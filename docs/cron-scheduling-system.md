# CRON Jobs & Scheduling System

This document describes the comprehensive CRON jobs and scheduling system implemented for the Air Quality API.

## Overview

The CRON scheduling system provides automated job execution, queue management, health monitoring, and error recovery for the Air Quality API. It includes circuit breaker patterns, duplicate prevention, performance monitoring, and comprehensive alerting.

## Architecture

### Core Components

1. **CronService** - Main scheduler with job execution and monitoring
2. **QueueHealthService** - Queue performance monitoring and bottleneck detection  
3. **CronController** - REST API for managing CRON jobs
4. **Circuit Breaker** - Automatic failure recovery and system protection
5. **Configuration** - Centralized settings and feature flags

### Key Features

- **Automated Scheduling**: Multiple CRON jobs with different intervals
- **Circuit Breaker**: Automatic failure recovery and system protection
- **Duplicate Prevention**: Prevents multiple instances of the same job
- **Health Monitoring**: Real-time queue and system health tracking
- **Performance Analytics**: Trend analysis and bottleneck detection
- **Error Recovery**: Automatic retry with exponential backoff
- **Management API**: REST endpoints for monitoring and control

## CRON Jobs

### 1. Paris Data Fetch Job
- **Schedule**: `* * * * *` (Every minute)
- **Timezone**: Europe/Paris
- **Purpose**: Fetch air quality data for Paris
- **Priority**: Normal
- **Features**: Duplicate prevention, circuit breaker protection

### 2. Hourly Aggregations
- **Schedule**: `0 * * * *` (Every hour)
- **Timezone**: UTC
- **Purpose**: Calculate current day aggregations for all locations
- **Priority**: Normal
- **Features**: Multi-location processing, automatic scaling

### 3. Daily Statistics Finalization
- **Schedule**: `59 23 * * *` (Daily at 23:59)
- **Timezone**: UTC
- **Purpose**: Finalize daily statistics and generate reports
- **Priority**: High
- **Features**: Report caching, alert notifications for high AQI

### 4. Weekly Cleanup
- **Schedule**: `0 2 * * 0` (Sunday at 2 AM)
- **Timezone**: UTC
- **Purpose**: Clean old queue jobs, logs, and temporary data
- **Priority**: Low
- **Features**: Multi-queue cleanup, cache cleaning, metrics cleanup

### 5. Health Check
- **Schedule**: `*/5 * * * *` (Every 5 minutes)
- **Timezone**: UTC
- **Purpose**: Monitor system health and queue performance
- **Priority**: High
- **Features**: Automatic alerting, circuit breaker management

## Circuit Breaker Implementation

The circuit breaker protects the system from cascading failures:

### States
- **CLOSED**: Normal operation, requests pass through
- **OPEN**: System failure detected, requests blocked
- **HALF_OPEN**: Testing if system has recovered

### Configuration
```typescript
circuitBreaker: {
  failureThreshold: 5,        // Open after 5 consecutive failures
  timeout: 5 * 60 * 1000,     // 5 minutes recovery timeout
  monitoringWindow: 60 * 1000  // 1 minute monitoring window
}
```

### Behavior
1. Counts consecutive failures
2. Opens circuit when threshold exceeded
3. Blocks requests during timeout period
4. Allows test requests in HALF_OPEN state
5. Closes circuit on successful recovery

## Queue Health Monitoring

### Health Score Calculation
The health score (0-1) considers:
- **Failure Rate**: Penalizes high failure rates
- **Processing Speed**: Penalizes slow job processing
- **Queue Backlog**: Penalizes high waiting job counts
- **Throughput**: Penalizes low processing rates

### Bottleneck Detection
Automatically detects and categorizes bottlenecks:

#### Types
- `queue_backlog`: High number of waiting jobs
- `high_failure_rate`: Excessive job failures
- `slow_processing`: Long processing times
- `high_wait_time`: Jobs waiting too long

#### Severity Levels
- **Critical**: Immediate attention required
- **High**: Significant impact on performance
- **Medium**: Moderate performance degradation
- **Low**: Minor issues, monitoring recommended

### Alert Thresholds
```typescript
alertThresholds: {
  healthScore: 0.5,     // Alert below 50%
  failureRate: 0.1,     // Alert above 10%
  waitingJobs: 100,     // Alert above 100 jobs
  processingTime: 30000 // Alert above 30 seconds
}
```

## Management API

### CRON Job Management

#### Get Job Statistics
```http
GET /cron/jobs/stats
```
Returns execution statistics for all CRON jobs.

#### Toggle Job
```http
POST /cron/jobs/{jobName}/toggle
Content-Type: application/json

{
  "enabled": true
}
```

#### Execute Job Manually
```http
POST /cron/jobs/{jobName}/execute
```

### Health Monitoring

#### Get Queue Health
```http
GET /cron/health/queues
```

#### Get Specific Queue Health
```http
GET /cron/health/queues/{queueName}
```

#### Detect Bottlenecks
```http
GET /cron/health/bottlenecks
```

#### Get Recommendations
```http
GET /cron/health/recommendations/{queueName}
```

#### Get Performance Trends
```http
GET /cron/health/trends/{queueName}
```

### System Overview

#### Complete System Status
```http
GET /cron/status/overview
```
Returns comprehensive system health including:
- CRON job statistics
- Queue health metrics
- Circuit breaker status
- Detected bottlenecks
- Overall system health

