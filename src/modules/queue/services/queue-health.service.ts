import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue, Job } from 'bull';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Inject } from '@nestjs/common';

export interface QueueHealthMetrics {
  queueName: string;
  healthScore: number; // 0-1 scale
  totalJobs: number;
  waitingJobs: number;
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  averageProcessingTime: number;
  processingRate: number; // jobs per minute
  failureRate: number; // 0-1 scale
  lastUpdated: Date;
  issues: string[];
}

export interface QueueBottleneck {
  queueName: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: 'high_wait_time' | 'high_failure_rate' | 'slow_processing' | 'queue_backlog';
  description: string;
  metrics: {
    waitingJobs: number;
    averageWaitTime: number;
    failureRate: number;
    processingTime: number;
  };
  recommendations: string[];
}

@Injectable()
export class QueueHealthService {
  private readonly logger = new Logger(QueueHealthService.name);
  private readonly healthMetrics = new Map<string, QueueHealthMetrics>();
  private readonly processingTimeHistory = new Map<string, number[]>();

  constructor(
    @InjectQueue('air-quality') private airQualityQueue: Queue,
    @InjectQueue('analytics') private analyticsQueue: Queue,
    @InjectQueue('notifications') private notificationsQueue: Queue,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    this.initializeHealthMonitoring();
  }

