import { Controller, Get, Post, Param, Body, UseGuards, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';

import { CronService, CronJobStats, CircuitBreakerState } from '../services/cron.service';
import { QueueHealthService, QueueHealthMetrics, QueueBottleneck } from '../../queue/services/queue-health.service';

export class ToggleCronJobDto {
  enabled: boolean;
}

export class CronJobManagementDto {
  jobName: string;
  action: 'start' | 'stop' | 'execute';
}

@ApiTags('cron-management')
@Controller('cron')
export class CronController {
  private readonly logger = new Logger(CronController.name);

  constructor(
    private readonly cronService: CronService,
    private readonly queueHealthService: QueueHealthService,
  ) {}

  @Get('jobs/stats')
  @ApiOperation({ summary: 'Get CRON job statistics' })
  @ApiResponse({ status: 200, description: 'CRON job statistics retrieved successfully' })
  async getCronJobStats(): Promise<CronJobStats[]> {
    this.logger.log('Fetching CRON job statistics');
    return this.cronService.getCronJobStats();
  }

  @Get('circuit-breaker/status')
  @ApiOperation({ summary: 'Get circuit breaker status' })
  @ApiResponse({ status: 200, description: 'Circuit breaker status retrieved successfully' })
  async getCircuitBreakerStatus(): Promise<CircuitBreakerState> {
    this.logger.log('Fetching circuit breaker status');
    return this.cronService.getCircuitBreakerStatus();
  }

  @Post('jobs/:jobName/toggle')
  @ApiOperation({ summary: 'Enable or disable a specific CRON job' })
  @ApiParam({ name: 'jobName', description: 'Name of the CRON job' })
  @ApiResponse({ status: 200, description: 'CRON job toggled successfully' })
  async toggleCronJob(
    @Param('jobName') jobName: string,
    @Body() toggleDto: ToggleCronJobDto,
  ): Promise<{ message: string; jobName: string; enabled: boolean }> {
    this.logger.log(`Toggling CRON job ${jobName} to ${toggleDto.enabled ? 'enabled' : 'disabled'}`);
    
    await this.cronService.toggleCronJob(jobName, toggleDto.enabled);
    
    return {
      message: `CRON job ${jobName} ${toggleDto.enabled ? 'enabled' : 'disabled'} successfully`,
      jobName,
      enabled: toggleDto.enabled,
    };
  }

  @Post('jobs/:jobName/execute')
  @ApiOperation({ summary: 'Manually execute a CRON job' })
  @ApiParam({ name: 'jobName', description: 'Name of the CRON job to execute' })
  @ApiResponse({ status: 200, description: 'CRON job executed successfully' })
  async executeCronJob(@Param('jobName') jobName: string): Promise<{ message: string; jobName: string }> {
    this.logger.log(`Manually executing CRON job: ${jobName}`);
    
    await this.cronService.executeJobManually(jobName);
    
    return {
      message: `CRON job ${jobName} executed successfully`,
      jobName,
    };
  }

  @Get('health/queues')
  @ApiOperation({ summary: 'Get health metrics for all queues' })
  @ApiResponse({ status: 200, description: 'Queue health metrics retrieved successfully' })
  async getQueueHealth(): Promise<QueueHealthMetrics[]> {
    this.logger.log('Fetching queue health metrics');
    return this.queueHealthService.getAllQueueHealth();
  }

  @Get('health/queues/:queueName')
  @ApiOperation({ summary: 'Get health metrics for a specific queue' })
  @ApiParam({ name: 'queueName', description: 'Name of the queue' })
  @ApiResponse({ status: 200, description: 'Queue health metrics retrieved successfully' })
  async getSpecificQueueHealth(@Param('queueName') queueName: string): Promise<QueueHealthMetrics> {
    this.logger.log(`Fetching health metrics for queue: ${queueName}`);
    return this.queueHealthService.getQueueHealth(queueName);
  }

  @Get('health/bottlenecks')
  @ApiOperation({ summary: 'Detect queue bottlenecks' })
  @ApiResponse({ status: 200, description: 'Queue bottlenecks detected successfully' })
  async detectBottlenecks(): Promise<QueueBottleneck[]> {
    this.logger.log('Detecting queue bottlenecks');
    return this.queueHealthService.detectBottlenecks();
  }

  @Get('health/recommendations/:queueName')
  @ApiOperation({ summary: 'Get recommendations for a specific queue' })
  @ApiParam({ name: 'queueName', description: 'Name of the queue' })
  @ApiResponse({ status: 200, description: 'Queue recommendations retrieved successfully' })
  async getQueueRecommendations(@Param('queueName') queueName: string): Promise<string[]> {
    this.logger.log(`Fetching recommendations for queue: ${queueName}`);
    return this.queueHealthService.getQueueRecommendations(queueName);
  }

  @Get('health/trends/:queueName')
  @ApiOperation({ summary: 'Get performance trends for a specific queue' })
  @ApiParam({ name: 'queueName', description: 'Name of the queue' })
  @ApiResponse({ status: 200, description: 'Performance trends retrieved successfully' })
  async getPerformanceTrends(@Param('queueName') queueName: string): Promise<{
    trend: 'improving' | 'degrading' | 'stable';
    healthScoreChange: number;
    processingTimeChange: number;
    throughputChange: number;
  }> {
    this.logger.log(`Fetching performance trends for queue: ${queueName}`);
    return this.queueHealthService.getPerformanceTrends(queueName);
  }

  @Get('status/overview')
  @ApiOperation({ summary: 'Get overall system status overview' })
  @ApiResponse({ status: 200, description: 'System status overview retrieved successfully' })
  async getSystemOverview(): Promise<{
    cronJobs: CronJobStats[];
    queueHealth: QueueHealthMetrics[];
    circuitBreaker: CircuitBreakerState;
    bottlenecks: QueueBottleneck[];
    systemHealth: 'healthy' | 'warning' | 'critical';
  }> {
    this.logger.log('Fetching system status overview');

    const [cronJobs, queueHealth, circuitBreaker, bottlenecks] = await Promise.all([
      this.cronService.getCronJobStats(),
      this.queueHealthService.getAllQueueHealth(),
      this.cronService.getCircuitBreakerStatus(),
      this.queueHealthService.detectBottlenecks(),
    ]);

    // Determine overall system health
    let systemHealth: 'healthy' | 'warning' | 'critical' = 'healthy';
    
    const criticalBottlenecks = bottlenecks.filter(b => b.severity === 'critical');
    const avgHealthScore = queueHealth.reduce((sum, q) => sum + q.healthScore, 0) / queueHealth.length;
    const failedJobs = cronJobs.filter(job => job.failureCount > 0);

    if (criticalBottlenecks.length > 0 || avgHealthScore < 0.3 || circuitBreaker.state === 'OPEN') {
      systemHealth = 'critical';
    } else if (bottlenecks.length > 0 || avgHealthScore < 0.7 || failedJobs.length > 0) {
      systemHealth = 'warning';
    }

    return {
      cronJobs,
      queueHealth,
      circuitBreaker,
      bottlenecks,
      systemHealth,
    };
  }

  @Post('maintenance/cleanup')
  @ApiOperation({ summary: 'Trigger manual system cleanup' })
  @ApiResponse({ status: 200, description: 'System cleanup triggered successfully' })
  async triggerCleanup(): Promise<{ message: string; timestamp: Date }> {
    this.logger.log('Triggering manual system cleanup');
    
    await this.cronService.executeJobManually('weekly-cleanup');
    
    return {
      message: 'System cleanup triggered successfully',
      timestamp: new Date(),
    };
  }

  @Post('monitoring/health-check')
  @ApiOperation({ summary: 'Trigger manual health check' })
  @ApiResponse({ status: 200, description: 'Health check triggered successfully' })
  async triggerHealthCheck(): Promise<{ message: string; timestamp: Date }> {
    this.logger.log('Triggering manual health check');
    
    await this.cronService.executeJobManually('health-check');
    
    return {
      message: 'Health check triggered successfully',
      timestamp: new Date(),
    };
  }
} 