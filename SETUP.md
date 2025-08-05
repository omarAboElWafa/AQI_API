# AQI API Setup Guide

## Prerequisites

1. **Node.js** (v16 or higher)
2. **MongoDB** (v4.4 or higher)
3. **Redis** (v6 or higher)
4. **IQAir API Key** (Get from https://www.iqair.com/air-pollution-data-api)

## Installation

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Configuration**
   Copy the example environment file and configure it:
   ```bash
   cp env.example .env
   ```

   Edit `.env` file with your settings:
   ```env
   # Required
   IQAIR_API_KEY=your_iqair_api_key_here
   MONGODB_URI=mongodb://localhost:27017/aqi_monitoring
   
   # Optional (defaults provided)
   NODE_ENV=development
   PORT=3000
   REDIS_HOST=localhost
   REDIS_PORT=6379
   ADMIN_API_KEY=your_admin_api_key_here
   CACHE_TTL=3600
   ```

3. **Database Setup**
   
   Start MongoDB (if not running):
   ```bash
   # Using brew (macOS)
   brew services start mongodb-community
   
   # Using systemctl (Linux)
   sudo systemctl start mongod
   
   # Using Docker
   docker run -d -p 27017:27017 --name mongodb mongo:latest
   ```

   Start Redis (if not running):
   ```bash
   # Using brew (macOS)
   brew services start redis
   
   # Using systemctl (Linux)
   sudo systemctl start redis
   
   # Using Docker
   docker run -d -p 6379:6379 --name redis redis:latest
   ```

## Running the Application

### Development Mode
```bash
npm run start:dev
```

### Production Mode
```bash
npm run build
npm run start:prod
```

### Debug Mode
```bash
npm run start:debug
```

## Verify Installation

1. **Health Check**
   ```bash
   curl http://localhost:3000/api/analytics/health
   ```

2. **Test Current Air Quality** (requires valid IQAIR_API_KEY)
   ```bash
   curl http://localhost:3000/api/air-quality/current
   ```

## CRON Job Verification

The system includes automatic CRON jobs that will start running when the application starts:

1. **Paris Data Fetch** - Every minute
2. **Hourly Aggregations** - Every hour
3. **Daily Statistics** - Daily at 23:59
4. **Health Checks** - Every 5 minutes
5. **Weekly Cleanup** - Sundays at 2 AM

Check logs to verify CRON jobs are running:
```bash
# In development mode, you'll see logs like:
# [CronService] Executing Paris data fetch scheduling job
# [CronService] Performing system health check
```

## Key Features Implemented

### ✅ Required Endpoints

1. **Current Paris Air Quality**
   - `GET /api/air-quality/current`
   - Returns real-time Paris air quality data

2. **Historical Data**
   - `GET /api/air-quality/history?days=7`
   - Configurable number of days (1-90)

3. **Daily Statistics**
   - `GET /api/air-quality/daily-stats?date=2024-08-05`
   - Statistics for any specific date

4. **Most Polluted Time**
   - `GET /api/air-quality/most-polluted`
   - Returns datetime with highest pollution in Paris

5. **Analytics Endpoints**
   - `GET /api/analytics/daily-summary?date=2024-08-05`
   - `GET /api/analytics/hourly-averages?date=2024-08-05`

### ✅ Special Requirements

1. **Coordinates Endpoint**
   - `GET /api/air-quality/nearest-city?latitude=48.856613&longitude=2.352222`
   - Calls IQAIR API's `nearest_city` endpoint
   - Works with any latitude/longitude coordinates

2. **Paris CRON Job**
   - Automatically fetches Paris air quality every minute
   - Uses coordinates: latitude: 48.856613, longitude: 2.352222
   - Saves data with date and time to database

3. **Most Polluted Endpoint**
   - Returns datetime when Paris was most polluted
   - Based on CRON job historical data

### ✅ Additional Features

1. **Response Formatting**
   - Standardized API response format
   - Proper HTTP status codes
   - Meaningful error messages

2. **Caching**
   - Redis-based response caching
   - Cache headers with TTL information
   - Smart cache invalidation

3. **Validation & Security**
   - Input validation with class-validator
   - API key authentication for admin endpoints
   - Rate limiting implementation

4. **Error Handling**
   - Comprehensive error handling
   - Circuit breaker pattern for external APIs
   - Retry logic with exponential backoff

5. **Documentation**
   - Complete API documentation
   - Example requests and responses
   - Clear setup instructions

## Testing the API

### Basic Tests

1. **Get Current Paris Air Quality**
   ```bash
   curl http://localhost:3000/api/air-quality/current
   ```

2. **Get Historical Data**
   ```bash
   curl "http://localhost:3000/api/air-quality/history?days=7"
   ```

3. **Get Daily Statistics**
   ```bash
   curl "http://localhost:3000/api/air-quality/daily-stats?date=2024-08-05"
   ```

4. **Get Most Polluted Time**
   ```bash
   curl http://localhost:3000/api/air-quality/most-polluted
   ```

5. **Test Coordinates Endpoint**
   ```bash
   curl "http://localhost:3000/api/air-quality/nearest-city?latitude=48.856613&longitude=2.352222"
   ```

6. **Get Analytics Summary**
   ```bash
   curl "http://localhost:3000/api/analytics/daily-summary?date=2024-08-05"
   ```

7. **Get Hourly Averages**
   ```bash
   curl "http://localhost:3000/api/analytics/hourly-averages?date=2024-08-05"
   ```

### Admin Tests (requires API key)

1. **Manual Data Fetch**
   ```bash
   curl -X POST "http://localhost:3000/api/air-quality/fetch" \
     -H "x-api-key: your_admin_api_key_here" \
     -H "Content-Type: application/json" \
     -d '{"city": "Paris", "country": "France"}'
   ```

2. **Cache Invalidation**
   ```bash
   curl -X POST "http://localhost:3000/api/analytics/cache/invalidate" \
     -H "x-api-key: your_admin_api_key_here" \
     -H "Content-Type: application/json" \
     -d '{"city": "Paris", "country": "France"}'
   ```

## Monitoring

### Health Endpoints
- `GET /api/analytics/health` - Service health status
- Monitor logs for CRON job execution
- Check Redis and MongoDB connectivity

### Expected Log Output
```
[AirQualityController] Fetching current Paris air quality
[CronService] Executing Paris data fetch scheduling job
[IQAirApiService] Successfully fetched air quality data for Paris in 234ms
[AnalyticsController] Fetching daily summary for Paris, France on 2024-08-05
```

## Troubleshooting

### Common Issues

1. **IQAIR API Key Issues**
   - Ensure your API key is valid
   - Check API usage limits
   - Verify environment variable is set correctly

2. **Database Connection Issues**
   - Ensure MongoDB is running
   - Check MONGODB_URI in .env file
   - Verify database permissions

3. **Redis Connection Issues**
   - Ensure Redis is running
   - Check REDIS_HOST and REDIS_PORT
   - Test Redis connectivity: `redis-cli ping`

4. **CRON Jobs Not Running**
   - Check application logs
   - Ensure ScheduleModule is imported
   - Verify CRON service is initialized

5. **API Validation Errors**
   - Check request format
   - Ensure required parameters are provided
   - Verify data types match expectations

### Debug Commands

```bash
# Check MongoDB status
mongo --eval "db.stats()"

# Check Redis status
redis-cli ping

# Test IQAIR API directly
curl "http://api.airvisual.com/v2/city?city=Paris&state=Ile-de-France&country=France&key=YOUR_API_KEY"

# Check application logs
npm run start:dev | grep -E "(ERROR|WARN|CronService|AirQuality)"
```

## Production Deployment

### Environment Variables for Production
```env
NODE_ENV=production
PORT=3000
MONGODB_URI=mongodb://your-production-mongodb-uri
REDIS_HOST=your-production-redis-host
IQAIR_API_KEY=your_production_api_key
ADMIN_API_KEY=secure_random_admin_key
```

### Production Checklist
- [ ] Set NODE_ENV=production
- [ ] Use secure API keys
- [ ] Configure production MongoDB and Redis
- [ ] Set up monitoring and logging
- [ ] Configure reverse proxy (nginx)
- [ ] Set up SSL certificates
- [ ] Configure rate limiting
- [ ] Set up backup strategies

## Next Steps

1. **Add More Cities**: Extend the system to monitor multiple cities
2. **Real-time Notifications**: Implement WebSocket for real-time updates
3. **Dashboard**: Create a web dashboard for visualization
4. **Alerting**: Set up email/SMS alerts for high pollution levels
5. **Data Export**: Add endpoints for data export (CSV, JSON)
6. **Machine Learning**: Implement pollution prediction models

The system is now ready with all the requested features and more! 