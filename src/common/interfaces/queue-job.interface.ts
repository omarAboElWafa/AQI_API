export interface QueueJobData {
  id: string;
  type: string;
  priority: number;
  data: any;
  metadata?: Record<string, any>;
  createdAt: Date;
  scheduledFor?: Date;
  retryCount: number;
  maxRetries: number;
}

export interface AirQualityFetchJob {
  city: string;
  state: string;
  country: string;
  priority: 'low' | 'normal' | 'high';
  retryCount: number;
  maxRetries: number;
  apiKey?: string;
  timeout?: number;
}

export interface EmailAlertJob {
  alertId: string;
  recipient: {
    email: string;
    name?: string;
  };
  template: {
    city: string;
    aqi: number;
    level: string;
    timestamp: Date;
  };
  priority: 'low' | 'normal' | 'high' | 'urgent';
  retryCount: number;
  maxRetries: number;
}

export interface AnalyticsJob {
  type: 'daily' | 'weekly' | 'monthly';
  location: string;
  date: string;
  priority: 'low' | 'normal' | 'high';
  retryCount: number;
  maxRetries: number;
}

export interface DataCleanupJob {
  type: 'old_records' | 'duplicates' | 'invalid_data';
  location?: string;
  olderThan?: Date;
  priority: 'low' | 'normal' | 'high';
  retryCount: number;
  maxRetries: number;
}

export interface JobResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  executionTime: number;
  timestamp: Date;
  jobId: string;
}

export interface JobProgress {
  jobId: string;
  progress: number; // 0-100
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  message?: string;
  data?: any;
  timestamp: Date;
}

export interface QueueConfig {
  name: string;
  concurrency: number;
  defaultJobOptions: {
    removeOnComplete: number;
    removeOnFail: number;
    attempts: number;
    backoff: {
      type: 'exponential' | 'fixed';
      delay: number;
    };
  };
  limiter?: {
    max: number;
    duration: number;
  };
}

export interface JobScheduler {
  cron: string;
  jobType: string;
  data: any;
  enabled: boolean;
  timezone?: string;
}

export interface QueueStats {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
  processingRate: number;
  avgProcessingTime: number;
} 