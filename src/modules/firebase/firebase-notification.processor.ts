import { Injectable, OnModuleInit } from '@nestjs/common';
import { WorkerHost, OnWorkerEvent, Processor } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { FirebaseNotificationService } from './firebase-notification.service';

@Processor('notificationQueue')
@Injectable()
export class FirebaseNotificationProcessor extends WorkerHost implements OnModuleInit {
  constructor(private firebaseNotificationService: FirebaseNotificationService) {
    super();
  }

  async process(job: Job): Promise<void> {
    const { fcmToken, title } = job.data;
    console.log(`🔔 Sending reminder for task: "${title}"`);
    // 🔥 Log repeat job info
  console.log(`🔔 Processing job: ${job.id}`);

    // 🔥 Check if job is repeating
    if (job.opts.repeat) {
      console.log(`♻️ This is a repeating job for "${title}"`);
    }

    await this.firebaseNotificationService.sendNotification(
      fcmToken,
      `Reminder: ${title}`,
      `Don't forget to complete "${title}".`
    );

    console.log(`✅ Notification for "${title}" sent successfully.`);
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
