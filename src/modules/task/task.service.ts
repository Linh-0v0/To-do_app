import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTaskDto, UpdateTaskDto } from '../dto/task.dto';

@Injectable()
export class TaskService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new task
   */
  async createTask(userId: string, createTaskDto: CreateTaskDto) {
    return this.prisma.task.create({
      data: {
        userId,
        ...createTaskDto,
      },
    });
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
   * 🔥 Update a task (only if owned by user)
   */
  async updateTask(userId: string, taskId: string, updateTaskDto: UpdateTaskDto) {
    const task = await this.getTaskById(userId, taskId);
    
    return this.prisma.task.update({
      where: { id: task.id },
      data: updateTaskDto,
    });
  }

  /**
   * 🔥 Delete a task (only if owned by user)
   */
  async deleteTask(userId: string, taskId: string) {
    const task = await this.getTaskById(userId, taskId);

    return this.prisma.task.delete({
      where: { id: task.id },
    });
  }
}
