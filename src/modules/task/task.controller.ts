import { Controller, Post, Get, Patch, Delete, Body, Param, Req, UseGuards } from '@nestjs/common';
import { TaskService } from './task.service';
import { CreateTaskDto, UpdateTaskDto } from '../dto/task.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Request } from 'express';
import { CustomRequest } from '../../common/interfaces/custom-request.interface';

@Controller('tasks')
@UseGuards(JwtAuthGuard) // ✅ JwtAuthGuard automatically sets req.user
export class TaskController {
  constructor(private readonly taskService: TaskService) { }

  @Post()
  async createTask(@Req() req: CustomRequest, @Body() createTaskDto: CreateTaskDto) {
    return this.taskService.createTask(req.user.uid, createTaskDto);
  }

  @Get()
  async getUserTasks(@Req() req: CustomRequest) {
    return this.taskService.getUserTasks(req.user.uid);
  }

  @Get(':taskId')
  async getTaskById(@Req() req: CustomRequest, @Param('taskId') taskId: string) {
    return this.taskService.getTaskById(req.user.uid, taskId);
  }

  @Patch(':taskId')
  async updateTask(@Req() req: CustomRequest, @Param('taskId') taskId: string, @Body() updateTaskDto: UpdateTaskDto) {
    return this.taskService.updateTask(req.user.uid, taskId, updateTaskDto);
  }

  @Delete(':taskId')
  async deleteTask(@Req() req: CustomRequest, @Param('taskId') taskId: string) {
    return this.taskService.deleteTask(req.user.uid, taskId);
  }
}