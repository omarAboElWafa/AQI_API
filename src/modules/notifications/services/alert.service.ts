import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Inject, CACHE_MANAGER } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { EmailService, AlertType } from './email.service';

export interface AlertThreshold {
  consecutive_api_failures: number;
  high_pollution_aqi: number;
  extreme_pollution_aqi: number;
  queue_backlog_size: number;
  daily_summary_time: string;
  system_error_rate: number;
  storage_usage_threshold: number;
  email_rate_limit: number;
}

export interface AlertCondition {
  id: string;
  type: AlertType;
  condition: (data: any) => boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  throttleMinutes: number;
  escalationMinutes: number;
  recipients: string[];
  template: string;
}

export interface AlertHistory {
  id: string;
  type: AlertType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  data: any;
  timestamp: Date;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  escalated: boolean;
  escalatedAt?: Date;
  recipients: string[];
  emailSent: boolean;
  emailDeliveryId?: string;
}

export interface AlertThrottle {
  alertId: string;
  lastTriggered: Date;
  count: number;
  escalated: boolean;
}

export interface AlertEscalation {
  alertId: string;
  originalRecipients: string[];
  escalatedRecipients: string[];
  escalationTime: Date;
  reason: string;
}

@Injectable()
export class AlertService {
  private readonly logger = new Logger(AlertService.name);
  private readonly alertHistory = new Map<string, AlertHistory>();
  private readonly alertThrottles = new Map<string, AlertThrottle>();
  private readonly alertEscalations = new Map<string, AlertEscalation>();

  // Default alert thresholds
  private readonly ALERT_THRESHOLDS: AlertThreshold = {
    consecutive_api_failures: 5,
    high_pollution_aqi: 150,
    extreme_pollution_aqi: 200,
    queue_backlog_size: 100,
    daily_summary_time: '23:30',
    system_error_rate: 0.1, // 10%
    storage_usage_threshold: 0.8, // 80%
    email_rate_limit: 50,
  };

  constructor(
    private configService: ConfigService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private emailService: EmailService,
  ) {
    this.initializeAlertConditions();
  }

  /**
   * Initialize alert conditions
   */
  private initializeAlertConditions(): void {
    this.alertConditions = [
      // Critical API failures
      {
        id: 'api_failures',
        type: AlertType.CRITICAL,
        condition: (data: { consecutiveFailures: number }) => 
          data.consecutiveFailures >= this.ALERT_THRESHOLDS.consecutive_api_failures,
        severity: 'critical',
        throttleMinutes: 30,
        escalationMinutes: 60,
        recipients: this.getAdminRecipients(),
        template: 'critical',
      },
      // High pollution alerts
      {
        id: 'high_pollution',
        type: AlertType.POLLUTION,
        condition: (data: { aqi: number }) => 
          data.aqi >= this.ALERT_THRESHOLDS.high_pollution_aqi && 
          data.aqi < this.ALERT_THRESHOLDS.extreme_pollution_aqi,
        severity: 'medium',
        throttleMinutes: 60,
        escalationMinutes: 120,
        recipients: this.getPollutionRecipients(),
        template: 'pollution',
      },
      // Extreme pollution alerts
      {
        id: 'extreme_pollution',
        type: AlertType.POLLUTION,
        condition: (data: { aqi: number }) => 
          data.aqi >= this.ALERT_THRESHOLDS.extreme_pollution_aqi,
        severity: 'high',
        throttleMinutes: 30,
        escalationMinutes: 60,
        recipients: this.getPollutionRecipients(),
        template: 'pollution',
      },
      // Queue backlog alerts
      {
        id: 'queue_backlog',
        type: AlertType.SYSTEM_HEALTH,
        condition: (data: { queueSize: number }) => 
          data.queueSize >= this.ALERT_THRESHOLDS.queue_backlog_size,
        severity: 'medium',
        throttleMinutes: 15,
        escalationMinutes: 45,
        recipients: this.getSystemRecipients(),
        template: 'system_health',
      },
      // System error rate alerts
      {
        id: 'system_error_rate',
        type: AlertType.SYSTEM_HEALTH,
        condition: (data: { errorRate: number }) => 
          data.errorRate >= this.ALERT_THRESHOLDS.system_error_rate,
        severity: 'high',
        throttleMinutes: 10,
        escalationMinutes: 30,
        recipients: this.getSystemRecipients(),
        template: 'system_health',
      },
      // Storage usage alerts
      {
        id: 'storage_usage',
        type: AlertType.SYSTEM_HEALTH,
        condition: (data: { storageUsage: number }) => 
          data.storageUsage >= this.ALERT_THRESHOLDS.storage_usage_threshold,
        severity: 'medium',
        throttleMinutes: 60,
        escalationMinutes: 180,
        recipients: this.getSystemRecipients(),
        template: 'system_health',
      },
    ];
  }

