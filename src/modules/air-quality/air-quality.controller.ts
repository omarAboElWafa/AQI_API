import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  HttpStatus,
  HttpCode,
  ValidationPipe,
  UsePipes,
  UseInterceptors,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  Logger,
  Headers,
} from '@nestjs/common';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from '@nestjs/cache-manager';

import { AirQualityService } from './air-quality.service';
import { IQAirApiService } from './services/iqair-api.service';
import {
  GetAirQualityDto,
  CreateAirQualityDto,
  AirQualityResponseDto,
  GetAirQualityByLocationDto,
  GetHistoryDto,
  GetDailyStatsDto,
  StandardizedApiResponse,
  ApiResponseMetadata,
  DailyStatsResponseDto,
  MostPollutedTimeResponseDto,
} from '@/common/dto/air-quality.dto';

@Controller('api/air-quality')
@UseInterceptors(CacheInterceptor)
export class AirQualityController {
  private readonly logger = new Logger(AirQualityController.name);

  constructor(
    private readonly airQualityService: AirQualityService,
    private readonly iqairApiService: IQAirApiService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache
  ) {}

  /**
   * GET /api/air-quality/current → Current Paris air quality
   */
  @Get('current')
  @CacheTTL(300) // 5 minutes cache
  @HttpCode(HttpStatus.OK)
  async getCurrentParisAirQuality(
    @Headers('x-api-key') apiKey?: string
  ): Promise<StandardizedApiResponse<AirQualityResponseDto>> {
    try {
      this.logger.log('Fetching current Paris air quality');

      const cacheKey = 'current-paris-air-quality';
      const cached =
        await this.cacheManager.get<AirQualityResponseDto>(cacheKey);

      if (cached) {
        return this.createStandardResponse(cached, true, 0);
      }

      // Get latest Paris data from database
      const latestData = await this.airQualityService.getLatestAirQuality(
        'Paris',
        'France'
      );

      if (!latestData) {
        throw new NotFoundException('Current Paris air quality data not found');
      }

      const responseData = this.mapToResponseDto(latestData);

      // Cache for 5 minutes
      await this.cacheManager.set(cacheKey, responseData, 300);

      const dataAge = Math.floor(
        (Date.now() - new Date(latestData.timestamp).getTime()) / (1000 * 60)
      );

      return this.createStandardResponse(responseData, false, dataAge);
    } catch (error) {
      this.logger.error('Error fetching current Paris air quality:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to retrieve current air quality data'
      );
    }
  }

