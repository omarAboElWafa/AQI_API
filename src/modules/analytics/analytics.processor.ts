import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';

import { AnalyticsService, AnalyticsReport } from './analytics.service';

interface AnalyticsJob {
  city: string;
  country: string;
  reportType: 'daily' | 'weekly';
}

@Processor('analytics')
export class AnalyticsProcessor {
  private readonly logger = new Logger(AnalyticsProcessor.name);

  constructor(private readonly analyticsService: AnalyticsService) {}

  @Process('generate-report')
  async handleGenerateReport(job: Job<AnalyticsJob>) {
    this.logger.log(`Processing analytics report job for ${job.data.city}, ${job.data.country}`);

    try {
      let report: AnalyticsReport;

      if (job.data.reportType === 'daily') {
        report = await this.analyticsService.generateDailyReport(job.data.city, job.data.country);
      } else {
        report = await this.analyticsService.generateWeeklyReport(job.data.city, job.data.country);
      }

      this.logger.log(`Successfully generated ${job.data.reportType} report for ${job.data.city}`);
      
      return {
        success: true,
        report,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to generate ${job.data.reportType} report for ${job.data.city}:`, error);
      
      // Re-throw the error to mark the job as failed
      throw error;
    }
  }
} 