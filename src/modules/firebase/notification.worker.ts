import { Worker } from 'bullmq';
import { NestFactory } from '@nestjs/core';
import { FirebaseNotificationService } from './firebase-notification.service';
import { FirebaseNotificationModule } from './firebase-notification.module';

async function bootstrapWorker() {
  const appContext = await NestFactory.createApplicationContext(FirebaseNotificationModule);
  const firebaseNotificationService = appContext.get(FirebaseNotificationService);

  const worker = new Worker(
    'notificationQueue',
    async (job) => {
      const { fcmToken, title } = job.data;
      console.log(`🔔 Sending reminder for task: "${title}"`);

      await firebaseNotificationService.sendNotification(
        fcmToken,
        `Reminder: ${title}`,
        `Don't forget to complete "${title}".`
      );
    },
    { connection: { host: process.env.REDIS_HOST || 'localhost', port: 6379 } }
  );

  worker.on('completed', (job) => console.log(`✅ Job ${job.id} completed!`));
  worker.on('failed', (job, err) => {
    console.error(`❌ Job ${job?.id ?? 'unknown'} failed: ${err.message}`);
  });
  
}

bootstrapWorker();
