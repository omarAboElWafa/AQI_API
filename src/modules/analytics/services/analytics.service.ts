import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Inject, CACHE_MANAGER } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';

import { AirQuality, AirQualityDocument } from '../air-quality/schemas/air-quality.schema';
import { DailyAggregation, DailyAggregationDocument } from '../analytics/schemas/daily-aggregation.schema';

export interface AnalyticsReport {
  city: string;
  country: string;
  period: string;
  averageAQI: number;
  maxAQI: number;
  minAQI: number;
  unhealthyDays: number;
  totalDays: number;
  trend: 'improving' | 'worsening' | 'stable';
}

export interface DailyStats {
  date: string;
  city: string;
  country: string;
  averageAQI: number;
  maxAQI: number;
  minAQI: number;
  dominantPollutant: string;
  pollutionLevel: 'Good' | 'Moderate' | 'Unhealthy for Sensitive Groups' | 'Unhealthy' | 'Very Unhealthy' | 'Hazardous';
  hourlyAverages: Array<{
    hour: number;
    averageAQI: number;
    recordCount: number;
  }>;
  totalRecords: number;
  missingDataHours: number[];
  lastUpdated: Date;
}

export interface HourlyStats {
  hour: number;
  averageAQI: number;
  maxAQI: number;
  minAQI: number;
  dominantPollutant: string;
  recordCount: number;
  weatherAverage: {
    temperature: number;
    humidity: number;
    pressure: number;
    windSpeed: number;
  };
}

export interface PollutionPattern {
  timeSlot: string;
  averageAQI: number;
  frequency: number;
  dominantPollutant: string;
  pollutionLevel: string;
}

export interface HistoricalTrend {
  date: string;
  averageAQI: number;
  maxAQI: number;
  minAQI: number;
  dominantPollutant: string;
  recordCount: number;
}

export interface MostPollutedTime {
  timestamp: Date;
  aqi: number;
  pollutant: string;
  city: string;
  country: string;
  weather: {
    temperature: number;
    humidity: number;
    pressure: number;
    windSpeed: number;
  };
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
  private readonly cacheTTL = {
    dailyStats: 24 * 60 * 60, // 24 hours
    hourlyStats: 60 * 60, // 1 hour
    mostPollutedTime: 24 * 60 * 60, // 24 hours
    historicalTrends: 6 * 60 * 60, // 6 hours
    pollutionPatterns: 12 * 60 * 60, // 12 hours
  };

  constructor(
    @InjectQueue('analytics') private analyticsQueue: Queue,
    @InjectModel(AirQuality.name) private airQualityModel: Model<AirQualityDocument>,
    @InjectModel(DailyAggregation.name) private dailyAggregationModel: Model<DailyAggregationDocument>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private configService: ConfigService,
  ) {}

