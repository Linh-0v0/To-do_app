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
import { CustomRequest } from 'src/common/interfaces/custom-request.interface';
import { getUserId } from 'src/common/utils/get-user-id';

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
    const userId = getUserId(request.user);
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
    const userId = getUserId(user);
    const task = this.prisma.task.findMany({
      where: { userId },
    });
    return task;
  }

  /**
   * Get a single task (only if owned by user)
   */
  async getTaskById(user: CustomRequest['user'], taskId: string) {
    const userId = getUserId(user);
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
    const userId = getUserId(user);
    const existingTask = await this.prisma.task.findUnique({
      where: { id: taskId, userId },
    });

    if (!existingTask) {
      throw new NotFoundException('Task not found');
    }

    // 🔄 Check if the task is being marked as completed
    const updatedTask = await this.prisma.task.update({
      where: { id: taskId },
      data: updateTaskDto,
    });

    // 🔄 Check if the task is being marked as completed
    const isMarkingCompleted = updatedTask.status == true;
    if (isMarkingCompleted) {
      // one-time reminder
      if (!updatedTask.repeatType || updatedTask.repeatType == 'none') {
        await this.removeScheduledReminder(existingTask.jobKey || '');
        console.log(
          `✅ Task "${existingTask.title}" is completed. Reminder deleted.`,
        );
        // repeating reminder
      } else {
        console.log(
          `🔄 Task "${existingTask.title}" is completed but has a repeat type. Keeping reminders.`,
        );
        // 🔄 If the task reminder or repeat type is changed, reschedule
        await this.removeScheduledReminder(updatedTask.jobKey || '');
        await this.scheduleReminder(userId, updatedTask);
      }
    } else {
      console.log(
        `🔄 Task "${updatedTask.title}" is updated but not completed.`,
      );
      await this.removeScheduledReminder(updatedTask.jobKey || '');
      await this.scheduleReminder(userId, updatedTask);
    }
    return updatedTask;
  }

  async softDeleteTask(user: CustomRequest['user'], taskId: string) {
    const userId = getUserId(user);

    // const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    console.log('taskid', taskId);
    const task = await this.getTaskById(user, taskId);

    if (!task || task.deletedAt) {
      throw new NotFoundException('Task not found or already deleted');
    }

    await this.prisma.task.update({
      where: { id: taskId },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Delete a task (only if owned by user)
   */
  async deleteTask(user: CustomRequest['user'], taskId: string) {
    const userId = getUserId(user);
    const task = await this.getTaskById(user, taskId);
    await this.prisma.task.delete({ where: { id: taskId } });
  }

  async scheduleReminder(userId: string, task: any) {
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
    // 🔥 Remove existing scheduled job (prevents duplicates in case)
    await this.removeScheduledReminder(task.jobKey);

    // ✅ One-time Reminder (No repeat)
    if (!task.repeatType || task.repeatType === 'none') {
      const jobTime = new Date(task.reminder).getTime();
      const currentTime = Date.now();
      const delay = jobTime - currentTime;
      if (delay <= 0) {
        console.warn(`⚠️ Reminder time is in the past, skipping.`);
        return;
      }
      const jobAdd = await this.notificationQueue.add(
        'sendReminder',
        {
          userId,
          fcmToken: user.fcmToken,
          title: task.title,
        },
        { delay },
      );

      if (jobAdd) {
        await this.prisma.task.update({
          where: { id: task.id },
          data: {
            jobKey: jobAdd.repeatJobKey, //2e8b795db9bcf3c46a1d332692908ff8
          },
        });
      }
      return;
    } else {
      // // 🔥 Handle REPEATING Reminders (daily, weekly, monthly, yearly)
      const repeatOpts = this.getRepeatOptions(task.repeatType);

      if (repeatOpts) {
        const jobAdd = await this.notificationQueue.add(
          'sendReminder',
          {
            userId,
            fcmToken: user.fcmToken,
            title: task.title,
          },
          {
            delay: new Date(task.reminder).getTime() - Date.now(),
            repeat: repeatOpts, // 🔥 Ensures repeated execution
            removeOnComplete: true, // 🔥 Keeps queue clean
          },
        );

        // 🔥 Save the job key in the DB
        if (jobAdd) {
          await this.prisma.task.update({
            where: { id: task.id },
            data: {
              jobKey: jobAdd.repeatJobKey, //2e8b795db9bcf3c46a1d332692908ff8
            },
          });
        }
      }
    } // 🔥 Save the job key in the DB

    const jobs = await this.notificationQueue.getJobs([
      'waiting',
      'delayed',
      'active',
      'completed',
    ]);
  }

  /**
   * Get Repeat Options for BullMQ based on RepeatType
   */
  private getRepeatOptions(repeatType: string): any {
    switch (repeatType) {
      case 'daily':
        // return { every: 86_400_000 }; // ✅ Fix: 24 hours in ms
        // return { every: 60_000 }; // ✅ 1 minute
        return { every: 120_000 }; // ✅ 2 minute
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
  async removeScheduledReminder(jobKey: string) {
    if (jobKey) {
      await this.notificationQueue.remove(jobKey);
      await this.notificationQueue.removeJobScheduler(jobKey);
      console.log(`🗑️ Removed existing reminder job for Job key: ${jobKey}`);
    } else {
      console.log(`⚠️ No existing job found for this job: ${jobKey}`);
    }
  }
}
