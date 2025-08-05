import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  IQAirApiService,
  StandardizedAirQualityData,
} from './iqair-api.service';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('IQAirApiService', () => {
  let service: IQAirApiService;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IQAirApiService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<IQAirApiService>(IQAirApiService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with valid API key', () => {
      mockConfigService.get.mockReturnValue('test-api-key');

      expect(() => new IQAirApiService(configService)).not.toThrow();
    });

    it('should throw error when API key is missing', () => {
      mockConfigService.get.mockReturnValue(null);

      expect(() => new IQAirApiService(configService)).toThrow(
        'IQAir API key is required'
      );
    });
  });

  describe('fetchCityAirQuality', () => {
    it('should successfully fetch air quality data for a city', async () => {
      const mockApiResponse = {
        data: {
          status: 'success',
          data: {
            city: 'Paris',
            state: 'Ile-de-France',
            country: 'France',
            location: {
              type: 'Point',
              coordinates: [2.352222, 48.856613],
            },
            current: {
              pollution: {
                ts: '2024-08-05T10:30:00Z',
                aqius: 65,
                mainus: 'p2',
                aqicn: 65,
                maincn: 'p2',
              },
              weather: {
                ts: '2024-08-05T10:30:00Z',
                tp: 22,
                pr: 1013,
                hu: 60,
                ws: 3.5,
                wd: 270,
                ic: '01d',
              },
            },
          },
        },
      };

      mockedAxios.create.mockReturnValue({
        get: jest.fn().mockResolvedValue(mockApiResponse),
      } as any);

      const result = await service.fetchCityAirQuality(
        'Paris',
        'Ile-de-France',
        'France'
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.location).toBe('Paris, Ile-de-France, France');
      expect(result.data?.aqi).toBe(65);
      expect(result.data?.main_pollutant).toBe('p2');
    });

    it('should handle API errors gracefully', async () => {
      const mockError = {
        response: {
          status: 429,
          data: { message: 'Rate limit exceeded' },
        },
      };

      mockedAxios.create.mockReturnValue({
        get: jest.fn().mockRejectedValue(mockError),
      } as any);

      const result = await service.fetchCityAirQuality(
        'Paris',
        'Ile-de-France',
        'France'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.retryCount).toBeGreaterThan(0);
    });

    it('should retry on network errors', async () => {
      const mockError = {
        code: 'ECONNRESET',
        message: 'Connection reset',
      };

      mockedAxios.create.mockReturnValue({
        get: jest.fn().mockRejectedValue(mockError),
      } as any);

      const result = await service.fetchCityAirQuality(
        'Paris',
        'Ile-de-France',
        'France'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.retryCount).toBeGreaterThan(0);
    });
  });

  describe('fetchNearestCityAirQuality', () => {
    it('should successfully fetch air quality data for nearest city', async () => {
      const mockApiResponse = {
        data: {
          status: 'success',
          data: {
            city: 'Paris',
            state: 'Ile-de-France',
            country: 'France',
            location: {
              type: 'Point',
              coordinates: [2.352222, 48.856613],
            },
            current: {
              pollution: {
                ts: '2024-08-05T10:30:00Z',
                aqius: 65,
                mainus: 'p2',
                aqicn: 65,
                maincn: 'p2',
              },
              weather: {
                ts: '2024-08-05T10:30:00Z',
                tp: 22,
                pr: 1013,
                hu: 60,
                ws: 3.5,
                wd: 270,
                ic: '01d',
              },
            },
          },
        },
      };

      mockedAxios.create.mockReturnValue({
        get: jest.fn().mockResolvedValue(mockApiResponse),
      } as any);

      const result = await service.fetchNearestCityAirQuality(
        48.856613,
        2.352222
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.location).toBe('Paris, Ile-de-France, France');
      expect(result.data?.aqi).toBe(65);
    });

    it('should handle API errors for nearest city', async () => {
      const mockError = {
        response: {
          status: 400,
          data: { message: 'Invalid coordinates' },
        },
      };

      mockedAxios.create.mockReturnValue({
        get: jest.fn().mockRejectedValue(mockError),
      } as any);

      const result = await service.fetchNearestCityAirQuality(
        48.856613,
        2.352222
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('getHealthStatus', () => {
    it('should return health status', async () => {
      const healthStatus = await service.getHealthStatus();

      expect(healthStatus).toHaveProperty('status');
      expect(healthStatus).toHaveProperty('apiKey');
      expect(healthStatus).toHaveProperty('totalCalls');
      expect(healthStatus).toHaveProperty('successRate');
    });
  });

  describe('getRateLimitInfo', () => {
    it('should return rate limit information', async () => {
      const rateLimitInfo = await service.getRateLimitInfo();

      expect(rateLimitInfo).toHaveProperty('limit');
      expect(rateLimitInfo).toHaveProperty('remaining');
      expect(rateLimitInfo).toHaveProperty('resetTime');
      expect(rateLimitInfo.limit).toBe(10000);
      expect(rateLimitInfo.remaining).toBe(9999);
    });
  });

  describe('standardizeApiResponse', () => {
    it('should standardize API response correctly', () => {
      const mockApiResponse = {
        status: 'success',
        data: {
          city: 'Paris',
          state: 'Ile-de-France',
          country: 'France',
          location: {
            type: 'Point',
            coordinates: [2.352222, 48.856613] as [number, number],
          },
          current: {
            pollution: {
              ts: '2024-08-05T10:30:00Z',
              aqius: 65,
              mainus: 'p2',
              aqicn: 65,
              maincn: 'p2',
            },
            weather: {
              ts: '2024-08-05T10:30:00Z',
              tp: 22,
              pr: 1013,
              hu: 60,
              ws: 3.5,
              wd: 270,
              ic: '01d',
            },
          },
        },
      };

      const responseTime = 150;
      const retryCount = 0;

      const result = service['standardizeApiResponse'](
        mockApiResponse,
        responseTime,
        retryCount
      );

      expect(result).toEqual({
        location: 'Paris, Ile-de-France, France',
        coordinates: {
          latitude: 48.856613,
          longitude: 2.352222,
        },
        timestamp: expect.any(Date),
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
      });
    });
  });

  describe('getAirQualityLevel', () => {
    it.each([
      [25, 'Good'],
      [75, 'Moderate'],
      [125, 'Unhealthy for Sensitive Groups'],
      [175, 'Unhealthy'],
      [250, 'Very Unhealthy'],
      [350, 'Hazardous'],
    ])('should return correct level for AQI %i', (aqi, expectedLevel) => {
      const result = service['getAirQualityLevel'](aqi);
      expect(result).toBe(expectedLevel);
    });
  });

  describe('shouldRetry', () => {
    it('should retry on network errors', () => {
      const networkError = { code: 'ECONNRESET' };
      const result = service['shouldRetry'](networkError);
      expect(result).toBe(true);
    });

    it('should retry on server errors', () => {
      const serverError = { response: { status: 500 } };
      const result = service['shouldRetry'](serverError);
      expect(result).toBe(true);
    });

    it('should retry on rate limiting', () => {
      const rateLimitError = { response: { status: 429 } };
      const result = service['shouldRetry'](rateLimitError);
      expect(result).toBe(true);
    });

    it('should not retry on client errors', () => {
      const clientError = { response: { status: 400 } };
      const result = service['shouldRetry'](clientError);
      expect(result).toBe(false);
    });
  });

  describe('calculateRetryDelay', () => {
    it('should calculate exponential backoff delay', () => {
      const delay1 = service['calculateRetryDelay'](0);
      const delay2 = service['calculateRetryDelay'](1);
      const delay3 = service['calculateRetryDelay'](2);

      expect(delay1).toBeGreaterThan(0);
      expect(delay2).toBeGreaterThan(delay1);
      expect(delay3).toBeGreaterThan(delay2);
    });
  });
});
