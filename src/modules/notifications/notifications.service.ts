import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface EmailAlert {
  to: string;
  subject: string;
  html: string;
  city: string;
  aqi: number;
  level: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private transporter: nodemailer.Transporter;

  constructor(
    @InjectQueue('notifications') private notificationsQueue: Queue,
    private configService: ConfigService,
  ) {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    const smtpConfig = this.configService.get('email.smtp');
    
    if (smtpConfig?.host && smtpConfig?.user && smtpConfig?.pass) {
      this.transporter = nodemailer.createTransporter({
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: false,
        auth: {
          user: smtpConfig.user,
          pass: smtpConfig.pass,
        },
      });
    }
  }

  async sendAirQualityAlert(city: string, aqi: number, level: string): Promise<void> {
    const adminEmail = this.configService.get<string>('email.adminEmail');
    
    if (!adminEmail) {
      this.logger.warn('Admin email not configured, skipping alert');
      return;
    }

    const alert: EmailAlert = {
      to: adminEmail,
      subject: `Air Quality Alert - ${city}`,
      html: this.generateAlertEmail(city, aqi, level),
      city,
      aqi,
      level,
    };

    await this.notificationsQueue.add('send-email-alert', alert);
  }

  async sendEmailAlert(alert: EmailAlert): Promise<void> {
    if (!this.transporter) {
      this.logger.error('Email transporter not configured');
      throw new Error('Email configuration not available');
    }

    try {
      await this.transporter.sendMail({
        from: this.configService.get('email.smtp.user'),
        to: alert.to,
        subject: alert.subject,
        html: alert.html,
      });

      this.logger.log(`Email alert sent successfully for ${alert.city}`);
    } catch (error) {
      this.logger.error(`Failed to send email alert for ${alert.city}:`, error);
      throw error;
    }
  }

  private generateAlertEmail(city: string, aqi: number, level: string): string {
    const color = this.getLevelColor(level);
    
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: ${color};">Air Quality Alert</h2>
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px;">
          <h3>City: ${city}</h3>
          <p><strong>AQI Level:</strong> <span style="color: ${color};">${level}</span></p>
          <p><strong>AQI Value:</strong> ${aqi}</p>
          <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
        </div>
        <div style="margin-top: 20px; padding: 15px; background-color: #e8f4fd; border-radius: 8px;">
          <h4>Health Recommendations:</h4>
          <ul>
            ${this.getHealthRecommendations(level)}
          </ul>
        </div>
      </div>
    `;
  }

  private getLevelColor(level: string): string {
    switch (level) {
      case 'Good': return '#00e400';
      case 'Moderate': return '#ffff00';
      case 'Unhealthy for Sensitive Groups': return '#ff7e00';
      case 'Unhealthy': return '#ff0000';
      case 'Very Unhealthy': return '#8f3f97';
      case 'Hazardous': return '#7e0023';
      default: return '#666666';
    }
  }

  private getHealthRecommendations(level: string): string {
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
} 