  /**
   * Calculate daily statistics with MongoDB aggregation pipeline
   */
  async calculateDailyStats(date: string, city: string, country: string): Promise<DailyStats> {
    const cacheKey = `daily-stats:${city}:${country}:${date}`;
    
    // Try to get from cache first
    const cached = await this.cacheManager.get<DailyStats>(cacheKey);
    if (cached) {
      this.logger.debug(`Retrieved daily stats from cache for ${city}, ${country} on ${date}`);
      return cached;
    }

    const startDate = new Date(date);
    const endDate = new Date(date);
    endDate.setDate(endDate.getDate() + 1);

    // MongoDB aggregation pipeline for daily statistics
    const pipeline = [
      {
        $match: {
          city,
          country,
          timestamp: {
            $gte: startDate,
            $lt: endDate,
          },
        },
      },
      {
        $facet: {
          // Overall daily statistics
          dailyStats: [
            {
              $group: {
                _id: null,
                averageAQI: { $avg: '$pollution.aqius' },
                maxAQI: { $max: '$pollution.aqius' },
                minAQI: { $min: '$pollution.aqius' },
                totalRecords: { $sum: 1 },
                dominantPollutant: {
                  $push: '$pollution.mainus',
                },
              },
            },
          ],
          // Hourly averages
          hourlyStats: [
            {
              $group: {
                _id: { $hour: '$timestamp' },
                averageAQI: { $avg: '$pollution.aqius' },
                maxAQI: { $max: '$pollution.aqius' },
                minAQI: { $min: '$pollution.aqius' },
                recordCount: { $sum: 1 },
                dominantPollutant: {
                  $push: '$pollution.mainus',
                },
                avgTemperature: { $avg: '$weather.tp' },
                avgHumidity: { $avg: '$weather.hu' },
                avgPressure: { $avg: '$weather.pr' },
                avgWindSpeed: { $avg: '$weather.ws' },
              },
            },
            {
              $sort: { _id: 1 },
            },
          ],
          // Missing hours detection
          missingHours: [
            {
              $group: {
                _id: { $hour: '$timestamp' },
              },
            },
            {
              $sort: { _id: 1 },
            },
          ],
        },
      },
    ];

    const result = await this.airQualityModel.aggregate(pipeline).exec();

    if (result.length === 0 || result[0].dailyStats.length === 0) {
      throw new Error(`No data available for ${city}, ${country} on ${date}`);
    }

    const dailyStats = result[0].dailyStats[0];
    const hourlyStats = result[0].hourlyStats;
    const presentHours = result[0].missingHours.map(h => h._id);

    // Calculate missing hours (0-23)
    const missingHours = Array.from({ length: 24 }, (_, i) => i)
      .filter(hour => !presentHours.includes(hour));

    // Find dominant pollutant for the day
    const dominantPollutant = this.findDominantPollutant(dailyStats.dominantPollutant);

    // Determine pollution level
    const pollutionLevel = this.getPollutionLevel(dailyStats.averageAQI);

    // Format hourly averages
    const hourlyAverages = hourlyStats.map(hour => ({
      hour: hour._id,
      averageAQI: Math.round(hour.averageAQI * 100) / 100,
      recordCount: hour.recordCount,
    }));

    const stats: DailyStats = {
      date,
      city,
      country,
      averageAQI: Math.round(dailyStats.averageAQI * 100) / 100,
      maxAQI: dailyStats.maxAQI,
      minAQI: dailyStats.minAQI,
      dominantPollutant,
      pollutionLevel,
      hourlyAverages,
      totalRecords: dailyStats.totalRecords,
      missingDataHours: missingHours,
      lastUpdated: new Date(),
    };

    // Cache the result
    await this.cacheManager.set(cacheKey, stats, this.cacheTTL.dailyStats);

    // Store in daily aggregation collection for historical analysis
    await this.storeDailyAggregation(stats);

    return stats;
  }

  /**
   * Update current day statistics in real-time
   */
  async updateCurrentDayStats(city: string, country: string): Promise<DailyStats> {
    const today = new Date().toISOString().split('T')[0];
    return this.calculateDailyStats(today, city, country);
  }

