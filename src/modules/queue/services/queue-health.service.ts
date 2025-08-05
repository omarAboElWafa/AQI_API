import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue, Job } from 'bull';

export interface QueueHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  stats: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: boolean;
  };
  performance: {
    avgProcessingTime: number;
    throughput: number; // jobs per minute
    failureRate: number; // percentage
  };
  lastJobCompleted?: Date;
  lastJobFailed?: Date;
  issues: string[];
}

export interface OverallHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  queues: QueueHealth[];
  summary: {
    totalWaiting: number;
    totalActive: number;
    totalFailed: number;
    overallThroughput: number;
    overallFailureRate: number;
  };
  timestamp: Date;
}

@Injectable()
export class QueueHealthService {
  private readonly logger = new Logger(QueueHealthService.name);
  private readonly healthThresholds = {
    maxWaitingJobs: 100,
    maxActiveJobs: 50,
    maxFailureRate: 10, // percentage
    minThroughput: 1, // jobs per minute
    maxProcessingTime: 60000, // 1 minute in ms
  };

  constructor(
    @InjectQueue('air-quality') private airQualityQueue: Queue,
    @InjectQueue('notifications') private notificationsQueue: Queue,
    @InjectQueue('analytics') private analyticsQueue: Queue,
  ) {}

  /**
   * Get health status for all queues
   */
  async getOverallHealth(): Promise<OverallHealth> {
    const queues = [
      { name: 'air-quality', queue: this.airQualityQueue },
      { name: 'notifications', queue: this.notificationsQueue },
      { name: 'analytics', queue: this.analyticsQueue },
    ];

    const queueHealths: QueueHealth[] = [];
    let totalWaiting = 0;
    let totalActive = 0;
    let totalFailed = 0;
    let totalThroughput = 0;
    let totalFailureRate = 0;

    for (const { name, queue } of queues) {
      const queueHealth = await this.getQueueHealth(name, queue);
      queueHealths.push(queueHealth);

      totalWaiting += queueHealth.stats.waiting;
      totalActive += queueHealth.stats.active;
      totalFailed += queueHealth.stats.failed;
      totalThroughput += queueHealth.performance.throughput;
      totalFailureRate += queueHealth.performance.failureRate;
    }

    const overallStatus = this.determineOverallStatus(queueHealths);
    const avgFailureRate = totalFailureRate / queues.length;

    return {
      status: overallStatus,
      queues: queueHealths,
      summary: {
        totalWaiting,
        totalActive,
        totalFailed,
        overallThroughput: totalThroughput,
        overallFailureRate: avgFailureRate,
      },
      timestamp: new Date(),
    };
  }

  /**
   * Get health status for a specific queue
   */
  async getQueueHealth(name: string, queue: Queue): Promise<QueueHealth> {
    try {
      // Get basic stats
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaiting(),
        queue.getActive(),
        queue.getCompleted(),
        queue.getFailed(),
        queue.getDelayed(),
      ]);

      const stats = {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        delayed: delayed.length,
        paused: await queue.isPaused(),
      };

      // Calculate performance metrics
      const performance = await this.calculatePerformanceMetrics(queue, completed, failed);

      // Determine health status and issues
      const issues: string[] = [];
      const status = this.determineQueueStatus(stats, performance, issues);

      // Get last job timestamps
      const lastJobCompleted = completed.length > 0 ? new Date(completed[0].processedOn || 0) : undefined;
      const lastJobFailed = failed.length > 0 ? new Date(failed[0].failedReason || 0) : undefined;