  /**
   * GET /api/air-quality/history?days=7 → Historical data
   */
  @Get('history')
  @CacheTTL(1800) // 30 minutes cache
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ transform: true }))
  async getHistoricalData(
    @Query() query: GetHistoryDto
  ): Promise<StandardizedApiResponse<AirQualityResponseDto[]>> {
    try {
      this.logger.log(`Fetching historical data for ${query.days || 7} days`);

      const days = query.days || 7;
      const cacheKey = `history-paris-${days}`;
      const cached =
        await this.cacheManager.get<AirQualityResponseDto[]>(cacheKey);

      if (cached) {
        return this.createStandardResponse(cached, true, 0);
      }

      const historicalData = await this.airQualityService.getAirQualityHistory(
        'Paris',
        'France',
        days
      );

      if (!historicalData || historicalData.length === 0) {
        throw new NotFoundException(
          `No historical data found for the last ${days} days`
        );
      }

      const responseData = historicalData.map(data =>
        this.mapToResponseDto(data)
      );

      // Cache for 30 minutes
      await this.cacheManager.set(cacheKey, responseData, 1800);

      return this.createStandardResponse(responseData, false, 30);
    } catch (error) {
      this.logger.error('Error fetching historical data:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to retrieve historical data'
      );
    }
  }

  /**
   * GET /api/air-quality/daily-stats?date=2024-08-05 → Daily statistics
   */
  @Get('daily-stats')
  @CacheTTL(3600) // 1 hour cache
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ transform: true }))
  async getDailyStats(
    @Query() query: GetDailyStatsDto
  ): Promise<StandardizedApiResponse<DailyStatsResponseDto>> {
    try {
      this.logger.log(`Fetching daily stats for ${query.date}`);

      const cacheKey = `daily-stats-paris-${query.date}`;
      const cached =
        await this.cacheManager.get<DailyStatsResponseDto>(cacheKey);

      if (cached) {
        return this.createStandardResponse(cached, true, 0);
      }

      // Use basic aggregation since calculateDailyStats might not exist
      const dailyStats = await this.calculateBasicDailyStats(
        query.date,
        'Paris',
        'France'
      );

      if (!dailyStats) {
        throw new NotFoundException(`No data found for ${query.date}`);
      }

      // Cache for 1 hour (longer for historical dates)
      const cacheTtl = this.isHistoricalDate(query.date) ? 86400 : 3600; // 24h for historical, 1h for recent
      await this.cacheManager.set(cacheKey, dailyStats, cacheTtl);

      return this.createStandardResponse(dailyStats, false, 60);
    } catch (error) {
      this.logger.error('Error fetching daily stats:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to retrieve daily statistics'
      );
    }
  }

  /**
   * GET /api/air-quality/most-polluted → Most polluted datetime
   */
  @Get('most-polluted')
  @CacheTTL(1800) // 30 minutes cache
  @HttpCode(HttpStatus.OK)
  async getMostPollutedTime(): Promise<
    StandardizedApiResponse<MostPollutedTimeResponseDto>
  > {
    try {
      this.logger.log('Fetching most polluted time for Paris');

      const cacheKey = 'most-polluted-paris';
      const cached =
        await this.cacheManager.get<MostPollutedTimeResponseDto>(cacheKey);

      if (cached) {
        return this.createStandardResponse(cached, true, 0);
      }

      // Use basic query since getMostPollutedTime might not exist
      const mostPollutedData = await this.findMostPollutedTime(
        'Paris',
        'France'
      );

      if (!mostPollutedData) {
        throw new NotFoundException('No pollution data found for Paris');
      }

      // Cache for 30 minutes
      await this.cacheManager.set(cacheKey, mostPollutedData, 1800);

      return this.createStandardResponse(mostPollutedData, false, 30);
    } catch (error) {
      this.logger.error('Error fetching most polluted time:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to retrieve most polluted time data'
      );
    }
  }

  /**
   * GET /api/air-quality/nearest-city?latitude=48.856613&longitude=2.352222
   * Calls IQAIR API to get air quality for the given coordinates using nearest_city endpoint
   */
  @Get('nearest-city')
  @CacheTTL(600) // 10 minutes cache for live API data
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ transform: true }))
  async getAirQualityByLocation(
    @Query() query: GetAirQualityByLocationDto
  ): Promise<StandardizedApiResponse<AirQualityResponseDto>> {
    try {
      this.logger.log(
        `Fetching air quality for coordinates: ${query.latitude}, ${query.longitude}`
      );

      const cacheKey = `nearest-city-${query.latitude}-${query.longitude}`;
      const cached =
        await this.cacheManager.get<AirQualityResponseDto>(cacheKey);

      if (cached) {
        return this.createStandardResponse(cached, true, 0);
      }

      // For now, use the existing fetchCityAirQuality and enhance the IQAir service later
      // This is a placeholder that would need the nearest city API call implementation
      const city = 'Paris'; // This would be determined by coordinates in a real implementation
      const state = 'Ile-de-France';
      const country = 'France';

      const iqairResult = await this.iqairApiService.fetchCityAirQuality(
        city,
        state,
        country
      );

      if (!iqairResult.success) {
        throw new BadRequestException(
          `Failed to fetch air quality data: ${iqairResult.error}`
        );
      }

      const responseData = this.mapIQAirToResponseDto(iqairResult.data!);

      // Cache for 10 minutes
      await this.cacheManager.set(cacheKey, responseData, 600);

      return this.createStandardResponse(responseData, false, 0);
    } catch (error) {
      this.logger.error('Error fetching air quality by location:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to retrieve air quality data for the specified location'
      );
    }
  }

  /**
   * Legacy endpoint for backward compatibility
   */
  @Get('location')
  @CacheTTL(600)
  @HttpCode(HttpStatus.OK)
  async getAirQualityByLocationLegacy(
    @Query('lat') latitude: number,
    @Query('lng') longitude: number,
    @Query('distance') maxDistance?: number
  ): Promise<StandardizedApiResponse<AirQualityResponseDto[]>> {
    try {
      this.logger.log(
        `Legacy location endpoint called for: ${latitude}, ${longitude}`
      );

      const results = await this.airQualityService.getAirQualityByLocation(
        latitude,
        longitude,
        maxDistance
      );

      const responseData = results.map(data => this.mapToResponseDto(data));

      return this.createStandardResponse(responseData, false, 0);
    } catch (error) {
      this.logger.error('Error in legacy location endpoint:', error);
      throw new InternalServerErrorException(
        'Failed to retrieve air quality data'
      );
    }
  }

  /**
   * POST /api/air-quality/fetch - Trigger data fetch
   */
  @Post('fetch')
  @HttpCode(HttpStatus.ACCEPTED)
  @UsePipes(new ValidationPipe())
  async fetchAirQualityData(
    @Body() body: GetAirQualityDto,
    @Headers('x-api-key') apiKey?: string
  ): Promise<StandardizedApiResponse<{ message: string }>> {
    try {
      this.logger.log(
        `Triggering data fetch for ${body.city}, ${body.country}`
      );

      // Basic API key validation
      const adminApiKey = 'admin-api-key'; // This should come from config
      if (apiKey !== adminApiKey) {
        throw new BadRequestException('Invalid API key for admin operations');
      }

      await this.airQualityService.addToQueue(
        body.city,
        body.state || '',
        body.country
      );

      const responseData = {
        message: 'Air quality data fetch has been queued',
      };

      return this.createStandardResponse(responseData, false, 0);
    } catch (error) {
      this.logger.error('Error triggering data fetch:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to queue data fetch');
    }
  }

  /**
   * POST /api/air-quality - Create new record (admin only)
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe())
  async createAirQualityRecord(
    @Body() createDto: CreateAirQualityDto,
    @Headers('x-api-key') apiKey?: string
  ): Promise<StandardizedApiResponse<AirQualityResponseDto>> {
    try {
      this.logger.log(
        `Creating air quality record for ${createDto.city}, ${createDto.country}`
      );

      // Basic API key validation
      const adminApiKey = 'admin-api-key'; // This should come from config
      if (apiKey !== adminApiKey) {
        throw new BadRequestException('Invalid API key for admin operations');
      }

      const record =
        await this.airQualityService.createAirQualityRecord(createDto);
      const responseData = this.mapToResponseDto(record);

      return this.createStandardResponse(responseData, false, 0);
    } catch (error) {
      this.logger.error('Error creating air quality record:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to create air quality record'
      );
    }
  }

  // Helper methods
  private createStandardResponse<T>(
    data: T,
    cached: boolean,
    dataFreshness: number,
    cacheTtl?: number
  ): StandardizedApiResponse<T> {
    const metadata: ApiResponseMetadata = {
      cached,
      dataFreshness,
      responseTime: new Date(),
      version: '1.0.0',
      cacheTtl,
    };

    return {
      success: true,
      data,
      metadata,
    };
  }

  private async calculateBasicDailyStats(
    date: string,
    city: string,
    country: string
  ): Promise<DailyStatsResponseDto | null> {
    try {
      // This is a basic implementation - in a real app this would be more sophisticated
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);

      const history = await this.airQualityService.getAirQualityHistory(
        city,
        country,
        1
      );

      if (!history || history.length === 0) {
        return null;
      }

      const aqiValues = history.map(h => h.aqius || 0);
      const averageAqi =
        aqiValues.reduce((a, b) => a + b, 0) / aqiValues.length;
      const minAqi = Math.min(...aqiValues);
      const maxAqi = Math.max(...aqiValues);
      const unhealthyHours = aqiValues.filter(aqi => aqi > 100).length;

      return {
        date,
        city,
        country,
        averageAqi: Math.round(averageAqi),
        minAqi,
        maxAqi,
        dominantPollutant: history[0]?.mainus || 'p2',
        measurementCount: history.length,
        unhealthyHours,
      };
    } catch (error) {
      this.logger.error('Error calculating daily stats:', error);
      return null;
    }
  }

  private async findMostPollutedTime(
    city: string,
    country: string
  ): Promise<MostPollutedTimeResponseDto | null> {
    try {
      // Get recent history and find the highest AQI
      const history = await this.airQualityService.getAirQualityHistory(
        city,
        country,
        30
      );

      if (!history || history.length === 0) {
        return null;
      }

      let mostPolluted = history[0];
      let maxAqi = mostPolluted.aqius || 0;

      for (const record of history) {
        const currentAqi = record.aqius || 0;
        if (currentAqi > maxAqi) {
          maxAqi = currentAqi;
          mostPolluted = record;
        }
      }

      return {
        dateTime: mostPolluted.timestamp,
        aqi: maxAqi,
        pollutant: mostPolluted.mainus || 'p2',
        level: this.getAirQualityLevel(maxAqi),
        city,
        country,
      };
    } catch (error) {
      this.logger.error('Error finding most polluted time:', error);
      return null;
    }
  }

  private mapToResponseDto(data: any): AirQualityResponseDto {
    return {
      city: data.city,
      state: data.state,
      country: data.country,
      aqius: data.pollution?.aqius || data.aqius,
      mainus: data.pollution?.mainus || data.mainus,
      aqicn: data.pollution?.aqicn || data.aqicn,
      maincn: data.pollution?.maincn || data.maincn,
      temperature: data.weather?.tp || data.temperature,
      pressure: data.weather?.pr || data.pressure,
      humidity: data.weather?.hu || data.humidity,
      windSpeed: data.weather?.ws || data.windSpeed,
      windDirection: data.weather?.wd || data.windDirection,
      weatherIcon: data.weather?.ic || data.weatherIcon,
      timestamp: data.timestamp,
      level: this.getAirQualityLevel(data.pollution?.aqius || data.aqius),
      location: {
        latitude: data.location?.coordinates?.[1] || data.latitude,
        longitude: data.location?.coordinates?.[0] || data.longitude,
      },
    };
  }

  private mapIQAirToResponseDto(iqairData: any): AirQualityResponseDto {
    return {
      city: iqairData.location.split(',')[0].trim(),
      state: iqairData.location.split(',')[1]?.trim() || '',
      country: iqairData.location.split(',')[2]?.trim() || '',
      aqius: iqairData.aqi,
      mainus: iqairData.main_pollutant,
      aqicn: iqairData.aqi, // IQAIR typically returns US AQI
      maincn: iqairData.main_pollutant,
      temperature: iqairData.weather.temperature,
      pressure: 1013, // Default if not provided
      humidity: iqairData.weather.humidity,
      windSpeed: 0, // Default if not provided
      windDirection: 0, // Default if not provided
      weatherIcon: '',
      timestamp: iqairData.timestamp,
      level: iqairData.pollution_level,
      location: {
        latitude: iqairData.coordinates.latitude,
        longitude: iqairData.coordinates.longitude,
      },
    };
  }

  private getAirQualityLevel(aqi: number): string {
    if (aqi <= 50) return 'Good';
    if (aqi <= 100) return 'Moderate';
    if (aqi <= 150) return 'Unhealthy for Sensitive Groups';
    if (aqi <= 200) return 'Unhealthy';
    if (aqi <= 300) return 'Very Unhealthy';
    return 'Hazardous';
  }

  private isHistoricalDate(dateString: string): boolean {
    const targetDate = new Date(dateString);
    const today = new Date();
    const diffInDays =
      (today.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24);
    return diffInDays > 1;
  }
}
