import { BullModule } from '@nestjs/bull';
import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import {
  AirQuality,
  AirQualitySchema,
} from '../air-quality/schemas/air-quality.schema';
import { AnalyticsProcessor } from './analytics.processor';
import { AnalyticsController } from './controllers/analytics.controller';
import {
  DailyAggregation,
  DailyAggregationSchema,
} from './schemas/daily-aggregation.schema';
import { AnalyticsService } from './services/analytics.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'analytics',
    }),
    MongooseModule.forFeature([
      { name: AirQuality.name, schema: AirQualitySchema },
      { name: DailyAggregation.name, schema: DailyAggregationSchema },
    ]),
    CacheModule.register(),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, AnalyticsProcessor],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
