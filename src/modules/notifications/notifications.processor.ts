import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';

import { NotificationsService, EmailAlert } from './notifications.service';

@Processor('notifications')
export class NotificationsProcessor {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  @Process('send-email-alert')
  async handleSendEmailAlert(job: Job<EmailAlert>) {
    this.logger.log(`Processing email alert job for ${job.data.city}`);

    try {
      await this.notificationsService.sendEmailAlert(job.data);

      this.logger.log(`Successfully sent email alert for ${job.data.city}`);

      return {
        success: true,
        city: job.data.city,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(
        `Failed to send email alert for ${job.data.city}:`,
        error
      );

      // Re-throw the error to mark the job as failed
      throw error;
    }
  }
}
