import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTaskDto, UpdateTaskDto } from '../dto/task.dto';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { getNextOccurrence } from 'src/common/utils/date.util';

@Injectable()
export class TaskService {
  private readonly logger = new Logger(TaskService.name);
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('notificationQueue') private notificationQueue: Queue,
  ) { }

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
  async updateTask(
    userId: string,
    taskId: string,
    updateTaskDto: UpdateTaskDto,
  ) {
    const existingTask = await this.prisma.task.findUnique({
      where: { id: taskId, userId },
    });

    if (!existingTask) {
      throw new NotFoundException('Task not found');
    }

    const updatedTask = await this.prisma.task.update({
      where: { id: taskId },
      data: updateTaskDto,
    });
  
    // If task is marked as completed (status: true), remove the reminder
    if (updateTaskDto.status === true) {
      if (existingTask.repeatType === 'none' || !existingTask.repeatType) {
        await this.removeScheduledReminder(taskId);
        console.log(`✅ Task "${existingTask.title}" is completed. Reminder deleted.`);
      } else {
        console.log(`🔄 Task "${existingTask.title}" is completed but has a repeat type. Keeping reminders.`);
      }
    }
  
    // If the task has a repeat type or reminder is updated, reschedule
    if (updateTaskDto.reminder || updateTaskDto.repeatType) {
      await this.scheduleReminder(userId, updatedTask);
    }

    // //  If repeatType is changed, remove old scheduled job
    // if (updateTaskDto.repeatType && updateTaskDto.repeatType !== existingTask.repeatType) {
    //   await this.removeScheduledReminder(taskId);
    // }

    // //  Update task in DB
    // const updatedTask = await this.prisma.task.update({
    //   where: { id: taskId, userId },
    //   data: updateTaskDto,
    // });

    // //  Re-schedule notification if reminder or repeat changed
    // if (updatedTask.reminder || updatedTask.repeatType) {
    //   await this.scheduleReminder(userId, updatedTask);
    // }

    return updatedTask;
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
 * Schedule a notification for a task reminder (Supports repeat & one-time reminders)
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

  // 🔥 Remove existing scheduled job (prevents duplicates)
  await this.removeScheduledReminder(task.id);

  // ✅ If no repeat, just schedule a one-time reminder (due date)
  if (!task.repeatType || task.repeatType === 'none') {
    const jobTime = new Date(task.reminder).getTime();
    const currentTime = Date.now();
    const delay = jobTime - currentTime;

    if (delay <= 0) {
      console.warn(`⚠️ Reminder time is in the past, skipping.`);
      return;
    }

    await this.notificationQueue.add(
      'sendReminder',
      {
        userId,
        fcmToken: user.fcmToken,
        title: task.title,
      },
      { delay, attempts: 3 },
    );

    console.log(`✅ One-time reminder scheduled for task "${task.title}" at ${task.reminder}`);
    return;
  }

  // 🔥 Handle REPEATING Reminders
  if (task.repeatType === 'custom' && task.repeatDays) {
    const repeatDaysArray = task.repeatDays.split(','); // Example: "Mo,We,Fr"

    for (const day of repeatDaysArray) {
      const nextDate = getNextOccurrence(day);
      if (nextDate) {
        await this.notificationQueue.add(
          'sendReminder',
          {
            userId,
            fcmToken: user.fcmToken,
            title: task.title,
          },
          {
            delay: nextDate.getTime() - Date.now(),
            repeat: { every: 7 * 24 * 60 * 60 * 1000 }, // Repeat weekly
            attempts: 3,
          },
        );
        console.log(`✅ Custom repeat scheduled for "${task.title}" on ${nextDate}`);
      }
    }
  } else {
    // ✅ Handle standard repeat types (daily, weekly, monthly, yearly)
    const repeatOpts = this.getRepeatOptions(task);
    await this.notificationQueue.add(
      'sendReminder',
      {
        userId,
        fcmToken: user.fcmToken,
        title: task.title,
      },
      {
        delay: new Date(task.reminder).getTime() - Date.now(),
        repeat: repeatOpts,
        attempts: 3,
      },
    );

    console.log(`✅ Recurring reminder scheduled for "${task.title}" with repeat type: ${task.repeatType}`);
  }
}


/**
   * Get Repeat Options for BullMQ based on RepeatType
   */
private getRepeatOptions(task: any): any {
  switch (task.repeatType) {
    case 'daily':
      return { every: 24 * 60 * 60 * 1000 }; // Every 24 hours
    case 'weekly':
      return { every: 7 * 24 * 60 * 60 * 1000 }; // Every 7 days
    case 'monthly':
      return { every: 30 * 24 * 60 * 60 * 1000 }; // Every 30 days
    case 'yearly':
      return { every: 365 * 24 * 60 * 60 * 1000 }; // Every 365 days
    case 'custom':
      if (task.repeatDays) {
        return { every: this.getCustomRepeatInterval(task.repeatDays) };
      }
      return {};
    default:
      return {}; // No repeat
  }
}

/**
 * Remove an existing scheduled reminder job
 */
async removeScheduledReminder(taskId: string) {
  const job = await this.notificationQueue.getJob(taskId);

  if (job) {
    await job.remove();
    console.log(`🗑️ Removed existing reminder job for Task ID: ${taskId}`);
  } else {
    console.log(`⚠️ No existing job found for Task ID: ${taskId}`);
  }
}

 /**
   * Helper: Convert Custom Repeat Days to Interval
   */
 private getCustomRepeatInterval(repeatDays: string): number {
  const daysArray = repeatDays.split(','); // Example: "Mo,We,Fr"
  console.log(`🔄 Custom repeat days:`, daysArray);

  // 🔥 Simplified: Just returns every 2 days as an example
  return 2 * 24 * 60 * 60 * 1000;
}

/**
 * Calculates the next reminder date based on the repeat type
 */
private calculateNextReminder(currentDate: Date, repeatType: string): number {
  const nextDate = new Date(currentDate);

  switch (repeatType) {
    case 'daily':
      nextDate.setDate(nextDate.getDate() + 1);
      break;
    case 'weekly':
      nextDate.setDate(nextDate.getDate() + 7);
      break;
    case 'monthly':
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;
    case 'yearly':
      nextDate.setFullYear(nextDate.getFullYear() + 1);
      break;
    default:
      console.warn(`⚠️ Unknown repeat type: ${repeatType}, using default (one-time reminder).`);
      return currentDate.getTime(); // No change for one-time reminders
  }

  return nextDate.getTime();
}


  /**
   *  Runs every minute to check for reminders and send notifications
   */
  // @Cron(CronExpression.EVERY_MINUTE) //  Runs every minute
  // async checkForReminders() {
  //   this.logger.log('🔍 Checking for due reminders...');

  //   const now = new Date();
  //   const tasks = await this.prisma.task.findMany({
  //     where: {
  //       reminder: {
  //         lte: now, // Get tasks where reminder time has passed
  //       },
  //       status: false, //  Only notify for incomplete tasks
  //     },
  //     include: { user: { select: { fcmToken: true } } },
  //   });

  //   for (const task of tasks) {
  //     if (!task.user.fcmToken) continue; //  Skip if user has no FCM token

  //     await this.firebaseNotificationService.sendNotification(
  //       task.user.fcmToken,
  //       `Reminder: ${task.title}`,
  //       `Don't forget to complete "${task.title}".`
  //     );

  //     //  Mark the reminder as sent (optional, based on your logic)
  //     await this.prisma.task.update({
  //       where: { id: task.id },
  //       data: { reminder: null }, // Prevent duplicate notifications
  //     });
  //   }
  // }
}
