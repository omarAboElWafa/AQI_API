import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bull';
import { CacheModule } from '@nestjs/cache-manager';

import { AirQualityController } from './air-quality.controller';
import { AirQualityService } from './air-quality.service';
import { AirQualityProcessor } from './air-quality.processor';
import { IQAirApiService } from './services/iqair-api.service';
import { AirQuality, AirQualitySchema } from './schemas/air-quality.schema';
import { AirQualityHot, AirQualityHotSchema } from '../database/schemas/air-quality-hot.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AirQuality.name, schema: AirQualitySchema },
      { name: AirQualityHot.name, schema: AirQualityHotSchema },
    ]),
    BullModule.registerQueue({
      name: 'air-quality',
    }),
    CacheModule.register(),
  ],
  controllers: [AirQualityController],
  providers: [AirQualityService, AirQualityProcessor, IQAirApiService],
  exports: [AirQualityService, IQAirApiService],
})
export class AirQualityModule {} 