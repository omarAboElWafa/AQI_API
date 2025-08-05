import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bull';
import { CacheModule } from '@nestjs/cache-manager';
import { ScheduleModule } from '@nestjs/schedule';

import { AirQualityController } from './air-quality.controller';
import { CronController } from './controllers/cron.controller';
import { AirQualityService } from './air-quality.service';
import { AirQualityProcessor } from './air-quality.processor';
import { IQAirApiService } from './services/iqair-api.service';
import { CronService } from './services/cron.service';
import { AirQuality, AirQualitySchema } from './schemas/air-quality.schema';
import { AirQualityHot, AirQualityHotSchema } from '../database/schemas/air-quality-hot.schema';
import { QueueModule } from '../queue/queue.module';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AirQuality.name, schema: AirQualitySchema },
      { name: AirQualityHot.name, schema: AirQualityHotSchema },
    ]),
    BullModule.registerQueue({
      name: 'air-quality',
    }),
    BullModule.registerQueue({
      name: 'analytics',
    }),
    BullModule.registerQueue({
      name: 'notifications',
    }),
    CacheModule.register(),
    ScheduleModule.forRoot(),
    QueueModule,
    AnalyticsModule,
  ],
  controllers: [AirQualityController, CronController],
  providers: [AirQualityService, AirQualityProcessor, IQAirApiService, CronService],
  exports: [AirQualityService, IQAirApiService, CronService],
})
export class AirQualityModule {} 