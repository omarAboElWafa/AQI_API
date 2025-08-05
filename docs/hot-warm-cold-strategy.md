# Hot/Warm/Cold Data Strategy

## Overview

This document describes the implementation of a 3-tier data strategy using MongoDB collections with TTL (Time-To-Live) for the air quality monitoring system. This approach optimizes performance, storage costs, and query efficiency based on data age and access patterns.

## Architecture

### Data Tiers

#### 1. Hot Data (Last 30 Days)
- **Collection**: `air_quality_hot`
- **TTL**: 30 days (auto-delete)
- **Performance**: High-performance indexes
- **Use Case**: Recent data, real-time queries, alerts

#### 2. Warm Data (30 Days - 1 Year)
- **Collection**: `air_quality_warm`
- **TTL**: 365 days (auto-delete)
- **Performance**: Balanced indexes
- **Use Case**: Historical analysis, trend analysis

#### 3. Cold Data (>1 Year)
- **Collection**: `air_quality_cold`
- **TTL**: None (permanent storage)
- **Performance**: Minimal indexing
- **Use Case**: Long-term archival, compliance, research

## Collection Schemas

### Hot Collection Schema
```typescript
// High-performance indexes for recent data
{
  location: string,           // Indexed
  coordinates: {              // Geospatial index
    latitude: number,
    longitude: number
  },
  timestamp: Date,            // Primary index
  aqi: number,               // Indexed for alerts
  main_pollutant: string,
  pollution_level: string,
  weather: {
    temperature: number,
    humidity: number
  },
  metadata: {
    api_response_time: number,
    cached: boolean,
    retry_count: number
  }
}

// Indexes:
// - { timestamp: -1 }                    // Primary time index
// - { timestamp: -1, aqi: -1 }          // Time + AQI compound
// - { location: 1, timestamp: -1 }      // Location + time
// - { coordinates: '2dsphere' }         // Geospatial
// - { aqi: 1, timestamp: -1 }           // Partial index (AQI ≥ 100)
// - TTL: 30 days
```

### Warm Collection Schema
```typescript
// Balanced indexes for historical data
{
  // Same structure as hot collection
  // Reduced indexing for cost optimization
}

// Indexes:
// - { timestamp: -1 }                    // Primary time index
// - { date: 1 }                         // For daily aggregations
// - { location: 1, timestamp: -1 }      // Location + time
// - TTL: 365 days
```

### Cold Collection Schema
```typescript
// Minimal indexing for archival data
{
  // Same structure as hot collection
  // Minimal indexing for storage efficiency
}

// Indexes:
// - { timestamp: -1 }                    // Only essential index
// - No TTL (permanent storage)
```

## Data Migration Service

### Automatic Migrations

#### Daily Migration (Hot → Warm)
```typescript
@Cron(CronExpression.EVERY_DAY_AT_2AM)
async migrateHotToWarm() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  // 1. Find hot data older than 30 days
  const hotDataToMigrate = await this.hotModel.find({
    timestamp: { $lt: thirtyDaysAgo }
  }).lean();

  // 2. Batch insert to warm collection
  await this.warmModel.insertMany(warmData);

  // 3. Delete from hot collection
  await this.hotModel.deleteMany({
    timestamp: { $lt: thirtyDaysAgo }
  });
}
```

#### Monthly Migration (Warm → Cold)
```typescript
@Cron('0 3 1 * *') // 3 AM on 1st of each month
async migrateWarmToCold() {
  const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  
  // Similar logic for warm → cold migration
}
```

### Manual Migration
```typescript
async manualMigration(
  fromCollection: 'hot' | 'warm',
  toCollection: 'warm' | 'cold',
  cutoffDate: Date
): Promise<MigrationStats>
```

## Smart Query Service

### Automatic Collection Selection

The smart query service automatically determines which collections to query based on the date range:

```typescript
async getAirQualityData(startDate: Date, endDate: Date) {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

  const results = [];

  // Query hot collection if date range includes last 30 days
  if (endDate >= thirtyDaysAgo) {
    const hotData = await this.hotModel.find({...});
    results.push(...hotData);
  }

  // Query warm collection if needed
  if (startDate <= thirtyDaysAgo && endDate >= oneYearAgo) {
    const warmData = await this.warmModel.find({...});
    results.push(...warmData);
  }

  // Query cold collection if needed
  if (startDate <= oneYearAgo) {
    const coldData = await this.coldModel.find({...});
    results.push(...coldData);
  }

  return results.sort((a, b) => a.timestamp - b.timestamp);
}
```

### Query Optimization

#### Time-Series Queries
```typescript
async getTimeSeriesData(
  location: string,
  startDate: Date,
  endDate: Date,
  interval: 'hourly' | 'daily' | 'weekly'
): Promise<QueryResult>
```

#### Geospatial Queries
```typescript
async getAirQualityByLocation(
  latitude: number,
  longitude: number,
  maxDistance: number = 50000
): Promise<QueryResult>
```

## API Endpoints

### Data Management Controller

#### Collection Statistics
```http
GET /api/v1/data-management/stats
```

