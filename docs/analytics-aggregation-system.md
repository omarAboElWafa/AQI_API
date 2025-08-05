# Analytics & Aggregation Service

This document describes the comprehensive analytics and data aggregation system implemented for the Air Quality API.

## Overview

The analytics service provides advanced data analysis, aggregation, and reporting capabilities with MongoDB aggregation pipelines, Redis caching, and performance optimizations. It handles daily statistics, hourly averages, historical trends, pollution patterns, and comprehensive reporting.

## Architecture

### Core Components

1. **AnalyticsService** - Main analytics engine with aggregation pipelines
2. **AnalyticsController** - REST API for analytics endpoints
3. **DailyAggregation Schema** - MongoDB schema for historical data
4. **Redis Caching** - Performance optimization with intelligent caching
5. **MongoDB Aggregation Pipelines** - Efficient data processing

### Key Features

- **Advanced Aggregations**: MongoDB pipelines for complex data analysis
- **Intelligent Caching**: Redis-based caching with TTL strategies
- **Real-time Updates**: Current day statistics with live updates
- **Historical Analysis**: Multi-day trend analysis and patterns
- **Performance Optimization**: Optimized queries and indexing
- **Missing Data Handling**: Graceful handling of data gaps
- **Comprehensive Reporting**: Multi-dimensional analytics reports

## Analytics Methods

### 1. Daily Statistics Calculation
```typescript
calculateDailyStats(date: string, city: string, country: string): Promise<DailyStats>
```

**Features:**
- MongoDB aggregation pipeline for efficient processing
- Hourly averages calculation
- Missing data hour detection
- Dominant pollutant identification
- Pollution level categorization
- Redis caching with 24h TTL

**Pipeline Stages:**
1. **$match**: Filter by city, country, and date range
2. **$facet**: Parallel processing for different aggregations
3. **$group**: Aggregate by hour and overall statistics
4. **$sort**: Order results chronologically
5. **$project**: Format final output

### 2. Current Day Updates
```typescript
updateCurrentDayStats(city: string, country: string): Promise<DailyStats>
```

**Features:**
- Real-time aggregation for today's data
- Automatic cache invalidation
- Live updates as new data arrives
- Performance optimized for frequent access

### 3. Most Polluted Time Analysis
```typescript
getMostPollutedTime(city: string, country: string, days: number): Promise<MostPollutedTime>
```

**Features:**
- Identifies peak pollution periods
- Includes weather conditions at peak time
- Configurable time window analysis
- Detailed pollutant information

### 4. Historical Trends
```typescript
getHistoricalTrends(city: string, country: string, days: number): Promise<HistoricalTrend[]>
```

**Features:**
- Multi-day trend analysis
- Daily aggregation with dominant pollutants
- Trend calculation algorithms
- Performance optimized for large datasets

### 5. Pollution Patterns
```typescript
getPollutionPatterns(city: string, country: string, period: 'weekly' | 'monthly'): Promise<PollutionPattern[]>
```

**Features:**
- Time-based pattern analysis
- Pollution level distribution
- Frequency analysis by time slots
- Weekly and monthly pattern detection

### 6. Hourly Statistics
```typescript
getHourlyStats(date: string, city: string, country: string): Promise<HourlyStats[]>
```

**Features:**
- Detailed hourly breakdown
- Weather condition averages
- Record count per hour
- Dominant pollutant per hour

### 7. Comprehensive Reports
```typescript
generateComprehensiveReport(city: string, country: string, days: number): Promise<ComprehensiveReport>
```

**Features:**
- Multi-dimensional analysis
- Summary statistics
- Trend analysis
- Pattern recognition
- Performance metrics

## MongoDB Aggregation Pipelines

### Daily Statistics Pipeline
```javascript
[
  {
    $match: {
      city,
      country,
      timestamp: { $gte: startDate, $lt: endDate }
    }
  },
  {
    $facet: {
      dailyStats: [
        {
          $group: {
            _id: null,
            averageAQI: { $avg: '$pollution.aqius' },
            maxAQI: { $max: '$pollution.aqius' },
            minAQI: { $min: '$pollution.aqius' },
            totalRecords: { $sum: 1 },
            dominantPollutant: { $push: '$pollution.mainus' }
          }
        }
      ],
      hourlyStats: [
        {
          $group: {
            _id: { $hour: '$timestamp' },
            averageAQI: { $avg: '$pollution.aqius' },
            maxAQI: { $max: '$pollution.aqius' },
            minAQI: { $min: '$pollution.aqius' },
            recordCount: { $sum: 1 },
            dominantPollutant: { $push: '$pollution.mainus' },
            avgTemperature: { $avg: '$weather.tp' },
            avgHumidity: { $avg: '$weather.hu' },
            avgPressure: { $avg: '$weather.pr' },
            avgWindSpeed: { $avg: '$weather.ws' }
          }
        },
        { $sort: { _id: 1 } }
      ],
      missingHours: [
        {
          $group: { _id: { $hour: '$timestamp' } }
        },
        { $sort: { _id: 1 } }
      ]
    }
  }
]
```

