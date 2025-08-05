# Email Notification & Alerting System

## Overview

The Email Notification & Alerting System provides comprehensive email-based notifications and alerting capabilities for the AQI API. It includes configurable alert thresholds, rate limiting, delivery tracking, and escalation logic.

## Architecture

### Core Components

1. **EmailService** (`src/modules/notifications/services/email.service.ts`)
   - Nodemailer integration with SMTP configuration
   - Email templates for different alert types
   - Rate limiting and delivery tracking
   - Retry logic with exponential backoff

2. **AlertService** (`src/modules/notifications/services/alert.service.ts`)
   - Alert condition monitoring and triggering
   - Alert throttling and escalation
   - Alert history tracking and acknowledgment
   - Configurable thresholds and recipients

3. **NotificationsController** (`src/modules/notifications/controllers/notifications.controller.ts`)
   - REST API endpoints for alert management
   - Email delivery status monitoring
   - Alert statistics and health checks

## Alert Types

### 1. Critical Alerts
- **Purpose**: System failures, API errors, database issues
- **Severity**: Critical
- **Threshold**: 5 consecutive API failures
- **Throttle**: 30 minutes
- **Escalation**: 60 minutes

### 2. Pollution Alerts
- **High Pollution**: AQI ≥ 150
- **Extreme Pollution**: AQI ≥ 200
- **Severity**: Medium/High
- **Throttle**: 60/30 minutes
- **Escalation**: 120/60 minutes

### 3. Daily Summary Alerts
- **Purpose**: Daily air quality statistics
- **Schedule**: Daily at 23:30
- **Content**: Average, max, min AQI, trends, recommendations

### 4. System Health Alerts
- **Queue Backlog**: > 100 jobs waiting
- **Error Rate**: > 10% system errors
- **Storage Usage**: > 80% disk usage
- **Severity**: Medium/High

### 5. Weekly Report Alerts
- **Purpose**: Weekly aggregated pollution trends
- **Schedule**: Weekly on Sunday
- **Content**: Weekly statistics, trends, recommendations

## Configuration

### Environment Variables

```bash
# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Email Settings
EMAIL_FROM=noreply@aqi-api.com
ADMIN_EMAIL=admin@aqi-api.com

# Rate Limiting
EMAIL_RATE_LIMIT_HOUR=50
EMAIL_RATE_LIMIT_DAY=1000
EMAIL_RETRY_ATTEMPTS=3
EMAIL_RETRY_DELAY=5000

# Alert Thresholds
ALERT_API_FAILURES=5
ALERT_HIGH_POLLUTION_AQI=150
ALERT_EXTREME_POLLUTION_AQI=200
ALERT_QUEUE_BACKLOG=100
ALERT_DAILY_SUMMARY_TIME=23:30
ALERT_SYSTEM_ERROR_RATE=0.1
ALERT_STORAGE_USAGE=0.8
ALERT_EMAIL_RATE_LIMIT=50

# Alert Recipients
ALERT_ADMIN_RECIPIENTS=admin@aqi-api.com,manager@aqi-api.com
ALERT_POLLUTION_RECIPIENTS=admin@aqi-api.com,health@aqi-api.com
ALERT_SYSTEM_RECIPIENTS=admin@aqi-api.com,ops@aqi-api.com
ALERT_ESCALATION_RECIPIENTS=admin@aqi-api.com,emergency@aqi-api.com

# Throttling
ALERT_THROTTLE_MINUTES=30
ALERT_ESCALATION_MINUTES=60
ALERT_MAX_PER_HOUR=10

# Retention
ALERT_RETENTION_DAYS=30
EMAIL_RETENTION_DAYS=7
THROTTLE_RESET_HOURS=24

# Features
ENABLE_EMAIL_NOTIFICATIONS=true
ENABLE_ALERT_ESCALATION=true
ENABLE_RATE_LIMITING=true
ENABLE_DELIVERY_TRACKING=true
ENABLE_HEALTH_MONITORING=true
```

## API Endpoints

### Alert Management

#### Get Alert History
```http
GET /notifications/alerts?type=pollution&severity=high&acknowledged=false&limit=50
```

#### Get Active Alerts
```http
GET /notifications/alerts/active
```

#### Get Alert Statistics
```http
GET /notifications/alerts/stats
```

#### Acknowledge Alert
```http
PUT /notifications/alerts/{alertId}/acknowledge
Content-Type: application/json

{
  "acknowledgedBy": "admin@aqi-api.com"
}
```

