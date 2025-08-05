import { registerAs } from '@nestjs/config';

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

export interface AlertConfig {
  thresholds: {
    consecutive_api_failures: number;
    high_pollution_aqi: number;
    extreme_pollution_aqi: number;
    queue_backlog_size: number;
    daily_summary_time: string;
    system_error_rate: number;
    storage_usage_threshold: number;
    email_rate_limit: number;
  };
  recipients: {
    adminRecipients: string[];
    pollutionRecipients: string[];
    systemRecipients: string[];
    escalationRecipients: string[];
  };
  throttling: {
    defaultThrottleMinutes: number;
    escalationMinutes: number;
    maxAlertsPerHour: number;
  };
  retention: {
    alertHistoryDays: number;
    emailDeliveryDays: number;
    throttleResetHours: number;
  };
}

export interface NotificationsConfig {
  email: EmailConfig;
  alerts: AlertConfig;
  features: {
    emailNotifications: boolean;
    alertEscalation: boolean;
    rateLimiting: boolean;
    deliveryTracking: boolean;
    healthMonitoring: boolean;
  };
}

export default registerAs(
  'notifications',
  (): NotificationsConfig => ({
    email: {
      smtp: {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
      },
      from: process.env.EMAIL_FROM || 'noreply@aqi-api.com',
      adminEmail: process.env.ADMIN_EMAIL || 'admin@aqi-api.com',
      rateLimit: {
        maxEmailsPerHour: parseInt(process.env.EMAIL_RATE_LIMIT_HOUR || '50'),
        maxEmailsPerDay: parseInt(process.env.EMAIL_RATE_LIMIT_DAY || '1000'),
        retryAttempts: parseInt(process.env.EMAIL_RETRY_ATTEMPTS || '3'),
        retryDelay: parseInt(process.env.EMAIL_RETRY_DELAY || '5000'),
      },
    },
    alerts: {
      thresholds: {
        consecutive_api_failures: parseInt(
          process.env.ALERT_API_FAILURES || '5'
        ),
        high_pollution_aqi: parseInt(
          process.env.ALERT_HIGH_POLLUTION_AQI || '150'
        ),
        extreme_pollution_aqi: parseInt(
          process.env.ALERT_EXTREME_POLLUTION_AQI || '200'
        ),
        queue_backlog_size: parseInt(process.env.ALERT_QUEUE_BACKLOG || '100'),
        daily_summary_time: process.env.ALERT_DAILY_SUMMARY_TIME || '23:30',
        system_error_rate: parseFloat(
          process.env.ALERT_SYSTEM_ERROR_RATE || '0.1'
        ),
        storage_usage_threshold: parseFloat(
          process.env.ALERT_STORAGE_USAGE || '0.8'
        ),
        email_rate_limit: parseInt(process.env.ALERT_EMAIL_RATE_LIMIT || '50'),
      },
      recipients: {
        adminRecipients: process.env.ALERT_ADMIN_RECIPIENTS?.split(',') || [
          'admin@aqi-api.com',
        ],
        pollutionRecipients: process.env.ALERT_POLLUTION_RECIPIENTS?.split(
          ','
        ) || ['admin@aqi-api.com'],
        systemRecipients: process.env.ALERT_SYSTEM_RECIPIENTS?.split(',') || [
          'admin@aqi-api.com',
        ],
        escalationRecipients: process.env.ALERT_ESCALATION_RECIPIENTS?.split(
          ','
        ) || ['admin@aqi-api.com'],
      },
      throttling: {
        defaultThrottleMinutes: parseInt(
          process.env.ALERT_THROTTLE_MINUTES || '30'
        ),
        escalationMinutes: parseInt(
          process.env.ALERT_ESCALATION_MINUTES || '60'
        ),
        maxAlertsPerHour: parseInt(process.env.ALERT_MAX_PER_HOUR || '10'),
      },
      retention: {
        alertHistoryDays: parseInt(process.env.ALERT_RETENTION_DAYS || '30'),
        emailDeliveryDays: parseInt(process.env.EMAIL_RETENTION_DAYS || '7'),
        throttleResetHours: parseInt(process.env.THROTTLE_RESET_HOURS || '24'),
      },
    },
    features: {
      emailNotifications: process.env.ENABLE_EMAIL_NOTIFICATIONS !== 'false',
      alertEscalation: process.env.ENABLE_ALERT_ESCALATION !== 'false',
      rateLimiting: process.env.ENABLE_RATE_LIMITING !== 'false',
      deliveryTracking: process.env.ENABLE_DELIVERY_TRACKING !== 'false',
      healthMonitoring: process.env.ENABLE_HEALTH_MONITORING !== 'false',
    },
  })
);
