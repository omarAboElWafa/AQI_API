import { Controller, Get, Post, Param, Query, Body, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';

import { AnalyticsService } from '../services/analytics.service';
import { DailyStats, HourlyStats, HistoricalTrend, PollutionPattern, MostPollutedTime } from '../services/analytics.service';

export class AnalyticsQueryDto {
  city: string;
  country: string;
  date?: string;
  days?: number;
  period?: 'weekly' | 'monthly';
}

@ApiTags('analytics')
@Controller('analytics')
export class AnalyticsController {
  private readonly logger = new Logger(AnalyticsController.name);

  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('daily-stats/:city/:country')
  @ApiOperation({ summary: 'Get daily statistics for a specific city and country' })
  @ApiParam({ name: 'city', description: 'City name' })
  @ApiParam({ name: 'country', description: 'Country name' })
  @ApiQuery({ name: 'date', required: false, description: 'Date in YYYY-MM-DD format (defaults to today)' })
  @ApiResponse({ status: 200, description: 'Daily statistics retrieved successfully' })
  async getDailyStats(
    @Param('city') city: string,
    @Param('country') country: string,
    @Query('date') date?: string,
  ): Promise<DailyStats> {
    this.logger.log(`Fetching daily stats for ${city}, ${country} on ${date || 'today'}`);
    
    const targetDate = date || new Date().toISOString().split('T')[0];
    return this.analyticsService.calculateDailyStats(targetDate, city, country);
  }

  @Get('current-day/:city/:country')
  @ApiOperation({ summary: 'Get current day statistics with real-time updates' })
  @ApiParam({ name: 'city', description: 'City name' })
  @ApiParam({ name: 'country', description: 'Country name' })
  @ApiResponse({ status: 200, description: 'Current day statistics retrieved successfully' })
  async getCurrentDayStats(
    @Param('city') city: string,
    @Param('country') country: string,
  ): Promise<DailyStats> {
    this.logger.log(`Fetching current day stats for ${city}, ${country}`);
    return this.analyticsService.updateCurrentDayStats(city, country);
  }

  @Get('hourly-stats/:city/:country')
  @ApiOperation({ summary: 'Get hourly statistics for a specific date' })
  @ApiParam({ name: 'city', description: 'City name' })
  @ApiParam({ name: 'country', description: 'Country name' })
  @ApiQuery({ name: 'date', required: false, description: 'Date in YYYY-MM-DD format (defaults to today)' })
  @ApiResponse({ status: 200, description: 'Hourly statistics retrieved successfully' })
  async getHourlyStats(
    @Param('city') city: string,
    @Param('country') country: string,
    @Query('date') date?: string,
  ): Promise<HourlyStats[]> {
    this.logger.log(`Fetching hourly stats for ${city}, ${country} on ${date || 'today'}`);
    
    const targetDate = date || new Date().toISOString().split('T')[0];
    return this.analyticsService.getHourlyStats(targetDate, city, country);
  }

  @Get('most-polluted-time/:city/:country')
  @ApiOperation({ summary: 'Get the most polluted time period' })
  @ApiParam({ name: 'city', description: 'City name' })
  @ApiParam({ name: 'country', description: 'Country name' })
  @ApiQuery({ name: 'days', required: false, description: 'Number of days to analyze (default: 7)' })
  @ApiResponse({ status: 200, description: 'Most polluted time retrieved successfully' })
  async getMostPollutedTime(
    @Param('city') city: string,
    @Param('country') country: string,
    @Query('days') days?: number,
  ): Promise<MostPollutedTime> {
    this.logger.log(`Fetching most polluted time for ${city}, ${country} over ${days || 7} days`);
    return this.analyticsService.getMostPollutedTime(city, country, days || 7);
  }

  @Get('historical-trends/:city/:country')
  @ApiOperation({ summary: 'Get historical trends for multiple days' })
  @ApiParam({ name: 'city', description: 'City name' })
  @ApiParam({ name: 'country', description: 'Country name' })
  @ApiQuery({ name: 'days', required: false, description: 'Number of days to analyze (default: 30)' })
  @ApiResponse({ status: 200, description: 'Historical trends retrieved successfully' })
  async getHistoricalTrends(
    @Param('city') city: string,
    @Param('country') country: string,
    @Query('days') days?: number,
  ): Promise<HistoricalTrend[]> {
    this.logger.log(`Fetching historical trends for ${city}, ${country} over ${days || 30} days`);
    return this.analyticsService.getHistoricalTrends(city, country, days || 30);
  }

  @Get('pollution-patterns/:city/:country')
  @ApiOperation({ summary: 'Get pollution patterns (weekly/monthly analysis)' })
  @ApiParam({ name: 'city', description: 'City name' })
  @ApiParam({ name: 'country', description: 'Country name' })
  @ApiQuery({ name: 'period', required: false, description: 'Analysis period: weekly or monthly (default: weekly)' })
  @ApiResponse({ status: 200, description: 'Pollution patterns retrieved successfully' })
  async getPollutionPatterns(
    @Param('city') city: string,
    @Param('country') country: string,
    @Query('period') period?: 'weekly' | 'monthly',
  ): Promise<PollutionPattern[]> {
    this.logger.log(`Fetching pollution patterns for ${city}, ${country} (${period || 'weekly'})`);
    return this.analyticsService.getPollutionPatterns(city, country, period || 'weekly');
  }

  @Get('comprehensive-report/:city/:country')
  @ApiOperation({ summary: 'Get comprehensive analytics report' })
  @ApiParam({ name: 'city', description: 'City name' })
  @ApiParam({ name: 'country', description: 'Country name' })
  @ApiQuery({ name: 'days', required: false, description: 'Number of days to analyze (default: 7)' })
  @ApiResponse({ status: 200, description: 'Comprehensive report retrieved successfully' })
  async getComprehensiveReport(
    @Param('city') city: string,
    @Param('country') country: string,
    @Query('days') days?: number,
  ): Promise<{
    dailyStats: DailyStats;
    mostPollutedTime: MostPollutedTime;
    historicalTrends: HistoricalTrend[];
    pollutionPatterns: PollutionPattern[];
    summary: {
      averageAQI: number;
      trend: 'improving' | 'worsening' | 'stable';
      dominantPollutant: string;
      unhealthyDays: number;
      totalDays: number;
    };
  }> {
    this.logger.log(`Generating comprehensive report for ${city}, ${country} over ${days || 7} days`);
    return this.analyticsService.generateComprehensiveReport(city, country, days || 7);
  }

  @Get('top-cities')
  @ApiOperation({ summary: 'Get top cities by average AQI' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of cities to return (default: 10)' })
  @ApiResponse({ status: 200, description: 'Top cities retrieved successfully' })
  async getTopCitiesByAQI(
    @Query('limit') limit?: number,
  ): Promise<Array<{ city: string; country: string; averageAQI: number }>> {
    this.logger.log(`Fetching top ${limit || 10} cities by AQI`);
    return this.analyticsService.getTopCitiesByAQI(limit || 10);
  }

  @Get('daily-report/:city/:country')
  @ApiOperation({ summary: 'Get daily report (legacy endpoint)' })
  @ApiParam({ name: 'city', description: 'City name' })
  @ApiParam({ name: 'country', description: 'Country name' })
  @ApiResponse({ status: 200, description: 'Daily report retrieved successfully' })
  async getDailyReport(
    @Param('city') city: string,
    @Param('country') country: string,
  ): Promise<{
    city: string;
    country: string;
    period: string;
    averageAQI: number;
    maxAQI: number;
    minAQI: number;
    unhealthyDays: number;
    totalDays: number;
    trend: 'improving' | 'worsening' | 'stable';
  }> {
    this.logger.log(`Fetching daily report for ${city}, ${country}`);
    return this.analyticsService.generateDailyReport(city, country);
  }

  @Get('weekly-report/:city/:country')
  @ApiOperation({ summary: 'Get weekly report (legacy endpoint)' })
  @ApiParam({ name: 'city', description: 'City name' })
  @ApiParam({ name: 'country', description: 'Country name' })
  @ApiResponse({ status: 200, description: 'Weekly report retrieved successfully' })
  async getWeeklyReport(
    @Param('city') city: string,
    @Param('country') country: string,
  ): Promise<{
    city: string;
    country: string;
    period: string;
    averageAQI: number;
    maxAQI: number;
    minAQI: number;
    unhealthyDays: number;
    totalDays: number;
    trend: 'improving' | 'worsening' | 'stable';
  }> {
    this.logger.log(`Fetching weekly report for ${city}, ${country}`);
    return this.analyticsService.generateWeeklyReport(city, country);
  }

  @Post('cache/invalidate/:city/:country')
  @ApiOperation({ summary: 'Invalidate cache for specific city and country' })
  @ApiParam({ name: 'city', description: 'City name' })
  @ApiParam({ name: 'country', description: 'Country name' })
  @ApiQuery({ name: 'date', required: false, description: 'Specific date to invalidate (optional)' })
  @ApiResponse({ status: 200, description: 'Cache invalidated successfully' })
  async invalidateCache(
    @Param('city') city: string,
    @Param('country') country: string,
    @Query('date') date?: string,
  ): Promise<{ message: string; city: string; country: string; date?: string }> {
    this.logger.log(`Invalidating cache for ${city}, ${country}${date ? ` on ${date}` : ''}`);
    
    await this.analyticsService.invalidateCache(city, country, date);
    
    return {
      message: 'Cache invalidated successfully',
      city,
      country,
      date,
    };
  }

  @Get('health')
  @ApiOperation({ summary: 'Get analytics service health status' })
  @ApiResponse({ status: 200, description: 'Analytics service health status' })
  async getHealth(): Promise<{
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
  }> {
    this.logger.log('Checking analytics service health');
    
    return {
      status: 'healthy',
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
  }
} 