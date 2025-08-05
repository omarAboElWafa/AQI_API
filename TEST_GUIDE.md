# Testing Guide for AQI API

This guide provides comprehensive instructions for running and understanding the test suite for the AQI API application.

## 🧪 Test Structure

The test suite is organized into the following categories:

### **Unit Tests** (`src/**/*.spec.ts`)
- **AirQualityService**: Core business logic for air quality data management
- **IQAirApiService**: External API integration and error handling
- **AnalyticsService**: Data aggregation and analytics calculations
- **QueueService**: Job queue management
- **CronService**: Scheduled task execution

### **Integration Tests** (`test/integration/`)
- **Queue Job Processing**: End-to-end job processing workflows
- **CRON Job Execution**: Scheduled task execution and monitoring
- **Analytics Integration**: Data processing and caching workflows

## 🚀 Quick Start

### **Run All Tests**
```bash
npm test
```

### **Run Specific Test Types**
```bash
# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# E2E tests
npm run test:e2e

# With coverage
npm run test:coverage
```

### **Watch Mode**
```bash
# Watch all tests
npm run test:watch

# Watch specific tests
npm run test:unit -- --watch
```

## 📊 Test Coverage

The test suite aims for **70% coverage** across:
- **Branches**: 70%
- **Functions**: 70%
- **Lines**: 70%
- **Statements**: 70%

### **Coverage Report**
```bash
# Generate coverage report
npm run test:coverage

# View HTML coverage report
open coverage/lcov-report/index.html
```

## 🧩 Unit Tests

### **AirQualityService Tests**
```typescript
describe('AirQualityService', () => {
  // Tests core functionality:
  // - getLatestAirQuality()
  // - getAirQualityHistory()
  // - getAirQualityByLocation()
  // - createAirQualityRecord()
  // - addToQueue()
  // - mapToResponseDto()
  // - getAirQualityLevel()
});
```

**Key Test Scenarios:**
- ✅ Fetch latest air quality data
- ✅ Retrieve historical data with date filtering
- ✅ Location-based queries with geospatial indexing
- ✅ Data creation and validation
- ✅ Queue job scheduling
- ✅ Response DTO mapping
- ✅ AQI level classification

### **IQAirApiService Tests**
```typescript
describe('IQAirApiService', () => {
  // Tests external API integration:
  // - fetchCityAirQuality()
  // - fetchNearestCityAirQuality()
  // - Error handling and retry logic
  // - Rate limiting
  // - Response standardization
});
```

**Key Test Scenarios:**
- ✅ Successful API calls
- ✅ Error handling (network, rate limits, invalid responses)
- ✅ Retry logic with exponential backoff
- ✅ Response data standardization
- ✅ Health status monitoring
- ✅ Rate limit tracking

## 🔗 Integration Tests

### **Queue Job Processing Integration**
```typescript
describe('Queue Job Processing Integration', () => {
  // Tests end-to-end job processing:
  // - Job creation and scheduling
  // - Job execution with external API calls
  // - Database persistence
  // - Error handling and recovery
  // - Job status tracking
});
```

**Key Test Scenarios:**
- ✅ Job creation and queue management
- ✅ Successful job execution with API integration
- ✅ Database persistence of job results
- ✅ Error handling during job execution
- ✅ Job retry mechanisms
- ✅ Queue health monitoring

### **CRON Job Execution Integration**
```typescript
describe('CRON Job Execution Integration', () => {
  // Tests scheduled task execution:
  // - Paris data fetching (every minute)
  // - Hourly aggregations
  // - Daily statistics finalization
  // - Weekly cleanup operations
  // - Health monitoring
});
```

**Key Test Scenarios:**
- ✅ Scheduled Paris data fetching
- ✅ Hourly data aggregation for multiple cities
- ✅ Daily statistics generation and caching
- ✅ Weekly cleanup of old jobs
- ✅ System health monitoring
- ✅ Circuit breaker pattern implementation

### **Analytics Integration**
```typescript
describe('Analytics Integration', () => {
  // Tests analytics data processing:
  // - Daily statistics calculation
  // - Hourly averages computation
  // - Weekly trend analysis
  // - Cache integration
  // - Report generation
});
```

**Key Test Scenarios:**
- ✅ Daily statistics calculation with MongoDB aggregation
- ✅ Cache hit/miss scenarios
- ✅ Hourly data breakdown
- ✅ Weekly trend analysis
- ✅ Report generation with recommendations
- ✅ Cache invalidation

## 🛠️ Test Utilities

### **Global Test Utilities**
```typescript
// Available in all tests
global.testUtils = {
  createMockAirQualityData: () => { /* mock data */ },
  createMockApiResponse: () => { /* mock API response */ },
  createMockJob: (data) => { /* mock job */ },
  createMockQueue: () => { /* mock queue */ },
  createMockCache: () => { /* mock cache */ },
  createMockModel: () => { /* mock database model */ },
  waitForAsync: (ms) => { /* async helper */ },
};
```

