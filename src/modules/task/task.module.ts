import { Module } from '@nestjs/common';
import { TaskService } from './task.service';
import { TaskController } from './task.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { FirebaseNotificationModule } from '../firebase/firebase-notification.module';

@Module({
  imports: [PrismaModule, FirebaseNotificationModule],
  providers: [TaskService],
  controllers: [TaskController],
})
export class TaskModule {}
