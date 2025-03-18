import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from '../auth/jwt.strategy';

@Module({
  imports: [JwtModule.register({ secret: process.env.JWT_SECRET || 'secretKey' })],
  providers: [UserService, PrismaService, JwtStrategy],
  controllers: [UserController],
  exports: [UserService],
})
export class UserModule {}
