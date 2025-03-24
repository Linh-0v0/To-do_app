import { Injectable, OnModuleInit } from '@nestjs/common';
import { WorkerHost, OnWorkerEvent, Processor } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { FirebaseNotificationService } from './firebase-notification.service';

@Processor('notificationQueue')
@Injectable()
export class FirebaseNotificationProcessor
  extends WorkerHost
  implements OnModuleInit
{
  constructor(
    private firebaseNotificationService: FirebaseNotificationService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    const { fcmToken, title } = job.data;
    await this.firebaseNotificationService.sendNotification(
      fcmToken,
      `Reminder: ${title}`,
      `Don't forget to complete "${title}".`,
    );
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    console.log(`✅ Job ${job.id} completed!`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    console.error(`❌ Job ${job?.id ?? 'unknown'} failed: ${err.message}`);
  }

  async onModuleInit() {
    console.log('🔄 Worker is ready to process jobs...');
  }
}
