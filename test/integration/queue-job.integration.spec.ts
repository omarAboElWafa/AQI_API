import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Queue } from 'bull';
import { getQueueToken } from '@nestjs/bull';
import { AirQualityProcessor } from '../../src/modules/air-quality/processors/air-quality.processor';
import { AirQuality, AirQualityDocument } from '../../src/modules/air-quality/schemas/air-quality.schema';
import { IQAirApiService } from '../../src/modules/air-quality/services/iqair-api.service';
import { ConfigService } from '@nestjs/config';

describe('Queue Job Processing Integration', () => {
  let module: TestingModule;
  let processor: AirQualityProcessor;
  let airQualityModel: Model<AirQualityDocument>;
  let iqairApiService: IQAirApiService;
  let airQualityQueue: Queue;

  const mockAirQualityModel = {
    create: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    exec: jest.fn(),
  };

  const mockIQAirApiService = {
    fetchCityAirQuality: jest.fn(),
    fetchNearestCityAirQuality: jest.fn(),
  };

  const mockAirQualityQueue = {
    add: jest.fn(),
    process: jest.fn(),
    getJob: jest.fn(),
    getJobs: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AirQualityProcessor,
        {
          provide: getModelToken(AirQuality.name),
          useValue: mockAirQualityModel,
        },
        {
          provide: IQAirApiService,
          useValue: mockIQAirApiService,
        },
        {
          provide: getQueueToken('air-quality'),
          useValue: mockAirQualityQueue,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-api-key'),
          },
        },
      ],
    }).compile();

    processor = module.get<AirQualityProcessor>(AirQualityProcessor);
    airQualityModel = module.get<Model<AirQualityDocument>>(getModelToken(AirQuality.name));
    iqairApiService = module.get<IQAirApiService>(IQAirApiService);
    airQualityQueue = module.get<Queue>(getQueueToken('air-quality'));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchAirQualityData', () => {
    it('should process fetch air quality job successfully', async () => {
      const jobData = {
        city: 'Paris',
        state: 'Ile-de-France',
        country: 'France',
      };

      const mockApiResponse = {
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
      };

      const mockCreatedRecord = {
        _id: 'mock-id',
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
      };

      mockIQAirApiService.fetchCityAirQuality.mockResolvedValue(mockApiResponse);
      mockAirQualityModel.create.mockResolvedValue(mockCreatedRecord);

      const mockJob = {
        data: jobData,
        progress: jest.fn(),
        log: jest.fn(),
      };

      const result = await processor.fetchAirQualityData(mockJob as any);

      expect(mockIQAirApiService.fetchCityAirQuality).toHaveBeenCalledWith(
        'Paris',
        'Ile-de-France',
        'France'
      );
      expect(mockAirQualityModel.create).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should handle API failure gracefully', async () => {
      const jobData = {
        city: 'Paris',
        state: 'Ile-de-France',
        country: 'France',
      };

      const mockApiResponse = {
        success: false,
        error: 'API rate limit exceeded',
        responseTime: 1000,
        retryCount: 3,
      };

      mockIQAirApiService.fetchCityAirQuality.mockResolvedValue(mockApiResponse);

      const mockJob = {
        data: jobData,
        progress: jest.fn(),
        log: jest.fn(),
      };

      await expect(processor.fetchAirQualityData(mockJob as any)).rejects.toThrow();

      expect(mockIQAirApiService.fetchCityAirQuality).toHaveBeenCalled();
      expect(mockAirQualityModel.create).not.toHaveBeenCalled();
    });

    it('should handle database save failure', async () => {
      const jobData = {
        city: 'Paris',
        state: 'Ile-de-France',
        country: 'France',
      };

      const mockApiResponse = {
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
      };

      mockIQAirApiService.fetchCityAirQuality.mockResolvedValue(mockApiResponse);
      mockAirQualityModel.create.mockRejectedValue(new Error('Database connection failed'));

      const mockJob = {
        data: jobData,
        progress: jest.fn(),
        log: jest.fn(),
      };

      await expect(processor.fetchAirQualityData(mockJob as any)).rejects.toThrow('Database connection failed');

      expect(mockIQAirApiService.fetchCityAirQuality).toHaveBeenCalled();
      expect(mockAirQualityModel.create).toHaveBeenCalled();
    });
  });

  describe('fetchParisData', () => {
    it('should process Paris data fetch job successfully', async () => {
      const mockApiResponse = {
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
      };

      const mockCreatedRecord = {
        _id: 'mock-id',
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
      };

      mockIQAirApiService.fetchCityAirQuality.mockResolvedValue(mockApiResponse);
      mockAirQualityModel.create.mockResolvedValue(mockCreatedRecord);

      const mockJob = {
        progress: jest.fn(),
        log: jest.fn(),
      };

      const result = await processor.fetchParisData(mockJob as any);

      expect(mockIQAirApiService.fetchCityAirQuality).toHaveBeenCalledWith(
        'Paris',
        'Ile-de-France',
        'France'
      );
      expect(mockAirQualityModel.create).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('Job Queue Integration', () => {
    it('should add job to queue successfully', async () => {
      const jobData = {
        city: 'Paris',
        state: 'Ile-de-France',
        country: 'France',
      };

      const mockJob = {
        id: 'test-job-id',
        data: jobData,
      };

      mockAirQualityQueue.add.mockResolvedValue(mockJob);

      const result = await airQualityQueue.add('fetch-air-quality', jobData);

      expect(mockAirQualityQueue.add).toHaveBeenCalledWith('fetch-air-quality', jobData);
      expect(result).toEqual(mockJob);
    });

    it('should handle queue job failure', async () => {
      const jobData = {
        city: 'Paris',
        state: 'Ile-de-France',
        country: 'France',
      };

      mockAirQualityQueue.add.mockRejectedValue(new Error('Queue connection failed'));

      await expect(airQualityQueue.add('fetch-air-quality', jobData)).rejects.toThrow('Queue connection failed');
    });
  });
}); 