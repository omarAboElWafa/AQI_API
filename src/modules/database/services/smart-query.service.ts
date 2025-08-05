import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { AirQualityHot, AirQualityHotDocument } from '../schemas/air-quality-hot.schema';
import { AirQualityWarm, AirQualityWarmDocument } from '../schemas/air-quality-warm.schema';
import { AirQualityCold, AirQualityColdDocument } from '../schemas/air-quality-cold.schema';
import { AirQualityQueryDto } from '@/common/dto/air-quality-record.dto';

export interface QueryResult<T = any> {
  data: T[];
  sources: {
    hot: number;
    warm: number;
    cold: number;
  };
  totalCount: number;
  executionTime: number;
}

@Injectable()
export class SmartQueryService {
  private readonly logger = new Logger(SmartQueryService.name);

  constructor(
    @InjectModel(AirQualityHot.name) private hotModel: Model<AirQualityHotDocument>,
    @InjectModel(AirQualityWarm.name) private warmModel: Model<AirQualityWarmDocument>,
    @InjectModel(AirQualityCold.name) private coldModel: Model<AirQualityColdDocument>,
  ) {}

  /**
   * Smart query that automatically determines which collections to query based on date range
   */
  async getAirQualityData(
    startDate: Date,
    endDate: Date,
    queryOptions: Partial<AirQualityQueryDto> = {}
  ): Promise<QueryResult> {
    const startTime = Date.now();
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    const results: any[] = [];
    const sources = { hot: 0, warm: 0, cold: 0 };

    try {
      // Build base query
      const baseQuery: any = {};
      
      if (queryOptions.location) {
        baseQuery.location = queryOptions.location;
      }
      
      if (queryOptions.minAqi !== undefined) {
        baseQuery.aqi = { $gte: queryOptions.minAqi };
      }
      
      if (queryOptions.maxAqi !== undefined) {
        if (baseQuery.aqi) {
          baseQuery.aqi.$lte = queryOptions.maxAqi;
        } else {
          baseQuery.aqi = { $lte: queryOptions.maxAqi };
        }
      }
      
      if (queryOptions.pollutant) {
        baseQuery.main_pollutant = queryOptions.pollutant;
      }
      
      if (queryOptions.pollution_level) {
        baseQuery.pollution_level = queryOptions.pollution_level;
      }

      // Query hot collection if date range includes last 30 days
      if (endDate >= thirtyDaysAgo) {
        const hotQuery = {
          ...baseQuery,
          timestamp: {
            $gte: startDate,
            $lte: endDate
          }
        };

        const hotData = await this.hotModel
          .find(hotQuery)
          .sort({ timestamp: -1 })
          .limit(queryOptions.limit || 1000)
          .lean();

        results.push(...hotData);
        sources.hot = hotData.length;
        this.logger.debug(`Queried hot collection: ${hotData.length} records`);
      }

      // Query warm collection if date range includes 30 days to 1 year
      if (startDate <= thirtyDaysAgo && endDate >= oneYearAgo) {
        const warmQuery = {
          ...baseQuery,
          timestamp: {
            $gte: startDate < thirtyDaysAgo ? startDate : thirtyDaysAgo,
            $lte: endDate > thirtyDaysAgo ? endDate : thirtyDaysAgo
          }
        };

        const warmData = await this.warmModel
          .find(warmQuery)
          .sort({ timestamp: -1 })
          .limit(queryOptions.limit || 1000)
          .lean();

        results.push(...warmData);
        sources.warm = warmData.length;
        this.logger.debug(`Queried warm collection: ${warmData.length} records`);
      }

      // Query cold collection if date range includes data older than 1 year
      if (startDate <= oneYearAgo) {
        const coldQuery = {
          ...baseQuery,
          timestamp: {
            $gte: startDate < oneYearAgo ? startDate : oneYearAgo,
            $lte: endDate > oneYearAgo ? endDate : oneYearAgo
          }
        };

        const coldData = await this.coldModel
          .find(coldQuery)
          .sort({ timestamp: -1 })
          .limit(queryOptions.limit || 1000)
          .lean();

        results.push(...coldData);
        sources.cold = coldData.length;
        this.logger.debug(`Queried cold collection: ${coldData.length} records`);
      }

      // Sort all results by timestamp
      results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      // Apply limit to final results
      const finalResults = results.slice(0, queryOptions.limit || 1000);

      const executionTime = Date.now() - startTime;

      this.logger.log(`Smart query completed in ${executionTime}ms. Sources: ${JSON.stringify(sources)}`);

      return {
        data: finalResults,
        sources,
        totalCount: finalResults.length,
        executionTime
      };

    } catch (error) {
      this.logger.error('Error during smart query:', error);
      throw error;
    }
  }

  /**
   * Get latest air quality data for a location
   */
  async getLatestAirQuality(location: string): Promise<any | null> {
    // Try hot collection first (most recent data)
    let latestRecord = await this.hotModel
      .findOne({ location })
      .sort({ timestamp: -1 })
      .lean();

    if (!latestRecord) {
      // Try warm collection
      latestRecord = await this.warmModel
        .findOne({ location })
        .sort({ timestamp: -1 })
        .lean();
    }

    if (!latestRecord) {
      // Try cold collection
      latestRecord = await this.coldModel
        .findOne({ location })
        .sort({ timestamp: -1 })
        .lean();
    }

    return latestRecord;
  }