  private alertConditions: AlertCondition[] = [];

  /**
   * Check and trigger alerts based on conditions
   */
  async checkAndTriggerAlerts(data: any): Promise<AlertHistory[]> {
    const triggeredAlerts: AlertHistory[] = [];

    for (const condition of this.alertConditions) {
      if (condition.condition(data)) {
        const alert = await this.triggerAlert(condition, data);
        if (alert) {
          triggeredAlerts.push(alert);
        }
      }
    }

    return triggeredAlerts;
  }

  /**
   * Trigger a specific alert
   */
  async triggerAlert(condition: AlertCondition, data: any): Promise<AlertHistory | null> {
    const alertId = `${condition.id}_${Date.now()}`;
    
    // Check throttling
    if (this.isThrottled(condition.id, condition.throttleMinutes)) {
      this.logger.debug(`Alert ${condition.id} is throttled`);
      return null;
    }

    // Check if escalation is needed
    const shouldEscalate = this.shouldEscalate(condition.id, condition.escalationMinutes);
    const recipients = shouldEscalate 
      ? this.getEscalatedRecipients(condition.recipients)
      : condition.recipients;

    // Create alert history
    const alert: AlertHistory = {
      id: alertId,
      type: condition.type,
      severity: condition.severity,
      message: this.generateAlertMessage(condition, data),
      data,
      timestamp: new Date(),
      acknowledged: false,
      escalated: shouldEscalate,
      escalatedAt: shouldEscalate ? new Date() : undefined,
      recipients,
      emailSent: false,
    };

    // Store alert history
    this.alertHistory.set(alertId, alert);

    // Update throttle
    this.updateThrottle(condition.id);

    // Send email notification
    try {
      const emailDelivery = await this.sendAlertEmail(alert, condition, data);
      alert.emailSent = true;
      alert.emailDeliveryId = emailDelivery.id;
      this.alertHistory.set(alertId, alert);
    } catch (error) {
      this.logger.error(`Failed to send alert email for ${condition.id}:`, error);
    }

    this.logger.log(`Alert triggered: ${condition.id} (${condition.severity})`);
    return alert;
  }

  /**
   * Send alert email
   */
  private async sendAlertEmail(alert: AlertHistory, condition: AlertCondition, data: any): Promise<any> {
    const template = this.emailService.generateEmailTemplate(condition.type, {
      ...data,
      alertId: alert.id,
      severity: condition.severity,
      timestamp: alert.timestamp,
    });

    return await this.emailService.sendEmail(
      alert.recipients.join(', '),
      template.subject,
      template.html,
      template.text,
      condition.type,
    );
  }

  /**
   * Check if alert is throttled
   */
  private isThrottled(alertId: string, throttleMinutes: number): boolean {
    const throttle = this.alertThrottles.get(alertId);
    if (!throttle) return false;

    const now = new Date();
    const throttleWindow = new Date(now.getTime() - throttleMinutes * 60 * 1000);

    return throttle.lastTriggered > throttleWindow;
  }

  /**
   * Update alert throttle
   */
  private updateThrottle(alertId: string): void {
    const throttle = this.alertThrottles.get(alertId) || {
      alertId,
      lastTriggered: new Date(),
      count: 0,
      escalated: false,
    };

    throttle.lastTriggered = new Date();
    throttle.count++;
    this.alertThrottles.set(alertId, throttle);
  }