      return {
        name,
        status,
        stats,
        performance,
        lastJobCompleted,
        lastJobFailed,
        issues,
      };

    } catch (error) {
      this.logger.error(`Error getting health for queue ${name}:`, error);
      
      return {
        name,
        status: 'unhealthy',
        stats: {
          waiting: 0,
          active: 0,
          completed: 0,
          failed: 0,
          delayed: 0,
          paused: false,
        },
        performance: {
          avgProcessingTime: 0,
          throughput: 0,
          failureRate: 100,
        },
        issues: [`Error accessing queue: ${error.message}`],
      };
    }
  }

  /**
   * Calculate performance metrics
   */
  private async calculatePerformanceMetrics(
    queue: Queue,
    completed: Job[],
    failed: Job[]
  ): Promise<{
    avgProcessingTime: number;
    throughput: number;
    failureRate: number;
  }> {
    // Calculate average processing time from recent completed jobs
    const recentCompleted = completed.slice(0, 10); // Last 10 jobs
    const avgProcessingTime = recentCompleted.length > 0
      ? recentCompleted.reduce((sum, job) => {
          const duration = (job.processedOn || 0) - (job.timestamp || 0);
          return sum + duration;
        }, 0) / recentCompleted.length
      : 0;

    // Calculate throughput (jobs per minute) from last hour
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    const recentJobs = completed.filter(job => (job.processedOn || 0) > oneHourAgo);
    const throughput = recentJobs.length; // jobs in last hour

    // Calculate failure rate from recent jobs
    const totalRecentJobs = recentCompleted.length + failed.slice(0, 10).length;
    const failureRate = totalRecentJobs > 0
      ? (failed.slice(0, 10).length / totalRecentJobs) * 100
      : 0;

    return {
      avgProcessingTime,
      throughput,
      failureRate,
    };
  }

  /**
   * Determine queue health status
   */
  private determineQueueStatus(
    stats: any,
    performance: any,
    issues: string[]
  ): 'healthy' | 'degraded' | 'unhealthy' {
    let degradedCount = 0;
    let unhealthyCount = 0;

    // Check waiting jobs
    if (stats.waiting > this.healthThresholds.maxWaitingJobs) {
      issues.push(`Too many waiting jobs: ${stats.waiting}`);
      if (stats.waiting > this.healthThresholds.maxWaitingJobs * 2) {
        unhealthyCount++;
      } else {
        degradedCount++;
      }
    }

    // Check active jobs
    if (stats.active > this.healthThresholds.maxActiveJobs) {
      issues.push(`Too many active jobs: ${stats.active}`);
      degradedCount++;
    }

    // Check failure rate
    if (performance.failureRate > this.healthThresholds.maxFailureRate) {
      issues.push(`High failure rate: ${performance.failureRate.toFixed(2)}%`);
      if (performance.failureRate > this.healthThresholds.maxFailureRate * 2) {
        unhealthyCount++;
      } else {
        degradedCount++;
      }
    }

    // Check throughput
    if (performance.throughput < this.healthThresholds.minThroughput) {
      issues.push(`Low throughput: ${performance.throughput} jobs/hour`);
      degradedCount++;
    }

    // Check processing time
    if (performance.avgProcessingTime > this.healthThresholds.maxProcessingTime) {
      issues.push(`Slow processing: ${(performance.avgProcessingTime / 1000).toFixed(2)}s avg`);
      degradedCount++;
    }

    // Check if paused
    if (stats.paused) {
      issues.push('Queue is paused');
      unhealthyCount++;
    }

    // Determine overall status
    if (unhealthyCount > 0) {
      return 'unhealthy';
    } else if (degradedCount > 0) {
      return 'degraded';
    } else {
      return 'healthy';
    }
  }

  /**
   * Determine overall system health status
   */
  private determineOverallStatus(queueHealths: QueueHealth[]): 'healthy' | 'degraded' | 'unhealthy' {
    const unhealthyQueues = queueHealths.filter(q => q.status === 'unhealthy').length;
    const degradedQueues = queueHealths.filter(q => q.status === 'degraded').length;

    if (unhealthyQueues > 0) {
      return 'unhealthy';
    } else if (degradedQueues > 0) {
      return 'degraded';
    } else {
      return 'healthy';
    }
  }

  /**
   * Check if queue is responsive
   */
  async isQueueResponsive(queueName: string): Promise<boolean> {
    try {
      const queue = this.getQueueByName(queueName);
      if (!queue) {
        return false;
      }

      // Simple responsiveness test - try to get waiting jobs
      const waiting = await Promise.race([
        queue.getWaiting(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 5000)
        ),
      ]);

      return true;
    } catch (error) {
      this.logger.error(`Queue ${queueName} is not responsive:`, error.message);
      return false;
    }
  }

  /**
   * Get queue connection status
   */
  async getQueueConnectionStatus(): Promise<{
    [queueName: string]: boolean;
  }> {
    const queues = [
      { name: 'air-quality', queue: this.airQualityQueue },
      { name: 'notifications', queue: this.notificationsQueue },
      { name: 'analytics', queue: this.analyticsQueue },
    ];

    const status: { [queueName: string]: boolean } = {};

    for (const { name, queue } of queues) {
      try {
        // Test Redis connection by getting queue status
        await queue.isPaused();
        status[name] = true;
      } catch (error) {
        this.logger.error(`Queue ${name} connection failed:`, error.message);
        status[name] = false;
      }
    }

    return status;
  }

  /**
   * Get detailed job metrics
   */
  async getJobMetrics(queueName: string): Promise<{
    totalJobs: number;
    successRate: number;
    avgProcessingTime: number;
    jobsPerHour: number;
    oldestWaitingJob?: Date;
    longestRunningJob?: { id: string; duration: number };
  }> {
    const queue = this.getQueueByName(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const [waiting, active, completed, failed] = await Promise.all([
      queue.getWaiting(),
      queue.getActive(),
      queue.getCompleted(),
      queue.getFailed(),
    ]);

    const totalJobs = completed.length + failed.length;
    const successRate = totalJobs > 0 ? (completed.length / totalJobs) * 100 : 0;

    // Calculate average processing time
    const avgProcessingTime = completed.length > 0
      ? completed.reduce((sum, job) => {
          const duration = (job.processedOn || 0) - (job.timestamp || 0);
          return sum + duration;
        }, 0) / completed.length
      : 0;

    // Calculate jobs per hour from last 24 hours
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    const recentJobs = completed.filter(job => (job.processedOn || 0) > oneDayAgo);
    const jobsPerHour = recentJobs.length / 24;

    // Find oldest waiting job
    const oldestWaitingJob = waiting.length > 0
      ? new Date(Math.min(...waiting.map(job => job.timestamp || Date.now())))
      : undefined;

    // Find longest running job
    const longestRunningJob = active.length > 0
      ? active.reduce((longest, job) => {
          const duration = Date.now() - (job.processedOn || job.timestamp || Date.now());
          return duration > (longest?.duration || 0)
            ? { id: job.id?.toString() || 'unknown', duration }
            : longest;
        }, undefined)
      : undefined;

    return {
      totalJobs,
      successRate,
      avgProcessingTime,
      jobsPerHour,
      oldestWaitingJob,
      longestRunningJob,
    };
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
   * Perform health check and log issues
   */
  async performHealthCheck(): Promise<void> {
    const health = await this.getOverallHealth();
    
    if (health.status === 'unhealthy') {
      this.logger.error('Queue system is unhealthy!', {
        status: health.status,
        issues: health.queues.flatMap(q => q.issues),
      });
    } else if (health.status === 'degraded') {
      this.logger.warn('Queue system performance is degraded', {
        status: health.status,
        issues: health.queues.flatMap(q => q.issues),
      });
    } else {
      this.logger.log('Queue system is healthy');
    }
  }
} 