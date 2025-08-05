import { InjectQueue } from '@nestjs/bull';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import axios from 'axios';
import { Queue } from 'bull';
import { Model } from 'mongoose';

import {
  AirQualityResponseDto,
  CreateAirQualityDto,
} from '@/common/dto/air-quality.dto';
import {
  AirQualityData,
  IQAirResponse,
} from '@/common/interfaces/air-quality.interface';
import { AirQuality, AirQualityDocument } from './schemas/air-quality.schema';

@Injectable()
export class AirQualityService {
  private readonly logger = new Logger(AirQualityService.name);

  constructor(
    @InjectModel(AirQuality.name)
    private airQualityModel: Model<AirQualityDocument>,
    @InjectQueue('air-quality') private airQualityQueue: Queue,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private configService: ConfigService
  ) {}

  async fetchAirQualityData(
    city: string,
    state: string,
    country: string
  ): Promise<AirQualityData> {
    const apiKey = this.configService.get<string>('iqair.apiKey');
    const baseUrl = this.configService.get<string>('iqair.baseUrl');

    if (!apiKey) {
      throw new Error('IQAir API key not configured');
    }

    try {
      const response = await axios.get<IQAirResponse>(`${baseUrl}/city`, {
        params: {
          city,
          state,
          country,
          key: apiKey,
        },
      });

      if (response.data.status !== 'success') {
        throw new Error('Failed to fetch air quality data');
      }

      return {
        ...response.data.data,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(
        `Failed to fetch air quality data for ${city}, ${state}, ${country}:`,
        error
      );
      throw error;
    }
  }

  async createAirQualityRecord(
    createDto: CreateAirQualityDto
  ): Promise<AirQualityDocument> {
    const airQualityData = new this.airQualityModel({
      city: createDto.city,
      state: createDto.state,
      country: createDto.country,
      location: {
        type: 'Point',
        coordinates: [createDto.longitude, createDto.latitude],
      },
      pollution: {
        ts: new Date().toISOString(),
        aqius: createDto.aqius,
        mainus: createDto.mainus,
        aqicn: createDto.aqicn,
        maincn: createDto.maincn,
      },
      weather: {
        ts: new Date().toISOString(),
        tp: createDto.temperature,
        pr: createDto.pressure,
        hu: createDto.humidity,
        ws: createDto.windSpeed,
        wd: createDto.windDirection,
        ic: createDto.weatherIcon,
      },
      timestamp: createDto.timestamp,
    });

    return await airQualityData.save();
  }

  async getLatestAirQuality(
    city: string,
    country: string
  ): Promise<AirQualityResponseDto> {
    const cacheKey = `air-quality:${city}:${country}:latest`;

    // Try to get from cache first
    const cached = await this.cacheManager.get<AirQualityResponseDto>(cacheKey);
    if (cached) {
      return cached;
    }

    const airQuality = await this.airQualityModel
      .findOne({ city, country })
      .sort({ timestamp: -1 })
      .exec();

    if (!airQuality) {
      throw new NotFoundException(
        `No air quality data found for ${city}, ${country}`
      );
    }

    const response = this.mapToResponseDto(airQuality);

    // Cache the result for 5 minutes
    await this.cacheManager.set(cacheKey, response, 300);

    return response;
  }

  async getAirQualityHistory(
    city: string,
    country: string,
    limit: number = 24
  ): Promise<AirQualityResponseDto[]> {
    const airQualityRecords = await this.airQualityModel
      .find({ city, country })
      .sort({ timestamp: -1 })
      .limit(limit)
      .exec();

    return airQualityRecords.map(record => this.mapToResponseDto(record));
  }

  async getAirQualityByLocation(
    latitude: number,
    longitude: number,
    maxDistance: number = 50000 // 50km
  ): Promise<AirQualityResponseDto[]> {
    const airQualityRecords = await this.airQualityModel
      .find({
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [longitude, latitude],
            },
            $maxDistance: maxDistance,
          },
        },
      })
      .sort({ timestamp: -1 })
      .limit(10)
      .exec();

    return airQualityRecords.map(record => this.mapToResponseDto(record));
  }

  async addToQueue(
    city: string,
    state: string,
    country: string
  ): Promise<void> {
    await this.airQualityQueue.add('fetch-air-quality', {
      city,
      state,
      country,
    });
  }

  public mapToResponseDto(
    airQuality: AirQualityDocument
  ): AirQualityResponseDto {
    const aqiLevel = this.getAQILevel(airQuality.pollution.aqius);

    return {
      city: airQuality.city,
      state: airQuality.state,
      country: airQuality.country,
      aqius: airQuality.pollution.aqius,
      mainus: airQuality.pollution.mainus,
      aqicn: airQuality.pollution.aqicn,
      maincn: airQuality.pollution.maincn,
      temperature: airQuality.weather.tp,
      pressure: airQuality.weather.pr,
      humidity: airQuality.weather.hu,
      windSpeed: airQuality.weather.ws,
      windDirection: airQuality.weather.wd,
      weatherIcon: airQuality.weather.ic,
      timestamp: airQuality.timestamp,
      level: aqiLevel,
      location: {
        latitude: airQuality.location.coordinates[1],
        longitude: airQuality.location.coordinates[0],
      },
    };
  }

  private getAQILevel(aqi: number): string {
    if (aqi <= 50) return 'Good';
    if (aqi <= 100) return 'Moderate';
    if (aqi <= 150) return 'Unhealthy for Sensitive Groups';
    if (aqi <= 200) return 'Unhealthy';
    if (aqi <= 300) return 'Very Unhealthy';
    return 'Hazardous';
  }

  public getAirQualityLevel(aqi: number): string {
    return this.getAQILevel(aqi);
  }
}
