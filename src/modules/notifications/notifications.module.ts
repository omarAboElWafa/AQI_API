import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { CacheModule } from '@nestjs/cache-manager';

import { NotificationsService } from './notifications.service';
import { NotificationsProcessor } from './notifications.processor';
import { EmailService } from './services/email.service';
import { AlertService } from './services/alert.service';
import { NotificationsController } from './controllers/notifications.controller';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'notifications',
    }),
    CacheModule.register(),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsProcessor, EmailService, AlertService],
  exports: [NotificationsService, EmailService, AlertService],
})
export class NotificationsModule {} 