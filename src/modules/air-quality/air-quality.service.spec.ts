import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AirQualityService } from './air-quality.service';
import { AirQuality, AirQualityDocument } from './schemas/air-quality.schema';
import { IQAirApiService } from './services/iqair-api.service';
import { QueueService } from '../queue/services/queue.service';

describe('AirQualityService', () => {
  let service: AirQualityService;
  let airQualityModel: Model<AirQualityDocument>;
  let iqairApiService: IQAirApiService;
  let queueService: QueueService;

  const mockAirQualityModel = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    exec: jest.fn(),
  };

  const mockIQAirApiService = {
    fetchCityAirQuality: jest.fn(),
    fetchNearestCityAirQuality: jest.fn(),
  };

  const mockQueueService = {
    addFetchParisDataJob: jest.fn(),
    addJob: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AirQualityService,
        {
          provide: getModelToken(AirQuality.name),
          useValue: mockAirQualityModel,
        },
        {
          provide: IQAirApiService,
          useValue: mockIQAirApiService,
        },
        {
          provide: QueueService,
          useValue: mockQueueService,
        },
      ],
    }).compile();

    service = module.get<AirQualityService>(AirQualityService);
    airQualityModel = module.get<Model<AirQualityDocument>>(getModelToken(AirQuality.name));
    iqairApiService = module.get<IQAirApiService>(IQAirApiService);
    queueService = module.get<QueueService>(QueueService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getLatestAirQuality', () => {
    it('should return the latest air quality data for a city', async () => {
      const mockData = {
        city: 'Paris',
        country: 'France',
        pollution: { aqius: 65, mainus: 'p2' },
        weather: { tp: 22, hu: 60 },
        timestamp: new Date(),
      };

      mockAirQualityModel.findOne.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockData),
        }),
      });

      const result = await service.getLatestAirQuality('Paris', 'France');

      expect(result).toEqual(mockData);
      expect(mockAirQualityModel.findOne).toHaveBeenCalledWith({
        city: 'Paris',
        country: 'France',
      });
    });

    it('should return null when no data is found', async () => {
      mockAirQualityModel.findOne.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      });

      const result = await service.getLatestAirQuality('Paris', 'France');

      expect(result).toBeNull();
    });
  });

  describe('getAirQualityHistory', () => {
    it('should return air quality history for specified days', async () => {
      const mockData = [
        { city: 'Paris', country: 'France', pollution: { aqius: 65 }, timestamp: new Date() },
        { city: 'Paris', country: 'France', pollution: { aqius: 70 }, timestamp: new Date() },
      ];

      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - 7);

      mockAirQualityModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(mockData),
          }),
        }),
      });

      const result = await service.getAirQualityHistory('Paris', 'France', 7);

      expect(result).toEqual(mockData);
      expect(mockAirQualityModel.find).toHaveBeenCalledWith({
        city: 'Paris',
        country: 'France',
        timestamp: { $gte: expect.any(Date) },
      });
    });

    it('should use default limit when days parameter is not provided', async () => {
      const mockData = [{ city: 'Paris', country: 'France', pollution: { aqius: 65 } }];

      mockAirQualityModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(mockData),
          }),
        }),
      });

      await service.getAirQualityHistory('Paris', 'France');

      expect(mockAirQualityModel.find).toHaveBeenCalledWith({
        city: 'Paris',
        country: 'France',
        timestamp: { $gte: expect.any(Date) },
      });
    });
  });

  describe('getAirQualityByLocation', () => {
    it('should return air quality data by location coordinates', async () => {
      const mockData = [
        {
          city: 'Paris',
          country: 'France',
          location: { coordinates: [2.352222, 48.856613] },
          pollution: { aqius: 65 },
        },
      ];

      mockAirQualityModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockData),
      });

      const result = await service.getAirQualityByLocation(48.856613, 2.352222, 50000);

      expect(result).toEqual(mockData);
      expect(mockAirQualityModel.find).toHaveBeenCalledWith({
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [2.352222, 48.856613],
            },
            $maxDistance: 50000,
          },
        },
      });
    });

    it('should use default distance when maxDistance is not provided', async () => {
      const mockData = [{ city: 'Paris', country: 'France' }];

      mockAirQualityModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockData),
      });

      await service.getAirQualityByLocation(48.856613, 2.352222);

      expect(mockAirQualityModel.find).toHaveBeenCalledWith({
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [2.352222, 48.856613],
            },
            $maxDistance: 50000,
          },
        },
      });
    });
  });

  describe('createAirQualityRecord', () => {
    it('should create a new air quality record', async () => {
      const createDto = {
        city: 'Paris',
        state: 'Ile-de-France',
        country: 'France',
        latitude: 48.856613,
        longitude: 2.352222,
        aqius: 65,
        mainus: 'p2',
        aqicn: 65,
        maincn: 'p2',
        temperature: 22,
        pressure: 1013,
        humidity: 60,
        windSpeed: 3.5,
        windDirection: 270,
        weatherIcon: '01d',
        timestamp: new Date(),
      };

      const mockCreatedRecord = {
        ...createDto,
        _id: 'mock-id',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockAirQualityModel.create.mockResolvedValue(mockCreatedRecord);

      const result = await service.createAirQualityRecord(createDto);

      expect(result).toEqual(mockCreatedRecord);
      expect(mockAirQualityModel.create).toHaveBeenCalledWith({
        ...createDto,
        location: {
          type: 'Point',
          coordinates: [2.352222, 48.856613],
        },
        pollution: {
          ts: expect.any(String),
          aqius: 65,
          mainus: 'p2',
          aqicn: 65,
          maincn: 'p2',
        },
        weather: {
          ts: expect.any(String),
          tp: 22,
          pr: 1013,
          hu: 60,
          ws: 3.5,
          wd: 270,
          ic: '01d',
        },
      });
    });
  });

  describe('addToQueue', () => {
    it('should add a job to the queue for fetching air quality data', async () => {
      const city = 'Paris';
      const state = 'Ile-de-France';
      const country = 'France';

      mockQueueService.addJob.mockResolvedValue({ id: 'mock-job-id' });

      await service.addToQueue(city, state, country);

      expect(mockQueueService.addJob).toHaveBeenCalledWith(
        'air-quality',
        'fetch-air-quality',
        { city, state, country },
        expect.any(Object)
      );
    });
  });

  describe('mapToResponseDto', () => {
    it('should map database record to response DTO', () => {
      const mockRecord = {
        city: 'Paris',
        state: 'Ile-de-France',
        country: 'France',
        pollution: { aqius: 65, mainus: 'p2' },
        weather: { tp: 22, hu: 60 },
        timestamp: new Date(),
        location: { coordinates: [2.352222, 48.856613] },
      };

      const result = service.mapToResponseDto(mockRecord);

      expect(result).toEqual({
        city: 'Paris',
        state: 'Ile-de-France',
        country: 'France',
        aqius: 65,
        mainus: 'p2',
        aqicn: 65,
        maincn: 'p2',
        temperature: 22,
        pressure: 1013,
        humidity: 60,
        windSpeed: 3.5,
        windDirection: 270,
        weatherIcon: '01d',
        timestamp: expect.any(Date),
        level: 'Moderate',
        location: {
          latitude: 48.856613,
          longitude: 2.352222,
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
      const result = service.getAirQualityLevel(aqi);
      expect(result).toBe(expectedLevel);
    });
  });
}); 