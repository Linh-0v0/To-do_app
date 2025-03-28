import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { FirebaseNotificationService } from './firebase-notification.service';
import { FirebaseNotificationProcessor } from './firebase-notification.processor';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'redis_container',
        port: Number(process.env.REDIS_PORT) || 6379,
      },
    }),
    BullModule.registerQueue({
      name: 'notificationQueue',
    }),
    PrismaModule
  ],
  providers: [
    FirebaseNotificationService, //  Handles sending notifications
    FirebaseNotificationProcessor, //  Processes BullMQ jobs
  ],
  exports: [FirebaseNotificationService, BullModule],
})
export class FirebaseNotificationModule {}
