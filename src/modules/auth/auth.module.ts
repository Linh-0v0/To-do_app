import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [PrismaModule, JwtModule.register({ secret: process.env.JWT_SECRET || 'secretKey' })],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
})
export class AuthModule {}


// @Module({
//   imports: [PrismaModule],
//   providers: [AuthService],
//   controllers: [AuthController],
//   exports: [AuthService],
// })
// export class AuthModule {}