  /**
   * Get air quality data by location coordinates
   */
  async getAirQualityByLocation(
    latitude: number,
    longitude: number,
    maxDistance: number = 50000, // 50km
    limit: number = 10
  ): Promise<QueryResult> {
    const startTime = Date.now();
    const results: any[] = [];
    const sources = { hot: 0, warm: 0, cold: 0 };

    try {
      // Query all collections with geospatial search
      const [hotData, warmData, coldData] = await Promise.all([
        this.hotModel.find({
          coordinates: {
            $near: {
              $geometry: {
                type: 'Point',
                coordinates: [longitude, latitude],
              },
              $maxDistance: maxDistance,
            },
          },
        }).sort({ timestamp: -1 }).limit(limit).lean(),

        this.warmModel.find({
          coordinates: {
            $near: {
              $geometry: {
                type: 'Point',
                coordinates: [longitude, latitude],
              },
              $maxDistance: maxDistance,
            },
          },
        }).sort({ timestamp: -1 }).limit(limit).lean(),

        this.coldModel.find({
          coordinates: {
            $near: {
              $geometry: {
                type: 'Point',
                coordinates: [longitude, latitude],
              },
              $maxDistance: maxDistance,
            },
          },
        }).sort({ timestamp: -1 }).limit(limit).lean(),
      ]);

      results.push(...hotData, ...warmData, ...coldData);
      sources.hot = hotData.length;
      sources.warm = warmData.length;
      sources.cold = coldData.length;

      // Sort by timestamp and limit
      results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      const finalResults = results.slice(0, limit);

      const executionTime = Date.now() - startTime;

      return {
        data: finalResults,
        sources,
        totalCount: finalResults.length,
        executionTime
      };

    } catch (error) {
      this.logger.error('Error during location-based query:', error);
      throw error;
    }
  }

  /**
   * Get collection statistics
   */
  async getCollectionStats(): Promise<{
    hot: { count: number; size: number };
    warm: { count: number; size: number };
    cold: { count: number; size: number };
  }> {
    const [hotStats, warmStats, coldStats] = await Promise.all([
      this.getModelStats(this.hotModel),
      this.getModelStats(this.warmModel),
      this.getModelStats(this.coldModel),
    ]);

    return {
      hot: hotStats,
      warm: warmStats,
      cold: coldStats,
    };
  }

  private async getModelStats(model: Model<any>) {
    const count = await model.countDocuments();
    // Note: Collection size would require database admin commands
    // For now, we'll estimate based on count
    const estimatedSize = count * 1024; // Rough estimate: 1KB per document

    return {
      count,
      size: estimatedSize,
    };
  }

  /**
   * Optimized query for time-series data
   */
  async getTimeSeriesData(
    location: string,
    startDate: Date,
    endDate: Date,
    interval: 'hourly' | 'daily' | 'weekly' = 'daily'
  ): Promise<QueryResult> {
    const startTime = Date.now();
    
    // Use smart query to get data from appropriate collections
    const queryResult = await this.getAirQualityData(startDate, endDate, {
      location,
      limit: 10000 // Higher limit for time-series analysis
    });

    // Group data by time interval
    const groupedData = this.groupByTimeInterval(queryResult.data, interval);

    const executionTime = Date.now() - startTime;

    return {
      data: groupedData,
      sources: queryResult.sources,
      totalCount: groupedData.length,
      executionTime
    };
  }

  private groupByTimeInterval(data: any[], interval: 'hourly' | 'daily' | 'weekly') {
    const grouped: { [key: string]: any[] } = {};

    data.forEach(record => {
      const date = new Date(record.timestamp);
      let key: string;

      switch (interval) {
        case 'hourly':
          key = date.toISOString().slice(0, 13) + ':00:00.000Z'; // YYYY-MM-DDTHH:00:00.000Z
          break;
        case 'daily':
          key = date.toISOString().slice(0, 10) + 'T00:00:00.000Z'; // YYYY-MM-DDT00:00:00.000Z
          break;
        case 'weekly':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          weekStart.setHours(0, 0, 0, 0);
          key = weekStart.toISOString();
          break;
        default:
          key = date.toISOString().slice(0, 10);
      }

      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(record);
    });

    // Convert to array and calculate averages
    return Object.entries(grouped).map(([timeKey, records]) => {
      const avgAqi = records.reduce((sum, r) => sum + r.aqi, 0) / records.length;
      const avgTemp = records.reduce((sum, r) => sum + r.weather.temperature, 0) / records.length;
      const avgHumidity = records.reduce((sum, r) => sum + r.weather.humidity, 0) / records.length;

      return {
        timestamp: timeKey,
        avg_aqi: Math.round(avgAqi * 100) / 100,
        avg_temperature: Math.round(avgTemp * 100) / 100,
        avg_humidity: Math.round(avgHumidity * 100) / 100,
        record_count: records.length,
        dominant_pollutant: this.getDominantPollutant(records),
        pollution_level: this.getDominantPollutionLevel(records)
      };
    }).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  private getDominantPollutant(records: any[]): string {
    const pollutantCounts: { [key: string]: number } = {};
    records.forEach(record => {
      pollutantCounts[record.main_pollutant] = (pollutantCounts[record.main_pollutant] || 0) + 1;
    });
    return Object.entries(pollutantCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';
  }

  private getDominantPollutionLevel(records: any[]): string {
    const levelCounts: { [key: string]: number } = {};
    records.forEach(record => {
      levelCounts[record.pollution_level] = (levelCounts[record.pollution_level] || 0) + 1;
    });
    return Object.entries(levelCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';
  }
} 