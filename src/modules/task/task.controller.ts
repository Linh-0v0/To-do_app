import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { TaskService } from './task.service';
import { CreateTaskDto, UpdateTaskDto } from '../dto/task.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CustomRequest } from '../../common/interfaces/custom-request.interface';

@Controller('tasks')
@UseGuards(JwtAuthGuard) // ✅ JwtAuthGuard automatically sets req.user
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @Post()
  async createTask(
    @Req() req: CustomRequest,
    @Body() createTaskDto: CreateTaskDto,
  ) {
    return this.taskService.createTask(req, createTaskDto);
  }

  @Get()
  async getUserTasks(@Req() req: CustomRequest) {
    return this.taskService.getUserTasks(req.user);
  }

  @Get(':taskId')
  async getTaskById(
    @Req() req: CustomRequest,
    @Param('taskId') taskId: string,
  ) {
    return this.taskService.getTaskById(req.user, taskId);
  }

  @Patch(':taskId')
  async updateTask(
    @Req() req: CustomRequest,
    @Param('taskId') taskId: string,
    @Body() updateTaskDto: UpdateTaskDto,
  ) {
    return this.taskService.updateTask(req.user, taskId, updateTaskDto);
  }

  @Delete(':taskId')
  async softDeleteTask(
    @Req() req: CustomRequest,
    @Param('taskId') taskId: string,
  ) {
    await this.taskService.softDeleteTask(req.user, taskId);
    return { message: 'Task soft-deleted' };
  }

  @Delete(':taskId')
  @HttpCode(204)
  async deleteTask(@Req() req: CustomRequest, @Param('taskId') taskId: string) {
    return this.taskService.deleteTask(req.user, taskId);
  }
}
