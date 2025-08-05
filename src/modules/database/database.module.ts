import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AirQualityHot, AirQualityHotSchema } from './schemas/air-quality-hot.schema';
import { AirQualityWarm, AirQualityWarmSchema } from './schemas/air-quality-warm.schema';
import { AirQualityCold, AirQualityColdSchema } from './schemas/air-quality-cold.schema';
import { DataMigrationService } from './services/data-migration.service';
import { SmartQueryService } from './services/smart-query.service';
import { DataManagementController } from './controllers/data-management.controller';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      useFactory: async () => ({
        uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/aqi_monitoring',
        useNewUrlParser: true,
        useUnifiedTopology: true,
      }),
    }),
    MongooseModule.forFeature([
      { name: AirQualityHot.name, schema: AirQualityHotSchema },
      { name: AirQualityWarm.name, schema: AirQualityWarmSchema },
      { name: AirQualityCold.name, schema: AirQualityColdSchema },
    ]),
  ],
  controllers: [DataManagementController],
  providers: [DataMigrationService, SmartQueryService],
  exports: [MongooseModule, DataMigrationService, SmartQueryService],
})
export class DatabaseModule {} 