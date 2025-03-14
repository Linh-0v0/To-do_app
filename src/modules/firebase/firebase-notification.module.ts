import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { FirebaseNotificationService } from './firebase-notification.service';
import { FirebaseNotificationProcessor } from './firebase-notification.processor';

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT) || 6379,
      },
    }),
    BullModule.registerQueue({
      name: 'notificationQueue',
    }),
  ],
  providers: [
    FirebaseNotificationService, //  Handles sending notifications
    FirebaseNotificationProcessor, //  Processes BullMQ jobs
  ],
  exports: [FirebaseNotificationService],
})
export class FirebaseNotificationModule {}
