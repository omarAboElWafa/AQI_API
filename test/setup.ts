import { ConfigModule } from '@nestjs/config';

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.IQAIR_API_KEY = 'test-api-key';
process.env.ADMIN_API_KEY = 'test-admin-key';
process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';

// Global test setup
beforeAll(async () => {
  // Setup any global test configuration
  console.log('Setting up test environment...');
});

afterAll(async () => {
  // Cleanup after all tests
  console.log('Cleaning up test environment...');
});

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock setTimeout and setInterval for faster tests
jest.useFakeTimers();

// Mock Date.now() for consistent timestamps in tests
const mockDate = new Date('2024-08-05T10:00:00Z');
jest.spyOn(Date, 'now').mockImplementation(() => mockDate.getTime());

// Global test utilities
global.testUtils = {
  createMockAirQualityData: () => ({
    city: 'Paris',
    state: 'Ile-de-France',
    country: 'France',
    location: {
      type: 'Point',
      coordinates: [2.352222, 48.856613],
    },
    pollution: {
      ts: new Date().toISOString(),
      aqius: 65,
      mainus: 'p2',
      aqicn: 65,
      maincn: 'p2',
    },
    weather: {
      ts: new Date().toISOString(),
      tp: 22,
      pr: 1013,
      hu: 60,
      ws: 3.5,
      wd: 270,
      ic: '01d',
    },
    timestamp: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  }),

  createMockApiResponse: () => ({
    success: true,
    data: {
      location: 'Paris, Ile-de-France, France',
      coordinates: {
        latitude: 48.856613,
        longitude: 2.352222,
      },
      timestamp: new Date(),
      aqi: 65,
      main_pollutant: 'p2',
      pollution_level: 'Moderate',
      weather: {
        temperature: 22,
        humidity: 60,
      },
      metadata: {
        api_response_time: 150,
        cached: false,
        retry_count: 0,
      },
    },
  }),

  createMockJob: (data: any = {}) => ({
    id: 'test-job-id',
    data,
    progress: jest.fn(),
    log: jest.fn(),
    finished: jest.fn(),
    failed: jest.fn(),
  }),

  createMockQueue: () => ({
    add: jest.fn(),
    process: jest.fn(),
    getJob: jest.fn(),
    getJobs: jest.fn(),
    clean: jest.fn(),
    close: jest.fn(),
  }),

  createMockCache: () => ({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    reset: jest.fn(),
  }),

  createMockModel: () => ({
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    aggregate: jest.fn(),
    exec: jest.fn(),
  }),

  waitForAsync: (ms: number = 100) => new Promise(resolve => setTimeout(resolve, ms)),
};

// Extend Jest matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidDate(): R;
      toBeValidObjectId(): R;
      toHaveValidCoordinates(): R;
    }
  }

  var testUtils: {
    createMockAirQualityData: () => any;
    createMockApiResponse: () => any;
    createMockJob: (data?: any) => any;
    createMockQueue: () => any;
    createMockCache: () => any;
    createMockModel: () => any;
    waitForAsync: (ms?: number) => Promise<void>;
  };
}

// Custom Jest matchers
expect.extend({
  toBeValidDate(received) {
    const pass = received instanceof Date && !isNaN(received.getTime());
    return {
      message: () => `expected ${received} to be a valid Date`,
      pass,
    };
  },

  toBeValidObjectId(received) {
    const pass = typeof received === 'string' && /^[0-9a-fA-F]{24}$/.test(received);
    return {
      message: () => `expected ${received} to be a valid ObjectId`,
      pass,
    };
  },

  toHaveValidCoordinates(received) {
    const pass = received && 
                 typeof received.latitude === 'number' && 
                 typeof received.longitude === 'number' &&
                 received.latitude >= -90 && 
                 received.latitude <= 90 &&
                 received.longitude >= -180 && 
                 received.longitude <= 180;
    return {
      message: () => `expected ${received} to have valid coordinates`,
      pass,
    };
  },
}); 