  /**
   * Check if alert should be escalated
   */
  private shouldEscalate(alertId: string, escalationMinutes: number): boolean {
    const throttle = this.alertThrottles.get(alertId);
    if (!throttle) return false;

    const now = new Date();
    const escalationWindow = new Date(now.getTime() - escalationMinutes * 60 * 1000);

    // Escalate if alert has been triggered multiple times within escalation window
    return throttle.count > 3 && throttle.lastTriggered > escalationWindow;
  }

  /**
   * Get escalated recipients
   */
  private getEscalatedRecipients(originalRecipients: string[]): string[] {
    const escalationRecipients = this.configService.get<string[]>('alerts.escalationRecipients', []);
    return [...new Set([...originalRecipients, ...escalationRecipients])];
  }

  /**
   * Generate alert message
   */
  private generateAlertMessage(condition: AlertCondition, data: any): string {
    switch (condition.id) {
      case 'api_failures':
        return `API failures detected: ${data.consecutiveFailures} consecutive failures`;
      case 'high_pollution':
        return `High pollution alert: AQI ${data.aqi} in ${data.city}`;
      case 'extreme_pollution':
        return `Extreme pollution alert: AQI ${data.aqi} in ${data.city}`;
      case 'queue_backlog':
        return `Queue backlog detected: ${data.queueSize} jobs waiting`;
      case 'system_error_rate':
        return `High error rate detected: ${(data.errorRate * 100).toFixed(2)}%`;
      case 'storage_usage':
        return `High storage usage: ${(data.storageUsage * 100).toFixed(2)}%`;
      default:
        return `Alert triggered: ${condition.id}`;
    }
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<AlertHistory | null> {
    const alert = this.alertHistory.get(alertId);
    if (!alert) {
      return null;
    }

    alert.acknowledged = true;
    alert.acknowledgedBy = acknowledgedBy;
    alert.acknowledgedAt = new Date();

    this.alertHistory.set(alertId, alert);
    this.logger.log(`Alert ${alertId} acknowledged by ${acknowledgedBy}`);

    return alert;
  }

  /**
   * Get alert history
   */
  async getAlertHistory(
    filters?: {
      type?: AlertType;
      severity?: string;
      acknowledged?: boolean;
      escalated?: boolean;
      startDate?: Date;
      endDate?: Date;
    },
    limit: number = 100,
  ): Promise<AlertHistory[]> {
    let alerts = Array.from(this.alertHistory.values());

    // Apply filters
    if (filters?.type) {
      alerts = alerts.filter(alert => alert.type === filters.type);
    }
    if (filters?.severity) {
      alerts = alerts.filter(alert => alert.severity === filters.severity);
    }
    if (filters?.acknowledged !== undefined) {
      alerts = alerts.filter(alert => alert.acknowledged === filters.acknowledged);
    }
    if (filters?.escalated !== undefined) {
      alerts = alerts.filter(alert => alert.escalated === filters.escalated);
    }
    if (filters?.startDate) {
      alerts = alerts.filter(alert => alert.timestamp >= filters.startDate);
    }
    if (filters?.endDate) {
      alerts = alerts.filter(alert => alert.timestamp <= filters.endDate);
    }

    // Sort by timestamp (newest first) and limit
    return alerts
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get alert statistics
   */
  async getAlertStats(): Promise<{
    total: number;
    bySeverity: Record<string, number>;
    byType: Record<string, number>;
    acknowledged: number;
    escalated: number;
    emailSent: number;
    last24Hours: number;
  }> {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const alerts = Array.from(this.alertHistory.values());
    const recentAlerts = alerts.filter(alert => alert.timestamp >= oneDayAgo);

    const stats = {
      total: alerts.length,
      bySeverity: {} as Record<string, number>,
      byType: {} as Record<string, number>,
      acknowledged: 0,
      escalated: 0,
      emailSent: 0,
      last24Hours: recentAlerts.length,
    };

    for (const alert of alerts) {
      stats.bySeverity[alert.severity] = (stats.bySeverity[alert.severity] || 0) + 1;
      stats.byType[alert.type] = (stats.byType[alert.type] || 0) + 1;
      if (alert.acknowledged) stats.acknowledged++;
      if (alert.escalated) stats.escalated++;
      if (alert.emailSent) stats.emailSent++;
    }

    return stats;
  }

  /**
   * Get active alerts (not acknowledged)
   */
  async getActiveAlerts(): Promise<AlertHistory[]> {
    return Array.from(this.alertHistory.values())
      .filter(alert => !alert.acknowledged)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Clear old alert history
   */
  async clearOldAlerts(daysToKeep: number = 30): Promise<number> {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
    let deletedCount = 0;

    for (const [alertId, alert] of this.alertHistory.entries()) {
      if (alert.timestamp < cutoffDate) {
        this.alertHistory.delete(alertId);
        deletedCount++;
      }
    }

    this.logger.log(`Cleared ${deletedCount} old alerts (older than ${daysToKeep} days)`);
    return deletedCount;
  }

  /**
   * Update alert thresholds
   */
  async updateAlertThresholds(newThresholds: Partial<AlertThreshold>): Promise<void> {
    Object.assign(this.ALERT_THRESHOLDS, newThresholds);
    this.logger.log('Alert thresholds updated:', newThresholds);
  }

  /**
   * Get current alert thresholds
   */
  getAlertThresholds(): AlertThreshold {
    return { ...this.ALERT_THRESHOLDS };
  }

  /**
   * Get admin recipients
   */
  private getAdminRecipients(): string[] {
    return this.configService.get<string[]>('alerts.adminRecipients', [
      this.configService.get<string>('email.adminEmail', 'admin@example.com'),
    ]);
  }

  /**
   * Get pollution alert recipients
   */
  private getPollutionRecipients(): string[] {
    return this.configService.get<string[]>('alerts.pollutionRecipients', [
      this.configService.get<string>('email.adminEmail', 'admin@example.com'),
    ]);
  }

  /**
   * Get system health recipients
   */
  private getSystemRecipients(): string[] {
    return this.configService.get<string[]>('alerts.systemRecipients', [
      this.configService.get<string>('email.adminEmail', 'admin@example.com'),
    ]);
  }

  /**
   * Send daily summary alert
   */
  async sendDailySummary(data: {
    city: string;
    date: string;
    averageAQI: number;
    maxAQI: number;
    minAQI: number;
    dominantPollutant: string;
    trend: string;
    unhealthyHours: number;
  }): Promise<void> {
    const recipients = this.getPollutionRecipients();
    const template = this.emailService.generateEmailTemplate(AlertType.DAILY_SUMMARY, data);

    await this.emailService.sendEmail(
      recipients.join(', '),
      template.subject,
      template.html,
      template.text,
      AlertType.DAILY_SUMMARY,
    );

    this.logger.log(`Daily summary sent for ${data.city} on ${data.date}`);
  }

  /**
   * Send weekly report alert
   */
  async sendWeeklyReport(data: {
    city: string;
    weekStart: string;
    weekEnd: string;
    averageAQI: number;
    maxAQI: number;
    unhealthyDays: number;
    dominantPollutant: string;
    trend: string;
    recommendations: string[];
  }): Promise<void> {
    const recipients = this.getPollutionRecipients();
    const template = this.emailService.generateEmailTemplate(AlertType.WEEKLY_REPORT, data);

    await this.emailService.sendEmail(
      recipients.join(', '),
      template.subject,
      template.html,
      template.text,
      AlertType.WEEKLY_REPORT,
    );

    this.logger.log(`Weekly report sent for ${data.city} (${data.weekStart} to ${data.weekEnd})`);
  }

  /**
   * Send system health alert
   */
  async sendSystemHealthAlert(data: {
    timestamp: Date;
    queueHealth: any[];
    storageUsage: number;
    errorRate: number;
    uptime: number;
  }): Promise<void> {
    const recipients = this.getSystemRecipients();
    const template = this.emailService.generateEmailTemplate(AlertType.SYSTEM_HEALTH, data);

    await this.emailService.sendEmail(
      recipients.join(', '),
      template.subject,
      template.html,
      template.text,
      AlertType.SYSTEM_HEALTH,
    );

    this.logger.log(`System health alert sent at ${data.timestamp.toLocaleString()}`);
  }
} 