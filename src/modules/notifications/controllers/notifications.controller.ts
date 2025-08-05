import { Controller, Get, Post, Put, Delete, Param, Body, Query, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';

import { EmailService, AlertType, EmailDelivery } from '../services/email.service';
import { AlertService, AlertHistory, AlertThreshold } from '../services/alert.service';
import { NotificationsService } from '../notifications.service';

export class AcknowledgeAlertDto {
  acknowledgedBy: string;
}

export class UpdateThresholdsDto {
  consecutive_api_failures?: number;
  high_pollution_aqi?: number;
  extreme_pollution_aqi?: number;
  queue_backlog_size?: number;
  daily_summary_time?: string;
  system_error_rate?: number;
  storage_usage_threshold?: number;
  email_rate_limit?: number;
}

export class SendEmailDto {
  to: string;
  subject: string;
  html: string;
  text?: string;
  alertType?: AlertType;
}

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  private readonly logger = new Logger(NotificationsController.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly alertService: AlertService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Get('alerts')
  @ApiOperation({ summary: 'Get alert history with filters' })
  @ApiQuery({ name: 'type', required: false, description: 'Alert type filter' })
  @ApiQuery({ name: 'severity', required: false, description: 'Severity filter' })
  @ApiQuery({ name: 'acknowledged', required: false, description: 'Acknowledged filter' })
  @ApiQuery({ name: 'escalated', required: false, description: 'Escalated filter' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of alerts to return' })
  @ApiResponse({ status: 200, description: 'Alert history retrieved successfully' })
  async getAlertHistory(
    @Query('type') type?: AlertType,
    @Query('severity') severity?: string,
    @Query('acknowledged') acknowledged?: boolean,
    @Query('escalated') escalated?: boolean,
    @Query('limit') limit?: number,
  ): Promise<AlertHistory[]> {
    this.logger.log('Fetching alert history with filters');
    
    const filters = {
      type,
      severity,
      acknowledged,
      escalated,
    };

    return this.alertService.getAlertHistory(filters, limit || 100);
  }

  @Get('alerts/active')
  @ApiOperation({ summary: 'Get active (unacknowledged) alerts' })
  @ApiResponse({ status: 200, description: 'Active alerts retrieved successfully' })
  async getActiveAlerts(): Promise<AlertHistory[]> {
    this.logger.log('Fetching active alerts');
    return this.alertService.getActiveAlerts();
  }

  @Get('alerts/stats')
  @ApiOperation({ summary: 'Get alert statistics' })
  @ApiResponse({ status: 200, description: 'Alert statistics retrieved successfully' })
  async getAlertStats(): Promise<{
    total: number;
    bySeverity: Record<string, number>;
    byType: Record<string, number>;
    acknowledged: number;
    escalated: number;
    emailSent: number;
    last24Hours: number;
  }> {
    this.logger.log('Fetching alert statistics');
    return this.alertService.getAlertStats();
  }

  @Get('alerts/:alertId')
  @ApiOperation({ summary: 'Get specific alert by ID' })
  @ApiParam({ name: 'alertId', description: 'Alert ID' })
  @ApiResponse({ status: 200, description: 'Alert retrieved successfully' })
  async getAlert(@Param('alertId') alertId: string): Promise<AlertHistory | null> {
    this.logger.log(`Fetching alert: ${alertId}`);
    
    const alerts = await this.alertService.getAlertHistory();
    return alerts.find(alert => alert.id === alertId) || null;
  }

  @Put('alerts/:alertId/acknowledge')
  @ApiOperation({ summary: 'Acknowledge an alert' })
  @ApiParam({ name: 'alertId', description: 'Alert ID' })
  @ApiResponse({ status: 200, description: 'Alert acknowledged successfully' })
  async acknowledgeAlert(
    @Param('alertId') alertId: string,
    @Body() acknowledgeDto: AcknowledgeAlertDto,
  ): Promise<AlertHistory | null> {
    this.logger.log(`Acknowledging alert: ${alertId} by ${acknowledgeDto.acknowledgedBy}`);
    return this.alertService.acknowledgeAlert(alertId, acknowledgeDto.acknowledgedBy);
  }

  @Get('alerts/thresholds')
  @ApiOperation({ summary: 'Get current alert thresholds' })
  @ApiResponse({ status: 200, description: 'Alert thresholds retrieved successfully' })
  async getAlertThresholds(): Promise<AlertThreshold> {
    this.logger.log('Fetching alert thresholds');
    return this.alertService.getAlertThresholds();
  }

  @Put('alerts/thresholds')
  @ApiOperation({ summary: 'Update alert thresholds' })
  @ApiResponse({ status: 200, description: 'Alert thresholds updated successfully' })
  async updateAlertThresholds(@Body() thresholdsDto: UpdateThresholdsDto): Promise<{ message: string }> {
    this.logger.log('Updating alert thresholds:', thresholdsDto);
    
    await this.alertService.updateAlertThresholds(thresholdsDto);
    
    return { message: 'Alert thresholds updated successfully' };
  }

  @Delete('alerts/clear')
  @ApiOperation({ summary: 'Clear old alerts' })
  @ApiQuery({ name: 'days', required: false, description: 'Number of days to keep (default: 30)' })
  @ApiResponse({ status: 200, description: 'Old alerts cleared successfully' })
  async clearOldAlerts(@Query('days') days?: number): Promise<{ message: string; deletedCount: number }> {
    this.logger.log(`Clearing old alerts (keeping ${days || 30} days)`);
    
    const deletedCount = await this.alertService.clearOldAlerts(days || 30);
    
    return {
      message: 'Old alerts cleared successfully',
      deletedCount,
    };
  }

  @Post('email/send')
  @ApiOperation({ summary: 'Send email notification' })
  @ApiResponse({ status: 200, description: 'Email sent successfully' })
  async sendEmail(@Body() sendEmailDto: SendEmailDto): Promise<EmailDelivery> {
    this.logger.log(`Sending email to ${sendEmailDto.to}`);
    
    return this.emailService.sendEmail(
      sendEmailDto.to,
      sendEmailDto.subject,
      sendEmailDto.html,
      sendEmailDto.text,
      sendEmailDto.alertType,
    );
  }

  @Get('email/delivery/:deliveryId')
  @ApiOperation({ summary: 'Get email delivery status' })
  @ApiParam({ name: 'deliveryId', description: 'Email delivery ID' })
  @ApiResponse({ status: 200, description: 'Email delivery status retrieved successfully' })
  async getEmailDeliveryStatus(@Param('deliveryId') deliveryId: string): Promise<EmailDelivery | null> {
    this.logger.log(`Fetching email delivery status: ${deliveryId}`);
    return this.emailService.getDeliveryStatus(deliveryId);
  }

  @Get('email/stats')
  @ApiOperation({ summary: 'Get email delivery statistics' })
  @ApiResponse({ status: 200, description: 'Email delivery statistics retrieved successfully' })
  async getEmailStats(): Promise<{
    total: number;
    sent: number;
    failed: number;
    pending: number;
    retrying: number;
  }> {
    this.logger.log('Fetching email delivery statistics');
    return this.emailService.getDeliveryStats();
  }

  @Post('alerts/trigger')
  @ApiOperation({ summary: 'Manually trigger alerts for testing' })
  @ApiResponse({ status: 200, description: 'Alerts triggered successfully' })
  async triggerAlerts(@Body() data: any): Promise<AlertHistory[]> {
    this.logger.log('Manually triggering alerts for testing');
    return this.alertService.checkAndTriggerAlerts(data);
  }

  @Post('alerts/pollution')
  @ApiOperation({ summary: 'Send pollution alert' })
  @ApiResponse({ status: 200, description: 'Pollution alert sent successfully' })
  async sendPollutionAlert(@Body() data: {
    city: string;
    aqi: number;
    level: string;
    pollutant: string;
  }): Promise<void> {
    this.logger.log(`Sending pollution alert for ${data.city} (AQI: ${data.aqi})`);
    
    await this.notificationsService.sendAirQualityAlert(
      data.city,
      data.aqi,
      data.level,
    );
  }

  @Post('alerts/daily-summary')
  @ApiOperation({ summary: 'Send daily summary alert' })
  @ApiResponse({ status: 200, description: 'Daily summary sent successfully' })
  async sendDailySummary(@Body() data: {
    city: string;
    date: string;
    averageAQI: number;
    maxAQI: number;
    minAQI: number;
    dominantPollutant: string;
    trend: string;
    unhealthyHours: number;
  }): Promise<void> {
    this.logger.log(`Sending daily summary for ${data.city} on ${data.date}`);
    await this.alertService.sendDailySummary(data);
  }

  @Post('alerts/weekly-report')
  @ApiOperation({ summary: 'Send weekly report alert' })
  @ApiResponse({ status: 200, description: 'Weekly report sent successfully' })
  async sendWeeklyReport(@Body() data: {
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
    this.logger.log(`Sending weekly report for ${data.city} (${data.weekStart} to ${data.weekEnd})`);
    await this.alertService.sendWeeklyReport(data);
  }

  @Post('alerts/system-health')
  @ApiOperation({ summary: 'Send system health alert' })
  @ApiResponse({ status: 200, description: 'System health alert sent successfully' })
  async sendSystemHealthAlert(@Body() data: {
    timestamp: Date;
    queueHealth: any[];
    storageUsage: number;
    errorRate: number;
    uptime: number;
  }): Promise<void> {
    this.logger.log('Sending system health alert');
    await this.alertService.sendSystemHealthAlert(data);
  }

  @Get('health')
  @ApiOperation({ summary: 'Get notifications service health status' })
  @ApiResponse({ status: 200, description: 'Notifications service health status' })
  async getHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: Date;
    version: string;
    features: {
      emailService: boolean;
      alertService: boolean;
      rateLimiting: boolean;
      deliveryTracking: boolean;
    };
    stats: {
      activeAlerts: number;
      emailDeliveryRate: number;
      alertAcknowledgmentRate: number;
    };
  }> {
    this.logger.log('Checking notifications service health');
    
    const [activeAlerts, emailStats, alertStats] = await Promise.all([
      this.alertService.getActiveAlerts(),
      this.emailService.getDeliveryStats(),
      this.alertService.getAlertStats(),
    ]);

    const emailDeliveryRate = emailStats.total > 0 ? emailStats.sent / emailStats.total : 0;
    const alertAcknowledgmentRate = alertStats.total > 0 ? alertStats.acknowledged / alertStats.total : 0;

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (emailDeliveryRate < 0.8 || activeAlerts.length > 10) {
      status = 'degraded';
    }
    
    if (emailDeliveryRate < 0.5 || activeAlerts.length > 50) {
      status = 'unhealthy';
    }

    return {
      status,
      timestamp: new Date(),
      version: '1.0.0',
      features: {
        emailService: true,
        alertService: true,
        rateLimiting: true,
        deliveryTracking: true,
      },
      stats: {
        activeAlerts: activeAlerts.length,
        emailDeliveryRate: emailDeliveryRate,
        alertAcknowledgmentRate: alertAcknowledgmentRate,
      },
    };
  }
} 