  /**
   * Get most polluted time with detailed analysis
   */
  async getMostPollutedTime(city: string, country: string, days: number = 7): Promise<MostPollutedTime> {
    const cacheKey = `most-polluted-time:${city}:${country}:${days}`;
    
    const cached = await this.cacheManager.get<MostPollutedTime>(cacheKey);
    if (cached) {
      return cached;
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const pipeline = [
      {
        $match: {
          city,
          country,
          timestamp: {
            $gte: startDate,
            $lte: endDate,
          },
        },
      },
      {
        $sort: { 'pollution.aqius': -1 },
      },
      {
        $limit: 1,
      },
      {
        $project: {
          timestamp: 1,
          aqi: '$pollution.aqius',
          pollutant: '$pollution.mainus',
          city: 1,
          country: 1,
          weather: {
            temperature: '$weather.tp',
            humidity: '$weather.hu',
            pressure: '$weather.pr',
            windSpeed: '$weather.ws',
          },
        },
      },
    ];

    const result = await this.airQualityModel.aggregate(pipeline).exec();

    if (result.length === 0) {
      throw new Error(`No data available for ${city}, ${country} in the last ${days} days`);
    }

    const mostPolluted = result[0];
    const mostPollutedTime: MostPollutedTime = {
      timestamp: mostPolluted.timestamp,
      aqi: mostPolluted.aqi,
      pollutant: mostPolluted.pollutant,
      city: mostPolluted.city,
      country: mostPolluted.country,
      weather: mostPolluted.weather,
    };

    await this.cacheManager.set(cacheKey, mostPollutedTime, this.cacheTTL.mostPollutedTime);
    return mostPollutedTime;
  }

  /**
   * Get historical trends for multiple days
   */
  async getHistoricalTrends(city: string, country: string, days: number = 30): Promise<HistoricalTrend[]> {
    const cacheKey = `historical-trends:${city}:${country}:${days}`;
    
    const cached = await this.cacheManager.get<HistoricalTrend[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const pipeline = [
      {
        $match: {
          city,
          country,
          timestamp: {
            $gte: startDate,
            $lte: endDate,
          },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$timestamp',
            },
          },
          averageAQI: { $avg: '$pollution.aqius' },
          maxAQI: { $max: '$pollution.aqius' },
          minAQI: { $min: '$pollution.aqius' },
          dominantPollutant: { $push: '$pollution.mainus' },
          recordCount: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
      {
        $project: {
          date: '$_id',
          averageAQI: { $round: ['$averageAQI', 2] },
          maxAQI: 1,
          minAQI: 1,
          dominantPollutant: 1,
          recordCount: 1,
        },
      },
    ];

    const results = await this.airQualityModel.aggregate(pipeline).exec();

    const trends: HistoricalTrend[] = results.map(result => ({
      date: result.date,
      averageAQI: result.averageAQI,
      maxAQI: result.maxAQI,
      minAQI: result.minAQI,
      dominantPollutant: this.findDominantPollutant(result.dominantPollutant),
      recordCount: result.recordCount,
    }));

    await this.cacheManager.set(cacheKey, trends, this.cacheTTL.historicalTrends);
    return trends;
  }

  /**
   * Get pollution patterns (weekly/monthly analysis)
   */
  async getPollutionPatterns(city: string, country: string, period: 'weekly' | 'monthly' = 'weekly'): Promise<PollutionPattern[]> {
    const cacheKey = `pollution-patterns:${city}:${country}:${period}`;
    
    const cached = await this.cacheManager.get<PollutionPattern[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (period === 'weekly' ? 7 : 30));

    const pipeline = [
      {
        $match: {
          city,
          country,
          timestamp: {
            $gte: startDate,
            $lte: endDate,
          },
        },
      },
      {
        $group: {
          _id: {
            hour: { $hour: '$timestamp' },
            pollutant: '$pollution.mainus',
            pollutionLevel: {
              $switch: {
                branches: [
                  { case: { $lte: ['$pollution.aqius', 50] }, then: 'Good' },
                  { case: { $lte: ['$pollution.aqius', 100] }, then: 'Moderate' },
                  { case: { $lte: ['$pollution.aqius', 150] }, then: 'Unhealthy for Sensitive Groups' },
                  { case: { $lte: ['$pollution.aqius', 200] }, then: 'Unhealthy' },
                  { case: { $lte: ['$pollution.aqius', 300] }, then: 'Very Unhealthy' },
                ],
                default: 'Hazardous',
              },
            },
          },
          averageAQI: { $avg: '$pollution.aqius' },
          frequency: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: {
            hour: '$_id.hour',
            pollutionLevel: '$_id.pollutionLevel',
          },
          averageAQI: { $avg: '$averageAQI' },
          frequency: { $sum: '$frequency' },
          dominantPollutant: {
            $first: '$_id.pollutant',
          },
        },
      },
      {
        $sort: { '_id.hour': 1, frequency: -1 },
      },
      {
        $project: {
          timeSlot: {
            $concat: [
              { $toString: '$_id.hour' },
              ':00',
            ],
          },
          averageAQI: { $round: ['$averageAQI', 2] },
          frequency: 1,
          dominantPollutant: 1,
          pollutionLevel: '$_id.pollutionLevel',
        },
      },
    ];

    const results = await this.airQualityModel.aggregate(pipeline).exec();

    const patterns: PollutionPattern[] = results.map(result => ({
      timeSlot: result.timeSlot,
      averageAQI: result.averageAQI,
      frequency: result.frequency,
      dominantPollutant: result.dominantPollutant,
      pollutionLevel: result.pollutionLevel,
    }));

    await this.cacheManager.set(cacheKey, patterns, this.cacheTTL.pollutionPatterns);
    return patterns;
  }

  /**
   * Get hourly statistics for a specific day
   */
  async getHourlyStats(date: string, city: string, country: string): Promise<HourlyStats[]> {
    const cacheKey = `hourly-stats:${city}:${country}:${date}`;
    
    const cached = await this.cacheManager.get<HourlyStats[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const startDate = new Date(date);
    const endDate = new Date(date);
    endDate.setDate(endDate.getDate() + 1);

    const pipeline = [
      {
        $match: {
          city,
          country,
          timestamp: {
            $gte: startDate,
            $lt: endDate,
          },
        },
      },
      {
        $group: {
          _id: { $hour: '$timestamp' },
          averageAQI: { $avg: '$pollution.aqius' },
          maxAQI: { $max: '$pollution.aqius' },
          minAQI: { $min: '$pollution.aqius' },
          dominantPollutant: { $push: '$pollution.mainus' },
          recordCount: { $sum: 1 },
          avgTemperature: { $avg: '$weather.tp' },
          avgHumidity: { $avg: '$weather.hu' },
          avgPressure: { $avg: '$weather.pr' },
          avgWindSpeed: { $avg: '$weather.ws' },
        },
      },
      {
        $sort: { _id: 1 },
      },
      {
        $project: {
          hour: '$_id',
          averageAQI: { $round: ['$averageAQI', 2] },
          maxAQI: 1,
          minAQI: 1,
          dominantPollutant: 1,
          recordCount: 1,
          weatherAverage: {
            temperature: { $round: ['$avgTemperature', 2] },
            humidity: { $round: ['$avgHumidity', 2] },
            pressure: { $round: ['$avgPressure', 2] },
            windSpeed: { $round: ['$avgWindSpeed', 2] },
          },
        },
      },
    ];

    const results = await this.airQualityModel.aggregate(pipeline).exec();

    const hourlyStats: HourlyStats[] = results.map(result => ({
      hour: result.hour,
      averageAQI: result.averageAQI,
      maxAQI: result.maxAQI,
      minAQI: result.minAQI,
      dominantPollutant: this.findDominantPollutant(result.dominantPollutant),
      recordCount: result.recordCount,
      weatherAverage: result.weatherAverage,
    }));

    await this.cacheManager.set(cacheKey, hourlyStats, this.cacheTTL.hourlyStats);
    return hourlyStats;
  }

  /**
   * Generate comprehensive analytics report
   */
  async generateComprehensiveReport(city: string, country: string, days: number = 7): Promise<{
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
    const today = new Date().toISOString().split('T')[0];

    const [dailyStats, mostPollutedTime, historicalTrends, pollutionPatterns] = await Promise.all([
      this.calculateDailyStats(today, city, country),
      this.getMostPollutedTime(city, country, days),
      this.getHistoricalTrends(city, country, days),
      this.getPollutionPatterns(city, country, 'weekly'),
    ]);

    // Calculate summary statistics
    const averageAQI = historicalTrends.reduce((sum, trend) => sum + trend.averageAQI, 0) / historicalTrends.length;
    const unhealthyDays = historicalTrends.filter(trend => trend.averageAQI > 100).length;
    const trend = this.calculateTrendFromHistorical(historicalTrends);

    const summary = {
      averageAQI: Math.round(averageAQI * 100) / 100,
      trend,
      dominantPollutant: dailyStats.dominantPollutant,
      unhealthyDays,
      totalDays: historicalTrends.length,
    };

    return {
      dailyStats,
      mostPollutedTime,
      historicalTrends,
      pollutionPatterns,
      summary,
    };
  }

  /**
   * Invalidate cache for specific data
   */
  async invalidateCache(city: string, country: string, date?: string): Promise<void> {
    const patterns = [
      `daily-stats:${city}:${country}:*`,
      `hourly-stats:${city}:${country}:*`,
      `most-polluted-time:${city}:${country}:*`,
      `historical-trends:${city}:${country}:*`,
      `pollution-patterns:${city}:${country}:*`,
    ];

    if (date) {
      patterns.push(`daily-stats:${city}:${country}:${date}`);
      patterns.push(`hourly-stats:${city}:${country}:${date}`);
    }

    // Note: Redis doesn't support pattern deletion directly
    // In a production environment, you'd use SCAN + DEL
    this.logger.log(`Cache invalidation requested for ${city}, ${country}`);
  }

  /**
   * Store daily aggregation for historical analysis
   */
  private async storeDailyAggregation(stats: DailyStats): Promise<void> {
    try {
      const aggregation = new this.dailyAggregationModel({
        date: stats.date,
        city: stats.city,
        country: stats.country,
        averageAQI: stats.averageAQI,
        maxAQI: stats.maxAQI,
        minAQI: stats.minAQI,
        dominantPollutant: stats.dominantPollutant,
        pollutionLevel: stats.pollutionLevel,
        totalRecords: stats.totalRecords,
        hourlyAverages: stats.hourlyAverages,
        missingDataHours: stats.missingDataHours,
      });

      await aggregation.save();
    } catch (error) {
      this.logger.error('Error storing daily aggregation:', error);
    }
  }

  /**
   * Find dominant pollutant from array
   */
  private findDominantPollutant(pollutants: string[]): string {
    const frequency: Record<string, number> = {};
    
    pollutants.forEach(pollutant => {
      frequency[pollutant] = (frequency[pollutant] || 0) + 1;
    });

    return Object.entries(frequency)
      .sort(([, a], [, b]) => b - a)[0][0];
  }

  /**
   * Get pollution level based on AQI
   */
  private getPollutionLevel(aqi: number): 'Good' | 'Moderate' | 'Unhealthy for Sensitive Groups' | 'Unhealthy' | 'Very Unhealthy' | 'Hazardous' {
    if (aqi <= 50) return 'Good';
    if (aqi <= 100) return 'Moderate';
    if (aqi <= 150) return 'Unhealthy for Sensitive Groups';
    if (aqi <= 200) return 'Unhealthy';
    if (aqi <= 300) return 'Very Unhealthy';
    return 'Hazardous';
  }

  /**
   * Calculate trend from historical data
   */
  private calculateTrendFromHistorical(trends: HistoricalTrend[]): 'improving' | 'worsening' | 'stable' {
    if (trends.length < 3) return 'stable';

    const recent = trends.slice(-3);
    const older = trends.slice(0, 3);

    const recentAvg = recent.reduce((sum, t) => sum + t.averageAQI, 0) / recent.length;
    const olderAvg = older.reduce((sum, t) => sum + t.averageAQI, 0) / older.length;

    const difference = recentAvg - olderAvg;
    const threshold = 5;

    if (difference > threshold) return 'worsening';
    if (difference < -threshold) return 'improving';
    return 'stable';
  }

  /**
   * Legacy methods for backward compatibility
   */
  async generateDailyReport(city: string, country: string): Promise<AnalyticsReport> {
    const today = new Date().toISOString().split('T')[0];
    const dailyStats = await this.calculateDailyStats(today, city, country);
    
    return {
      city: dailyStats.city,
      country: dailyStats.country,
      period: '24h',
      averageAQI: dailyStats.averageAQI,
      maxAQI: dailyStats.maxAQI,
      minAQI: dailyStats.minAQI,
      unhealthyDays: dailyStats.averageAQI > 100 ? 1 : 0,
      totalDays: 1,
      trend: 'stable', // Would need historical data for proper trend calculation
    };
  }

  async generateWeeklyReport(city: string, country: string): Promise<AnalyticsReport> {
    const trends = await this.getHistoricalTrends(city, country, 7);
    
    if (trends.length === 0) {
      throw new Error(`No data available for ${city}, ${country} in the last week`);
    }

    const aqiValues = trends.map(t => t.averageAQI);
    const averageAQI = aqiValues.reduce((sum, aqi) => sum + aqi, 0) / aqiValues.length;
    const maxAQI = Math.max(...aqiValues);
    const minAQI = Math.min(...aqiValues);
    const unhealthyDays = aqiValues.filter(aqi => aqi > 100).length;

    return {
      city,
      country,
      period: '7d',
      averageAQI: Math.round(averageAQI * 100) / 100,
      maxAQI,
      minAQI,
      unhealthyDays,
      totalDays: trends.length,
      trend: this.calculateTrendFromHistorical(trends),
    };
  }

  async getTopCitiesByAQI(limit: number = 10): Promise<Array<{ city: string; country: string; averageAQI: number }>> {
    const pipeline = [
      {
        $group: {
          _id: { city: '$city', country: '$country' },
          averageAQI: { $avg: '$pollution.aqius' },
          count: { $sum: 1 },
        },
      },
      {
        $match: {
          count: { $gte: 5 },
        },
      },
      {
        $sort: { averageAQI: -1 },
      },
      {
        $limit: limit,
      },
      {
        $project: {
          city: '$_id.city',
          country: '$_id.country',
          averageAQI: { $round: ['$averageAQI', 2] },
        },
      },
    ];

    return await this.airQualityModel.aggregate(pipeline).exec();
  }

  async addAnalyticsJob(city: string, country: string, reportType: 'daily' | 'weekly'): Promise<void> {
    await this.analyticsQueue.add('generate-report', {
      city,
      country,
      reportType,
    });
  }

  private calculateTrend(aqiValues: number[]): 'improving' | 'worsening' | 'stable' {
    if (aqiValues.length < 2) return 'stable';

    const firstHalf = aqiValues.slice(0, Math.floor(aqiValues.length / 2));
    const secondHalf = aqiValues.slice(Math.floor(aqiValues.length / 2));

    const firstAvg = firstHalf.reduce((sum, aqi) => sum + aqi, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, aqi) => sum + aqi, 0) / secondHalf.length;

    const difference = secondAvg - firstAvg;
    const threshold = 5;

    if (difference > threshold) return 'worsening';
    if (difference < -threshold) return 'improving';
    return 'stable';
  }
} 