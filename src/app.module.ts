import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bull';
import { CacheModule } from '@nestjs/cache-manager';
import { ScheduleModule } from '@nestjs/schedule';
import * as redisStore from 'cache-manager-redis-store';

import configuration from './config/configuration';

// Import modules (to be created)
import { AirQualityModule } from './modules/air-quality/air-quality.module';
import { DatabaseModule } from './modules/database/database.module';
import { QueueModule } from './modules/queue/queue.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: '.env',
    }),
    
    // Database
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService) => ({
        uri: configService.get('database.uri'),
      }),
      inject: [ConfigService],
    }),
    
    // Cache with Redis
    CacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService) => ({
        store: redisStore,
        host: configService.get('redis.host'),
        port: configService.get('redis.port'),
        ttl: configService.get('cache.ttl'),
      }),
      inject: [ConfigService],
    }),
    
    // Bull Queue
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService) => ({
        redis: {
          host: configService.get('bull.redis.host'),
          port: configService.get('bull.redis.port'),
        },
      }),
      inject: [ConfigService],
    }),
    
    // Schedule
    ScheduleModule.forRoot(),
    
    // Application modules
    AirQualityModule,
    DatabaseModule,
    QueueModule,
    NotificationsModule,
    AnalyticsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {} 