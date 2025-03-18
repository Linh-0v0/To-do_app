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
import { CustomRequest } from 'src/common/interfaces/custom-request.interface';

@Injectable()
export class TaskService {
  private readonly logger = new Logger(TaskService.name);
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('notificationQueue') private notificationQueue: Queue,
  ) {}

  /**
   * Create a new task
   */
  async createTask(request: CustomRequest, createTaskDto: CreateTaskDto) {
    const user = request.user;
    console.log('createTask user:', user);
    const userId = user.provider == 'firebase' ? user.id : user.uid || user.sub;
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
  async getUserTasks(user: CustomRequest['user']) {
    const userId = user.provider == 'firebase' ? user.id : user.uid || user.sub;
    const task = this.prisma.task.findMany({
      where: { userId },
    });
    return task;
  }

  /**
   * Get a single task (only if owned by user)
   */
  async getTaskById(user: CustomRequest['user'], taskId: string) {
    const userId = user.provider == 'firebase' ? user.id : user.uid || user.sub;
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });

    if (!task) throw new NotFoundException('Task not found');
    if (task.userId !== userId) throw new ForbiddenException('Access denied');

    return task;
  }

  /**
   * Update a task (only if owned by user)
   */
  async updateTask(
    user: CustomRequest['user'],
    taskId: string,
    updateTaskDto: UpdateTaskDto,
  ) {
    const userId = user.provider == 'firebase' ? user.id : user.uid || user.sub;
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
        console.log(
          `✅ Task "${existingTask.title}" is completed. Reminder deleted.`,
        );
      } else {
        console.log(
          `🔄 Task "${existingTask.title}" is completed but has a repeat type. Keeping reminders.`,
        );
      }
    }

    // If the task has a repeat type or reminder is updated, reschedule
    if (updateTaskDto.reminder || updateTaskDto.repeatType) {
      await this.scheduleReminder(userId, updatedTask);
    }

    return updatedTask;
  }

  /**
   * Delete a task (only if owned by user)
   */
  async deleteTask(user: CustomRequest['user'], taskId: string) {
    const userId = user.provider == 'firebase' ? user.id : user.uid || user.sub;
    const task = await this.getTaskById(userId, taskId);

    return 'Task deleted successfully';
  }

  async scheduleReminder(userId: string, task: any) {
    console.log('📅 scheduleReminder for user:', userId);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { fcmToken: true },
    });

    if (!user?.fcmToken) {
      console.warn(
        `⚠️ User ${userId} has no FCM token, skipping notification.`,
      );
      return;
    }

    // 🔥 Remove existing scheduled job (prevents duplicates)
    await this.removeScheduledReminder(task.id);

    // ✅ One-time Reminder (No repeat)
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

      console.log(
        `✅ One-time reminder scheduled for task "${task.title}" at ${task.reminder}`,
      );
      return;
    }

    // 🔥 Handle REPEATING Reminders (daily, weekly, monthly, yearly)
    const repeatOpts = this.getRepeatOptions(task.repeatType);

    if (repeatOpts) {
      await this.notificationQueue.add(
        'sendReminder',
        {
          userId,
          fcmToken: user.fcmToken,
          title: task.title,
        },
        {
          repeat: repeatOpts, // 🔥 Schedules repeating jobs
          jobId: `repeat-${task.id}`, // 🔥 Ensures unique job per task
          removeOnComplete: true, // 🔥 Keeps queue clean
        },
      );

      console.log(
        `✅ Recurring reminder scheduled for "${task.title}" with repeat type: ${task.repeatType}`,
      );
    }
    const repeatJobs = await this.notificationQueue.getRepeatableJobs();
    console.log('🔄 Repeat Jobs:', repeatJobs);
    const jobKey = repeatJobs.find(j => j.name === 'sendReminder')?.key;
    console.log(`🔑 Job Key for "${task.title}":`, jobKey);
  }

  /**
   * Get Repeat Options for BullMQ based on RepeatType
   */
  // private getRepeatOptions(repeatType: string): any {
  //   switch (repeatType) {
  //     case 'daily':
  //       return { every: 24 * 60 * 60 * 1000 }; // Every 24 hours
  //     case 'weekly':
  //       return { every: 7 * 24 * 60 * 60 * 1000 }; // Every 7 days
  //     case 'monthly':
  //       return { every: 30 * 24 * 60 * 60 * 1000 }; // Every 30 days
  //     case 'yearly':
  //       return { every: 365 * 24 * 60 * 60 * 1000 }; // Every 365 days
  //     default:
  //       return {}; // No repeat
  //   }
  // }

  private getRepeatOptions(repeatType: string): any {
    switch (repeatType) {
      case 'daily':
        return { every: 86_400_000 }; // ✅ Fix: 24 hours in ms
      case 'weekly':
        return { every: 604_800_000 }; // ✅ 7 days in ms
      case 'monthly':
        return { every: 30 * 86_400_000 }; // ✅ Approx. 30 days
      case 'yearly':
        return { every: 365 * 86_400_000 }; // ✅ 1 year
      default:
        return {};
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
   * Schedule a notification for a task reminder (Supports repeat & one-time reminders)
   */
  // async scheduleReminder(userId: string, task: any) {
  //   console.log('scheduleRemider userId:', userId);
  //   const user = await this.prisma.user.findUnique({
  //     where: { id: userId },
  //     select: { fcmToken: true },
  //   });

  //   if (!user?.fcmToken) {
  //     console.warn(
  //       `⚠️ User ${userId} has no FCM token, skipping notification.`,
  //     );
  //     return;
  //   }

  //   // 🔥 Remove existing scheduled job (prevents duplicates)
  //   // await this.removeScheduledReminder(task.id);

  //   // ✅ If repeatType is "none" or undefined, schedule a one-time reminder
  // if (!task.repeatType || task.repeatType === 'none') {
  //   const jobTime = new Date(task.reminder).getTime();
  //   const currentTime = Date.now();
  //   const delay = jobTime - currentTime;

  //   if (delay <= 0) {
  //     console.warn(`⚠️ Reminder time is in the past, skipping.`);
  //     return;
  //   }

  //   await this.notificationQueue.add(
  //     'sendReminder',
  //     {
  //       userId,
  //       fcmToken: user.fcmToken,
  //       title: task.title,
  //     },
  //     { delay, attempts: 3 }
  //   );

  //   console.log(`✅ One-time reminder scheduled for task "${task.title}" at ${task.reminder}`);
  //   return;
  // }

  // // 🔥 Handle REPEATING Reminders (daily, weekly, monthly, yearly)
  // const repeatOpts = this.getRepeatOptions(task.repeatType);

  // if (repeatOpts) {
  //   await this.notificationQueue.add(
  //     'sendReminder',
  //     {
  //       userId,
  //       fcmToken: user.fcmToken,
  //       title: task.title,
  //     },
  //     {
  //       delay: new Date(task.reminder).getTime() - Date.now(),
  //       repeat: repeatOpts,
  //       attempts: 3,
  //     }
  //   );

  //     console.log(`✅ Recurring reminder scheduled for "${task.title}" with repeat type: ${task.repeatType}`);
  //   }
  // }

  // /**
  //  * Get Repeat Options for BullMQ based on RepeatType
  //  */
  // private getRepeatOptions(task: any): any {
  //   switch (task.repeatType) {
  //     case 'daily':
  //       return { every: 24 * 60 * 60 * 1000 }; // Every 24 hours
  //     case 'weekly':
  //       return { every: 7 * 24 * 60 * 60 * 1000 }; // Every 7 days
  //     case 'monthly':
  //       return { every: 30 * 24 * 60 * 60 * 1000 }; // Every 30 days
  //     case 'yearly':
  //       return { every: 365 * 24 * 60 * 60 * 1000 }; // Every 365 days
  //     case 'custom':
  //       if (task.repeatDays) {
  //         return { every: this.getCustomRepeatInterval(task.repeatDays) };
  //       }
  //       return {};
  //     default:
  //       return {}; // No repeat
  //   }
  // }

  // /**
  //  * Remove an existing scheduled reminder job
  //  */
  // async removeScheduledReminder(taskId: string) {
  //   const job = await this.notificationQueue.getJob(taskId);

  //   if (job) {
  //     await job.remove();
  //     console.log(`🗑️ Removed existing reminder job for Task ID: ${taskId}`);
  //   } else {
  //     console.log(`⚠️ No existing job found for Task ID: ${taskId}`);
  //   }
  // }

  // /**
  //  * Helper: Convert Custom Repeat Days to Interval
  //  */
  // private getCustomRepeatInterval(repeatDays: string): number {
  //   const daysArray = repeatDays.split(','); // Example: "Mo,We,Fr"
  //   console.log(`🔄 Custom repeat days:`, daysArray);

  //   // 🔥 Simplified: Just returns every 2 days as an example
  //   return 2 * 24 * 60 * 60 * 1000;
  // }

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
        console.warn(
          `⚠️ Unknown repeat type: ${repeatType}, using default (one-time reminder).`,
        );
        return currentDate.getTime(); // No change for one-time reminders
    }

    return nextDate.getTime();
  }
}
