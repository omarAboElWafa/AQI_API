# AQI API - REST Endpoints Guide

## Overview
This document describes all the REST API endpoints implemented for the Air Quality Index (AQI) monitoring system. The API provides access to current and historical air quality data with proper caching, error handling, and standardized responses.

## Base URL
```
http://localhost:3000/api
```

## Authentication
Admin endpoints require an API key passed in the `x-api-key` header:
```
x-api-key: admin-api-key
```

## Standardized Response Format
All endpoints return responses in this format:
```json
{
  "success": true,
  "data": {}, // Actual response data
  "metadata": {
    "cached": false,
    "dataFreshness": 5,
    "responseTime": "2024-08-05T10:30:00Z",
    "version": "1.0.0",
    "cacheTtl": 3600
  },
  "message": "Optional error message if success is false"
}
```

## Air Quality Endpoints

### 1. Current Paris Air Quality
**GET** `/api/air-quality/current`

Returns the current air quality data for Paris.

**Response:**
```json
{
  "success": true,
  "data": {
    "city": "Paris",
    "state": "Ile-de-France",
    "country": "France",
    "aqius": 65,
    "mainus": "p2",
    "aqicn": 65,
    "maincn": "p2",
    "temperature": 22,
    "pressure": 1013,
    "humidity": 60,
    "windSpeed": 3.5,
    "windDirection": 270,
    "weatherIcon": "01d",
    "timestamp": "2024-08-05T10:30:00Z",
    "level": "Moderate",
    "location": {
      "latitude": 48.856613,
      "longitude": 2.352222
    }
  },
  "metadata": { ... }
}
```

**Cache:** 5 minutes

### 2. Historical Data
**GET** `/api/air-quality/history?days=7`

Returns historical air quality data for Paris.

**Query Parameters:**
- `days` (optional): Number of days to retrieve (1-90, default: 7)

**Example:**
```bash
GET /api/air-quality/history?days=14
```

**Cache:** 30 minutes

### 3. Daily Statistics
**GET** `/api/air-quality/daily-stats?date=2024-08-05`

Returns daily statistics for a specific date.

**Query Parameters:**
- `date` (required): Date in YYYY-MM-DD format

**Response:**
```json
{
  "success": true,
  "data": {
    "date": "2024-08-05",
    "city": "Paris",
    "country": "France",
    "averageAqi": 65,
    "minAqi": 45,
    "maxAqi": 95,
    "dominantPollutant": "p2",
    "measurementCount": 24,
    "unhealthyHours": 3
  },
  "metadata": { ... }
}
```

**Cache:** 1 hour (24 hours for historical dates)

### 4. Most Polluted Time
**GET** `/api/air-quality/most-polluted`

Returns the datetime when Paris had the highest pollution level.

**Response:**
```json
{
  "success": true,
  "data": {
    "dateTime": "2024-08-05T15:30:00Z",
    "aqi": 157,
    "pollutant": "p2",
    "level": "Unhealthy",
    "city": "Paris",
    "country": "France"
  },
  "metadata": { ... }
}
```

**Cache:** 30 minutes

### 5. Nearest City by Coordinates
**GET** `/api/air-quality/nearest-city?latitude=48.856613&longitude=2.352222`

Calls the IQAIR API to get air quality data for the nearest city to the given coordinates.

**Query Parameters:**
- `latitude` (required): Latitude coordinate (-90 to 90)
- `longitude` (required): Longitude coordinate (-180 to 180)

**Example:**
```bash
GET /api/air-quality/nearest-city?latitude=48.856613&longitude=2.352222
```

**Cache:** 10 minutes

### 6. Trigger Data Fetch (Admin)
**POST** `/api/air-quality/fetch`

Manually trigger air quality data fetch for a specific location.

**Headers:**
```
x-api-key: admin-api-key
Content-Type: application/json
```

**Request Body:**
```json
{
  "city": "Paris",
  "state": "Ile-de-France",
  "country": "France"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Air quality data fetch has been queued"
  },
  "metadata": { ... }
}
```

## Analytics Endpoints

### 1. Daily Summary
**GET** `/api/analytics/daily-summary?date=2024-08-05`

Returns comprehensive daily analytics summary.

**Query Parameters:**
- `date` (required): Date in YYYY-MM-DD format
- `city` (optional): City name (default: Paris)
- `country` (optional): Country name (default: France)

**Cache:** 1 hour

### 2. Hourly Averages
**GET** `/api/analytics/hourly-averages?date=2024-08-05`

Returns hourly air quality averages for a specific date.

