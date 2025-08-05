# MongoDB Schemas and DTOs Documentation

## Overview

This document describes all MongoDB schemas, DTOs (Data Transfer Objects), and interfaces used in the Air Quality Monitoring System.

## MongoDB Schemas

### 1. AirQualityRecord Schema

**File**: `src/modules/air-quality/schemas/air-quality-record.schema.ts`

**Purpose**: Stores individual air quality measurements with metadata.

**Fields**:
- `location` (string, indexed): City/location name (default: "paris")
- `coordinates` (object): Latitude and longitude coordinates
- `timestamp` (Date, indexed): Measurement timestamp
- `aqi` (number, 0-500): Air Quality Index value
- `main_pollutant` (enum): Primary pollutant type
- `pollution_level` (enum): Health impact level
- `weather` (object): Temperature and humidity data
- `metadata` (object): API response time, cache status, retry count

**Indexes**:
- Compound index: `{ location: 1, timestamp: -1 }`
- Geospatial index: `{ coordinates: '2dsphere' }`
- Partial index for high AQI: `{ aqi: 1, timestamp: -1 }` (AQI ≥ 100)
- Text index: `{ location: 'text' }`

### 2. DailyAggregation Schema

**File**: `src/modules/analytics/schemas/daily-aggregation.schema.ts`

**Purpose**: Stores daily aggregated air quality statistics.

**Fields**:
- `date` (string, unique): Date in YYYY-MM-DD format
- `location` (string, indexed): City/location name
- `daily_stats` (object): Aggregated statistics
  - `avg_aqi`: Daily average AQI
  - `peak_aqi`: Highest AQI with timestamp
  - `min_aqi`: Lowest AQI with timestamp
  - `dominant_pollutant`: Most frequent pollutant
  - `pollution_level_distribution`: Count by pollution level
- `hourly_averages` (array): 24-hour breakdown
- `calculated_at` (Date): When aggregation was computed
- `record_count` (number): Number of records aggregated

**Indexes**:
- Compound index: `{ location: 1, date: -1 }`
- Unique index: `{ date: 1, location: 1 }`
- Partial index for high AQI days: `{ 'daily_stats.avg_aqi': -1, date: -1 }`

## DTOs (Data Transfer Objects)

### 1. Air Quality Record DTOs

**File**: `src/common/dto/air-quality-record.dto.ts`

#### CreateAirQualityRecordDto
Used for creating new air quality records.

**Validation Rules**:
- `location`: Required string
- `coordinates`: Valid latitude (-90 to 90) and longitude (-180 to 180)
- `timestamp`: Valid date
- `aqi`: Number between 0 and 500
- `main_pollutant`: Must be one of predefined pollutants
- `pollution_level`: Must be valid health level
- `weather`: Temperature (-50 to 60°C), humidity (0-100%)

#### AirQualityResponseDto
Response format for air quality data.

#### UpdateAirQualityRecordDto
For updating existing records (all fields optional).

#### AirQualityQueryDto
For querying air quality records with filters.

### 2. Analytics DTOs

**File**: `src/common/dto/analytics.dto.ts`

#### CreateDailyAggregationDto
For creating daily aggregated statistics.

**Validation Rules**:
- `date`: Must match YYYY-MM-DD format
- `hourly_averages`: Exactly 24 entries (0-23 hours)
- `daily_stats`: Valid statistics object
- `record_count`: Non-negative number

#### DailyAggregationResponseDto
Response format for daily aggregations.

#### AnalyticsQueryDto
For querying analytics data with date ranges and filters.

#### MostPollutedTimeDto
For identifying peak pollution periods.

## Interfaces

### 1. IQAir API Interfaces

**File**: `src/common/interfaces/iqair-api.interface.ts`

#### IQAirApiResponse
Complete API response structure from IQAir.

#### IQAirApiError
Error response structure.

#### IQAirApiConfig
Configuration for API client.

### 2. Email Alert Interfaces

