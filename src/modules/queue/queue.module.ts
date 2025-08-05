import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';

import { QueueService } from './services/queue.service';
import { QueueHealthService } from './services/queue-health.service';
import { QueueController } from './controllers/queue.controller';

@Module({
  imports: [
    // Air Quality Queue
    BullModule.registerQueueAsync({
      name: 'air-quality',
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        redis: {
          host: configService.get('bull.redis.host'),
          port: configService.get('bull.redis.port'),
          password: configService.get('bull.redis.password'),
          db: configService.get('bull.redis.db', 0),
        },
        defaultJobOptions: {
          removeOnComplete: 100, // Keep last 100 completed jobs
          removeOnFail: 50,      // Keep last 50 failed jobs
          attempts: 5,           // Retry up to 5 times
          backoff: {
            type: 'exponential',
            delay: 30000,        // Start with 30s delay
          },
        },
        settings: {
          stalledInterval: 30 * 1000,    // 30 seconds
          maxStalledCount: 1,            // Max stalled jobs before considered failed
        },
      }),
      inject: [ConfigService],
    }),

    // Notifications Queue
    BullModule.registerQueueAsync({
      name: 'notifications',
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        redis: {
          host: configService.get('bull.redis.host'),
          port: configService.get('bull.redis.port'),
          password: configService.get('bull.redis.password'),
          db: configService.get('bull.redis.db', 0),
        },
        defaultJobOptions: {
          removeOnComplete: 50,
          removeOnFail: 25,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 10000,        // Start with 10s delay
          },
        },
      }),
      inject: [ConfigService],
    }),

    // Analytics Queue
    BullModule.registerQueueAsync({
      name: 'analytics',
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        redis: {
          host: configService.get('bull.redis.host'),
          port: configService.get('bull.redis.port'),
          password: configService.get('bull.redis.password'),
          db: configService.get('bull.redis.db', 0),
        },
        defaultJobOptions: {
          removeOnComplete: 25,
          removeOnFail: 10,
          attempts: 2,
          backoff: {
            type: 'fixed',
            delay: 60000,        // 1 minute delay
          },
        },
        settings: {
          stalledInterval: 60 * 1000,    // 1 minute
          maxStalledCount: 2,
        },
      }),
      inject: [ConfigService],
    }),
    CacheModule.register(),
  ],
  controllers: [QueueController],
  providers: [QueueService, QueueHealthService],
  exports: [BullModule, QueueService, QueueHealthService],
})
export class QueueModule {} 