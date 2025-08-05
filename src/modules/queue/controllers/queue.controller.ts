import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Query,
  Param,
  Body,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';

import { QueueService, JobPriority } from '../services/queue.service';
import { QueueHealthService } from '../services/queue-health.service';

@ApiTags('Queue Management')
@Controller('queue')
export class QueueController {
  constructor(
    private readonly queueService: QueueService,
    private readonly queueHealthService: QueueHealthService
  ) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get queue statistics' })
  @ApiResponse({
    status: 200,
    description: 'Queue statistics retrieved successfully',
  })
  async getQueueStats() {
    return await this.queueService.getQueueStats();
  }

  @Get('health')
  @ApiOperation({ summary: 'Get queue health status' })
  @ApiResponse({
    status: 200,
    description: 'Queue health status retrieved successfully',
  })
  async getQueueHealth() {
    return await this.queueHealthService.getAllQueueHealth();
  }

  @Get('health/:queueName')
  @ApiOperation({ summary: 'Get specific queue health status' })
  @ApiParam({
    name: 'queueName',
    description: 'Queue name',
    example: 'air-quality',
  })
  @ApiResponse({
    status: 200,
    description: 'Specific queue health status retrieved successfully',
  })
  async getSpecificQueueHealth(@Param('queueName') queueName: string) {
    return await this.queueHealthService.getQueueHealth(queueName);
  }

  @Post('jobs/fetch-paris-data')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Add fetch Paris data job' })
  @ApiResponse({
    status: 202,
    description: 'Job added successfully',
  })
  async addFetchParisDataJob(
    @Body()
    body: {
      priority?: JobPriority;
      delay?: number;
    } = {}
  ) {
    const job = await this.queueService.addFetchParisDataJob(
      body.priority || JobPriority.NORMAL,
      body.delay
    );

    return {
      message: 'Fetch Paris data job added',
      jobId: job.id,
      priority: body.priority || JobPriority.NORMAL,
    };
  }

  @Post('jobs/calculate-daily-stats')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Add calculate daily stats job' })
  @ApiResponse({
    status: 202,
    description: 'Job added successfully',
  })
  async addCalculateDailyStatsJob(
    @Body() body: { location: string; date: string; priority?: JobPriority }
  ) {
    const job = await this.queueService.addCalculateDailyStatsJob(
      body.location,
      body.date,
      body.priority || JobPriority.NORMAL
    );

    return {
      message: 'Calculate daily stats job added',
      jobId: job.id,
      location: body.location,
      date: body.date,
    };
  }

  @Post('jobs/send-alert-email')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Add send alert email job' })
  @ApiResponse({
    status: 202,
    description: 'Job added successfully',
  })
  async addSendAlertEmailJob(
    @Body()
    body: {
      city: string;
      aqi: number;
      level: string;
      recipient: string;
      priority?: JobPriority;
    }
  ) {
    const job = await this.queueService.addSendAlertEmailJob(
      {
        city: body.city,
        aqi: body.aqi,
        level: body.level,
        recipient: body.recipient,
      },
      body.priority || JobPriority.HIGH
    );

    return {
      message: 'Send alert email job added',
      jobId: job.id,
      city: body.city,
      aqi: body.aqi,
    };
  }

  @Post('schedule/paris-data')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Schedule recurring Paris data fetching' })
  @ApiResponse({
    status: 202,
    description: 'Recurring job scheduled successfully',
  })
  async scheduleParisDataFetching() {
    await this.queueService.scheduleParisDataFetching();

    return {
      message: 'Paris data fetching scheduled to run every minute',
    };
  }

  @Post('schedule/daily-stats')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Schedule daily stats calculation' })
  @ApiResponse({
    status: 202,
    description: 'Daily stats calculation scheduled successfully',
  })
  async scheduleDailyStatsCalculation() {
    await this.queueService.scheduleDailyStatsCalculation();

    return {
      message: 'Daily stats calculation scheduled to run daily at 1 AM',
    };
  }

  @Get('failed/:queueName')
  @ApiOperation({ summary: 'Get failed jobs' })
  @ApiParam({
    name: 'queueName',
    description: 'Queue name',
    example: 'air-quality',
  })
  @ApiQuery({
    name: 'limit',
    description: 'Number of jobs to return',
    example: 10,
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Failed jobs retrieved successfully',
  })
  async getFailedJobs(
    @Param('queueName') queueName: string,
    @Query('limit') limit?: number
  ) {
    const jobs = await this.queueService.getFailedJobs(queueName, limit || 10);

    return {
      queueName,
      failedJobs: jobs.map(job => ({
        id: job.id,
        name: job.name,
        data: job.data,
        failedReason: job.failedReason,
        timestamp: job.timestamp,
        attemptsMade: job.attemptsMade,
      })),
    };
  }

  @Post('retry/:queueName/:jobId')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Retry failed job' })
  @ApiParam({
    name: 'queueName',
    description: 'Queue name',
    example: 'air-quality',
  })
  @ApiParam({ name: 'jobId', description: 'Job ID', example: '123' })
  @ApiResponse({
    status: 202,
    description: 'Job retry initiated successfully',
  })
  async retryFailedJob(
    @Param('queueName') queueName: string,
    @Param('jobId') jobId: string
  ) {
    await this.queueService.retryFailedJob(queueName, jobId);

    return {
      message: 'Job retry initiated',
      queueName,
      jobId,
    };
  }

