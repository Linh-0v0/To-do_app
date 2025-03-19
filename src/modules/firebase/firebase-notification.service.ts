import { Injectable, Inject, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseNotificationService {
  private readonly logger = new Logger(FirebaseNotificationService.name);
  constructor() {}

  /**
   * 🔥 Send a push notification via Firebase Cloud Messaging (FCM)
   * @param fcmToken - User's Firebase token
   * @param title - Notification title
   * @param body - Notification message
   */
  async sendNotification(fcmToken: string, title: string, body: string) {
    try {
      const message = {
        notification: { title, body },
        token: fcmToken,
      };

      const response = await admin.messaging().send(message);
      this.logger.log(`✅ Notification sent successfully: ${response}`);
      return response;
    } catch (error) {
      this.logger.error(`❌ Failed to send notification: ${error.message}`);
      throw error;
    }
  }
}