### Historical Trends Pipeline
```javascript
[
  {
    $match: {
      city,
      country,
      timestamp: { $gte: startDate, $lte: endDate }
    }
  },
  {
    $group: {
      _id: {
        $dateToString: {
          format: '%Y-%m-%d',
          date: '$timestamp'
        }
      },
      averageAQI: { $avg: '$pollution.aqius' },
      maxAQI: { $max: '$pollution.aqius' },
      minAQI: { $min: '$pollution.aqius' },
      dominantPollutant: { $push: '$pollution.mainus' },
      recordCount: { $sum: 1 }
    }
  },
  { $sort: { _id: 1 } },
  {
    $project: {
      date: '$_id',
      averageAQI: { $round: ['$averageAQI', 2] },
      maxAQI: 1,
      minAQI: 1,
      dominantPollutant: 1,
      recordCount: 1
    }
  }
]
```

### Pollution Patterns Pipeline
```javascript
[
  {
    $match: {
      city,
      country,
      timestamp: { $gte: startDate, $lte: endDate }
    }
  },
  {
    $group: {
      _id: {
        hour: { $hour: '$timestamp' },
        pollutant: '$pollution.mainus',
        pollutionLevel: {
          $switch: {
            branches: [
              { case: { $lte: ['$pollution.aqius', 50] }, then: 'Good' },
              { case: { $lte: ['$pollution.aqius', 100] }, then: 'Moderate' },
              { case: { $lte: ['$pollution.aqius', 150] }, then: 'Unhealthy for Sensitive Groups' },
              { case: { $lte: ['$pollution.aqius', 200] }, then: 'Unhealthy' },
              { case: { $lte: ['$pollution.aqius', 300] }, then: 'Very Unhealthy' }
            ],
            default: 'Hazardous'
          }
        }
      },
      averageAQI: { $avg: '$pollution.aqius' },
      frequency: { $sum: 1 }
    }
  },
  {
    $group: {
      _id: {
        hour: '$_id.hour',
        pollutionLevel: '$_id.pollutionLevel'
      },
      averageAQI: { $avg: '$averageAQI' },
      frequency: { $sum: '$frequency' },
      dominantPollutant: { $first: '$_id.pollutant' }
    }
  },
  { $sort: { '_id.hour': 1, frequency: -1 } },
  {
    $project: {
      timeSlot: {
        $concat: [
          { $toString: '$_id.hour' },
          ':00'
        ]
      },
      averageAQI: { $round: ['$averageAQI', 2] },
      frequency: 1,
      dominantPollutant: 1,
      pollutionLevel: '$_id.pollutionLevel'
    }
  }
]
```

## Redis Caching Strategy

### Cache Keys and TTL
```typescript
const cacheTTL = {
  dailyStats: 24 * 60 * 60,        // 24 hours
  hourlyStats: 60 * 60,            // 1 hour
  mostPollutedTime: 24 * 60 * 60,  // 24 hours
  historicalTrends: 6 * 60 * 60,   // 6 hours
  pollutionPatterns: 12 * 60 * 60, // 12 hours
};
```

### Cache Key Patterns
- `daily-stats:{city}:{country}:{date}`
- `hourly-stats:{city}:{country}:{date}`
- `most-polluted-time:{city}:{country}:{days}`
- `historical-trends:{city}:{country}:{days}`
- `pollution-patterns:{city}:{country}:{period}`

### Cache Invalidation
- Automatic TTL-based expiration
- Manual invalidation endpoints
- Pattern-based cache clearing
- Selective invalidation by date/city

## Performance Optimizations

### Database Indexing
```javascript
// Compound indexes for efficient queries
{ city: 1, country: 1, timestamp: -1 }
{ city: 1, country: 1, date: -1 }
{ timestamp: -1 }
{ pollutionLevel: 1, date: -1 }
```

### Query Optimization
- **Pagination**: Limit result sets for large datasets
- **Projection**: Select only required fields
- **Index Usage**: Ensure proper index utilization
- **Aggregation Optimization**: Use efficient pipeline stages

### Caching Strategy
- **Multi-level Caching**: Redis + application-level caching
- **Cache Warming**: Pre-populate frequently accessed data
- **Cache Invalidation**: Smart invalidation strategies
- **Cache Metrics**: Monitor hit rates and performance

## API Endpoints

### Daily Statistics
```http
GET /analytics/daily-stats/{city}/{country}?date=2024-01-15
```

### Current Day Updates
```http
GET /analytics/current-day/{city}/{country}
```

### Hourly Statistics
```http
GET /analytics/hourly-stats/{city}/{country}?date=2024-01-15
```

### Most Polluted Time
```http
GET /analytics/most-polluted-time/{city}/{country}?days=7
```

### Historical Trends
```http
GET /analytics/historical-trends/{city}/{country}?days=30
```

### Pollution Patterns
```http
GET /analytics/pollution-patterns/{city}/{country}?period=weekly
```

### Comprehensive Report
```http
GET /analytics/comprehensive-report/{city}/{country}?days=7
```

### Top Cities
```http
GET /analytics/top-cities?limit=10
```

### Cache Management
```http
POST /analytics/cache/invalidate/{city}/{country}?date=2024-01-15
```

