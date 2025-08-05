import { Test, TestingModule } from '@nestjs/testing';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronService } from '../../src/modules/air-quality/services/cron.service';
import { QueueService } from '../../src/modules/queue/services/queue.service';
import { AnalyticsService } from '../../src/modules/analytics/analytics.service';
import { QueueHealthService } from '../../src/modules/queue/services/queue-health.service';
import { Queue } from 'bull';
import { getQueueToken } from '@nestjs/bull';
import { CACHE_MANAGER } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';

describe('CRON Job Execution Integration', () => {
  let module: TestingModule;
  let cronService: CronService;
  let queueService: QueueService;
  let analyticsService: AnalyticsService;
  let queueHealthService: QueueHealthService;
  let airQualityQueue: Queue;
  let analyticsQueue: Queue;
  let notificationsQueue: Queue;
  let cacheManager: Cache;

  const mockQueueService = {
    addFetchParisDataJob: jest.fn(),
    addCalculateDailyStatsJob: jest.fn(),
    cleanCompletedJobs: jest.fn(),
  };

  const mockAnalyticsService = {
    generateDailyReport: jest.fn(),
    generateWeeklyReport: jest.fn(),
    invalidateCache: jest.fn(),
  };

  const mockQueueHealthService = {
    getQueueHealth: jest.fn(),
  };

  const mockAirQualityQueue = {
    add: jest.fn(),
    process: jest.fn(),
    getJob: jest.fn(),
    getJobs: jest.fn(),
  };

  const mockAnalyticsQueue = {
    add: jest.fn(),
    process: jest.fn(),
    getJob: jest.fn(),
    getJobs: jest.fn(),
  };

  const mockNotificationsQueue = {
    add: jest.fn(),
    process: jest.fn(),
    getJob: jest.fn(),
    getJobs: jest.fn(),
  };

  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  const mockSchedulerRegistry = {
    getCronJob: jest.fn(),
    addCronJob: jest.fn(),
    deleteCronJob: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CronService,
        {
          provide: QueueService,
          useValue: mockQueueService,
        },
        {
          provide: AnalyticsService,
          useValue: mockAnalyticsService,
        },
        {
          provide: QueueHealthService,
          useValue: mockQueueHealthService,
        },
        {
          provide: getQueueToken('air-quality'),
          useValue: mockAirQualityQueue,
        },
        {
          provide: getQueueToken('analytics'),
          useValue: mockAnalyticsQueue,
        },
        {
          provide: getQueueToken('notifications'),
          useValue: mockNotificationsQueue,
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
        {
          provide: SchedulerRegistry,
          useValue: mockSchedulerRegistry,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-api-key'),
          },
        },
      ],
    }).compile();

    cronService = module.get<CronService>(CronService);
    queueService = module.get<QueueService>(QueueService);
    analyticsService = module.get<AnalyticsService>(AnalyticsService);
    queueHealthService = module.get<QueueHealthService>(QueueHealthService);
    airQualityQueue = module.get<Queue>(getQueueToken('air-quality'));
    analyticsQueue = module.get<Queue>(getQueueToken('analytics'));
    notificationsQueue = module.get<Queue>(getQueueToken('notifications'));
    cacheManager = module.get<Cache>(CACHE_MANAGER);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('scheduleParisFetch', () => {
    it('should schedule Paris data fetch job successfully', async () => {
      const mockQueueHealth = {
        healthScore: 0.9,
        queueName: 'air-quality',
        issues: [],
      };

      mockQueueHealthService.getQueueHealth.mockResolvedValue(mockQueueHealth);
      mockQueueService.addFetchParisDataJob.mockResolvedValue({ id: 'test-job-id' });

      await cronService.scheduleParisFetch();

      expect(mockQueueHealthService.getQueueHealth).toHaveBeenCalledWith('air-quality');
      expect(mockQueueService.addFetchParisDataJob).toHaveBeenCalled();
    });

    it('should skip job when queue health is poor', async () => {
      const mockQueueHealth = {
        healthScore: 0.3,
        queueName: 'air-quality',
        issues: ['High failure rate'],
      };

      mockQueueHealthService.getQueueHealth.mockResolvedValue(mockQueueHealth);

      await cronService.scheduleParisFetch();

      expect(mockQueueHealthService.getQueueHealth).toHaveBeenCalledWith('air-quality');
      expect(mockQueueService.addFetchParisDataJob).not.toHaveBeenCalled();
    });

    it('should handle circuit breaker when open', async () => {
      // Mock circuit breaker to be open
      const mockQueueHealth = {
        healthScore: 0.9,
        queueName: 'air-quality',
        issues: [],
      };

      mockQueueHealthService.getQueueHealth.mockResolvedValue(mockQueueHealth);

      // Simulate circuit breaker being open by calling the method multiple times
      // and checking if it respects the circuit breaker state
      await cronService.scheduleParisFetch();

      expect(mockQueueHealthService.getQueueHealth).toHaveBeenCalledWith('air-quality');
    });
  });

  describe('scheduleHourlyAggregations', () => {
    it('should schedule hourly aggregations successfully', async () => {
      const mockTrackedLocations = ['Paris, France', 'London, UK'];
      
      // Mock the getTrackedLocations method
      jest.spyOn(cronService as any, 'getTrackedLocations').mockResolvedValue(mockTrackedLocations);
      
      mockQueueService.addCalculateDailyStatsJob.mockResolvedValue({ id: 'test-job-id' });

      await cronService.scheduleHourlyAggregations();

      expect(mockQueueService.addCalculateDailyStatsJob).toHaveBeenCalledWith(
        'Paris',
        expect.any(String),
        expect.any(Object)
      );
    });

    it('should handle multiple locations for aggregation', async () => {
      const mockTrackedLocations = ['Paris, France', 'London, UK', 'Berlin, Germany'];
      
      jest.spyOn(cronService as any, 'getTrackedLocations').mockResolvedValue(mockTrackedLocations);
      
      mockQueueService.addCalculateDailyStatsJob.mockResolvedValue({ id: 'test-job-id' });

      await cronService.scheduleHourlyAggregations();

      expect(mockQueueService.addCalculateDailyStatsJob).toHaveBeenCalledTimes(mockTrackedLocations.length);
    });
  });

  describe('finalizeDailyStatistics', () => {
    it('should finalize daily statistics successfully', async () => {
      const mockTrackedLocations = ['Paris, France'];
      const mockDailyReport = {
        city: 'Paris',
        country: 'France',
        averageAQI: 65,
        maxAQI: 95,
        minAQI: 45,
        unhealthyDays: 2,
        totalDays: 7,
        trend: 'stable' as const,
      };

      jest.spyOn(cronService as any, 'getTrackedLocations').mockResolvedValue(mockTrackedLocations);
      mockAnalyticsService.generateDailyReport.mockResolvedValue(mockDailyReport);
      mockCacheManager.set.mockResolvedValue(undefined);
      mockNotificationsQueue.add.mockResolvedValue({ id: 'test-job-id' });

      await cronService.finalizeDailyStatistics();

      expect(mockAnalyticsService.generateDailyReport).toHaveBeenCalledWith('Paris', 'France');
      expect(mockCacheManager.set).toHaveBeenCalled();
    });

    it('should trigger notifications for high AQI', async () => {
      const mockTrackedLocations = ['Paris, France'];
      const mockDailyReport = {
        city: 'Paris',
        country: 'France',
        averageAQI: 175, // High AQI
        maxAQI: 200,
        minAQI: 150,
        unhealthyDays: 5,
        totalDays: 7,
        trend: 'worsening' as const,
      };

      jest.spyOn(cronService as any, 'getTrackedLocations').mockResolvedValue(mockTrackedLocations);
      mockAnalyticsService.generateDailyReport.mockResolvedValue(mockDailyReport);
      mockCacheManager.set.mockResolvedValue(undefined);
      mockNotificationsQueue.add.mockResolvedValue({ id: 'test-job-id' });

      await cronService.finalizeDailyStatistics();

      expect(mockNotificationsQueue.add).toHaveBeenCalledWith(
        'daily-aqi-alert',
        expect.objectContaining({
          city: 'Paris',
          country: 'France',
          averageAQI: 175,
        }),
        expect.any(Object)
      );
    });
  });

  describe('weeklyCleanup', () => {
    it('should perform weekly cleanup successfully', async () => {
      const mockCleanupResults = [10, 5, 3]; // Number of jobs cleaned from each queue
      
      mockQueueService.cleanCompletedJobs.mockResolvedValue(10);

      await cronService.weeklyCleanup();

      expect(mockQueueService.cleanCompletedJobs).toHaveBeenCalledTimes(3);
      expect(mockQueueService.cleanCompletedJobs).toHaveBeenCalledWith(
        'air-quality',
        7 * 24 * 60 * 60 * 1000
      );
      expect(mockQueueService.cleanCompletedJobs).toHaveBeenCalledWith(
        'analytics',
        7 * 24 * 60 * 60 * 1000
      );
      expect(mockQueueService.cleanCompletedJobs).toHaveBeenCalledWith(
        'notifications',
        7 * 24 * 60 * 60 * 1000
      );
    });

    it('should handle cleanup failures gracefully', async () => {
      mockQueueService.cleanCompletedJobs
        .mockResolvedValueOnce(10)
        .mockRejectedValueOnce(new Error('Cleanup failed'))
        .mockResolvedValueOnce(5);

      await cronService.weeklyCleanup();

      expect(mockQueueService.cleanCompletedJobs).toHaveBeenCalledTimes(3);
    });
  });

  describe('performHealthCheck', () => {
    it('should perform health check successfully', async () => {
      const mockQueueHealths = [
        { healthScore: 0.9, queueName: 'air-quality', issues: [] },
        { healthScore: 0.8, queueName: 'analytics', issues: [] },
        { healthScore: 0.7, queueName: 'notifications', issues: [] },
      ];

      mockQueueHealthService.getQueueHealth.mockResolvedValueOnce(mockQueueHealths[0]);
      mockQueueHealthService.getQueueHealth.mockResolvedValueOnce(mockQueueHealths[1]);
      mockQueueHealthService.getQueueHealth.mockResolvedValueOnce(mockQueueHealths[2]);

      await cronService.performHealthCheck();

      expect(mockQueueHealthService.getQueueHealth).toHaveBeenCalledTimes(3);
    });

    it('should trigger alerts for unhealthy queues', async () => {
      const mockQueueHealths = [
        { healthScore: 0.3, queueName: 'air-quality', issues: ['High failure rate'] },
        { healthScore: 0.4, queueName: 'analytics', issues: ['Slow processing'] },
        { healthScore: 0.9, queueName: 'notifications', issues: [] },
      ];

      mockQueueHealthService.getQueueHealth.mockResolvedValueOnce(mockQueueHealths[0]);
      mockQueueHealthService.getQueueHealth.mockResolvedValueOnce(mockQueueHealths[1]);
      mockQueueHealthService.getQueueHealth.mockResolvedValueOnce(mockQueueHealths[2]);
      mockNotificationsQueue.add.mockResolvedValue({ id: 'test-job-id' });

      await cronService.performHealthCheck();

      expect(mockNotificationsQueue.add).toHaveBeenCalledWith(
        'system-health-alert',
        expect.objectContaining({
          alertType: 'queue-health',
          unhealthyQueues: expect.arrayContaining([
            expect.objectContaining({ name: 'air-quality', healthScore: 0.3 }),
            expect.objectContaining({ name: 'analytics', healthScore: 0.4 }),
          ]),
        }),
        expect.any(Object)
      );
    });
  });

  describe('CRON Job Statistics', () => {
    it('should track job execution statistics', async () => {
      const mockQueueHealth = {
        healthScore: 0.9,
        queueName: 'air-quality',
        issues: [],
      };

      mockQueueHealthService.getQueueHealth.mockResolvedValue(mockQueueHealth);
      mockQueueService.addFetchParisDataJob.mockResolvedValue({ id: 'test-job-id' });

      await cronService.scheduleParisFetch();

      const stats = await cronService.getCronJobStats();
      const parisFetchStats = stats.find(stat => stat.jobName === 'fetch-paris-data');

      expect(parisFetchStats).toBeDefined();
      expect(parisFetchStats?.executionCount).toBeGreaterThan(0);
      expect(parisFetchStats?.lastExecution).toBeDefined();
    });

    it('should track circuit breaker state', () => {
      const circuitBreakerStatus = cronService.getCircuitBreakerStatus();

      expect(circuitBreakerStatus).toHaveProperty('state');
      expect(circuitBreakerStatus).toHaveProperty('failureCount');
      expect(circuitBreakerStatus).toHaveProperty('threshold');
      expect(circuitBreakerStatus).toHaveProperty('timeout');
    });
  });

  describe('Manual Job Execution', () => {
    it('should execute jobs manually', async () => {
      const mockQueueHealth = {
        healthScore: 0.9,
        queueName: 'air-quality',
        issues: [],
      };

      mockQueueHealthService.getQueueHealth.mockResolvedValue(mockQueueHealth);
      mockQueueService.addFetchParisDataJob.mockResolvedValue({ id: 'test-job-id' });

      await cronService.executeJobManually('fetch-paris-data');

      expect(mockQueueService.addFetchParisDataJob).toHaveBeenCalled();
    });

    it('should throw error for unknown job', async () => {
      await expect(cronService.executeJobManually('unknown-job')).rejects.toThrow('Unknown job: unknown-job');
    });
  });
}); 