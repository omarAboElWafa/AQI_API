import { InjectQueue } from '@nestjs/bull';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, SchedulerRegistry } from '@nestjs/schedule';
import { Queue } from 'bull';
import { Model } from 'mongoose';

import { AnalyticsService } from '../../analytics/services/analytics.service';
import { QueueHealthService } from '../../queue/services/queue-health.service';
import { JobPriority, QueueService } from '../../queue/services/queue.service';
import { AirQuality, AirQualityDocument } from '../schemas/air-quality.schema';

export interface CronJobStats {
  jobName: string;
  lastExecution: Date | null;
  nextExecution: Date | null;
  executionCount: number;
  failureCount: number;
  lastExecutionDuration: number;
  isEnabled: boolean;
  lastError?: string;
}

export interface CircuitBreakerState {
  failureCount: number;
  lastFailureTime: Date | null;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  threshold: number;
  timeout: number; // ms
}

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);
  private readonly jobStats = new Map<string, CronJobStats>();
  private readonly circuitBreaker: CircuitBreakerState = {
    failureCount: 0,
    lastFailureTime: null,
    state: 'CLOSED',
    threshold: 5, // Open circuit after 5 consecutive failures
    timeout: 5 * 60 * 1000, // 5 minutes
  };

  private readonly duplicatePreventionKeys = new Set<string>();

  constructor(
    @InjectQueue('air-quality') private airQualityQueue: Queue,
    @InjectQueue('analytics') private analyticsQueue: Queue,
    @InjectQueue('notifications') private notificationsQueue: Queue,
    @InjectModel(AirQuality.name)
    private airQualityModel: Model<AirQualityDocument>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private configService: ConfigService,
    private schedulerRegistry: SchedulerRegistry,
    private queueService: QueueService,
    private analyticsService: AnalyticsService,
    private queueHealthService: QueueHealthService
  ) {
    this.initializeJobStats();
  }

  /**
   * Every minute: Add Paris data fetch to queue
   * CRON: '* * * * *'
   */
  @Cron('* * * * *', {
    name: 'fetch-paris-data',
    timeZone: 'Europe/Paris',
  })
  async scheduleParisFetch(): Promise<void> {
    const jobName = 'fetch-paris-data';
    const startTime = Date.now();

    try {
      this.logger.debug('Executing Paris data fetch scheduling job');

      // Check circuit breaker
      if (this.isCircuitOpen()) {
        this.logger.warn('Circuit breaker is OPEN, skipping Paris data fetch');
        this.updateJobStats(
          jobName,
          startTime,
          false,
          'Circuit breaker is OPEN'
        );
        return;
      }

      // Prevent duplicate jobs
      const preventionKey = `paris-fetch-${Math.floor(Date.now() / 60000)}`; // Per minute
      if (this.duplicatePreventionKeys.has(preventionKey)) {
        this.logger.debug('Duplicate Paris fetch job prevented');
        return;
      }
      this.duplicatePreventionKeys.add(preventionKey);

      // Check queue health before adding job
      const queueHealth =
        await this.queueHealthService.getQueueHealth('air-quality');
      if (queueHealth.healthScore < 0.7) {
        this.logger.warn('Queue health score too low, skipping job addition');
        this.updateJobStats(jobName, startTime, false, 'Queue health too low');
        return;
      }

      // Add job to queue
      await this.queueService.addFetchParisDataJob(JobPriority.NORMAL);

      // Clean up old prevention keys (keep only last 5 minutes)
      this.cleanupDuplicatePreventionKeys();

      this.updateJobStats(jobName, startTime, true);
      this.resetCircuitBreaker();
    } catch (error) {
      this.logger.error(`Error in ${jobName}:`, error);
      this.updateJobStats(jobName, startTime, false, error.message);
      this.recordCircuitBreakerFailure();
    }
  }

  /**
   * Every hour: Calculate current day aggregations
   * CRON: '0 * * * *'
   */
  @Cron('0 * * * *', {
    name: 'hourly-aggregations',
    timeZone: 'UTC',
  })
  async scheduleHourlyAggregations(): Promise<void> {
    const jobName = 'hourly-aggregations';
    const startTime = Date.now();

    try {
      this.logger.log('Executing hourly aggregations job');

      // Get current date for aggregation
      const currentDate = new Date().toISOString().split('T')[0];

      // Add analytics job for Paris (primary location)
      await this.queueService.addCalculateDailyStatsJob(
        'Paris',
        currentDate,
        JobPriority.NORMAL
      );

      // Add jobs for other tracked locations if any
      const trackedLocations = await this.getTrackedLocations();
      for (const location of trackedLocations) {
        await this.queueService.addCalculateDailyStatsJob(
          location,
          currentDate,
          JobPriority.LOW
        );
      }

      this.updateJobStats(jobName, startTime, true);
    } catch (error) {
      this.logger.error(`Error in ${jobName}:`, error);
      this.updateJobStats(jobName, startTime, false, error.message);
    }
  }

  /**
   * Daily at 23:59: Finalize daily statistics
   * CRON: '59 23 * * *'
   */
  @Cron('59 23 * * *', {
    name: 'finalize-daily-stats',
    timeZone: 'UTC',
  })
  async finalizeDailyStatistics(): Promise<void> {
    const jobName = 'finalize-daily-stats';
    const startTime = Date.now();

    try {
      this.logger.log('Executing daily statistics finalization job');

      const today = new Date().toISOString().split('T')[0];
      const trackedLocations = await this.getTrackedLocations();

      // Generate final daily reports
      for (const location of trackedLocations) {
        try {
          const [city, country] = location.split(',').map(s => s.trim());

          // Generate daily report
          const dailyReport = await this.analyticsService.generateDailyReport(
            city,
            country
          );

          // Cache the report
          const cacheKey = `daily-report:${city}:${country}:${today}`;
          await this.cacheManager.set(cacheKey, dailyReport, 24 * 60 * 60); // Cache for 24 hours

          // Add notification job if AQI is concerning
          if (dailyReport.averageAQI > 150) {
            await this.notificationsQueue.add(
              'daily-aqi-alert',
              {
                city,
                country,
                averageAQI: dailyReport.averageAQI,
                date: today,
              },
              {
                priority: JobPriority.HIGH,
              }
            );
          }
        } catch (locationError) {
          this.logger.error(
            `Error processing location ${location}:`,
            locationError
          );
        }
      }

      this.updateJobStats(jobName, startTime, true);
    } catch (error) {
      this.logger.error(`Error in ${jobName}:`, error);
      this.updateJobStats(jobName, startTime, false, error.message);
    }
  }

  /**
   * Weekly cleanup: Clean old data/logs
   * CRON: '0 2 * * 0' (Sunday at 2 AM)
   */
  @Cron('0 2 * * 0', {
    name: 'weekly-cleanup',
    timeZone: 'UTC',
  })
  async weeklyCleanup(): Promise<void> {
    const jobName = 'weekly-cleanup';
    const startTime = Date.now();

    try {
      this.logger.log('Executing weekly cleanup job');

      // Clean old queue jobs (completed jobs older than 7 days)
      const cleanupPromises = [
        this.queueService.cleanCompletedJobs(
          'air-quality',
          7 * 24 * 60 * 60 * 1000
        ),
        this.queueService.cleanCompletedJobs(
          'analytics',
          7 * 24 * 60 * 60 * 1000
        ),
        this.queueService.cleanCompletedJobs(
          'notifications',
          7 * 24 * 60 * 60 * 1000
        ),
      ];

      const cleanupResults = await Promise.allSettled(cleanupPromises);

      let totalCleaned = 0;
      cleanupResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          totalCleaned += result.value;
        } else {
          this.logger.error(
            `Cleanup failed for queue ${index}:`,
            result.reason
          );
        }
      });

      // Clear old cache entries
      await this.clearOldCacheEntries();

      // Reset job statistics for jobs older than 30 days
      await this.cleanupOldJobStats();

      this.logger.log(
        `Weekly cleanup completed. Total jobs cleaned: ${totalCleaned}`
      );
      this.updateJobStats(jobName, startTime, true);
    } catch (error) {
      this.logger.error(`Error in ${jobName}:`, error);
      this.updateJobStats(jobName, startTime, false, error.message);
    }
  }

  /**
   * Health check CRON job - every 5 minutes
   */
  @Cron('*/5 * * * *', {
    name: 'health-check',
    timeZone: 'UTC',
  })
  async performHealthCheck(): Promise<void> {
    const jobName = 'health-check';
    const startTime = Date.now();

    try {
      this.logger.debug('Performing system health check');

      // Check queue health
      const queueHealths = await Promise.all([
        this.queueHealthService.getQueueHealth('air-quality'),
        this.queueHealthService.getQueueHealth('analytics'),
        this.queueHealthService.getQueueHealth('notifications'),
      ]);

      // Check for unhealthy queues
      const unhealthyQueues = queueHealths.filter(
        health => health.healthScore < 0.5
      );

      if (unhealthyQueues.length > 0) {
        this.logger.warn(
          `Unhealthy queues detected: ${unhealthyQueues.map(q => q.queueName).join(', ')}`
        );

        // Add alert notification
        await this.notificationsQueue.add(
          'system-health-alert',
          {
            alertType: 'queue-health',
            unhealthyQueues: unhealthyQueues.map(q => ({
              name: q.queueName,
              healthScore: q.healthScore,
              issues: q.issues,
            })),
            timestamp: new Date(),
          },
          {
            priority: JobPriority.HIGH,
          }
        );
      }

      // Check circuit breaker status
      if (this.circuitBreaker.state === 'OPEN') {
        const timeSinceLastFailure =
          Date.now() - (this.circuitBreaker.lastFailureTime?.getTime() || 0);
        if (timeSinceLastFailure > this.circuitBreaker.timeout) {
          this.circuitBreaker.state = 'HALF_OPEN';
          this.logger.log('Circuit breaker moved to HALF_OPEN state');
        }
      }

      this.updateJobStats(jobName, startTime, true);
    } catch (error) {
      this.logger.error(`Error in ${jobName}:`, error);
      this.updateJobStats(jobName, startTime, false, error.message);
    }
  }

  /**
   * Get CRON job statistics
   */
  async getCronJobStats(): Promise<CronJobStats[]> {
    return Array.from(this.jobStats.values());
  }

  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus(): CircuitBreakerState {
    return { ...this.circuitBreaker };
  }

  /**
   * Manual job execution for testing/debugging
   */
  async executeJobManually(jobName: string): Promise<void> {
    this.logger.log(`Manually executing job: ${jobName}`);

    switch (jobName) {
      case 'fetch-paris-data':
        await this.scheduleParisFetch();
        break;
      case 'hourly-aggregations':
        await this.scheduleHourlyAggregations();
        break;
      case 'finalize-daily-stats':
        await this.finalizeDailyStatistics();
        break;
      case 'weekly-cleanup':
        await this.weeklyCleanup();
        break;
      case 'health-check':
        await this.performHealthCheck();
        break;
      default:
        throw new Error(`Unknown job: ${jobName}`);
    }
  }

  /**
   * Enable/disable specific CRON job
   */
  async toggleCronJob(jobName: string, enabled: boolean): Promise<void> {
    try {
      const job = this.schedulerRegistry.getCronJob(jobName);

      if (enabled) {
        job.start();
        this.logger.log(`Enabled CRON job: ${jobName}`);
      } else {
        job.stop();
        this.logger.log(`Disabled CRON job: ${jobName}`);
      }

      // Update stats
      const stats = this.jobStats.get(jobName);
      if (stats) {
        stats.isEnabled = enabled;
      }
    } catch (error) {
      this.logger.error(`Error toggling CRON job ${jobName}:`, error);
      throw error;
    }
  }

  private initializeJobStats(): void {
    const jobs = [
      'fetch-paris-data',
      'hourly-aggregations',
      'finalize-daily-stats',
      'weekly-cleanup',
      'health-check',
    ];

    jobs.forEach(jobName => {
      this.jobStats.set(jobName, {
        jobName,
        lastExecution: null,
        nextExecution: null,
        executionCount: 0,
        failureCount: 0,
        lastExecutionDuration: 0,
        isEnabled: true,
      });
    });
  }

  private updateJobStats(
    jobName: string,
    startTime: number,
    success: boolean,
    error?: string
  ): void {
    const stats = this.jobStats.get(jobName);
    if (!stats) return;

    const duration = Date.now() - startTime;

    stats.lastExecution = new Date();
    stats.lastExecutionDuration = duration;
    stats.executionCount++;

    if (success) {
      stats.lastError = undefined;
    } else {
      stats.failureCount++;
      stats.lastError = error;
    }
  }

  private isCircuitOpen(): boolean {
    return this.circuitBreaker.state === 'OPEN';
  }

  private recordCircuitBreakerFailure(): void {
    this.circuitBreaker.failureCount++;
    this.circuitBreaker.lastFailureTime = new Date();

    if (this.circuitBreaker.failureCount >= this.circuitBreaker.threshold) {
      this.circuitBreaker.state = 'OPEN';
      this.logger.warn('Circuit breaker OPENED due to consecutive failures');
    }
  }

  private resetCircuitBreaker(): void {
    if (this.circuitBreaker.state === 'HALF_OPEN') {
      this.circuitBreaker.state = 'CLOSED';
      this.circuitBreaker.failureCount = 0;
      this.logger.log('Circuit breaker CLOSED - system recovered');
    } else if (this.circuitBreaker.failureCount > 0) {
      this.circuitBreaker.failureCount = Math.max(
        0,
        this.circuitBreaker.failureCount - 1
      );
    }
  }

  private cleanupDuplicatePreventionKeys(): void {
    const fiveMinutesAgo = Math.floor((Date.now() - 5 * 60 * 1000) / 60000);

    for (const key of this.duplicatePreventionKeys) {
      const keyTime = parseInt(key.split('-').pop() || '0');
      if (keyTime < fiveMinutesAgo) {
        this.duplicatePreventionKeys.delete(key);
      }
    }
  }

  private async getTrackedLocations(): Promise<string[]> {
    // Get unique locations from the database
    const locations = await this.airQualityModel.distinct('city').exec();
    const countries = await this.airQualityModel.distinct('country').exec();

    // For simplicity, return primary locations
    // In a real scenario, you might have a configuration table
    return ['Paris, France'];
  }

  private async clearOldCacheEntries(): Promise<void> {
    // This would depend on your cache implementation
    // For Redis, you might use SCAN with pattern matching
    this.logger.log(
      'Cache cleanup completed (implementation depends on cache store)'
    );
  }

  private async cleanupOldJobStats(): Promise<void> {
    // Reset failure counts and old errors for better monitoring
    for (const [jobName, stats] of this.jobStats) {
      if (
        stats.lastExecution &&
        Date.now() - stats.lastExecution.getTime() > 30 * 24 * 60 * 60 * 1000
      ) {
        stats.failureCount = 0;
        stats.lastError = undefined;
      }
    }
  }
}
