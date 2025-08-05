import { IsString, IsNumber, IsBoolean, IsOptional, IsEnum, IsEmail, IsDateString, Min, Max, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum AlertType {
  CRITICAL = 'critical',
  POLLUTION = 'pollution',
  DAILY_SUMMARY = 'daily_summary',
  SYSTEM_HEALTH = 'system_health',
  WEEKLY_REPORT = 'weekly_report',
}

export enum AlertSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export class EmailDeliveryDto {
  @ApiProperty({ description: 'Unique delivery ID' })
  id: string;

  @ApiProperty({ description: 'Recipient email address' })
  to: string;

  @ApiProperty({ description: 'Email subject' })
  subject: string;

  @ApiProperty({ description: 'Delivery status', enum: ['pending', 'sent', 'failed', 'retrying'] })
  status: 'pending' | 'sent' | 'failed' | 'retrying';

  @ApiProperty({ description: 'Number of delivery attempts' })
  attempts: number;

  @ApiProperty({ description: 'Maximum number of retry attempts' })
  maxAttempts: number;

  @ApiPropertyOptional({ description: 'Timestamp when email was sent' })
  sentAt?: Date;

  @ApiPropertyOptional({ description: 'Error message if delivery failed' })
  error?: string;

  @ApiPropertyOptional({ description: 'Timestamp for next retry attempt' })
  retryAfter?: Date;
}

export class AlertHistoryDto {
  @ApiProperty({ description: 'Unique alert ID' })
  id: string;

  @ApiProperty({ description: 'Alert type', enum: AlertType })
  type: AlertType;

  @ApiProperty({ description: 'Alert severity', enum: AlertSeverity })
  severity: AlertSeverity;

  @ApiProperty({ description: 'Alert message' })
  message: string;

  @ApiProperty({ description: 'Alert data payload' })
  data: any;

  @ApiProperty({ description: 'Alert timestamp' })
  timestamp: Date;

  @ApiProperty({ description: 'Whether alert has been acknowledged' })
  acknowledged: boolean;

  @ApiPropertyOptional({ description: 'User who acknowledged the alert' })
  acknowledgedBy?: string;

  @ApiPropertyOptional({ description: 'Timestamp when alert was acknowledged' })
  acknowledgedAt?: Date;

  @ApiProperty({ description: 'Whether alert has been escalated' })
  escalated: boolean;

  @ApiPropertyOptional({ description: 'Timestamp when alert was escalated' })
  escalatedAt?: Date;

  @ApiProperty({ description: 'Email recipients' })
  recipients: string[];

  @ApiProperty({ description: 'Whether email was sent' })
  emailSent: boolean;

  @ApiPropertyOptional({ description: 'Email delivery ID' })
  emailDeliveryId?: string;
}

export class AlertThresholdDto {
  @ApiProperty({ description: 'Consecutive API failures threshold', minimum: 1, maximum: 100 })
  @IsNumber()
  @Min(1)
  @Max(100)
  consecutive_api_failures: number;

  @ApiProperty({ description: 'High pollution AQI threshold', minimum: 50, maximum: 300 })
  @IsNumber()
  @Min(50)
  @Max(300)
  high_pollution_aqi: number;

  @ApiProperty({ description: 'Extreme pollution AQI threshold', minimum: 100, maximum: 500 })
  @IsNumber()
  @Min(100)
  @Max(500)
  extreme_pollution_aqi: number;

  @ApiProperty({ description: 'Queue backlog size threshold', minimum: 10, maximum: 1000 })
  @IsNumber()
  @Min(10)
  @Max(1000)
  queue_backlog_size: number;

  @ApiProperty({ description: 'Daily summary time (HH:MM format)' })
  @IsString()
  daily_summary_time: string;

  @ApiProperty({ description: 'System error rate threshold (0-1)', minimum: 0, maximum: 1 })
  @IsNumber()
  @Min(0)
  @Max(1)
  system_error_rate: number;

  @ApiProperty({ description: 'Storage usage threshold (0-1)', minimum: 0, maximum: 1 })
  @IsNumber()
  @Min(0)
  @Max(1)
  storage_usage_threshold: number;

  @ApiProperty({ description: 'Email rate limit per hour', minimum: 10, maximum: 1000 })
  @IsNumber()
  @Min(10)
  @Max(1000)
  email_rate_limit: number;
}

export class UpdateThresholdsDto {
  @ApiPropertyOptional({ description: 'Consecutive API failures threshold' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  consecutive_api_failures?: number;

  @ApiPropertyOptional({ description: 'High pollution AQI threshold' })
  @IsOptional()
  @IsNumber()
  @Min(50)
  @Max(300)
  high_pollution_aqi?: number;

  @ApiPropertyOptional({ description: 'Extreme pollution AQI threshold' })
  @IsOptional()
  @IsNumber()
  @Min(100)
  @Max(500)
  extreme_pollution_aqi?: number;

  @ApiPropertyOptional({ description: 'Queue backlog size threshold' })
  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(1000)
  queue_backlog_size?: number;

  @ApiPropertyOptional({ description: 'Daily summary time (HH:MM format)' })
  @IsOptional()
  @IsString()
  daily_summary_time?: string;

  @ApiPropertyOptional({ description: 'System error rate threshold (0-1)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  system_error_rate?: number;

  @ApiPropertyOptional({ description: 'Storage usage threshold (0-1)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  storage_usage_threshold?: number;

  @ApiPropertyOptional({ description: 'Email rate limit per hour' })
  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(1000)
  email_rate_limit?: number;
}

export class AcknowledgeAlertDto {
  @ApiProperty({ description: 'User who is acknowledging the alert' })
  @IsString()
  acknowledgedBy: string;
}

export class SendEmailDto {
  @ApiProperty({ description: 'Recipient email address' })
  @IsEmail()
  to: string;

  @ApiProperty({ description: 'Email subject' })
  @IsString()
  subject: string;

  @ApiProperty({ description: 'Email HTML content' })
  @IsString()
  html: string;

  @ApiPropertyOptional({ description: 'Email text content' })
  @IsOptional()
  @IsString()
  text?: string;

  @ApiPropertyOptional({ description: 'Alert type for template generation', enum: AlertType })
  @IsOptional()
  @IsEnum(AlertType)
  alertType?: AlertType;
}

export class PollutionAlertDto {
  @ApiProperty({ description: 'City name' })
  @IsString()
  city: string;

  @ApiProperty({ description: 'Air Quality Index value', minimum: 0, maximum: 500 })
  @IsNumber()
  @Min(0)
  @Max(500)
  aqi: number;

  @ApiProperty({ description: 'Pollution level' })
  @IsString()
  level: string;

  @ApiProperty({ description: 'Dominant pollutant' })
  @IsString()
  pollutant: string;
}

export class DailySummaryDto {
  @ApiProperty({ description: 'City name' })
  @IsString()
  city: string;

  @ApiProperty({ description: 'Date in YYYY-MM-DD format' })
  @IsString()
  date: string;

  @ApiProperty({ description: 'Average AQI for the day' })
  @IsNumber()
  averageAQI: number;

  @ApiProperty({ description: 'Maximum AQI for the day' })
  @IsNumber()
  maxAQI: number;

  @ApiProperty({ description: 'Minimum AQI for the day' })
  @IsNumber()
  minAQI: number;

  @ApiProperty({ description: 'Dominant pollutant' })
  @IsString()
  dominantPollutant: string;

  @ApiProperty({ description: 'Air quality trend' })
  @IsString()
  trend: string;

  @ApiProperty({ description: 'Number of unhealthy hours' })
  @IsNumber()
  unhealthyHours: number;
}

export class WeeklyReportDto {
  @ApiProperty({ description: 'City name' })
  @IsString()
  city: string;

  @ApiProperty({ description: 'Week start date (YYYY-MM-DD)' })
  @IsString()
  weekStart: string;

  @ApiProperty({ description: 'Week end date (YYYY-MM-DD)' })
  @IsString()
  weekEnd: string;

  @ApiProperty({ description: 'Average AQI for the week' })
  @IsNumber()
  averageAQI: number;

  @ApiProperty({ description: 'Maximum AQI for the week' })
  @IsNumber()
  maxAQI: number;

  @ApiProperty({ description: 'Number of unhealthy days' })
  @IsNumber()
  unhealthyDays: number;

  @ApiProperty({ description: 'Dominant pollutant' })
  @IsString()
  dominantPollutant: string;

  @ApiProperty({ description: 'Weekly trend' })
  @IsString()
  trend: string;

  @ApiProperty({ description: 'Health recommendations' })
  @IsString({ each: true })
  recommendations: string[];
}

export class SystemHealthDto {
  @ApiProperty({ description: 'Timestamp of the health check' })
  @IsDateString()
  timestamp: Date;

  @ApiProperty({ description: 'Queue health information' })
  @ValidateNested({ each: true })
  @Type(() => QueueHealthDto)
  queueHealth: QueueHealthDto[];

  @ApiProperty({ description: 'Storage usage percentage (0-1)', minimum: 0, maximum: 1 })
  @IsNumber()
  @Min(0)
  @Max(1)
  storageUsage: number;

  @ApiProperty({ description: 'System error rate (0-1)', minimum: 0, maximum: 1 })
  @IsNumber()
  @Min(0)
  @Max(1)
  errorRate: number;

  @ApiProperty({ description: 'System uptime in milliseconds' })
  @IsNumber()
  uptime: number;
}

export class QueueHealthDto {
  @ApiProperty({ description: 'Queue name' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Number of waiting jobs' })
  @IsNumber()
  waiting: number;

  @ApiProperty({ description: 'Number of active jobs' })
  @IsNumber()
  active: number;

  @ApiProperty({ description: 'Number of failed jobs' })
  @IsNumber()
  failed: number;
}

export class AlertStatsDto {
  @ApiProperty({ description: 'Total number of alerts' })
  total: number;

  @ApiProperty({ description: 'Alerts by severity' })
  bySeverity: Record<string, number>;

  @ApiProperty({ description: 'Alerts by type' })
  byType: Record<string, number>;

  @ApiProperty({ description: 'Number of acknowledged alerts' })
  acknowledged: number;

  @ApiProperty({ description: 'Number of escalated alerts' })
  escalated: number;

  @ApiProperty({ description: 'Number of emails sent' })
  emailSent: number;

  @ApiProperty({ description: 'Number of alerts in last 24 hours' })
  last24Hours: number;
}

export class EmailStatsDto {
  @ApiProperty({ description: 'Total number of emails' })
  total: number;

  @ApiProperty({ description: 'Number of successfully sent emails' })
  sent: number;

  @ApiProperty({ description: 'Number of failed emails' })
  failed: number;

  @ApiProperty({ description: 'Number of pending emails' })
  pending: number;

  @ApiProperty({ description: 'Number of emails being retried' })
  retrying: number;
}

export class NotificationsHealthDto {
  @ApiProperty({ description: 'Service health status', enum: ['healthy', 'degraded', 'unhealthy'] })
  status: 'healthy' | 'degraded' | 'unhealthy';

  @ApiProperty({ description: 'Health check timestamp' })
  timestamp: Date;

  @ApiProperty({ description: 'Service version' })
  version: string;

  @ApiProperty({ description: 'Available features' })
  features: {
    emailService: boolean;
    alertService: boolean;
    rateLimiting: boolean;
    deliveryTracking: boolean;
  };

  @ApiProperty({ description: 'Service statistics' })
  stats: {
    activeAlerts: number;
    emailDeliveryRate: number;
    alertAcknowledgmentRate: number;
  };
}

export class AlertFiltersDto {
  @ApiPropertyOptional({ description: 'Alert type filter', enum: AlertType })
  @IsOptional()
  @IsEnum(AlertType)
  type?: AlertType;

  @ApiPropertyOptional({ description: 'Severity filter', enum: AlertSeverity })
  @IsOptional()
  @IsEnum(AlertSeverity)
  severity?: AlertSeverity;

  @ApiPropertyOptional({ description: 'Acknowledged filter' })
  @IsOptional()
  @IsBoolean()
  acknowledged?: boolean;

  @ApiPropertyOptional({ description: 'Escalated filter' })
  @IsOptional()
  @IsBoolean()
  escalated?: boolean;

  @ApiPropertyOptional({ description: 'Start date filter' })
  @IsOptional()
  @IsDateString()
  startDate?: Date;

  @ApiPropertyOptional({ description: 'End date filter' })
  @IsOptional()
  @IsDateString()
  endDate?: Date;

  @ApiPropertyOptional({ description: 'Number of alerts to return', minimum: 1, maximum: 1000 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000)
  limit?: number;
} 