**Query Parameters:**
- `date` (required): Date in YYYY-MM-DD format
- `city` (optional): City name (default: Paris)
- `country` (optional): Country name (default: France)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "hour": 0,
      "averageAqi": 45,
      "measurements": 1,
      "dominantPollutant": "p2"
    },
    {
      "hour": 1,
      "averageAqi": 48,
      "measurements": 1,
      "dominantPollutant": "p2"
    }
    // ... 22 more hours
  ],
  "metadata": { ... }
}
```

**Cache:** 30 minutes

### 3. Paris-Specific Endpoints
**GET** `/api/analytics/paris/daily-summary?date=2024-08-05`
**GET** `/api/analytics/paris/hourly-averages?date=2024-08-05`

Dedicated endpoints for Paris data with the same functionality as the general endpoints.

### 4. Historical Trends
**GET** `/api/analytics/trends?city=Paris&country=France&days=30`

Returns historical trend analysis.

**Query Parameters:**
- `city` (optional): City name (default: Paris)
- `country` (optional): Country name (default: France)
- `days` (optional): Number of days to analyze (default: 30)

**Cache:** 2 hours

### 5. Pollution Patterns
**GET** `/api/analytics/pollution-patterns?city=Paris&country=France&period=weekly`

Returns pollution pattern analysis.

**Query Parameters:**
- `city` (optional): City name (default: Paris)
- `country` (optional): Country name (default: France)
- `period` (optional): Analysis period - 'weekly' or 'monthly' (default: weekly)

**Cache:** 1 hour

### 6. Health Check
**GET** `/api/analytics/health`

Returns service health status.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-08-05T10:30:00Z",
    "version": "1.0.0",
    "features": {
      "dailyStats": true,
      "hourlyStats": true,
      "historicalTrends": true,
      "pollutionPatterns": true,
      "caching": true
    }
  },
  "metadata": { ... }
}
```

## CRON Job Features

### Automatic Data Collection
The system includes a CRON job that:
- Fetches Paris air quality data every 1 minute
- Coordinates: latitude: 48.856613, longitude: 2.352222
- Saves data to the database with timestamp
- Handles retries and error recovery

### CRON Job Schedule
```
* * * * * - Every minute: Fetch Paris air quality data
0 * * * * - Every hour: Calculate hourly aggregations
59 23 * * * - Daily at 23:59: Finalize daily statistics
0 2 * * 0 - Weekly cleanup: Clean old data/logs
*/5 * * * * - Every 5 minutes: Health checks
```

## Error Handling

### HTTP Status Codes
- `200 OK` - Successful request
- `201 Created` - Resource created successfully
- `202 Accepted` - Request accepted for processing
- `400 Bad Request` - Invalid request parameters
- `401 Unauthorized` - Invalid or missing API key
- `404 Not Found` - Resource not found
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

### Error Response Format
```json
{
  "success": false,
  "data": null,
  "metadata": { ... },
  "message": "Detailed error description"
}
```

## Rate Limiting
- General endpoints: 100 requests per minute per IP
- Admin endpoints: 10 requests per minute per API key
- IQAIR API endpoints: 5 requests per minute (to respect external API limits)

## Caching Strategy

### Cache TTL by Endpoint Type
- **Current data**: 5 minutes
- **Historical data**: 30 minutes
- **Daily statistics**: 1 hour (24 hours for historical dates)
- **Analytics**: 1-2 hours
- **IQAIR API calls**: 10 minutes

### Cache Headers
All cached responses include cache metadata:
```json
{
  "metadata": {
    "cached": true,
    "dataFreshness": 5,
    "cacheTtl": 3600
  }
}
```

## Usage Examples

### Get Current Paris Air Quality
```bash
curl -X GET "http://localhost:3000/api/air-quality/current"
```

### Get Historical Data for Last 7 Days
```bash
curl -X GET "http://localhost:3000/api/air-quality/history?days=7"
```

### Get Daily Statistics
```bash
curl -X GET "http://localhost:3000/api/air-quality/daily-stats?date=2024-08-05"
```

### Get Air Quality by Coordinates
```bash
curl -X GET "http://localhost:3000/api/air-quality/nearest-city?latitude=48.856613&longitude=2.352222"
```

### Get Analytics Summary
```bash
curl -X GET "http://localhost:3000/api/analytics/daily-summary?date=2024-08-05"
```

### Trigger Manual Fetch (Admin)
```bash
curl -X POST "http://localhost:3000/api/air-quality/fetch" \
  -H "x-api-key: admin-api-key" \
  -H "Content-Type: application/json" \
  -d '{"city": "Paris", "country": "France"}'
```

## Environment Variables

Make sure to set these environment variables:

```env
# Required
IQAIR_API_KEY=your_iqair_api_key_here
MONGODB_URI=mongodb://localhost:27017/aqi_monitoring

# Optional
REDIS_HOST=localhost
REDIS_PORT=6379
ADMIN_API_KEY=your_admin_api_key_here
PORT=3000
```

## Notes

1. **Paris CRON**: The system automatically fetches Paris air quality data every minute using the specified coordinates.

2. **Most Polluted Endpoint**: The `/api/air-quality/most-polluted` endpoint returns the datetime where Paris zone had the highest pollution level based on CRON job results.

3. **Nearest City**: The `/api/air-quality/nearest-city` endpoint calls the IQAIR API's `nearest_city` endpoint to get air quality data for any coordinates.

4. **Data Validation**: All endpoints include input validation using class-validator decorators.

5. **Response Caching**: Responses are cached using Redis to improve performance and reduce external API calls.

6. **Error Recovery**: The system includes circuit breakers and retry logic for handling API failures.

7. **Monitoring**: Health check endpoints are available for monitoring service status. 