#### Update Alert Thresholds
```http
PUT /notifications/alerts/thresholds
Content-Type: application/json

{
  "high_pollution_aqi": 160,
  "extreme_pollution_aqi": 250,
  "queue_backlog_size": 150
}
```

### Email Management

#### Send Email
```http
POST /notifications/email/send
Content-Type: application/json

{
  "to": "recipient@example.com",
  "subject": "Test Email",
  "html": "<h1>Test</h1>",
  "alertType": "pollution"
}
```

#### Get Email Delivery Status
```http
GET /notifications/email/delivery/{deliveryId}
```

#### Get Email Statistics
```http
GET /notifications/email/stats
```

### Alert Triggers

#### Send Pollution Alert
```http
POST /notifications/alerts/pollution
Content-Type: application/json

{
  "city": "Paris",
  "aqi": 180,
  "level": "Unhealthy",
  "pollutant": "PM2.5"
}
```

#### Send Daily Summary
```http
POST /notifications/alerts/daily-summary
Content-Type: application/json

{
  "city": "Paris",
  "date": "2024-01-15",
  "averageAQI": 85,
  "maxAQI": 120,
  "minAQI": 45,
  "dominantPollutant": "PM2.5",
  "trend": "improving",
  "unhealthyHours": 3
}
```

#### Send System Health Alert
```http
POST /notifications/alerts/system-health
Content-Type: application/json

{
  "timestamp": "2024-01-15T23:30:00Z",
  "queueHealth": [
    {
      "name": "air-quality",
      "waiting": 25,
      "active": 5,
      "failed": 2
    }
  ],
  "storageUsage": 0.75,
  "errorRate": 0.05,
  "uptime": 86400000
}
```

### Health Monitoring

#### Get Service Health
```http
GET /notifications/health
```

## Email Templates

### Critical Alert Template
- **Subject**: 🚨 Critical Alert - {component}
- **Content**: Error details, severity, immediate actions required
- **Color Coding**: Red for critical, orange for medium, yellow for low

### Pollution Alert Template
- **Subject**: ⚠️ Air Quality Alert - {city} (AQI: {value})
- **Content**: AQI level, pollutant, health recommendations
- **Color Coding**: Based on pollution level (Good: Green, Hazardous: Dark Red)

### Daily Summary Template
- **Subject**: 📊 Daily Air Quality Summary - {city} ({date})
- **Content**: Statistics table, trends, unhealthy hours
- **Format**: HTML table with color-coded data

### System Health Template
- **Subject**: 🔧 System Health Report - {date}
- **Content**: Queue status, error rates, storage usage
- **Visualization**: Progress bars and status indicators

### Weekly Report Template
- **Subject**: 📈 Weekly Air Quality Report - {city} ({week})
- **Content**: Weekly statistics, trends, recommendations
- **Format**: Comprehensive report with charts and analysis

## Rate Limiting

### Email Rate Limits
- **Per Hour**: 50 emails per recipient
- **Per Day**: 1000 emails per recipient
- **Retry Attempts**: 3 attempts with exponential backoff
- **Retry Delay**: 5 seconds initial, doubles on each retry

### Alert Throttling
- **Default Throttle**: 30 minutes between similar alerts
- **Escalation Window**: 60 minutes for escalation
- **Max Alerts Per Hour**: 10 alerts per type
- **Throttle Reset**: 24 hours

## Delivery Tracking

### Email Delivery States
1. **pending**: Email queued for delivery
2. **sent**: Email successfully delivered
3. **failed**: Email delivery failed
4. **retrying**: Email being retried

### Tracking Features
- Unique delivery IDs for each email
- Delivery attempt tracking
- Error message capture
- Retry scheduling
- Delivery statistics

## Alert Escalation

### Escalation Logic
- Alerts triggered multiple times within escalation window
- Escalation recipients added to original recipients
- Escalation timestamp recorded
- Escalation reason logged

### Escalation Conditions
- **API Failures**: 3+ failures within 60 minutes
- **Pollution Alerts**: 2+ high alerts within 120 minutes
- **System Health**: 2+ system alerts within 60 minutes

## Alert History

### Alert States
- **Active**: Unacknowledged alerts
- **Acknowledged**: Alerts acknowledged by users
- **Escalated**: Alerts that triggered escalation
- **Resolved**: Alerts that are no longer active

