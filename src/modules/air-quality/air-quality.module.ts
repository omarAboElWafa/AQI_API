import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bull';
import { CacheModule } from '@nestjs/cache-manager';

import { AirQualityController } from './air-quality.controller';
import { AirQualityService } from './air-quality.service';
import { AirQualityProcessor } from './air-quality.processor';
import { AirQuality, AirQualitySchema } from './schemas/air-quality.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AirQuality.name, schema: AirQualitySchema },
    ]),
    BullModule.registerQueue({
      name: 'air-quality',
    }),
    CacheModule.register(),
  ],
  controllers: [AirQualityController],
  providers: [AirQualityService, AirQualityProcessor],
  exports: [AirQualityService],
})
export class AirQualityModule {} 