  /**
   * Get health metrics for a specific queue
   */
  async getQueueHealth(queueName: string): Promise<QueueHealthMetrics> {
    const queue = this.getQueueByName(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    return this.calculateQueueHealth(queue, queueName);
  }

  /**
   * Get health metrics for all queues
   */
  async getAllQueueHealth(): Promise<QueueHealthMetrics[]> {
    const queues = [
      { name: 'air-quality', queue: this.airQualityQueue },
      { name: 'analytics', queue: this.analyticsQueue },
      { name: 'notifications', queue: this.notificationsQueue },
    ];

    const healthMetrics = await Promise.all(
      queues.map(({ name, queue }) => this.calculateQueueHealth(queue, name))
    );

    return healthMetrics;
  }

  /**
   * Detect queue bottlenecks
   */
  async detectBottlenecks(): Promise<QueueBottleneck[]> {
    const allHealth = await this.getAllQueueHealth();
    const bottlenecks: QueueBottleneck[] = [];

    for (const health of allHealth) {
      const queueBottlenecks = this.analyzeQueueBottlenecks(health);
      bottlenecks.push(...queueBottlenecks);
    }

    return bottlenecks.sort((a, b) => {
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });
  }

  /**
   * Get queue processing statistics
   */
  async getProcessingStats(queueName: string, timeWindow: number = 3600000): Promise<{
    averageProcessingTime: number;
    processingRate: number;
    throughput: number;
    failureRate: number;
  }> {
    const queue = this.getQueueByName(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const now = Date.now();
    const windowStart = now - timeWindow;

    // Get completed and failed jobs within time window
    const [completedJobs, failedJobs] = await Promise.all([
      queue.getCompleted(0, -1),
      queue.getFailed(0, -1),
    ]);

    // Filter jobs by time window
    const recentCompleted = completedJobs.filter(job => 
      job.finishedOn && job.finishedOn >= windowStart
    );
    const recentFailed = failedJobs.filter(job => 
      job.finishedOn && job.finishedOn >= windowStart
    );

    // Calculate metrics
    const totalProcessed = recentCompleted.length + recentFailed.length;
    const processingTimes = recentCompleted
      .filter(job => job.processedOn && job.finishedOn)
      .map(job => job.finishedOn! - job.processedOn!);

    const averageProcessingTime = processingTimes.length > 0
      ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length
      : 0;

    const processingRate = totalProcessed > 0
      ? (totalProcessed / (timeWindow / 60000)) // jobs per minute
      : 0;

    const throughput = recentCompleted.length;
    const failureRate = totalProcessed > 0 ? recentFailed.length / totalProcessed : 0;

    return {
      averageProcessingTime,
      processingRate,
      throughput,
      failureRate,
    };
  }

  /**
   * Monitor queue and alert on issues
   */
  async monitorAndAlert(): Promise<void> {
    try {
      const bottlenecks = await this.detectBottlenecks();
      const criticalBottlenecks = bottlenecks.filter(b => b.severity === 'critical' || b.severity === 'high');

      if (criticalBottlenecks.length > 0) {
        this.logger.warn(`Detected ${criticalBottlenecks.length} critical queue bottlenecks`);
        
        // Cache alert information
        await this.cacheManager.set(
          'queue-health-alerts',
          criticalBottlenecks,
          300 // 5 minutes
        );

        // Log each critical bottleneck
        for (const bottleneck of criticalBottlenecks) {
          this.logger.warn(`Queue ${bottleneck.queueName}: ${bottleneck.description}`, {
            severity: bottleneck.severity,
            type: bottleneck.type,
            recommendations: bottleneck.recommendations,
          });
        }
      }

      // Update cached health metrics
      const allHealth = await this.getAllQueueHealth();
      await this.cacheManager.set('queue-health-metrics', allHealth, 60); // 1 minute

    } catch (error) {
      this.logger.error('Error during queue health monitoring:', error);
    }
  }

  /**
   * Get queue recommendations based on health
   */
  async getQueueRecommendations(queueName: string): Promise<string[]> {
    const health = await this.getQueueHealth(queueName);
    const recommendations: string[] = [];

    if (health.healthScore < 0.5) {
      recommendations.push('Queue health is critical - immediate attention required');
    }

    if (health.failureRate > 0.1) {
      recommendations.push('High failure rate detected - check job processors and error handling');
    }

    if (health.waitingJobs > 100) {
      recommendations.push('High queue backlog - consider scaling workers or optimizing job processing');
    }

    if (health.averageProcessingTime > 30000) { // 30 seconds
      recommendations.push('Slow job processing detected - optimize job logic or increase resources');
    }

    if (health.processingRate < 10) { // Less than 10 jobs per minute
      recommendations.push('Low throughput detected - review worker configuration and concurrency settings');
    }

    if (recommendations.length === 0) {
      recommendations.push('Queue is performing well - no immediate action required');
    }

    return recommendations;
  }

  /**
   * Get historical performance trends
   */
  async getPerformanceTrends(queueName: string): Promise<{
    trend: 'improving' | 'degrading' | 'stable';
    healthScoreChange: number;
    processingTimeChange: number;
    throughputChange: number;
  }> {
    const current = await this.getQueueHealth(queueName);
    const cached = this.healthMetrics.get(queueName);

    if (!cached) {
      return {
        trend: 'stable',
        healthScoreChange: 0,
        processingTimeChange: 0,
        throughputChange: 0,
      };
    }

    const healthScoreChange = current.healthScore - cached.healthScore;
    const processingTimeChange = current.averageProcessingTime - cached.averageProcessingTime;
    const throughputChange = current.processingRate - cached.processingRate;

    let trend: 'improving' | 'degrading' | 'stable' = 'stable';
    
    if (healthScoreChange > 0.1 && throughputChange > 0) {
      trend = 'improving';
    } else if (healthScoreChange < -0.1 || processingTimeChange > 5000) {
      trend = 'degrading';
    }

    return {
      trend,
      healthScoreChange,
      processingTimeChange,
      throughputChange,
    };
  }

  private async calculateQueueHealth(queue: Queue, queueName: string): Promise<QueueHealthMetrics> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaiting(),
      queue.getActive(),
      queue.getCompleted(),
      queue.getFailed(),
      queue.getDelayed(),
    ]);

    const totalJobs = waiting.length + active.length + completed.length + failed.length;
    const stats = await this.getProcessingStats(queueName);
    
    // Calculate health score (0-1)
    let healthScore = 1.0;
    const issues: string[] = [];

    // Penalize high failure rate
    if (stats.failureRate > 0.05) { // > 5%
      healthScore -= stats.failureRate * 0.5;
      issues.push(`High failure rate: ${(stats.failureRate * 100).toFixed(1)}%`);
    }

    // Penalize slow processing
    if (stats.averageProcessingTime > 10000) { // > 10 seconds
      healthScore -= 0.2;
      issues.push(`Slow processing: ${(stats.averageProcessingTime / 1000).toFixed(1)}s average`);
    }