### Maintenance Operations

#### Trigger Manual Cleanup
```http
POST /cron/maintenance/cleanup
```

#### Trigger Health Check
```http
POST /cron/monitoring/health-check
```

## Configuration

### Environment Variables
```bash
# Redis Configuration
BULL_REDIS_HOST=localhost
BULL_REDIS_PORT=6379
BULL_REDIS_PASSWORD=password
BULL_REDIS_DB=0

# Feature Flags
CRON_ENABLE_DUPLICATE_PREVENTION=true
CRON_ENABLE_PERFORMANCE_MONITORING=true
CRON_ENABLE_AUTOMATIC_RECOVERY=true
CRON_ENABLE_METRICS_COLLECTION=true
CRON_ENABLE_ALERT_NOTIFICATIONS=true

# Circuit Breaker
CIRCUIT_BREAKER_FAILURE_THRESHOLD=5
CIRCUIT_BREAKER_TIMEOUT=300000
CIRCUIT_BREAKER_MONITORING_WINDOW=60000

# Health Monitoring
QUEUE_HEALTH_CHECK_INTERVAL=60000
QUEUE_HEALTH_ALERT_THRESHOLD=0.5
QUEUE_HEALTH_RETENTION_PERIOD=604800000
```

### Job Configuration
```typescript
// src/config/cron.config.ts
export default registerAs('cron', () => ({
  jobs: [
    {
      name: 'fetch-paris-data',
      cron: '* * * * *',
      timezone: 'Europe/Paris',
      enabled: true,
      description: 'Fetch air quality data for Paris every minute',
      category: 'data',
      priority: 'normal',
    },
    // ... other jobs
  ]
}));
```

## Error Handling & Recovery

### Retry Strategies
- **Data Fetch**: Exponential backoff, max 3 attempts
- **Analytics**: Fixed delay, max 2 attempts  
- **Notifications**: Exponential backoff, max 5 attempts

### Circuit Breaker Recovery
1. Detects consecutive failures
2. Opens circuit to prevent cascade
3. Waits for recovery timeout
4. Tests system recovery
5. Gradually restores normal operation

### Automatic Cleanup
- **Completed Jobs**: Removed after 7 days or 1000 count limit
- **Failed Jobs**: Removed after 30 days or 100 count limit
- **Logs**: Cleaned after 30 days
- **Metrics**: Retained for 90 days

## Monitoring & Alerting

### Performance Metrics
- Job execution counts and durations
- Success/failure rates
- Queue processing times
- System resource usage
- API response times

### Health Indicators
- Circuit breaker state
- Queue health scores
- Bottleneck severity
- System uptime
- Error rates

### Alert Conditions
- Circuit breaker opens
- Queue health below threshold
- Critical bottlenecks detected
- Job failure rates exceed limits
- Processing times exceed thresholds

## Best Practices

### Job Design
- Keep jobs idempotent
- Implement proper error handling
- Use appropriate timeouts
- Design for failure scenarios
- Log execution details

### Performance Optimization
- Monitor job execution times
- Optimize database queries
- Use caching where appropriate
- Balance job priorities
- Scale workers based on load

### Reliability
- Implement circuit breakers for external APIs
- Use retry logic with exponential backoff
- Monitor system health continuously
- Plan for graceful degradation
- Test failure scenarios

## Troubleshooting

### Common Issues

#### High Queue Backlog
**Symptoms**: Many waiting jobs, slow processing
**Solutions**: 
- Increase worker concurrency
- Optimize job processing logic
- Review resource allocation

#### High Failure Rate  
**Symptoms**: Many failed jobs, circuit breaker opening
**Solutions**:
- Check external API availability
- Review error logs
- Validate job data
- Adjust retry strategies

#### Slow Processing
**Symptoms**: Long execution times, low throughput
**Solutions**:
- Profile job execution
- Optimize database queries
- Add caching
- Review algorithm efficiency

#### Circuit Breaker Stuck Open
**Symptoms**: Jobs not executing, circuit remains open
**Solutions**:
- Check external dependencies
- Review failure threshold settings
- Manual circuit breaker reset
- Verify system recovery

### Debugging Commands

#### View Job Statistics
```bash
curl http://localhost:3000/cron/jobs/stats | jq
```

#### Check Queue Health
```bash
curl http://localhost:3000/cron/health/queues | jq
```

#### View System Overview
```bash
curl http://localhost:3000/cron/status/overview | jq
```

#### Manual Job Execution
```bash
curl -X POST http://localhost:3000/cron/jobs/health-check/execute
```

## Security Considerations

### Access Control
- Protect management endpoints with authentication
- Implement role-based access control
- Audit job execution activities
- Secure configuration access

### Data Protection
- Encrypt sensitive job data
- Secure Redis communications
- Protect API keys and credentials
- Implement data retention policies

### Monitoring
- Log all administrative actions
- Monitor for unusual job patterns
- Alert on security events
- Regular security assessments

## Future Enhancements

### Planned Features
- Dynamic job scheduling
- Advanced metrics dashboard
- Machine learning for optimization
- Multi-region job distribution
- Enhanced alerting rules

### Scalability Improvements
- Horizontal queue scaling
- Load balancing strategies
- Distributed job coordination
- Cross-region replication
- Performance auto-tuning

This CRON scheduling system provides a robust, scalable, and maintainable solution for automated job execution with comprehensive monitoring and error recovery capabilities. 