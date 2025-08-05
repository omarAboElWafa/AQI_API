import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue, Job } from 'bull';

export enum JobType {
  FETCH_PARIS_DATA = 'fetch-paris-data',
  CALCULATE_DAILY_STATS = 'calculate-daily-stats',
  SEND_ALERT_EMAIL = 'send-alert-email',
  MIGRATE_DATA = 'migrate-data',
  CLEANUP_OLD_DATA = 'cleanup-old-data',
}

export enum JobPriority {
  LOW = 1,
  NORMAL = 5,
  HIGH = 10,
  URGENT = 15,
  CRITICAL = 20,
}

export interface QueueJobData {
  type: JobType;
  data: any;
  priority: JobPriority;
  metadata?: {
    createdBy?: string;
    source?: string;
    correlationId?: string;
  };
}

export interface QueueStats {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectQueue('air-quality') private airQualityQueue: Queue,
    @InjectQueue('notifications') private notificationsQueue: Queue,
    @InjectQueue('analytics') private analyticsQueue: Queue
  ) {
    this.setupQueueListeners();
  }

  /**
   * Add FETCH_PARIS_DATA job to air-quality queue
   */
  async addFetchParisDataJob(
    priority: JobPriority = JobPriority.NORMAL,
    delay?: number
  ): Promise<Job> {
    const jobData: QueueJobData = {
      type: JobType.FETCH_PARIS_DATA,
      data: {
        city: 'Paris',
        state: 'Ile-de-France',
        country: 'France',
        timestamp: new Date(),
      },
      priority,
      metadata: {
        source: 'scheduler',
        correlationId: this.generateCorrelationId(),
      },
    };

    const options = {
      priority,
      delay,
      removeOnComplete: 100,
      removeOnFail: 50,
    };

    this.logger.log(`Adding FETCH_PARIS_DATA job with priority ${priority}`);

    return await this.airQualityQueue.add(
      JobType.FETCH_PARIS_DATA,
      jobData,
      options
    );
  }

  /**
   * Add CALCULATE_DAILY_STATS job to analytics queue
   */
  async addCalculateDailyStatsJob(
    location: string,
    date: string,
    priority: JobPriority = JobPriority.NORMAL
  ): Promise<Job> {
    const jobData: QueueJobData = {
      type: JobType.CALCULATE_DAILY_STATS,
      data: {
        location,
        date,
        timestamp: new Date(),
      },
      priority,
      metadata: {
        source: 'scheduler',
        correlationId: this.generateCorrelationId(),
      },
    };

    const options = {
      priority,
      removeOnComplete: 25,
      removeOnFail: 10,
    };

    this.logger.log(
      `Adding CALCULATE_DAILY_STATS job for ${location} on ${date}`
    );

    return await this.analyticsQueue.add(
      JobType.CALCULATE_DAILY_STATS,
      jobData,
      options
    );
  }

  /**
   * Add SEND_ALERT_EMAIL job to notifications queue
   */
  async addSendAlertEmailJob(
    alertData: {
      city: string;
      aqi: number;
      level: string;
      recipient: string;
    },
    priority: JobPriority = JobPriority.HIGH
  ): Promise<Job> {
    const jobData: QueueJobData = {
      type: JobType.SEND_ALERT_EMAIL,
      data: {
        ...alertData,
        timestamp: new Date(),
      },
      priority,
      metadata: {
        source: 'alert-system',
        correlationId: this.generateCorrelationId(),
      },
    };

    const options = {
      priority,
      removeOnComplete: 50,
      removeOnFail: 25,
      attempts: 3,
    };

    this.logger.log(
      `Adding SEND_ALERT_EMAIL job for ${alertData.city} (AQI: ${alertData.aqi})`
    );

    return await this.notificationsQueue.add(
      JobType.SEND_ALERT_EMAIL,
      jobData,
      options
    );
  }

  /**
   * Schedule recurring FETCH_PARIS_DATA job
   */
  async scheduleParisDataFetching(): Promise<void> {
    // Add job that repeats every minute
    const jobOptions = {
      repeat: { cron: '* * * * *' }, // Every minute
      priority: JobPriority.NORMAL,
      removeOnComplete: 5,
      removeOnFail: 5,
    };

    await this.airQualityQueue.add(
      JobType.FETCH_PARIS_DATA,
      {
        type: JobType.FETCH_PARIS_DATA,
        data: {
          city: 'Paris',
          state: 'Ile-de-France',
          country: 'France',
        },
        priority: JobPriority.NORMAL,
      },
      jobOptions
    );

    this.logger.log('Scheduled Paris data fetching job to run every minute');
  }

  /**
   * Schedule daily stats calculation
   */
  async scheduleDailyStatsCalculation(): Promise<void> {
    // Add job that repeats daily at 1 AM
    const jobOptions = {
      repeat: { cron: '0 1 * * *' }, // Daily at 1 AM
      priority: JobPriority.NORMAL,
      removeOnComplete: 10,
      removeOnFail: 5,
    };

    await this.analyticsQueue.add(
      JobType.CALCULATE_DAILY_STATS,
      {
        type: JobType.CALCULATE_DAILY_STATS,
        data: {
          location: 'Paris',
          date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
        },
        priority: JobPriority.NORMAL,
      },
      jobOptions
    );

    this.logger.log(
      'Scheduled daily stats calculation job to run daily at 1 AM'
    );
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<QueueStats[]> {
    const queues = [
      { name: 'air-quality', queue: this.airQualityQueue },
      { name: 'notifications', queue: this.notificationsQueue },
      { name: 'analytics', queue: this.analyticsQueue },
    ];

    const stats: QueueStats[] = [];

    for (const { name, queue } of queues) {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaiting(),
        queue.getActive(),
        queue.getCompleted(),
        queue.getFailed(),
        queue.getDelayed(),
      ]);

      stats.push({
        name,
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        delayed: delayed.length,
        paused: await queue.isPaused(),
      });
    }

    return stats;
  }

  /**
   * Get failed jobs
   */
  async getFailedJobs(queueName: string, limit: number = 10): Promise<Job[]> {
    const queue = this.getQueueByName(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    return await queue.getFailed(0, limit - 1);
  }

  /**
   * Retry failed job
   */
  async retryFailedJob(queueName: string, jobId: string): Promise<void> {
    const queue = this.getQueueByName(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const job = await queue.getJob(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    await job.retry();
    this.logger.log(`Retried job ${jobId} in queue ${queueName}`);
  }

  /**
   * Pause queue
   */
  async pauseQueue(queueName: string): Promise<void> {
    const queue = this.getQueueByName(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    await queue.pause();
    this.logger.log(`Paused queue ${queueName}`);
  }

  /**
   * Resume queue
   */
  async resumeQueue(queueName: string): Promise<void> {
    const queue = this.getQueueByName(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    await queue.resume();
    this.logger.log(`Resumed queue ${queueName}`);
  }

  /**
   * Clean completed jobs
   */
  async cleanCompletedJobs(
    queueName: string,
    olderThan: number = 24 * 60 * 60 * 1000
  ): Promise<number> {
    const queue = this.getQueueByName(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const cleaned = await queue.clean(olderThan, 'completed');
    this.logger.log(
      `Cleaned ${cleaned.length} completed jobs from queue ${queueName}`
    );

    return cleaned.length;
  }

  /**
   * Get queue by name
   */
  private getQueueByName(name: string): Queue | null {
    switch (name) {
      case 'air-quality':
        return this.airQualityQueue;
      case 'notifications':
        return this.notificationsQueue;
      case 'analytics':
        return this.analyticsQueue;
      default:
        return null;
    }
  }

  /**
   * Setup queue event listeners
   */
  private setupQueueListeners(): void {
    const queues = [
      { name: 'air-quality', queue: this.airQualityQueue },
      { name: 'notifications', queue: this.notificationsQueue },
      { name: 'analytics', queue: this.analyticsQueue },
    ];

    queues.forEach(({ name, queue }) => {
      queue.on('completed', (job: Job) => {
        this.logger.log(`Job ${job.id} completed in queue ${name}`);
      });

      queue.on('failed', (job: Job, err: Error) => {
        this.logger.error(
          `Job ${job.id} failed in queue ${name}:`,
          err.message
        );
      });

      queue.on('stalled', (job: Job) => {
        this.logger.warn(`Job ${job.id} stalled in queue ${name}`);
      });

      queue.on('progress', (job: Job, progress: number) => {
        this.logger.debug(
          `Job ${job.id} progress: ${progress}% in queue ${name}`
        );
      });

      queue.on('waiting', (jobId: string) => {
        this.logger.debug(`Job ${jobId} waiting in queue ${name}`);
      });

      queue.on('active', (job: Job) => {
        this.logger.debug(`Job ${job.id} started in queue ${name}`);
      });
    });
  }

  /**
   * Generate correlation ID for job tracking
   */
  private generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get job details
   */
  async getJobDetails(queueName: string, jobId: string): Promise<Job | null> {
    const queue = this.getQueueByName(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    return await queue.getJob(jobId);
  }

  /**
   * Remove job
   */
  async removeJob(queueName: string, jobId: string): Promise<void> {
    const queue = this.getQueueByName(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const job = await queue.getJob(jobId);
    if (job) {
      await job.remove();
      this.logger.log(`Removed job ${jobId} from queue ${queueName}`);
    }
  }

  /**
   * Get all active jobs
   */
  async getActiveJobs(): Promise<{ queueName: string; jobs: Job[] }[]> {
    const queues = [
      { name: 'air-quality', queue: this.airQualityQueue },
      { name: 'notifications', queue: this.notificationsQueue },
      { name: 'analytics', queue: this.analyticsQueue },
    ];

    const result = [];

    for (const { name, queue } of queues) {
      const activeJobs = await queue.getActive();
      result.push({
        queueName: name,
        jobs: activeJobs,
      });
    }

    return result;
  }
}
