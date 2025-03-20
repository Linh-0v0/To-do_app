import { Module } from '@nestjs/common';
import { TaskService } from './task.service';
import { TaskController } from './task.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from '../auth/jwt.strategy';
import { FirebaseNotificationModule } from '../firebase/firebase-notification.module';


@Module({
  imports: [PrismaModule, FirebaseNotificationModule, JwtModule.register({ secret: process.env.JWT_SECRET || 'secretKey' })],
  providers: [TaskService,  JwtStrategy],
  controllers: [TaskController],
})
export class TaskModule {}
 