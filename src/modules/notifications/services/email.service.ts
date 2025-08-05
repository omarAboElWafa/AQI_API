import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from '@nestjs/cache-manager';

export interface EmailTemplate {
  subject: string;
  html: string;
  text?: string;
}

export interface EmailDelivery {
  id: string;
  to: string;
  subject: string;
  status: 'pending' | 'sent' | 'failed' | 'retrying';
  attempts: number;
  maxAttempts: number;
  sentAt?: Date;
  error?: string;
  retryAfter?: Date;
}

export interface EmailRateLimit {
  recipient: string;
  lastSent: Date;
  count: number;
  windowStart: Date;
}

export enum AlertType {
  CRITICAL = 'critical',
  POLLUTION = 'pollution',
  DAILY_SUMMARY = 'daily_summary',
  SYSTEM_HEALTH = 'system_health',
  WEEKLY_REPORT = 'weekly_report',
}

export interface EmailConfig {
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
  };
  from: string;
  adminEmail: string;
  rateLimit: {
    maxEmailsPerHour: number;
    maxEmailsPerDay: number;
    retryAttempts: number;
    retryDelay: number;
  };
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;
  private readonly rateLimits = new Map<string, EmailRateLimit>();
  private readonly deliveryTracking = new Map<string, EmailDelivery>();

  constructor(
    private configService: ConfigService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache
  ) {
    this.initializeTransporter();
  }

  /**
   * Initialize Nodemailer transporter with SMTP settings
   */
  private initializeTransporter(): void {
    const emailConfig = this.configService.get<EmailConfig>('email');

    if (!emailConfig?.smtp?.host) {
      this.logger.warn(
        'SMTP configuration not found, email service will be disabled'
      );
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: emailConfig.smtp.host,
        port: emailConfig.smtp.port,
        secure: emailConfig.smtp.secure,
        auth: {
          user: emailConfig.smtp.user,
          pass: emailConfig.smtp.pass,
        },
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
        rateLimit: 14, // 14 messages per second
      });

      this.logger.log('Email transporter initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize email transporter:', error);
    }
  }

  /**
   * Send email with rate limiting and delivery tracking
   */
  async sendEmail(
    to: string,
    subject: string,
    html: string,
    text?: string,
    alertType?: AlertType
  ): Promise<EmailDelivery> {
    const deliveryId = this.generateDeliveryId();
    const delivery: EmailDelivery = {
      id: deliveryId,
      to,
      subject,
      status: 'pending',
      attempts: 0,
      maxAttempts: this.configService.get('email.rateLimit.retryAttempts', 3),
    };

    // Check rate limiting
    if (!this.checkRateLimit(to)) {
      delivery.status = 'failed';
      delivery.error = 'Rate limit exceeded';
      this.deliveryTracking.set(deliveryId, delivery);
      throw new Error(`Rate limit exceeded for ${to}`);
    }

    // Track delivery
    this.deliveryTracking.set(deliveryId, delivery);

    try {
      await this.sendEmailWithRetry(delivery, html, text);
      return delivery;
    } catch (error) {
      delivery.status = 'failed';
      delivery.error = error.message;
      this.deliveryTracking.set(deliveryId, delivery);
      throw error;
    }
  }

  /**
   * Send email with retry logic
   */
  private async sendEmailWithRetry(
    delivery: EmailDelivery,
    html: string,
    text?: string
  ): Promise<void> {
    const maxAttempts = delivery.maxAttempts;
    const retryDelay = this.configService.get(
      'email.rateLimit.retryDelay',
      5000
    );

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        delivery.attempts = attempt;
        delivery.status = attempt > 1 ? 'retrying' : 'pending';

        await this.transporter.sendMail({
          from: this.configService.get('email.from'),
          to: delivery.to,
          subject: delivery.subject,
          html,
          text,
        });

        delivery.status = 'sent';
        delivery.sentAt = new Date();
        this.logger.log(
          `Email sent successfully to ${delivery.to} (attempt ${attempt})`
        );
        return;
      } catch (error) {
        this.logger.error(
          `Email send attempt ${attempt} failed for ${delivery.to}:`,
          error
        );

        if (attempt === maxAttempts) {
          delivery.status = 'failed';
          delivery.error = error.message;
          throw error;
        }

        // Wait before retry
        await this.delay(retryDelay * attempt);
      }
    }
  }

  /**
   * Check rate limiting for recipient
   */
  private checkRateLimit(recipient: string): boolean {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const rateLimit = this.rateLimits.get(recipient);
    const config = this.configService.get('email.rateLimit');

    if (!rateLimit) {
      this.rateLimits.set(recipient, {
        recipient,
        lastSent: now,
        count: 1,
        windowStart: now,
      });
      return true;
    }

    // Reset counters if window has passed
    if (rateLimit.windowStart < oneHourAgo) {
      rateLimit.count = 0;
      rateLimit.windowStart = now;
    }

    // Check hourly limit
    if (rateLimit.count >= config.maxEmailsPerHour) {
      return false;
    }

    // Check daily limit (simplified - in production you'd track daily counts separately)
    const dailyCount = this.getDailyEmailCount(recipient);
    if (dailyCount >= config.maxEmailsPerDay) {
      return false;
    }

    // Update rate limit
    rateLimit.count++;
    rateLimit.lastSent = now;
    this.rateLimits.set(recipient, rateLimit);

    return true;
  }

  /**
   * Get daily email count for recipient
   */
  private getDailyEmailCount(recipient: string): number {
    // In a production environment, this would query a database
    // For now, we'll use a simplified approach
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    let count = 0;

    for (const delivery of this.deliveryTracking.values()) {
      if (
        delivery.to === recipient &&
        delivery.sentAt &&
        delivery.sentAt > oneDayAgo
      ) {
        count++;
      }
    }

    return count;
  }

  /**
   * Generate email templates for different alert types
   */
  generateEmailTemplate(alertType: AlertType, data: any): EmailTemplate {
    switch (alertType) {
      case AlertType.CRITICAL:
        return this.generateCriticalAlertTemplate(data);
      case AlertType.POLLUTION:
        return this.generatePollutionAlertTemplate(data);
      case AlertType.DAILY_SUMMARY:
        return this.generateDailySummaryTemplate(data);
      case AlertType.SYSTEM_HEALTH:
        return this.generateSystemHealthTemplate(data);
      case AlertType.WEEKLY_REPORT:
        return this.generateWeeklyReportTemplate(data);
      default:
        throw new Error(`Unknown alert type: ${alertType}`);
    }
  }

  /**
   * Critical Alert Template
   */
  private generateCriticalAlertTemplate(data: {
    error: string;
    component: string;
    timestamp: Date;
    severity: 'high' | 'medium' | 'low';
  }): EmailTemplate {
    const color =
      data.severity === 'high'
        ? '#ff0000'
        : data.severity === 'medium'
          ? '#ff7e00'
          : '#ffff00';

    return {
      subject: `🚨 Critical Alert - ${data.component}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: ${color}; color: white; padding: 20px; border-radius: 8px;">
            <h2>🚨 Critical System Alert</h2>
            <p><strong>Component:</strong> ${data.component}</p>
            <p><strong>Severity:</strong> ${data.severity.toUpperCase()}</p>
            <p><strong>Time:</strong> ${data.timestamp.toLocaleString()}</p>
          </div>
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin-top: 20px;">
            <h3>Error Details:</h3>
            <pre style="background-color: #fff; padding: 10px; border-radius: 4px; overflow-x: auto;">${data.error}</pre>
          </div>
          <div style="margin-top: 20px; padding: 15px; background-color: #e8f4fd; border-radius: 8px;">
            <h4>Immediate Actions Required:</h4>
            <ul>
              <li>Check system logs for additional details</li>
              <li>Verify component connectivity</li>
              <li>Review recent configuration changes</li>
              <li>Contact system administrator if needed</li>
            </ul>
          </div>
        </div>
      `,
    };
  }

  /**
   * Pollution Alert Template
   */
  private generatePollutionAlertTemplate(data: {
    city: string;
    aqi: number;
    level: string;
    pollutant: string;
    timestamp: Date;
  }): EmailTemplate {
    const color = this.getPollutionLevelColor(data.level);
    const recommendations = this.getPollutionRecommendations(data.level);

    return {
      subject: `⚠️ Air Quality Alert - ${data.city} (AQI: ${data.aqi})`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: ${color}; color: white; padding: 20px; border-radius: 8px;">
            <h2>⚠️ Air Quality Alert</h2>
            <p><strong>City:</strong> ${data.city}</p>
            <p><strong>AQI Level:</strong> ${data.level}</p>
            <p><strong>AQI Value:</strong> ${data.aqi}</p>
            <p><strong>Dominant Pollutant:</strong> ${data.pollutant}</p>
            <p><strong>Time:</strong> ${data.timestamp.toLocaleString()}</p>
          </div>
          <div style="margin-top: 20px; padding: 15px; background-color: #e8f4fd; border-radius: 8px;">
            <h4>Health Recommendations:</h4>
            <ul>
              ${recommendations}
            </ul>
          </div>
        </div>
      `,
    };
  }

  /**
   * Daily Summary Template
   */
  private generateDailySummaryTemplate(data: {
    city: string;
    date: string;
    averageAQI: number;
    maxAQI: number;
    minAQI: number;
    dominantPollutant: string;
    trend: string;
    unhealthyHours: number;
  }): EmailTemplate {
    return {
      subject: `📊 Daily Air Quality Summary - ${data.city} (${data.date})`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>📊 Daily Air Quality Summary</h2>
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px;">
            <h3>${data.city} - ${data.date}</h3>
            <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
              <tr style="background-color: #e8f4fd;">
                <td style="padding: 10px; border: 1px solid #ddd;"><strong>Average AQI</strong></td>
                <td style="padding: 10px; border: 1px solid #ddd;">${data.averageAQI}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border: 1px solid #ddd;"><strong>Maximum AQI</strong></td>
                <td style="padding: 10px; border: 1px solid #ddd;">${data.maxAQI}</td>
              </tr>
              <tr style="background-color: #e8f4fd;">
                <td style="padding: 10px; border: 1px solid #ddd;"><strong>Minimum AQI</strong></td>
                <td style="padding: 10px; border: 1px solid #ddd;">${data.minAQI}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border: 1px solid #ddd;"><strong>Dominant Pollutant</strong></td>
                <td style="padding: 10px; border: 1px solid #ddd;">${data.dominantPollutant}</td>
              </tr>
              <tr style="background-color: #e8f4fd;">
                <td style="padding: 10px; border: 1px solid #ddd;"><strong>Trend</strong></td>
                <td style="padding: 10px; border: 1px solid #ddd;">${data.trend}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border: 1px solid #ddd;"><strong>Unhealthy Hours</strong></td>
                <td style="padding: 10px; border: 1px solid #ddd;">${data.unhealthyHours}</td>
              </tr>
            </table>
          </div>
        </div>
      `,
    };
  }

  /**
   * System Health Template
   */
  private generateSystemHealthTemplate(data: {
    timestamp: Date;
    queueHealth: any[];
    storageUsage: number;
    errorRate: number;
    uptime: number;
  }): EmailTemplate {
    const healthColor =
      data.errorRate < 0.05
        ? '#00e400'
        : data.errorRate < 0.1
          ? '#ffff00'
          : '#ff0000';

    return {
      subject: `🔧 System Health Report - ${data.timestamp.toLocaleDateString()}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>🔧 System Health Report</h2>
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px;">
            <p><strong>Report Time:</strong> ${data.timestamp.toLocaleString()}</p>
            <p><strong>System Uptime:</strong> ${Math.floor(data.uptime / 3600000)} hours</p>
            <p><strong>Error Rate:</strong> <span style="color: ${healthColor};">${(data.errorRate * 100).toFixed(2)}%</span></p>
            <p><strong>Storage Usage:</strong> ${data.storageUsage.toFixed(2)}%</p>
          </div>
          <div style="margin-top: 20px;">
            <h3>Queue Health Status:</h3>
            ${data.queueHealth
              .map(
                queue => `
              <div style="background-color: #e8f4fd; padding: 15px; border-radius: 8px; margin-bottom: 10px;">
                <h4>${queue.name}</h4>
                <p>Waiting: ${queue.waiting} | Active: ${queue.active} | Failed: ${queue.failed}</p>
              </div>
            `
              )
              .join('')}
          </div>
        </div>
      `,
    };
  }

  /**
   * Weekly Report Template
   */
  private generateWeeklyReportTemplate(data: {
    city: string;
    weekStart: string;
    weekEnd: string;
    averageAQI: number;
    maxAQI: number;
    unhealthyDays: number;
    dominantPollutant: string;
    trend: string;
    recommendations: string[];
  }): EmailTemplate {
    return {
      subject: `📈 Weekly Air Quality Report - ${data.city} (${data.weekStart} to ${data.weekEnd})`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>📈 Weekly Air Quality Report</h2>
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px;">
            <h3>${data.city} - Week of ${data.weekStart} to ${data.weekEnd}</h3>
            <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
              <tr style="background-color: #e8f4fd;">
                <td style="padding: 10px; border: 1px solid #ddd;"><strong>Weekly Average AQI</strong></td>
                <td style="padding: 10px; border: 1px solid #ddd;">${data.averageAQI}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border: 1px solid #ddd;"><strong>Peak AQI</strong></td>
                <td style="padding: 10px; border: 1px solid #ddd;">${data.maxAQI}</td>
              </tr>
              <tr style="background-color: #e8f4fd;">
                <td style="padding: 10px; border: 1px solid #ddd;"><strong>Unhealthy Days</strong></td>
                <td style="padding: 10px; border: 1px solid #ddd;">${data.unhealthyDays}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border: 1px solid #ddd;"><strong>Dominant Pollutant</strong></td>
                <td style="padding: 10px; border: 1px solid #ddd;">${data.dominantPollutant}</td>
              </tr>
              <tr style="background-color: #e8f4fd;">
                <td style="padding: 10px; border: 1px solid #ddd;"><strong>Weekly Trend</strong></td>
                <td style="padding: 10px; border: 1px solid #ddd;">${data.trend}</td>
              </tr>
            </table>
          </div>
          <div style="margin-top: 20px; padding: 15px; background-color: #e8f4fd; border-radius: 8px;">
            <h4>Weekly Recommendations:</h4>
            <ul>
              ${data.recommendations.map(rec => `<li>${rec}</li>`).join('')}
            </ul>
          </div>
        </div>
      `,
    };
  }

  /**
   * Get pollution level color
   */
  private getPollutionLevelColor(level: string): string {
    switch (level) {
      case 'Good':
        return '#00e400';
      case 'Moderate':
        return '#ffff00';
      case 'Unhealthy for Sensitive Groups':
        return '#ff7e00';
      case 'Unhealthy':
        return '#ff0000';
      case 'Very Unhealthy':
        return '#8f3f97';
      case 'Hazardous':
        return '#7e0023';
      default:
        return '#666666';
    }
  }

  /**
   * Get pollution recommendations
   */
  private getPollutionRecommendations(level: string): string {
    switch (level) {
      case 'Good':
        return '<li>Air quality is considered satisfactory</li><li>Air pollution poses little or no risk</li>';
      case 'Moderate':
        return '<li>Air quality is acceptable</li><li>Some pollutants may be a concern for a small number of people</li>';
      case 'Unhealthy for Sensitive Groups':
        return '<li>Members of sensitive groups may experience health effects</li><li>General public is not likely to be affected</li>';
      case 'Unhealthy':
        return '<li>Some members of the general public may experience health effects</li><li>Members of sensitive groups may experience more serious effects</li>';
      case 'Very Unhealthy':
        return '<li>Health alert: everyone may experience more serious health effects</li><li>Members of sensitive groups may experience more serious effects</li>';
      case 'Hazardous':
        return '<li>Health warning of emergency conditions</li><li>Everyone is more likely to be affected</li>';
      default:
        return '<li>Please check local air quality guidelines</li>';
    }
  }

  /**
   * Get delivery status
   */
  async getDeliveryStatus(deliveryId: string): Promise<EmailDelivery | null> {
    return this.deliveryTracking.get(deliveryId) || null;
  }

  /**
   * Get delivery statistics
   */
  async getDeliveryStats(): Promise<{
    total: number;
    sent: number;
    failed: number;
    pending: number;
    retrying: number;
  }> {
    const stats = { total: 0, sent: 0, failed: 0, pending: 0, retrying: 0 };

    for (const delivery of this.deliveryTracking.values()) {
      stats.total++;
      stats[delivery.status]++;
    }

    return stats;
  }

  /**
   * Generate unique delivery ID
   */
  private generateDeliveryId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Delay utility for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