### History Features
- Alert filtering by type, severity, status
- Date range filtering
- Acknowledgment tracking
- Escalation history
- Email delivery status

## Health Monitoring

### Service Health Metrics
- **Email Delivery Rate**: Percentage of successful deliveries
- **Alert Acknowledgment Rate**: Percentage of acknowledged alerts
- **Active Alerts Count**: Number of unacknowledged alerts
- **Queue Health**: Email queue status

### Health States
- **Healthy**: Delivery rate > 80%, active alerts < 10
- **Degraded**: Delivery rate 50-80%, active alerts 10-50
- **Unhealthy**: Delivery rate < 50%, active alerts > 50

## Integration Examples

### Integration with Air Quality Service
```typescript
// In air-quality.service.ts
async checkPollutionLevels(city: string, aqi: number): Promise<void> {
  if (aqi >= 150) {
    await this.alertService.checkAndTriggerAlerts({
      aqi,
      city,
      pollutant: 'PM2.5',
    });
  }
}
```

### Integration with CRON Service
```typescript
// In cron.service.ts
@Cron('0 23 * * *')
async sendDailySummary(): Promise<void> {
  const stats = await this.analyticsService.calculateDailyStats(
    new Date().toISOString().split('T')[0],
    'Paris',
    'France'
  );
  
  await this.alertService.sendDailySummary({
    city: 'Paris',
    date: stats.date,
    averageAQI: stats.averageAQI,
    maxAQI: stats.maxAQI,
    minAQI: stats.minAQI,
    dominantPollutant: stats.dominantPollutant,
    trend: 'stable',
    unhealthyHours: stats.unhealthyHours,
  });
}
```

### Integration with Queue Health Monitoring
```typescript
// In queue-health.service.ts
async monitorQueueHealth(): Promise<void> {
  const health = await this.getQueueHealth();
  
  if (health.some(queue => queue.waiting > 100)) {
    await this.alertService.checkAndTriggerAlerts({
      queueSize: Math.max(...health.map(q => q.waiting)),
      errorRate: this.calculateErrorRate(),
      storageUsage: await this.getStorageUsage(),
    });
  }
}
```

## Best Practices

### Email Configuration
1. Use dedicated SMTP service (SendGrid, Mailgun, etc.)
2. Configure SPF, DKIM, and DMARC records
3. Monitor delivery rates and bounce rates
4. Use environment variables for sensitive credentials

### Alert Management
1. Set appropriate thresholds based on your environment
2. Configure escalation recipients carefully
3. Monitor alert acknowledgment rates
4. Regularly review and adjust alert conditions

### Rate Limiting
1. Start with conservative limits
2. Monitor rate limit hits
3. Adjust limits based on usage patterns
4. Implement proper error handling for rate limit violations

### Health Monitoring
1. Set up monitoring for email delivery rates
2. Track alert acknowledgment times
3. Monitor escalation frequency
4. Set up alerts for system health issues

## Troubleshooting

### Common Issues

#### Email Delivery Failures
- Check SMTP credentials and configuration
- Verify recipient email addresses
- Check rate limiting settings
- Review SMTP server logs

#### Alert Spam
- Adjust throttling settings
- Review alert thresholds
- Check escalation logic
- Monitor alert frequency

#### High Error Rates
- Check SMTP connectivity
- Verify email templates
- Review rate limiting configuration
- Check recipient email validation

### Debugging

#### Enable Debug Logging
```typescript
// In email.service.ts
this.logger.setLogLevels(['debug']);
```

#### Check Delivery Status
```http
GET /notifications/email/delivery/{deliveryId}
```

#### Monitor Alert History
```http
GET /notifications/alerts?limit=100
```

## Security Considerations

1. **SMTP Credentials**: Store securely in environment variables
2. **Email Validation**: Validate recipient email addresses
3. **Rate Limiting**: Prevent email abuse and spam
4. **Access Control**: Restrict alert management endpoints
5. **Data Retention**: Configure appropriate retention periods
6. **Audit Logging**: Log all alert and email activities

## Performance Optimization

1. **Connection Pooling**: Use SMTP connection pooling
2. **Template Caching**: Cache email templates
3. **Batch Processing**: Process emails in batches
4. **Async Processing**: Use queue-based email processing
5. **Database Indexing**: Index alert history for fast queries
6. **Memory Management**: Clean up old alert data regularly 