### Health Check
```http
GET /analytics/health
```

## Data Models

### DailyStats Interface
```typescript
interface DailyStats {
  date: string;
  city: string;
  country: string;
  averageAQI: number;
  maxAQI: number;
  minAQI: number;
  dominantPollutant: string;
  pollutionLevel: 'Good' | 'Moderate' | 'Unhealthy for Sensitive Groups' | 'Unhealthy' | 'Very Unhealthy' | 'Hazardous';
  hourlyAverages: Array<{
    hour: number;
    averageAQI: number;
    recordCount: number;
  }>;
  totalRecords: number;
  missingDataHours: number[];
  lastUpdated: Date;
}
```

### HourlyStats Interface
```typescript
interface HourlyStats {
  hour: number;
  averageAQI: number;
  maxAQI: number;
  minAQI: number;
  dominantPollutant: string;
  recordCount: number;
  weatherAverage: {
    temperature: number;
    humidity: number;
    pressure: number;
    windSpeed: number;
  };
}
```

### HistoricalTrend Interface
```typescript
interface HistoricalTrend {
  date: string;
  averageAQI: number;
  maxAQI: number;
  minAQI: number;
  dominantPollutant: string;
  recordCount: number;
}
```

## Error Handling

### Missing Data Handling
- **Graceful Degradation**: Continue processing with available data
- **Data Gap Detection**: Identify and report missing hours
- **Interpolation**: Optional data interpolation for gaps
- **Quality Metrics**: Report data completeness

### Error Scenarios
- **No Data Available**: Return appropriate error messages
- **Invalid Parameters**: Validate input parameters
- **Database Errors**: Handle connection and query errors
- **Cache Errors**: Fallback to database queries

## Monitoring and Metrics

### Performance Metrics
- **Query Execution Time**: Monitor aggregation pipeline performance
- **Cache Hit Rate**: Track cache effectiveness
- **Memory Usage**: Monitor Redis memory consumption
- **Database Load**: Track MongoDB query patterns

### Health Checks
- **Service Availability**: Endpoint health monitoring
- **Cache Connectivity**: Redis connection status
- **Database Connectivity**: MongoDB connection status
- **Feature Availability**: Individual feature health checks

## Best Practices

### Data Processing
- **Batch Processing**: Process data in batches for large datasets
- **Incremental Updates**: Update aggregations incrementally
- **Data Validation**: Validate input data before processing
- **Error Recovery**: Implement retry mechanisms

### Caching Strategy
- **Cache Key Design**: Use consistent and meaningful cache keys
- **TTL Management**: Set appropriate TTL values
- **Cache Warming**: Pre-populate frequently accessed data
- **Cache Monitoring**: Monitor cache performance and hit rates

### Performance Optimization
- **Index Optimization**: Ensure proper database indexing
- **Query Optimization**: Optimize aggregation pipelines
- **Resource Management**: Monitor memory and CPU usage
- **Scalability Planning**: Design for horizontal scaling

## Troubleshooting

### Common Issues

#### Slow Query Performance
**Symptoms**: Long response times for analytics queries
**Solutions**:
- Check database indexes
- Optimize aggregation pipelines
- Implement query result caching
- Monitor database performance

#### High Memory Usage
**Symptoms**: High Redis memory consumption
**Solutions**:
- Review cache TTL settings
- Implement cache eviction policies
- Monitor cache key patterns
- Optimize cache storage

#### Missing Data Issues
**Symptoms**: Incomplete analytics results
**Solutions**:
- Check data ingestion pipeline
- Verify data quality
- Implement data validation
- Review error handling

#### Cache Invalidation Problems
**Symptoms**: Stale data in analytics results
**Solutions**:
- Review cache invalidation logic
- Implement proper cache keys
- Monitor cache hit rates
- Test cache invalidation scenarios

### Debugging Commands

#### Check Cache Status
```bash
# Redis CLI commands
redis-cli keys "analytics:*"
redis-cli ttl "daily-stats:Paris:France:2024-01-15"
redis-cli info memory
```

#### Monitor Database Performance
```bash
# MongoDB commands
db.airquality.explain().aggregate([...])
db.airquality.getIndexes()
db.airquality.stats()
```

#### Check Service Health
```bash
curl http://localhost:3000/analytics/health
curl http://localhost:3000/analytics/daily-stats/Paris/France
```

## Future Enhancements

### Planned Features
- **Real-time Analytics**: Live streaming analytics
- **Machine Learning**: Predictive analytics and forecasting
- **Advanced Visualizations**: Interactive charts and graphs
- **Custom Aggregations**: User-defined aggregation rules
- **Multi-dimensional Analysis**: Advanced statistical analysis

### Scalability Improvements
- **Distributed Caching**: Redis cluster implementation
- **Database Sharding**: Horizontal database scaling
- **Microservices**: Service decomposition
- **Event-driven Architecture**: Asynchronous processing
- **API Versioning**: Backward compatibility management

This analytics and aggregation system provides a robust, scalable, and performant solution for air quality data analysis with comprehensive monitoring and optimization capabilities. 