### **Custom Jest Matchers**
```typescript
// Custom matchers for validation
expect(date).toBeValidDate();
expect(id).toBeValidObjectId();
expect(coordinates).toHaveValidCoordinates();
```

## 🔧 Test Configuration

### **Jest Configuration** (`jest.config.js`)
```javascript
module.exports = {
  // Test file patterns
  testRegex: '.*\\.spec\\.ts$',
  
  // Coverage settings
  collectCoverageFrom: [
    'src/**/*.(t|j)s',
    '!src/main.ts',
    '!src/**/*.module.ts',
    // ... other exclusions
  ],
  
  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};
```

### **Test Setup** (`test/setup.ts`)
```typescript
// Environment setup
process.env.NODE_ENV = 'test';
process.env.IQAIR_API_KEY = 'test-api-key';

// Global mocks
jest.useFakeTimers();
jest.spyOn(Date, 'now').mockImplementation(() => mockDate.getTime());

// Global test utilities
global.testUtils = { /* utilities */ };
```

## 📋 Test Commands Reference

### **Basic Commands**
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- air-quality.service.spec.ts

# Run tests matching pattern
npm test -- --testNamePattern="should.*successfully"
```

### **Advanced Commands**
```bash
# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Run tests with verbose output
npm test -- --verbose

# Run tests with debug information
npm run test:debug

# Run tests and generate coverage report
npm run test:coverage
```

### **Docker Test Commands**
```bash
# Run tests in Docker container
docker-compose exec aqi-api npm test

# Run tests with coverage in Docker
docker-compose exec aqi-api npm run test:coverage
```

## 🐛 Debugging Tests

### **Debug Mode**
```bash
# Run tests with Node.js debugger
npm run test:debug

# Run specific test with debug
npm test -- --runInBand --detectOpenHandles
```

### **Common Issues**

#### **1. Timeout Issues**
```bash
# Increase timeout for slow tests
npm test -- --testTimeout=10000
```

#### **2. Memory Issues**
```bash
# Increase Node.js memory
NODE_OPTIONS="--max-old-space-size=4096" npm test
```

#### **3. Database Connection Issues**
```bash
# Use test database
MONGODB_URI=mongodb://localhost:27017/test npm test
```

## 📈 Performance Testing

### **Load Testing**
```bash
# Run performance tests
npm test -- --testPathPattern=performance

# Test API response times
npm test -- --testNamePattern="performance"
```

### **Memory Testing**
```bash
# Monitor memory usage during tests
node --inspect-brk node_modules/.bin/jest --runInBand
```

## 🔍 Test Best Practices

### **1. Test Structure**
```typescript
describe('ServiceName', () => {
  describe('methodName', () => {
    it('should do something when condition', async () => {
      // Arrange
      const mockData = testUtils.createMockData();
      
      // Act
      const result = await service.method(mockData);
      
      // Assert
      expect(result).toBeDefined();
      expect(result.property).toBe(expectedValue);
    });
  });
});
```

### **2. Mocking Strategy**
```typescript
// Use dependency injection for easy mocking
const mockService = {
  method: jest.fn().mockResolvedValue(expectedResult),
};

// Mock external dependencies
jest.mock('axios');
jest.mock('@nestjs/mongoose');
```

### **3. Async Testing**
```typescript
// Use async/await for better readability
it('should handle async operations', async () => {
  const result = await service.asyncMethod();
  expect(result).toBeDefined();
});

// Test error scenarios
it('should handle errors gracefully', async () => {
  await expect(service.errorMethod()).rejects.toThrow('Expected error');
});
```

### **4. Test Data Management**
```typescript
// Use test utilities for consistent data
const mockData = testUtils.createMockAirQualityData();

// Clean up after tests
afterEach(() => {
  jest.clearAllMocks();
});
```

## 📊 Coverage Reports

### **HTML Coverage Report**
```bash
# Generate and open HTML report
npm run test:coverage
open coverage/lcov-report/index.html
```

### **Coverage Analysis**
- **Lines**: Percentage of code lines executed
- **Functions**: Percentage of functions called
- **Branches**: Percentage of conditional branches taken
- **Statements**: Percentage of statements executed

## 🚨 Continuous Integration

### **GitHub Actions Example**
```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:coverage
      - run: npm run test:integration
```

## 📚 Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [NestJS Testing Guide](https://docs.nestjs.com/fundamentals/testing)
- [MongoDB Testing](https://docs.mongodb.com/drivers/node/current/fundamentals/testing/)
- [Bull Queue Testing](https://github.com/OptimalBits/bull/blob/develop/test/test_utils.js)

The test suite provides comprehensive coverage of the AQI API functionality, ensuring reliability and maintainability of the application. 