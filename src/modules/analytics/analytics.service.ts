import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { AirQuality, AirQualityDocument } from '../air-quality/schemas/air-quality.schema';

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

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectQueue('analytics') private analyticsQueue: Queue,
    @InjectModel(AirQuality.name) private airQualityModel: Model<AirQualityDocument>,
  ) {}

  async generateDailyReport(city: string, country: string): Promise<AnalyticsReport> {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const records = await this.airQualityModel
      .find({
        city,
        country,
        timestamp: {
          $gte: yesterday,
          $lte: today,
        },
      })
      .sort({ timestamp: 1 })
      .exec();

    if (records.length === 0) {
      throw new Error(`No data available for ${city}, ${country} in the last 24 hours`);
    }

    const aqiValues = records.map(record => record.pollution.aqius);
    const averageAQI = aqiValues.reduce((sum, aqi) => sum + aqi, 0) / aqiValues.length;
    const maxAQI = Math.max(...aqiValues);
    const minAQI = Math.min(...aqiValues);
    const unhealthyDays = aqiValues.filter(aqi => aqi > 100).length;

    // Calculate trend (simple comparison of first and last values)
    const trend = this.calculateTrend(aqiValues);

    return {
      city,
      country,
      period: '24h',
      averageAQI: Math.round(averageAQI * 100) / 100,
      maxAQI,
      minAQI,
      unhealthyDays,
      totalDays: records.length,
      trend,
    };
  }

  async generateWeeklyReport(city: string, country: string): Promise<AnalyticsReport> {
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const records = await this.airQualityModel
      .find({
        city,
        country,
        timestamp: {
          $gte: weekAgo,
          $lte: today,
        },
      })
      .sort({ timestamp: 1 })
      .exec();

    if (records.length === 0) {
      throw new Error(`No data available for ${city}, ${country} in the last week`);
    }

    const aqiValues = records.map(record => record.pollution.aqius);
    const averageAQI = aqiValues.reduce((sum, aqi) => sum + aqi, 0) / aqiValues.length;
    const maxAQI = Math.max(...aqiValues);
    const minAQI = Math.min(...aqiValues);
    const unhealthyDays = aqiValues.filter(aqi => aqi > 100).length;

    const trend = this.calculateTrend(aqiValues);

    return {
      city,
      country,
      period: '7d',
      averageAQI: Math.round(averageAQI * 100) / 100,
      maxAQI,
      minAQI,
      unhealthyDays,
      totalDays: records.length,
      trend,
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
          count: { $gte: 5 }, // Only include cities with at least 5 records
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
    const threshold = 5; // 5 AQI points difference

    if (difference > threshold) return 'worsening';
    if (difference < -threshold) return 'improving';
    return 'stable';
  }
} 