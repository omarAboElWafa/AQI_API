import { 
  Controller, 
  Get, 
  Post, 
  Param, 
  Query, 
  Body, 
  Logger,
  HttpStatus,
  HttpCode,
  UseInterceptors,
  CacheInterceptor,
  CacheTTL,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  UsePipes,
  ValidationPipe,
  Headers,
} from '@nestjs/common';
import { Inject, CACHE_MANAGER } from '@nestjs/common';
import { Cache } from 'cache-manager';

import { AnalyticsService } from '../services/analytics.service';
import { 
  StandardizedApiResponse,
  ApiResponseMetadata,
  GetDailyStatsDto
} from '@/common/dto/air-quality.dto';
import { DailyStats, HourlyStats, HistoricalTrend, PollutionPattern, MostPollutedTime } from '../services/analytics.service';

export class AnalyticsQueryDto {
  city: string;
  country: string;
  date?: string;
  days?: number;
  period?: 'weekly' | 'monthly';
}

@Controller('api/analytics')
@UseInterceptors(CacheInterceptor)
export class AnalyticsController {
  private readonly logger = new Logger(AnalyticsController.name);

  constructor(
    private readonly analyticsService: AnalyticsService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  /**
   * GET /api/analytics/daily-summary?date=2024-08-05
   * Get daily summary for Paris (default) or specified location
   */
  @Get('daily-summary')
  @CacheTTL(3600) // 1 hour cache
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ transform: true }))
  async getDailySummary(
    @Query() query: GetDailyStatsDto & { city?: string; country?: string },
  ): Promise<StandardizedApiResponse<DailyStats>> {
    try {
      const city = query.city || 'Paris';
      const country = query.country || 'France';
      
      this.logger.log(`Fetching daily summary for ${city}, ${country} on ${query.date}`);
      
      const cacheKey = `daily-summary-${city}-${country}-${query.date}`;
      const cached = await this.cacheManager.get<DailyStats>(cacheKey);
      
      if (cached) {
        return this.createStandardResponse(cached, true, 0);
      }

      const dailyStats = await this.analyticsService.calculateDailyStats(query.date, city, country);
      
      if (!dailyStats) {
        throw new NotFoundException(`No data found for ${city}, ${country} on ${query.date}`);
      }

      // Cache for 1 hour (longer for historical dates)
      const cacheTtl = this.isHistoricalDate(query.date) ? 86400 : 3600;
      await this.cacheManager.set(cacheKey, dailyStats, cacheTtl);
      
      return this.createStandardResponse(dailyStats, false, 60);

    } catch (error) {
      this.logger.error('Error fetching daily summary:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to retrieve daily summary');
    }
  }

  /**
   * GET /api/analytics/hourly-averages?date=2024-08-05
   * Get hourly averages for Paris (default) or specified location
   */
  @Get('hourly-averages')
  @CacheTTL(1800) // 30 minutes cache
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ transform: true }))
  async getHourlyAverages(
    @Query() query: GetDailyStatsDto & { city?: string; country?: string },
  ): Promise<StandardizedApiResponse<HourlyStats[]>> {
    try {
      const city = query.city || 'Paris';
      const country = query.country || 'France';
      
      this.logger.log(`Fetching hourly averages for ${city}, ${country} on ${query.date}`);
      
      const cacheKey = `hourly-averages-${city}-${country}-${query.date}`;
      const cached = await this.cacheManager.get<HourlyStats[]>(cacheKey);
      
      if (cached) {
        return this.createStandardResponse(cached, true, 0);
      }

      const hourlyStats = await this.analyticsService.getHourlyStats(query.date, city, country);
      
      if (!hourlyStats || hourlyStats.length === 0) {
        throw new NotFoundException(`No hourly data found for ${city}, ${country} on ${query.date}`);
      }

      // Cache for 30 minutes (longer for historical dates)
      const cacheTtl = this.isHistoricalDate(query.date) ? 43200 : 1800; // 12h for historical, 30m for recent
      await this.cacheManager.set(cacheKey, hourlyStats, cacheTtl);
      
      return this.createStandardResponse(hourlyStats, false, 30);

    } catch (error) {
      this.logger.error('Error fetching hourly averages:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to retrieve hourly averages');
    }
  }

  /**
   * GET /api/analytics/paris/daily-summary?date=2024-08-05
   * Dedicated Paris endpoint for convenience
   */
  @Get('paris/daily-summary')
  @CacheTTL(3600)
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ transform: true }))
  async getParisDailySummary(
    @Query() query: GetDailyStatsDto,
  ): Promise<StandardizedApiResponse<DailyStats>> {
    try {
      this.logger.log(`Fetching Paris daily summary for ${query.date}`);
      
      const cacheKey = `paris-daily-summary-${query.date}`;
      const cached = await this.cacheManager.get<DailyStats>(cacheKey);
      
      if (cached) {
        return this.createStandardResponse(cached, true, 0);
      }

      const dailyStats = await this.analyticsService.calculateDailyStats(query.date, 'Paris', 'France');
      
      if (!dailyStats) {
        throw new NotFoundException(`No data found for Paris on ${query.date}`);
      }

      // Cache for 1 hour (longer for historical dates)
      const cacheTtl = this.isHistoricalDate(query.date) ? 86400 : 3600;
      await this.cacheManager.set(cacheKey, dailyStats, cacheTtl);
      
      return this.createStandardResponse(dailyStats, false, 60);

    } catch (error) {
      this.logger.error('Error fetching Paris daily summary:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to retrieve Paris daily summary');
    }
  }

  /**
   * GET /api/analytics/paris/hourly-averages?date=2024-08-05
   * Dedicated Paris endpoint for convenience
   */
  @Get('paris/hourly-averages')
  @CacheTTL(1800)
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ transform: true }))
  async getParisHourlyAverages(
    @Query() query: GetDailyStatsDto,
  ): Promise<StandardizedApiResponse<HourlyStats[]>> {
    try {
      this.logger.log(`Fetching Paris hourly averages for ${query.date}`);
      
      const cacheKey = `paris-hourly-averages-${query.date}`;
      const cached = await this.cacheManager.get<HourlyStats[]>(cacheKey);
      
      if (cached) {
        return this.createStandardResponse(cached, true, 0);
      }

      const hourlyStats = await this.analyticsService.getHourlyStats(query.date, 'Paris', 'France');
      
      if (!hourlyStats || hourlyStats.length === 0) {
        throw new NotFoundException(`No hourly data found for Paris on ${query.date}`);
      }

      // Cache for 30 minutes (longer for historical dates)
      const cacheTtl = this.isHistoricalDate(query.date) ? 43200 : 1800;
      await this.cacheManager.set(cacheKey, hourlyStats, cacheTtl);
      
      return this.createStandardResponse(hourlyStats, false, 30);

    } catch (error) {
      this.logger.error('Error fetching Paris hourly averages:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to retrieve Paris hourly averages');
    }
  }

  /**
   * GET /api/analytics/trends - Historical trends analysis
   */
  @Get('trends')
  @CacheTTL(7200) // 2 hours cache
  @HttpCode(HttpStatus.OK)
  async getHistoricalTrends(
    @Query('city') city: string = 'Paris',
    @Query('country') country: string = 'France',
    @Query('days') days: number = 30,
  ): Promise<StandardizedApiResponse<HistoricalTrend[]>> {
    try {
      this.logger.log(`Fetching historical trends for ${city}, ${country} over ${days} days`);
      
      const cacheKey = `trends-${city}-${country}-${days}`;
      const cached = await this.cacheManager.get<HistoricalTrend[]>(cacheKey);
      
      if (cached) {
        return this.createStandardResponse(cached, true, 0);
      }

      const trends = await this.analyticsService.getHistoricalTrends(city, country, days);
      
      if (!trends || trends.length === 0) {
        throw new NotFoundException(`No trend data found for ${city}, ${country}`);
      }

      // Cache for 2 hours
      await this.cacheManager.set(cacheKey, trends, 7200);
      
      return this.createStandardResponse(trends, false, 120);

    } catch (error) {
      this.logger.error('Error fetching historical trends:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to retrieve historical trends');
    }
  }

  /**
   * GET /api/analytics/pollution-patterns - Pollution pattern analysis
   */
  @Get('pollution-patterns')
  @CacheTTL(3600)
  @HttpCode(HttpStatus.OK)
  async getPollutionPatterns(
    @Query('city') city: string = 'Paris',
    @Query('country') country: string = 'France',
    @Query('period') period: 'weekly' | 'monthly' = 'weekly',
  ): Promise<StandardizedApiResponse<PollutionPattern[]>> {
    try {
      this.logger.log(`Fetching pollution patterns for ${city}, ${country} (${period})`);
      
      const cacheKey = `patterns-${city}-${country}-${period}`;
      const cached = await this.cacheManager.get<PollutionPattern[]>(cacheKey);
      
      if (cached) {
        return this.createStandardResponse(cached, true, 0);
      }

      const patterns = await this.analyticsService.getPollutionPatterns(city, country, period);
      
      if (!patterns || patterns.length === 0) {
        throw new NotFoundException(`No pattern data found for ${city}, ${country}`);
      }

      // Cache for 1 hour
      await this.cacheManager.set(cacheKey, patterns, 3600);
      
      return this.createStandardResponse(patterns, false, 60);

    } catch (error) {
      this.logger.error('Error fetching pollution patterns:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to retrieve pollution patterns');
    }
  }

  /**
   * Legacy endpoints for backward compatibility
   */
  @Get('daily-stats/:city/:country')
  @CacheTTL(3600)
  @HttpCode(HttpStatus.OK)
  async getDailyStatsLegacy(
    @Param('city') city: string,
    @Param('country') country: string,
    @Query('date') date?: string,
  ): Promise<StandardizedApiResponse<DailyStats>> {
    const targetDate = date || new Date().toISOString().split('T')[0];
    this.logger.log(`Legacy endpoint: Fetching daily stats for ${city}, ${country} on ${targetDate}`);
    
    try {
      const dailyStats = await this.analyticsService.calculateDailyStats(targetDate, city, country);
      return this.createStandardResponse(dailyStats, false, 0);
    } catch (error) {
      throw new InternalServerErrorException('Failed to retrieve daily statistics');
    }
  }

  @Get('hourly-stats/:city/:country')
  @CacheTTL(1800)
  @HttpCode(HttpStatus.OK)
  async getHourlyStatsLegacy(
    @Param('city') city: string,
    @Param('country') country: string,
    @Query('date') date?: string,
  ): Promise<StandardizedApiResponse<HourlyStats[]>> {
    const targetDate = date || new Date().toISOString().split('T')[0];
    this.logger.log(`Legacy endpoint: Fetching hourly stats for ${city}, ${country} on ${targetDate}`);
    
    try {
      const hourlyStats = await this.analyticsService.getHourlyStats(targetDate, city, country);
      return this.createStandardResponse(hourlyStats, false, 0);
    } catch (error) {
      throw new InternalServerErrorException('Failed to retrieve hourly statistics');
    }
  }

  /**
   * Administrative endpoints
   */
  @Post('cache/invalidate')
  @HttpCode(HttpStatus.OK)
  async invalidateCache(
    @Body() body: { city?: string; country?: string; date?: string },
    @Headers('x-api-key') apiKey?: string,
  ): Promise<StandardizedApiResponse<{ message: string }>> {
    try {
      // Basic API key validation
      const adminApiKey = 'admin-api-key'; // This should come from config
      if (apiKey !== adminApiKey) {
        throw new BadRequestException('Invalid API key for admin operations');
      }

      const city = body.city || 'Paris';
      const country = body.country || 'France';
      
      await this.analyticsService.invalidateCache(city, country, body.date);
      
      const message = `Cache invalidated for ${city}, ${country}${body.date ? ` on ${body.date}` : ''}`;
      this.logger.log(message);
      
      return this.createStandardResponse({ message }, false, 0);
    } catch (error) {
      this.logger.error('Error invalidating cache:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to invalidate cache');
    }
  }

  @Get('health')
  @HttpCode(HttpStatus.OK)
  async getHealth(): Promise<StandardizedApiResponse<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: Date;
    version: string;
    features: {
      dailyStats: boolean;
      hourlyStats: boolean;
      historicalTrends: boolean;
      pollutionPatterns: boolean;
      caching: boolean;
    };
  }>> {
    try {
      this.logger.log('Checking analytics service health');
      
      const healthData = {
        status: 'healthy' as const,
        timestamp: new Date(),
        version: '1.0.0',
        features: {
          dailyStats: true,
          hourlyStats: true,
          historicalTrends: true,
          pollutionPatterns: true,
          caching: true,
        },
      };

      return this.createStandardResponse(healthData, false, 0);
    } catch (error) {
      this.logger.error('Error checking health:', error);
      throw new InternalServerErrorException('Health check failed');
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

  private isHistoricalDate(dateString: string): boolean {
    const targetDate = new Date(dateString);
    const today = new Date();
    const diffInDays = (today.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24);
    return diffInDays > 1;
  }
} 