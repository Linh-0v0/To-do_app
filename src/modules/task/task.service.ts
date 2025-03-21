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

    // 🔄 Check if the task is being marked as completed
    const updatedTask = await this.prisma.task.update({
      where: { id: taskId },
      data: updateTaskDto,
    });

    // 🔄 Check if the task is being marked as completed
    const isMarkingCompleted = updateTaskDto.status == true;
    // 🔥 If marking completed & it's a repeatable task, remove the scheduled reminder
    if (isMarkingCompleted) {
      if (!existingTask.repeatType || existingTask.repeatType == 'none') {
        console.log('RepeatTYpe:', existingTask.repeatType);
        console.log(typeof existingTask.repeatType);
        await this.removeScheduledReminder(existingTask.jobKey || '');
        console.log(
          `✅ Task "${existingTask.title}" is completed. Reminder deleted.`,
        );
      } else {
        console.log(
          `🔄 Task "${existingTask.title}" is completed but has a repeat type. Keeping reminders.`,
        );
      }
    } else {
      console.log(
        `🔄 Task "${existingTask.title}" is updated but not completed.`,
      );
      // 🔄 If the task reminder or repeat type is changed, reschedule
      if (updateTaskDto.reminder || updateTaskDto.repeatType) {
        await this.removeScheduledReminder(existingTask.jobKey || '');
        await this.scheduleReminder(userId, updatedTask);
      }
    }
    return updatedTask;
  }

  /**
   * Delete a task (only if owned by user)
   */
  async deleteTask(user: CustomRequest['user'], taskId: string) {
    const task = await this.getTaskById(user, taskId);
    await this.prisma.task.delete({ where: { id: taskId } });
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
    console.log('taskid:', task.id);
    // 🔥 Remove existing scheduled job (prevents duplicates in case)
    await this.removeScheduledReminder(task.jobKey);

    if (task.status == false) {
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

        console.log(
          `✅ One-time reminder scheduled for task "${task.title}" at ${task.reminder}`,
        );
        return;
      } else {
        // // 🔥 Handle REPEATING Reminders (daily, weekly, monthly, yearly)
        const repeatOpts = this.getRepeatOptions(task.repeatType);

        if (repeatOpts) {
          // ✅ Step 1: Send the initial reminder once (immediately or with delay)
          const delayUntilFirstReminder =
            new Date(task.reminder).getTime() - Date.now();

          if (delayUntilFirstReminder > 0) {
            await this.notificationQueue.add(
              'sendReminder',
              {
                userId,
                fcmToken: user.fcmToken,
                title: task.title,
              },
              {
                delay: delayUntilFirstReminder,
                attempts: 3,
                removeOnComplete: true,
              },
            )
          };
          // ✅ Step 2: Schedule future repeats
          const jobAdd = await this.notificationQueue.add(
            'sendReminder',
            {
              userId,
              fcmToken: user.fcmToken,
              title: task.title,
            },
            {
              repeat: repeatOpts, // 🔥 Ensures repeated execution
              removeOnComplete: true, // 🔥 Keeps queue clean
            },
          );
          console.log('JOBADD', jobAdd.opts);
          // 🔥 Save the job key in the DB
          if (jobAdd) {
            await this.prisma.task.update({
              where: { id: task.id },
              data: {
                jobKey: jobAdd.repeatJobKey, //2e8b795db9bcf3c46a1d332692908ff8
              },
            });
          }
          console.log(
            `✅ Recurring reminder scheduled for "${task.title}" with repeat type: ${task.repeatType}`,
          );
        }
      } // 🔥 Save the job key in the DB
    }

    const jobs = await this.notificationQueue.getJobs([
      'waiting',
      'delayed',
      'active',
      'completed',
    ]);

    jobs.forEach((job) => {
      console.log(
        `Job Name: ${job.name}, Job ID: ${job.id}, Job Key: ${job.key}, Data:`,
        job.data,
      );
    });
  }

  /**
   * Get Repeat Options for BullMQ based on RepeatType
   */
  private getRepeatOptions(repeatType: string): any {
    switch (repeatType) {
      case 'daily':
        return { every: 86_400_000 }; // ✅ Fix: 24 hours in ms
      // return { every: 60_000 }; // ✅ 1 minute
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
