import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { IQAirApiService, ApiCallResult } from '../services/iqair-api.service';
import { AirQualityHot, AirQualityHotDocument } from '../../database/schemas/air-quality-hot.schema';
import { QueueService, JobType } from '../../queue/services/queue.service';
import { NotificationsService } from '../../notifications/notifications.service';

export interface ProcessingResult {
  success: boolean;
  jobId: string;
  jobType: string;
  data?: any;
  error?: string;
  executionTime: number;
  retryCount: number;
  timestamp: Date;
}

export interface JobStats {
  processed: number;
  successful: number;
  failed: number;
  avgExecutionTime: number;
  lastProcessed: Date;
}

@Injectable()
export class AirQualityProcessor {
  private readonly logger = new Logger(AirQualityProcessor.name);
  private readonly jobStats: Map<string, JobStats> = new Map();

  constructor(
    private readonly iqairApiService: IQAirApiService,
    private readonly queueService: QueueService,
    private readonly notificationsService: NotificationsService,
    @InjectModel(AirQualityHot.name) private airQualityHotModel: Model<AirQualityHotDocument>,
  ) {
    this.initializeJobStats();
  }

  /**
   * Process FETCH_PARIS_DATA jobs
   */
  @Process({ name: JobType.FETCH_PARIS_DATA, concurrency: 3 })
  async handleFetchParisData(job: Job): Promise<ProcessingResult> {
    const startTime = Date.now();
    const jobId = job.id?.toString() || 'unknown';
    
    this.logger.log(`Processing FETCH_PARIS_DATA job ${jobId} (attempt ${job.attemptsMade + 1}/${job.opts.attempts})`);

    try {
      // Update job progress
      await job.progress(10);

      // Fetch air quality data from IQAir API
      const apiResult: ApiCallResult = await this.iqairApiService.fetchParisAirQuality();
      
      await job.progress(50);

      if (!apiResult.success) {
        throw new Error(`API call failed: ${apiResult.error}`);
      }

      // Save to MongoDB hot collection
      const airQualityRecord = new this.airQualityHotModel({
        location: apiResult.data!.location,
        coordinates: apiResult.data!.coordinates,
        timestamp: apiResult.data!.timestamp,
        aqi: apiResult.data!.aqi,
        main_pollutant: apiResult.data!.main_pollutant,
        pollution_level: apiResult.data!.pollution_level,
        weather: apiResult.data!.weather,
        metadata: apiResult.data!.metadata,
      });

      const savedRecord = await airQualityRecord.save();
      
      await job.progress(80);

      // Check for high pollution and trigger alerts
      if (apiResult.data!.aqi > 100) {
        await this.triggerHighPollutionAlert(apiResult.data!);
      }

      await job.progress(100);

      const executionTime = Date.now() - startTime;
      
      this.updateJobStats(JobType.FETCH_PARIS_DATA, true, executionTime);
      
      this.logger.log(`Successfully processed FETCH_PARIS_DATA job ${jobId} in ${executionTime}ms (AQI: ${apiResult.data!.aqi})`);

      return {
        success: true,
        jobId,
        jobType: JobType.FETCH_PARIS_DATA,
        data: {
          recordId: savedRecord._id,
          aqi: apiResult.data!.aqi,
          pollution_level: apiResult.data!.pollution_level,
          apiResponseTime: apiResult.responseTime,
        },
        executionTime,
        retryCount: job.attemptsMade,
        timestamp: new Date(),
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      this.updateJobStats(JobType.FETCH_PARIS_DATA, false, executionTime);
      
      this.logger.error(`Failed to process FETCH_PARIS_DATA job ${jobId}:`, error.message);

      // Check if we should trigger failure alerts
      if (job.attemptsMade >= (job.opts.attempts || 1) - 1) {
        await this.triggerJobFailureAlert(JobType.FETCH_PARIS_DATA, error.message, job.attemptsMade + 1);
      }

      return {
        success: false,
        jobId,
        jobType: JobType.FETCH_PARIS_DATA,
        error: error.message,
        executionTime,
        retryCount: job.attemptsMade,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Process CALCULATE_DAILY_STATS jobs
   */
  @Process({ name: JobType.CALCULATE_DAILY_STATS, concurrency: 1 })
  async handleCalculateDailyStats(job: Job): Promise<ProcessingResult> {
    const startTime = Date.now();
    const jobId = job.id?.toString() || 'unknown';
    const { location, date } = job.data.data;

    this.logger.log(`Processing CALCULATE_DAILY_STATS job ${jobId} for ${location} on ${date}`);

    try {
      await job.progress(10);

      // Calculate start and end of day
      const startOfDay = new Date(`${date}T00:00:00.000Z`);
      const endOfDay = new Date(`${date}T23:59:59.999Z`);

      // Query hot collection for daily data
      const dailyRecords = await this.airQualityHotModel
        .find({
          location: new RegExp(location, 'i'),
          timestamp: {
            $gte: startOfDay,
            $lte: endOfDay,
          },
        })
        .sort({ timestamp: 1 })
        .lean();

      await job.progress(50);

      if (dailyRecords.length === 0) {
        throw new Error(`No data found for ${location} on ${date}`);
      }

      // Calculate daily statistics
      const stats = this.calculateDailyStatistics(dailyRecords);

      await job.progress(80);

      // TODO: Save to daily aggregation collection
      // This would be implemented when the analytics schema is ready

      await job.progress(100);

      const executionTime = Date.now() - startTime;
      
      this.updateJobStats(JobType.CALCULATE_DAILY_STATS, true, executionTime);
      
      this.logger.log(`Successfully calculated daily stats for ${location} on ${date} (${dailyRecords.length} records)`);

      return {
        success: true,
        jobId,
        jobType: JobType.CALCULATE_DAILY_STATS,
        data: {
          location,
          date,
          recordCount: dailyRecords.length,
          stats,
        },
        executionTime,
        retryCount: job.attemptsMade,
        timestamp: new Date(),
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      this.updateJobStats(JobType.CALCULATE_DAILY_STATS, false, executionTime);
      
      this.logger.error(`Failed to calculate daily stats for ${location} on ${date}:`, error.message);

      return {
        success: false,
        jobId,
        jobType: JobType.CALCULATE_DAILY_STATS,
        error: error.message,
        executionTime,
        retryCount: job.attemptsMade,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Process SEND_ALERT_EMAIL jobs
   */
  @Process({ name: JobType.SEND_ALERT_EMAIL, concurrency: 5 })
  async handleSendAlertEmail(job: Job): Promise<ProcessingResult> {
    const startTime = Date.now();
    const jobId = job.id?.toString() || 'unknown';
    const alertData = job.data.data;

    this.logger.log(`Processing SEND_ALERT_EMAIL job ${jobId} for ${alertData.city} (AQI: ${alertData.aqi})`);

    try {
      await job.progress(20);

      // Send alert email using notifications service
      await this.notificationsService.sendAirQualityAlert(
        alertData.city,
        alertData.aqi,
        alertData.level
      );

      await job.progress(100);

      const executionTime = Date.now() - startTime;
      
      this.updateJobStats(JobType.SEND_ALERT_EMAIL, true, executionTime);
      
      this.logger.log(`Successfully sent alert email for ${alertData.city}`);

      return {
        success: true,
        jobId,
        jobType: JobType.SEND_ALERT_EMAIL,
        data: {
          city: alertData.city,
          aqi: alertData.aqi,
          level: alertData.level,
          recipient: alertData.recipient,
        },
        executionTime,
        retryCount: job.attemptsMade,
        timestamp: new Date(),
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      this.updateJobStats(JobType.SEND_ALERT_EMAIL, false, executionTime);
      
      this.logger.error(`Failed to send alert email for ${alertData.city}:`, error.message);

      return {
        success: false,
        jobId,
        jobType: JobType.SEND_ALERT_EMAIL,
        error: error.message,
        executionTime,
        retryCount: job.attemptsMade,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Trigger high pollution alert
   */
  private async triggerHighPollutionAlert(data: any): Promise<void> {
    try {
      this.logger.warn(`High pollution detected in ${data.location}: AQI ${data.aqi} (${data.pollution_level})`);

      // Add alert email job to queue
      await this.queueService.addSendAlertEmailJob({
        city: data.location,
        aqi: data.aqi,
        level: data.pollution_level,
        recipient: 'admin@example.com', // This would come from config
      });

    } catch (error) {
      this.logger.error('Failed to trigger high pollution alert:', error.message);
    }
  }

  /**
   * Trigger job failure alert
   */
  private async triggerJobFailureAlert(jobType: string, errorMessage: string, attempts: number): Promise<void> {
    try {
      this.logger.error(`Job failure alert: ${jobType} failed after ${attempts} attempts - ${errorMessage}`);

      // Add failure notification job to queue
      await this.queueService.addSendAlertEmailJob({
        city: 'System',
        aqi: 0,
        level: 'Job Failure',
        recipient: 'admin@example.com',
      });

    } catch (error) {
      this.logger.error('Failed to trigger job failure alert:', error.message);
    }
  }

  /**
   * Calculate daily statistics from records
   */
  private calculateDailyStatistics(records: any[]): any {
    if (records.length === 0) {
      return null;
    }

    const aqiValues = records.map(r => r.aqi);
    const temperatures = records.map(r => r.weather.temperature);
    const humidities = records.map(r => r.weather.humidity);

    // Find peak and min AQI with timestamps
    const maxAqiRecord = records.reduce((max, record) => 
      record.aqi > max.aqi ? record : max
    );
    
    const minAqiRecord = records.reduce((min, record) => 
      record.aqi < min.aqi ? record : min
    );

    // Calculate pollution level distribution
    const pollutionLevelCounts: { [key: string]: number } = {};
    records.forEach(record => {
      pollutionLevelCounts[record.pollution_level] = 
        (pollutionLevelCounts[record.pollution_level] || 0) + 1;
    });

    // Find dominant pollutant
    const pollutantCounts: { [key: string]: number } = {};
    records.forEach(record => {
      pollutantCounts[record.main_pollutant] = 
        (pollutantCounts[record.main_pollutant] || 0) + 1;
    });
    
    const dominantPollutant = Object.entries(pollutantCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';

    return {
      avg_aqi: Math.round((aqiValues.reduce((sum, aqi) => sum + aqi, 0) / aqiValues.length) * 100) / 100,
      peak_aqi: {
        value: maxAqiRecord.aqi,
        time: maxAqiRecord.timestamp.toISOString(),
      },
      min_aqi: {
        value: minAqiRecord.aqi,
        time: minAqiRecord.timestamp.toISOString(),
      },
      avg_temperature: Math.round((temperatures.reduce((sum, temp) => sum + temp, 0) / temperatures.length) * 100) / 100,
      avg_humidity: Math.round((humidities.reduce((sum, hum) => sum + hum, 0) / humidities.length) * 100) / 100,
      dominant_pollutant: dominantPollutant,
      pollution_level_distribution: pollutionLevelCounts,
      record_count: records.length,
    };
  }

  /**
   * Update job statistics
   */
  private updateJobStats(jobType: string, success: boolean, executionTime: number): void {
    const stats = this.jobStats.get(jobType) || {
      processed: 0,
      successful: 0,
      failed: 0,
      avgExecutionTime: 0,
      lastProcessed: new Date(),
    };

    stats.processed++;
    if (success) {
      stats.successful++;
    } else {
      stats.failed++;
    }

    // Update average execution time
    stats.avgExecutionTime = ((stats.avgExecutionTime * (stats.processed - 1)) + executionTime) / stats.processed;
    stats.lastProcessed = new Date();

    this.jobStats.set(jobType, stats);
  }

  /**
   * Get job statistics
   */
  getJobStatistics(): Map<string, JobStats> {
    return this.jobStats;
  }

  /**
   * Initialize job statistics
   */
  private initializeJobStats(): void {
    const jobTypes = [
      JobType.FETCH_PARIS_DATA,
      JobType.CALCULATE_DAILY_STATS,
      JobType.SEND_ALERT_EMAIL,
    ];

    jobTypes.forEach(jobType => {
      this.jobStats.set(jobType, {
        processed: 0,
        successful: 0,
        failed: 0,
        avgExecutionTime: 0,
        lastProcessed: new Date(),
      });
    });
  }

  /**
   * Get processor health status
   */
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    stats: { [jobType: string]: JobStats };
    issues: string[];
  } {
    const issues: string[] = [];
    let degradedCount = 0;
    let unhealthyCount = 0;

    const statsObj: { [jobType: string]: JobStats } = {};
    
    this.jobStats.forEach((stats, jobType) => {
      statsObj[jobType] = stats;

      // Check failure rate
      const failureRate = stats.processed > 0 ? (stats.failed / stats.processed) * 100 : 0;
      if (failureRate > 20) {
        issues.push(`High failure rate for ${jobType}: ${failureRate.toFixed(2)}%`);
        unhealthyCount++;
      } else if (failureRate > 10) {
        issues.push(`Elevated failure rate for ${jobType}: ${failureRate.toFixed(2)}%`);
        degradedCount++;
      }

      // Check average execution time
      if (stats.avgExecutionTime > 30000) { // 30 seconds
        issues.push(`Slow processing for ${jobType}: ${(stats.avgExecutionTime / 1000).toFixed(2)}s avg`);
        degradedCount++;
      }
    });

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (unhealthyCount > 0) {
      status = 'unhealthy';
    } else if (degradedCount > 0) {
      status = 'degraded';
    }

    return {
      status,
      stats: statsObj,
      issues,
    };
  }
} 