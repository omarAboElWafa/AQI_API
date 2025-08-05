import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';

import { AnalyticsService } from './analytics.service';
import { AnalyticsProcessor } from './analytics.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'analytics',
    }),
  ],
  providers: [AnalyticsService, AnalyticsProcessor],
  exports: [AnalyticsService],
})
export class AnalyticsModule {} 