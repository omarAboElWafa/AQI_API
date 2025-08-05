import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AnalyticsService } from '../../src/modules/analytics/analytics.service';
import { DailyAggregation, DailyAggregationDocument } from '../../src/modules/analytics/schemas/daily-aggregation.schema';
import { AirQuality, AirQualityDocument } from '../../src/modules/air-quality/schemas/air-quality.schema';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

describe('Analytics Integration', () => {
  let module: TestingModule;
  let analyticsService: AnalyticsService;
  let dailyAggregationModel: Model<DailyAggregationDocument>;
  let airQualityModel: Model<AirQualityDocument>;
  let cacheManager: Cache;

  const mockDailyAggregationModel = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    aggregate: jest.fn(),
    exec: jest.fn(),
  };

  const mockAirQualityModel = {
    find: jest.fn(),
    aggregate: jest.fn(),
    exec: jest.fn(),
  };

  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        {
          provide: getModelToken(DailyAggregation.name),
          useValue: mockDailyAggregationModel,
        },
        {
          provide: getModelToken(AirQuality.name),
          useValue: mockAirQualityModel,
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    analyticsService = module.get<AnalyticsService>(AnalyticsService);
    dailyAggregationModel = module.get<Model<DailyAggregationDocument>>(getModelToken(DailyAggregation.name));
    airQualityModel = module.get<Model<AirQualityDocument>>(getModelToken(AirQuality.name));
    cacheManager = module.get<Cache>(CACHE_MANAGER);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateDailyStats', () => {
    it('should calculate daily statistics successfully', async () => {
      const mockAggregationResult = [
        {
          _id: null,
          averageAQI: 65.5,
          minAQI: 45,
          maxAQI: 95,
          dominantPollutant: 'p2',
          measurementCount: 24,
          unhealthyHours: 8,
        },
      ];

      mockAirQualityModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockAggregationResult),
      });

      const mockCreatedRecord = {
        _id: 'mock-id',
        date: '2024-08-05',
        city: 'Paris',
        country: 'France',
        averageAQI: 65.5,
        minAQI: 45,
        maxAQI: 95,
        dominantPollutant: 'p2',
        measurementCount: 24,
        unhealthyHours: 8,
        createdAt: new Date(),
      };

      mockDailyAggregationModel.create.mockResolvedValue(mockCreatedRecord);

      const result = await analyticsService.calculateDailyStats('2024-08-05', 'Paris', 'France');

      expect(result).toBeDefined();
      expect(result.averageAQI).toBe(65.5);
      expect(result.minAQI).toBe(45);
      expect(result.maxAQI).toBe(95);
      expect(mockAirQualityModel.aggregate).toHaveBeenCalled();
      expect(mockDailyAggregationModel.create).toHaveBeenCalled();
    });

    it('should return null when no data is found', async () => {
      mockAirQualityModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      });

      const result = await analyticsService.calculateDailyStats('2024-08-05', 'Paris', 'France');

      expect(result).toBeNull();
      expect(mockDailyAggregationModel.create).not.toHaveBeenCalled();
    });

    it('should handle aggregation errors gracefully', async () => {
      mockAirQualityModel.aggregate.mockReturnValue({
        exec: jest.fn().mockRejectedValue(new Error('Database aggregation failed')),
      });

      await expect(analyticsService.calculateDailyStats('2024-08-05', 'Paris', 'France')).rejects.toThrow('Database aggregation failed');
    });
  });

  describe('getDailySummary', () => {
    it('should return cached daily summary when available', async () => {
      const mockCachedData = {
        date: '2024-08-05',
        city: 'Paris',
        country: 'France',
        averageAQI: 65.5,
        minAQI: 45,
        maxAQI: 95,
        dominantPollutant: 'p2',
        measurementCount: 24,
        unhealthyHours: 8,
      };

      mockCacheManager.get.mockResolvedValue(mockCachedData);

      const result = await analyticsService.getDailySummary('2024-08-05', 'Paris', 'France');

      expect(result).toEqual(mockCachedData);
      expect(mockCacheManager.get).toHaveBeenCalledWith('daily-summary-Paris-France-2024-08-05');
    });

    it('should calculate and cache daily summary when not cached', async () => {
      mockCacheManager.get.mockResolvedValue(null);

      const mockAggregationResult = [
        {
          _id: null,
          averageAQI: 65.5,
          minAQI: 45,
          maxAQI: 95,
          dominantPollutant: 'p2',
          measurementCount: 24,
          unhealthyHours: 8,
        },
      ];

      mockAirQualityModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockAggregationResult),
      });

      const result = await analyticsService.getDailySummary('2024-08-05', 'Paris', 'France');

      expect(result).toBeDefined();
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        'daily-summary-Paris-France-2024-08-05',
        expect.any(Object),
        3600
      );
    });
  });

  describe('getHourlyAverages', () => {
    it('should return hourly averages for a specific date', async () => {
      const mockHourlyData = [
        { hour: 0, averageAQI: 60, count: 1 },
        { hour: 1, averageAQI: 65, count: 1 },
        { hour: 2, averageAQI: 70, count: 1 },
      ];

      mockAirQualityModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockHourlyData),
      });

      const result = await analyticsService.getHourlyAverages('2024-08-05', 'Paris', 'France');

      expect(result).toEqual(mockHourlyData);
      expect(mockAirQualityModel.aggregate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ $match: expect.any(Object) }),
          expect.objectContaining({ $group: expect.any(Object) }),
          expect.objectContaining({ $sort: expect.any(Object) }),
        ])
      );
    });

    it('should return empty array when no hourly data is found', async () => {
      mockAirQualityModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      });

      const result = await analyticsService.getHourlyAverages('2024-08-05', 'Paris', 'France');

      expect(result).toEqual([]);
    });
  });

  describe('getWeeklyTrends', () => {
    it('should calculate weekly trends successfully', async () => {
      const mockWeeklyData = [
        { date: '2024-08-01', averageAQI: 60, trend: 'improving' },
        { date: '2024-08-02', averageAQI: 65, trend: 'stable' },
        { date: '2024-08-03', averageAQI: 70, trend: 'worsening' },
      ];

      mockAirQualityModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockWeeklyData),
      });

      const result = await analyticsService.getWeeklyTrends('Paris', 'France');

      expect(result).toEqual(mockWeeklyData);
      expect(mockAirQualityModel.aggregate).toHaveBeenCalled();
    });
  });

  describe('getMostPollutedTime', () => {
    it('should return the most polluted time period', async () => {
      const mockPollutedData = [
        {
          timestamp: new Date('2024-08-05T14:00:00Z'),
          aqius: 150,
          city: 'Paris',
          country: 'France',
        },
      ];

      mockAirQualityModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(mockPollutedData),
          }),
        }),
      });

      const result = await analyticsService.getMostPollutedTime('Paris', 'France');

      expect(result).toBeDefined();
      expect(result?.aqius).toBe(150);
      expect(mockAirQualityModel.find).toHaveBeenCalledWith({
        city: 'Paris',
        country: 'France',
      });
    });

    it('should return null when no polluted data is found', async () => {
      mockAirQualityModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await analyticsService.getMostPollutedTime('Paris', 'France');

      expect(result).toBeNull();
    });
  });

  describe('generateDailyReport', () => {
    it('should generate comprehensive daily report', async () => {
      const mockDailyStats = {
        averageAQI: 65.5,
        minAQI: 45,
        maxAQI: 95,
        dominantPollutant: 'p2',
        measurementCount: 24,
        unhealthyHours: 8,
      };

      const mockHourlyData = [
        { hour: 0, averageAQI: 60, count: 1 },
        { hour: 1, averageAQI: 65, count: 1 },
      ];

      const mockMostPolluted = {
        timestamp: new Date('2024-08-05T14:00:00Z'),
        aqius: 150,
        city: 'Paris',
        country: 'France',
      };

      jest.spyOn(analyticsService, 'calculateDailyStats').mockResolvedValue(mockDailyStats);
      jest.spyOn(analyticsService, 'getHourlyAverages').mockResolvedValue(mockHourlyData);
      jest.spyOn(analyticsService, 'getMostPollutedTime').mockResolvedValue(mockMostPolluted);

      const result = await analyticsService.generateDailyReport('Paris', 'France');

      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('hourlyBreakdown');
      expect(result).toHaveProperty('peakPollution');
      expect(result).toHaveProperty('recommendations');
    });
  });

  describe('Cache Integration', () => {
    it('should invalidate cache when data is updated', async () => {
      const cacheKey = 'daily-summary-Paris-France-2024-08-05';

      await analyticsService.invalidateCache('Paris', 'France', '2024-08-05');

      expect(mockCacheManager.del).toHaveBeenCalledWith(cacheKey);
    });

    it('should handle cache invalidation errors gracefully', async () => {
      mockCacheManager.del.mockRejectedValue(new Error('Cache deletion failed'));

      await expect(analyticsService.invalidateCache('Paris', 'France', '2024-08-05')).rejects.toThrow('Cache deletion failed');
    });
  });

  describe('Data Validation', () => {
    it('should validate date format correctly', async () => {
      const invalidDate = 'invalid-date';

      await expect(analyticsService.calculateDailyStats(invalidDate, 'Paris', 'France')).rejects.toThrow();
    });

    it('should handle empty city and country parameters', async () => {
      await expect(analyticsService.calculateDailyStats('2024-08-05', '', '')).rejects.toThrow();
    });
  });

  describe('Performance Metrics', () => {
    it('should track analytics calculation time', async () => {
      const startTime = Date.now();

      const mockAggregationResult = [
        {
          _id: null,
          averageAQI: 65.5,
          minAQI: 45,
          maxAQI: 95,
          dominantPollutant: 'p2',
          measurementCount: 24,
          unhealthyHours: 8,
        },
      ];

      mockAirQualityModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockAggregationResult),
      });

      await analyticsService.calculateDailyStats('2024-08-05', 'Paris', 'France');

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      expect(executionTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });
}); 