  @Put('pause/:queueName')
  @ApiOperation({ summary: 'Pause queue' })
  @ApiParam({
    name: 'queueName',
    description: 'Queue name',
    example: 'air-quality',
  })
  @ApiResponse({
    status: 200,
    description: 'Queue paused successfully',
  })
  async pauseQueue(@Param('queueName') queueName: string) {
    await this.queueService.pauseQueue(queueName);

    return {
      message: 'Queue paused',
      queueName,
    };
  }

  @Put('resume/:queueName')
  @ApiOperation({ summary: 'Resume queue' })
  @ApiParam({
    name: 'queueName',
    description: 'Queue name',
    example: 'air-quality',
  })
  @ApiResponse({
    status: 200,
    description: 'Queue resumed successfully',
  })
  async resumeQueue(@Param('queueName') queueName: string) {
    await this.queueService.resumeQueue(queueName);

    return {
      message: 'Queue resumed',
      queueName,
    };
  }

  @Delete('clean/:queueName')
  @ApiOperation({ summary: 'Clean completed jobs' })
  @ApiParam({
    name: 'queueName',
    description: 'Queue name',
    example: 'air-quality',
  })
  @ApiQuery({
    name: 'olderThan',
    description: 'Clean jobs older than (milliseconds)',
    example: 86400000,
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Jobs cleaned successfully',
  })
  async cleanCompletedJobs(
    @Param('queueName') queueName: string,
    @Query('olderThan') olderThan?: number
  ) {
    const cleaned = await this.queueService.cleanCompletedJobs(
      queueName,
      olderThan || 24 * 60 * 60 * 1000 // 24 hours default
    );

    return {
      message: 'Completed jobs cleaned',
      queueName,
      cleanedCount: cleaned,
    };
  }

  @Get('jobs/active')
  @ApiOperation({ summary: 'Get all active jobs' })
  @ApiResponse({
    status: 200,
    description: 'Active jobs retrieved successfully',
  })
  async getActiveJobs() {
    const activeJobs = await this.queueService.getActiveJobs();

    return {
      activeJobs: activeJobs.map(({ queueName, jobs }) => ({
        queueName,
        count: jobs.length,
        jobs: jobs.map(job => ({
          id: job.id,
          name: job.name,
          data: job.data,
          progress: job.progress(),
          timestamp: job.timestamp,
        })),
      })),
    };
  }

  @Get('jobs/:queueName/:jobId')
  @ApiOperation({ summary: 'Get job details' })
  @ApiParam({
    name: 'queueName',
    description: 'Queue name',
    example: 'air-quality',
  })
  @ApiParam({ name: 'jobId', description: 'Job ID', example: '123' })
  @ApiResponse({
    status: 200,
    description: 'Job details retrieved successfully',
  })
  async getJobDetails(
    @Param('queueName') queueName: string,
    @Param('jobId') jobId: string
  ) {
    const job = await this.queueService.getJobDetails(queueName, jobId);

    if (!job) {
      return {
        message: 'Job not found',
        queueName,
        jobId,
      };
    }

    return {
      id: job.id,
      name: job.name,
      data: job.data,
      opts: job.opts,
      progress: job.progress(),
      timestamp: job.timestamp,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason,
      returnvalue: job.returnvalue,
    };
  }

  @Delete('jobs/:queueName/:jobId')
  @ApiOperation({ summary: 'Remove job' })
  @ApiParam({
    name: 'queueName',
    description: 'Queue name',
    example: 'air-quality',
  })
  @ApiParam({ name: 'jobId', description: 'Job ID', example: '123' })
  @ApiResponse({
    status: 200,
    description: 'Job removed successfully',
  })
  async removeJob(
    @Param('queueName') queueName: string,
    @Param('jobId') jobId: string
  ) {
    await this.queueService.removeJob(queueName, jobId);

    return {
      message: 'Job removed',
      queueName,
      jobId,
    };
  }

  @Get('metrics/:queueName')
  @ApiOperation({ summary: 'Get detailed job metrics' })
  @ApiParam({
    name: 'queueName',
    description: 'Queue name',
    example: 'air-quality',
  })
  @ApiResponse({
    status: 200,
    description: 'Job metrics retrieved successfully',
  })
  async getJobMetrics(@Param('queueName') queueName: string) {
    return await this.queueHealthService.getProcessingStats(queueName);
  }

  @Get('connection-status')
  @ApiOperation({ summary: 'Get queue connection status' })
  @ApiResponse({
    status: 200,
    description: 'Connection status retrieved successfully',
  })
  async getConnectionStatus() {
    return await this.queueHealthService.getAllQueueHealth();
  }

  /**
   * Helper method to get queue by name (for health service)
   */
  private getQueueByName(queueName: string): any {
    // This is a simplified implementation
    // In a real scenario, you'd inject the specific queue or use a registry
    switch (queueName) {
      case 'air-quality':
      case 'notifications':
      case 'analytics':
        return {}; // Queue instance would be returned here
      default:
        throw new Error(`Queue ${queueName} not found`);
    }
  }
}