    // Penalize high queue backlog
    if (waiting.length > 50) {
      healthScore -= Math.min(0.3, waiting.length / 1000);
      issues.push(`High backlog: ${waiting.length} waiting jobs`);
    }

    // Penalize low throughput
    if (stats.processingRate < 5) { // < 5 jobs per minute
      healthScore -= 0.2;
      issues.push(`Low throughput: ${stats.processingRate.toFixed(1)} jobs/min`);
    }

    healthScore = Math.max(0, Math.min(1, healthScore));

    const metrics: QueueHealthMetrics = {
      queueName,
      healthScore,
      totalJobs,
      waitingJobs: waiting.length,
      activeJobs: active.length,
      completedJobs: completed.length,
      failedJobs: failed.length,
      averageProcessingTime: stats.averageProcessingTime,
      processingRate: stats.processingRate,
      failureRate: stats.failureRate,
      lastUpdated: new Date(),
      issues,
    };

    // Store for trend analysis
    this.healthMetrics.set(queueName, metrics);

    return metrics;
  }

  private analyzeQueueBottlenecks(health: QueueHealthMetrics): QueueBottleneck[] {
    const bottlenecks: QueueBottleneck[] = [];

    // High wait time bottleneck
    if (health.waitingJobs > 100) {
      bottlenecks.push({
        queueName: health.queueName,
        severity: health.waitingJobs > 500 ? 'critical' : health.waitingJobs > 200 ? 'high' : 'medium',
        type: 'queue_backlog',
        description: `Queue has ${health.waitingJobs} waiting jobs`,
        metrics: {
          waitingJobs: health.waitingJobs,
          averageWaitTime: 0, // Would need additional tracking
          failureRate: health.failureRate,
          processingTime: health.averageProcessingTime,
        },
        recommendations: [
          'Increase worker concurrency',
          'Optimize job processing logic',
          'Consider horizontal scaling',
          'Review job priorities',
        ],
      });
    }

    // High failure rate bottleneck
    if (health.failureRate > 0.1) {
      bottlenecks.push({
        queueName: health.queueName,
        severity: health.failureRate > 0.25 ? 'critical' : health.failureRate > 0.15 ? 'high' : 'medium',
        type: 'high_failure_rate',
        description: `Queue has ${(health.failureRate * 100).toFixed(1)}% failure rate`,
        metrics: {
          waitingJobs: health.waitingJobs,
          averageWaitTime: 0,
          failureRate: health.failureRate,
          processingTime: health.averageProcessingTime,
        },
        recommendations: [
          'Review error logs and fix common failures',
          'Improve error handling in job processors',
          'Add retry logic with exponential backoff',
          'Validate job data before processing',
        ],
      });
    }

    // Slow processing bottleneck
    if (health.averageProcessingTime > 30000) { // 30 seconds
      bottlenecks.push({
        queueName: health.queueName,
        severity: health.averageProcessingTime > 120000 ? 'critical' : health.averageProcessingTime > 60000 ? 'high' : 'medium',
        type: 'slow_processing',
        description: `Average job processing time is ${(health.averageProcessingTime / 1000).toFixed(1)} seconds`,
        metrics: {
          waitingJobs: health.waitingJobs,
          averageWaitTime: 0,
          failureRate: health.failureRate,
          processingTime: health.averageProcessingTime,
        },
        recommendations: [
          'Optimize job processing algorithms',
          'Add database query optimization',
          'Implement caching for repeated operations',
          'Profile and identify performance bottlenecks',
        ],
      });
    }

    return bottlenecks;
  }

  private getQueueByName(name: string): Queue | null {
    switch (name) {
      case 'air-quality':
        return this.airQualityQueue;
      case 'analytics':
        return this.analyticsQueue;
      case 'notifications':
        return this.notificationsQueue;
      default:
        return null;
    }
  }

  private initializeHealthMonitoring(): void {
    // Set up periodic health monitoring
    setInterval(async () => {
      await this.monitorAndAlert();
    }, 60000); // Every minute

    this.logger.log('Queue health monitoring initialized');
  }
} 