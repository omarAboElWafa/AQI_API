import { IsString, IsBoolean, IsOptional, IsEnum, IsNumber, IsDateString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ToggleCronJobDto {
  @ApiProperty({ description: 'Enable or disable the CRON job' })
  @IsBoolean()
  enabled: boolean;
}

export class ExecuteCronJobDto {
  @ApiProperty({ description: 'Name of the CRON job to execute' })
  @IsString()
  jobName: string;

  @ApiPropertyOptional({ description: 'Override execution parameters' })
  @IsOptional()
  @ValidateNested()
  @Type(() => Object)
  parameters?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Force execution even if conditions not met' })
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}

export class CronJobConfigDto {
  @ApiProperty({ description: 'CRON job name' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'CRON expression' })
  @IsString()
  cron: string;

  @ApiProperty({ description: 'Timezone for the job' })
  @IsString()
  timezone: string;

  @ApiProperty({ description: 'Whether the job is enabled' })
  @IsBoolean()
  enabled: boolean;

  @ApiProperty({ description: 'Job description' })
  @IsString()
  description: string;

  @ApiProperty({ 
    description: 'Job category',
    enum: ['data', 'analytics', 'maintenance', 'monitoring']
  })
  @IsEnum(['data', 'analytics', 'maintenance', 'monitoring'])
  category: 'data' | 'analytics' | 'maintenance' | 'monitoring';

  @ApiProperty({ 
    description: 'Job priority',
    enum: ['low', 'normal', 'high', 'critical']
  })
  @IsEnum(['low', 'normal', 'high', 'critical'])
  priority: 'low' | 'normal' | 'high' | 'critical';
}

export class CronJobStatsDto {
  @ApiProperty({ description: 'Job name' })
  jobName: string;

  @ApiProperty({ description: 'Last execution timestamp', type: Date, nullable: true })
  lastExecution: Date | null;

  @ApiProperty({ description: 'Next execution timestamp', type: Date, nullable: true })
  nextExecution: Date | null;

  @ApiProperty({ description: 'Total execution count' })
  executionCount: number;

  @ApiProperty({ description: 'Failure count' })
  failureCount: number;

  @ApiProperty({ description: 'Last execution duration in milliseconds' })
  lastExecutionDuration: number;

  @ApiProperty({ description: 'Whether the job is enabled' })
  isEnabled: boolean;

  @ApiPropertyOptional({ description: 'Last error message' })
  lastError?: string;

  @ApiProperty({ description: 'Success rate as percentage' })
  successRate: number;

  @ApiProperty({ description: 'Average execution duration in milliseconds' })
  averageExecutionDuration: number;
}

export class CircuitBreakerStateDto {
  @ApiProperty({ description: 'Current failure count' })
  failureCount: number;

  @ApiProperty({ description: 'Last failure timestamp', type: Date, nullable: true })
  lastFailureTime: Date | null;

  @ApiProperty({ 
    description: 'Circuit breaker state',
    enum: ['CLOSED', 'OPEN', 'HALF_OPEN']
  })
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';

  @ApiProperty({ description: 'Failure threshold to open circuit' })
  threshold: number;

  @ApiProperty({ description: 'Timeout before attempting to close circuit (ms)' })
  timeout: number;

  @ApiProperty({ description: 'Time remaining until circuit can transition (ms)' })
  timeToRecovery: number;
}

export class QueueHealthMetricsDto {
  @ApiProperty({ description: 'Queue name' })
  queueName: string;

  @ApiProperty({ description: 'Health score (0-1)', minimum: 0, maximum: 1 })
  healthScore: number;

  @ApiProperty({ description: 'Total jobs in queue' })
  totalJobs: number;

  @ApiProperty({ description: 'Waiting jobs count' })
  waitingJobs: number;

  @ApiProperty({ description: 'Active jobs count' })
  activeJobs: number;

  @ApiProperty({ description: 'Completed jobs count' })
  completedJobs: number;

  @ApiProperty({ description: 'Failed jobs count' })
  failedJobs: number;

  @ApiProperty({ description: 'Average processing time in milliseconds' })
  averageProcessingTime: number;

  @ApiProperty({ description: 'Processing rate (jobs per minute)' })
  processingRate: number;

  @ApiProperty({ description: 'Failure rate (0-1)', minimum: 0, maximum: 1 })
  failureRate: number;

  @ApiProperty({ description: 'Last updated timestamp' })
  lastUpdated: Date;

  @ApiProperty({ description: 'Health issues', type: [String] })
  issues: string[];

  @ApiProperty({ description: 'Queue status trend', enum: ['improving', 'stable', 'degrading'] })
  trend: 'improving' | 'stable' | 'degrading';
}

export class QueueBottleneckDto {
  @ApiProperty({ description: 'Queue name' })
  queueName: string;

  @ApiProperty({ 
    description: 'Bottleneck severity',
    enum: ['low', 'medium', 'high', 'critical']
  })
  severity: 'low' | 'medium' | 'high' | 'critical';

  @ApiProperty({ 
    description: 'Bottleneck type',
    enum: ['high_wait_time', 'high_failure_rate', 'slow_processing', 'queue_backlog']
  })
  type: 'high_wait_time' | 'high_failure_rate' | 'slow_processing' | 'queue_backlog';

  @ApiProperty({ description: 'Bottleneck description' })
  description: string;

  @ApiProperty({ description: 'Related metrics' })
  metrics: {
    waitingJobs: number;
    averageWaitTime: number;
    failureRate: number;
    processingTime: number;
  };

  @ApiProperty({ description: 'Recommendations to resolve bottleneck', type: [String] })
  recommendations: string[];

  @ApiProperty({ description: 'Estimated impact level', enum: ['low', 'medium', 'high'] })
  impact: 'low' | 'medium' | 'high';
}

export class SystemOverviewDto {
  @ApiProperty({ description: 'CRON job statistics', type: [CronJobStatsDto] })
  cronJobs: CronJobStatsDto[];

  @ApiProperty({ description: 'Queue health metrics', type: [QueueHealthMetricsDto] })
  queueHealth: QueueHealthMetricsDto[];

  @ApiProperty({ description: 'Circuit breaker state' })
  circuitBreaker: CircuitBreakerStateDto;

  @ApiProperty({ description: 'Detected bottlenecks', type: [QueueBottleneckDto] })
  bottlenecks: QueueBottleneckDto[];

  @ApiProperty({ 
    description: 'Overall system health',
    enum: ['healthy', 'warning', 'critical']
  })
  systemHealth: 'healthy' | 'warning' | 'critical';

  @ApiProperty({ description: 'System uptime in milliseconds' })
  uptime: number;

  @ApiProperty({ description: 'Last health check timestamp' })
  lastHealthCheck: Date;

  @ApiProperty({ description: 'Performance summary' })
  performance: {
    totalJobsProcessed: number;
    averageResponseTime: number;
    errorRate: number;
    throughput: number;
  };
}

export class PerformanceTrendsDto {
  @ApiProperty({ 
    description: 'Performance trend',
    enum: ['improving', 'degrading', 'stable']
  })
  trend: 'improving' | 'degrading' | 'stable';

  @ApiProperty({ description: 'Health score change since last check' })
  healthScoreChange: number;

  @ApiProperty({ description: 'Processing time change (ms)' })
  processingTimeChange: number;

  @ApiProperty({ description: 'Throughput change (jobs/min)' })
  throughputChange: number;

  @ApiProperty({ description: 'Trend analysis period (hours)' })
  analysisPeriod: number;

  @ApiProperty({ description: 'Confidence level (0-1)', minimum: 0, maximum: 1 })
  confidence: number;
}

export class ScheduleJobDto {
  @ApiProperty({ description: 'Job type' })
  @IsString()
  jobType: string;

  @ApiProperty({ description: 'Job data' })
  @ValidateNested()
  @Type(() => Object)
  data: Record<string, any>;

  @ApiProperty({ 
    description: 'Job priority',
    enum: ['low', 'normal', 'high', 'urgent', 'critical']
  })
  @IsEnum(['low', 'normal', 'high', 'urgent', 'critical'])
  priority: 'low' | 'normal' | 'high' | 'urgent' | 'critical';

  @ApiPropertyOptional({ description: 'Delay before execution (ms)' })
  @IsOptional()
  @IsNumber()
  delay?: number;

  @ApiPropertyOptional({ description: 'CRON expression for recurring jobs' })
  @IsOptional()
  @IsString()
  cron?: string;

  @ApiPropertyOptional({ description: 'Job expiration time' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({ description: 'Maximum retry attempts' })
  @IsOptional()
  @IsNumber()
  maxRetries?: number;
}

export class JobExecutionResultDto {
  @ApiProperty({ description: 'Job ID' })
  jobId: string;

  @ApiProperty({ description: 'Execution success status' })
  success: boolean;

  @ApiProperty({ description: 'Execution start time' })
  startTime: Date;

  @ApiProperty({ description: 'Execution end time' })
  endTime: Date;

  @ApiProperty({ description: 'Execution duration (ms)' })
  duration: number;

  @ApiPropertyOptional({ description: 'Result data' })
  result?: any;

  @ApiPropertyOptional({ description: 'Error message if failed' })
  error?: string;

  @ApiProperty({ description: 'Retry count' })
  retryCount: number;

  @ApiProperty({ description: 'Job metadata' })
  metadata: Record<string, any>;
} 