#### Smart Query
```http
GET /api/v1/data-management/query?startDate=2024-01-01T00:00:00Z&endDate=2024-01-31T23:59:59Z&location=Paris&limit=100
```

#### Latest Data
```http
GET /api/v1/data-management/latest/Paris
```

#### Location-Based Query
```http
GET /api/v1/data-management/location?lat=48.8566&lng=2.3522&distance=50000&limit=10
```

#### Time-Series Data
```http
GET /api/v1/data-management/timeseries/Paris?startDate=2024-01-01T00:00:00Z&endDate=2024-01-31T23:59:59Z&interval=daily
```

#### Manual Migration
```http
POST /api/v1/data-management/migrate
Content-Type: application/json

{
  "fromCollection": "hot",
  "toCollection": "warm",
  "cutoffDate": "2024-01-01T00:00:00Z"
}
```

#### Emergency Cleanup
```http
POST /api/v1/data-management/cleanup
Content-Type: application/json

{
  "cutoffDate": "2023-01-01T00:00:00Z"
}
```

## Performance Benefits

### Query Performance
- **Hot Data**: Sub-millisecond queries for recent data
- **Warm Data**: Fast queries for historical analysis
- **Cold Data**: Acceptable performance for archival queries

### Storage Optimization
- **Hot Data**: High-performance indexes, frequent access
- **Warm Data**: Balanced indexes, moderate access
- **Cold Data**: Minimal indexes, rare access

### Cost Optimization
- **Hot Data**: Premium storage, high performance
- **Warm Data**: Standard storage, balanced performance
- **Cold Data**: Archive storage, low cost

## Monitoring and Metrics

### Migration Statistics
```typescript
interface MigrationStats {
  hotToWarm: {
    migrated: number;
    deleted: number;
    errors: number;
  };
  warmToCold: {
    migrated: number;
    deleted: number;
    errors: number;
  };
  timestamp: Date;
}
```

### Collection Statistics
```typescript
interface CollectionStats {
  hot: { count: number; size: number };
  warm: { count: number; size: number };
  cold: { count: number; size: number };
}
```

### Query Performance
```typescript
interface QueryResult {
  data: any[];
  sources: {
    hot: number;
    warm: number;
    cold: number;
  };
  totalCount: number;
  executionTime: number;
}
```

## Configuration

### Environment Variables
```env
# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/aqi_monitoring

# Migration Settings
HOT_TTL_DAYS=30
WARM_TTL_DAYS=365
MIGRATION_BATCH_SIZE=1000
MIGRATION_RETRY_ATTEMPTS=3
```

### CRON Schedule
```typescript
// Daily migration at 2 AM
@Cron(CronExpression.EVERY_DAY_AT_2AM)

// Monthly migration at 3 AM on 1st of month
@Cron('0 3 1 * *')
```

## Best Practices

### Data Migration
1. **Batch Processing**: Use `insertMany()` for efficient bulk operations
2. **Error Handling**: Implement retry logic for failed migrations
3. **Monitoring**: Track migration statistics and performance
4. **Backup**: Ensure data integrity during migrations

### Query Optimization
1. **Index Usage**: Leverage appropriate indexes for each tier
2. **Query Planning**: Use `explain()` to analyze query performance
3. **Caching**: Implement Redis caching for frequently accessed data
4. **Pagination**: Use cursor-based pagination for large result sets

### Storage Management
1. **TTL Indexes**: Automatically manage data lifecycle
2. **Compression**: Enable MongoDB compression for cold data
3. **Sharding**: Consider sharding for large datasets
4. **Backup Strategy**: Implement tiered backup strategy

## Troubleshooting

### Common Issues

#### Migration Failures
```typescript
// Check migration logs
this.logger.error('Migration failed:', error);

// Manual retry
await this.dataMigrationService.manualMigration('hot', 'warm', cutoffDate);
```

#### Query Performance Issues
```typescript
// Analyze query performance
const explain = await this.hotModel.find(query).explain('executionStats');

// Check index usage
db.air_quality_hot.getIndexes()
```

#### Storage Issues
```typescript
// Check collection sizes
db.air_quality_hot.stats()
db.air_quality_warm.stats()
db.air_quality_cold.stats()

// Emergency cleanup
await this.dataMigrationService.emergencyCleanup(cutoffDate);
```

### Monitoring Queries
```typescript
// Monitor query performance
const startTime = Date.now();
const result = await this.smartQueryService.getAirQualityData(startDate, endDate);
const executionTime = Date.now() - startTime;

this.logger.log(`Query completed in ${executionTime}ms`);
```

## Future Enhancements

### Planned Features
1. **Compression**: Implement data compression for cold storage
2. **Sharding**: Add horizontal scaling for large datasets
3. **Analytics**: Enhanced analytics on tiered data
4. **Backup**: Automated backup strategy for each tier
5. **Monitoring**: Real-time monitoring dashboard

### Performance Optimizations
1. **Read Replicas**: Use read replicas for cold data queries
2. **Connection Pooling**: Optimize database connections
3. **Query Caching**: Implement query result caching
4. **Index Optimization**: Continuous index optimization 