import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTaskDto, UpdateTaskDto } from '../dto/task.dto';
import { FirebaseNotificationService } from '../firebase/firebase-notification.service';
import { notificationQueue } from '../firebase/notification.queue';

@Injectable()
export class TaskService {
  private readonly logger = new Logger(TaskService.name);
  constructor(private readonly prisma: PrismaService, private firebaseNotificationService: FirebaseNotificationService) {}

  /**
   * Create a new task
   */
  async createTask(userId: string, createTaskDto: CreateTaskDto) {
    const task = await this.prisma.task.create({
      data: {
        userId,
        ...createTaskDto,
      },
    });
    if (task.reminder) {
        this.scheduleReminder(userId, task);
      }
    return task;
  }

  /**
   * Get all tasks for the authenticated user
   */
  async getUserTasks(userId: string) {
    return this.prisma.task.findMany({
      where: { userId },
    });
  }

  /**
   * Get a single task (only if owned by user)
   */
  async getTaskById(userId: string, taskId: string) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });

    if (!task) throw new NotFoundException('Task not found');
    if (task.userId !== userId) throw new ForbiddenException('Access denied');

    return task;
  }

  /**
   * Update a task (only if owned by user)
   */
  async updateTask(userId: string, taskId: string, updateTaskDto: UpdateTaskDto) {
    const task = await this.getTaskById(userId, taskId);
    
    return this.prisma.task.update({
      where: { id: task.id },
      data: updateTaskDto,
    });
  }

  /**
   * Delete a task (only if owned by user)
   */
  async deleteTask(userId: string, taskId: string) {
    const task = await this.getTaskById(userId, taskId);

    return this.prisma.task.delete({
      where: { id: task.id },
    });
  }

   /**
   * Schedule a notification for a task reminder
   */
   async scheduleReminder(userId: string, task: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { fcmToken: true },
    });

    if (!user?.fcmToken) {
      console.warn(`⚠️ User ${userId} has no FCM token, skipping notification.`);
      return;
    }

    const jobTime = new Date(task.reminder).getTime();
    const currentTime = Date.now();
    const delay = jobTime - currentTime; // 🔥 Calculate delay for BullMQ job

    if (delay <= 0) {
      console.warn(`⚠️ Reminder time is in the past, skipping.`);
      return;
    }

    // 🔥 Schedule the job dynamically in BullMQ
    await notificationQueue.add(
      'sendReminder',
      { userId, fcmToken: user.fcmToken, title: task.title },
      { delay }
    );

    console.log(`✅ Reminder for "${task.title}" scheduled in BullMQ.`);
  }
  
  /**
   * 🔥 Runs every minute to check for reminders and send notifications
   */
  // @Cron(CronExpression.EVERY_MINUTE) // ✅ Runs every minute
  // async checkForReminders() {
  //   this.logger.log('🔍 Checking for due reminders...');

  //   const now = new Date();
  //   const tasks = await this.prisma.task.findMany({
  //     where: {
  //       reminder: {
  //         lte: now, // ✅ Get tasks where reminder time has passed
  //       },
  //       status: false, // ✅ Only notify for incomplete tasks
  //     },
  //     include: { user: { select: { fcmToken: true } } },
  //   });

  //   for (const task of tasks) {
  //     if (!task.user.fcmToken) continue; // ✅ Skip if user has no FCM token

  //     await this.firebaseNotificationService.sendNotification(
  //       task.user.fcmToken,
  //       `Reminder: ${task.title}`,
  //       `Don't forget to complete "${task.title}".`
  //     );

  //     // ✅ Mark the reminder as sent (optional, based on your logic)
  //     await this.prisma.task.update({
  //       where: { id: task.id },
  //       data: { reminder: null }, // Prevent duplicate notifications
  //     });
  //   }
  // }
}