**File**: `src/common/interfaces/email-alert.interface.ts`

#### EmailAlert
Complete email alert structure.

#### EmailAlertTemplate
Template for generating email content.

#### EmailConfig
SMTP configuration.

#### EmailRecipient
Recipient with preferences.

### 3. Queue Job Interfaces

**File**: `src/common/interfaces/queue-job.interface.ts`

#### QueueJobData
Generic job data structure.

#### AirQualityFetchJob
Specific job for fetching air quality data.

#### EmailAlertJob
Job for sending email alerts.

#### AnalyticsJob
Job for generating analytics reports.

## Type Definitions

**File**: `src/common/types.ts`

### Core Types
- `PollutionLevel`: Health impact levels
- `Pollutant`: Valid pollutant types
- `JobPriority`: Job priority levels
- `JobStatus`: Job execution status
- `AlertFrequency`: Notification frequency
- `TrendDirection`: Data trend direction

### Utility Types
- `ApiResponse<T>`: Standard API response wrapper
- `PaginatedResponse<T>`: Paginated API response
- `QueryOptions`: Database query options
- `FilterOptions`: Query filter configuration

## Validation Rules

### Air Quality Data
- AQI values: 0-500 range
- Coordinates: Valid latitude/longitude ranges
- Timestamps: Valid ISO date strings
- Pollutants: Predefined enum values
- Pollution levels: Health impact categories

### Analytics Data
- Dates: YYYY-MM-DD format
- Hourly data: Exactly 24 entries
- Statistics: Valid numeric ranges
- Aggregations: Non-negative counts

### Email Data
- Email addresses: Valid format
- Priorities: Valid enum values
- Templates: Required fields present

## Indexing Strategy

### Time-Series Optimization
- Primary index on timestamp for chronological queries
- Compound indexes for location + time queries
- Partial indexes for high-value alerts

### Geospatial Queries
- 2dsphere index for location-based searches
- Coordinate-based proximity queries

### Text Search
- Text indexes on location names
- Full-text search capabilities

### Analytics Optimization
- Date-based indexes for time range queries
- Aggregation-specific compound indexes
- Unique constraints for data integrity

## Usage Examples

### Creating Air Quality Record
```typescript
const record: CreateAirQualityRecordDto = {
  location: "Paris",
  coordinates: { latitude: 48.8566, longitude: 2.3522 },
  timestamp: new Date(),
  aqi: 45,
  main_pollutant: "p2",
  pollution_level: "Good",
  weather: { temperature: 20, humidity: 65 },
  metadata: { api_response_time: 150, cached: false, retry_count: 0 }
};
```

### Querying with Filters
```typescript
const query: AirQualityQueryDto = {
  location: "Paris",
  startDate: new Date("2024-01-01"),
  endDate: new Date("2024-01-31"),
  minAqi: 50,
  maxAqi: 150,
  limit: 100
};
```

### Creating Daily Aggregation
```typescript
const aggregation: CreateDailyAggregationDto = {
  date: "2024-01-15",
  location: "Paris",
  daily_stats: {
    avg_aqi: 65,
    peak_aqi: { value: 120, time: "14:00" },
    min_aqi: { value: 35, time: "06:00" },
    dominant_pollutant: "p2",
    pollution_level_distribution: { "Good": 8, "Moderate": 16 }
  },
  hourly_averages: [...], // 24 entries
  record_count: 24
};
```

## Performance Considerations

### Index Usage
- Use compound indexes for common query patterns
- Partial indexes reduce index size for filtered queries
- Geospatial indexes enable efficient location queries

### Data Validation
- Client-side validation with class-validator
- Server-side validation for data integrity
- Database-level constraints for critical fields

### Caching Strategy
- Redis caching for frequently accessed data
- Cache invalidation on data updates
- TTL-based cache expiration

### Query Optimization
- Use projection to limit returned fields
- Implement pagination for large datasets
- Leverage aggregation pipelines for analytics 