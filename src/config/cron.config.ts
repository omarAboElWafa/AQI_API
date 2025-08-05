import { registerAs } from '@nestjs/config';

export interface CronJobConfig {
  name: string;
  cron: string;
  timezone: string;
  enabled: boolean;
  description: string;
  category: 'data' | 'analytics' | 'maintenance' | 'monitoring';
  priority: 'low' | 'normal' | 'high' | 'critical';
}

export interface CircuitBreakerConfig {
  enabled: boolean;
  failureThreshold: number;
  timeout: number; // milliseconds
  monitoringWindow: number; // milliseconds
}

export interface QueueHealthConfig {
  enabled: boolean;
  checkInterval: number; // milliseconds
  alertThresholds: {
    healthScore: number; // below this triggers alert
    failureRate: number; // above this triggers alert
    waitingJobs: number; // above this triggers alert
    processingTime: number; // above this triggers alert (ms)
  };
  retentionPeriod: number; // milliseconds for historical data
}

export default registerAs('cron', () => ({
  jobs: [
    {
      name: 'fetch-paris-data',
      cron: '* * * * *', // Every minute
      timezone: 'Europe/Paris',
      enabled: true,
      description: 'Fetch air quality data for Paris every minute',
      category: 'data',
      priority: 'normal',
    },
    {
      name: 'hourly-aggregations',
      cron: '0 * * * *', // Every hour
      timezone: 'UTC',
      enabled: true,
      description: 'Calculate current day aggregations for all tracked locations',
      category: 'analytics',
      priority: 'normal',
    },
    {
      name: 'finalize-daily-stats',
      cron: '59 23 * * *', // Daily at 23:59
      timezone: 'UTC',
      enabled: true,
      description: 'Finalize daily statistics and generate reports',
      category: 'analytics',
      priority: 'high',
    },
    {
      name: 'weekly-cleanup',
      cron: '0 2 * * 0', // Sunday at 2 AM
      timezone: 'UTC',
      enabled: true,
      description: 'Clean old queue jobs, logs, and temporary data',
      category: 'maintenance',
      priority: 'low',
    },
    {
      name: 'health-check',
      cron: '*/5 * * * *', // Every 5 minutes
      timezone: 'UTC',
      enabled: true,
      description: 'Monitor system health and queue performance',
      category: 'monitoring',
      priority: 'high',
    },
  ] as CronJobConfig[],

  circuitBreaker: {
    enabled: true,
    failureThreshold: 5, // Open circuit after 5 consecutive failures
    timeout: 5 * 60 * 1000, // 5 minutes in milliseconds
    monitoringWindow: 60 * 1000, // 1 minute monitoring window
  } as CircuitBreakerConfig,

  queueHealth: {
    enabled: true,
    checkInterval: 60 * 1000, // Check every minute
    alertThresholds: {
      healthScore: 0.5, // Alert if health score below 50%
      failureRate: 0.1, // Alert if failure rate above 10%
      waitingJobs: 100, // Alert if more than 100 waiting jobs
      processingTime: 30000, // Alert if processing time above 30 seconds
    },
    retentionPeriod: 7 * 24 * 60 * 60 * 1000, // 7 days
  } as QueueHealthConfig,

  // Feature flags
  features: {
    enableDuplicatePrevention: true,
    enablePerformanceMonitoring: true,
    enableAutomaticRecovery: true,
    enableMetricsCollection: true,
    enableAlertNotifications: true,
  },

  // Retry strategies
  retryStrategies: {
    dataFetch: {
      maxAttempts: 3,
      backoffStrategy: 'exponential',
      baseDelay: 1000, // 1 second
      maxDelay: 60000, // 1 minute
    },
    analytics: {
      maxAttempts: 2,
      backoffStrategy: 'fixed',
      baseDelay: 30000, // 30 seconds
      maxDelay: 30000,
    },
    notifications: {
      maxAttempts: 5,
      backoffStrategy: 'exponential',
      baseDelay: 5000, // 5 seconds
      maxDelay: 300000, // 5 minutes
    },
  },

  // Cleanup policies
  cleanup: {
    completedJobs: {
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      maxCount: 1000,
    },
    failedJobs: {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      maxCount: 100,
    },
    logs: {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    },
    metrics: {
      maxAge: 90 * 24 * 60 * 60 * 1000, // 90 days
    },
  },

  // Rate limiting
  rateLimits: {
    apiCalls: {
      iqair: {
        requestsPerMinute: 50,
        burstLimit: 10,
      },
    },
    queueOperations: {
      jobAddition: {
        requestsPerMinute: 1000,
        burstLimit: 100,
      },
    },
  },
})); 