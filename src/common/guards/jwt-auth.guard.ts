import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import * as admin from 'firebase-admin';
import { Request } from 'express';
import { JwtService } from '@nestjs/jwt';
import { CustomRequest } from '../interfaces/custom-request.interface';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtAuthGuard {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request>() as CustomRequest; // ✅ Explicitly cast to CustomRequest
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('No token provided');
    }

    const token = authHeader.replace('Bearer ', '').trim();
    // 🔹 Try Firebase Authentication First
    try {
      const decodedFirebaseToken = await admin.auth().verifyIdToken(token);
      // 🔹 Fetch the user from DB using Firebase UID
      const user = await this.prisma.user.findUnique({
        where: { firebaseUid: decodedFirebaseToken.uid }, // We stored Firebase UID as `id`
        select: { id: true, email: true },
      });

      if (!user) {
        throw new UnauthorizedException('User not found in database');
      }

      request.user = {
        provider: 'firebase',
        id: user.id, // ✅ Attach correct DB id
        email: user.email,
        ...decodedFirebaseToken,
      };
      return true;
    } catch (error) {
      console.log(error);
      console.log('Firebase token verification failed, falling back to JWT...');
    }

    // 🔹 If Firebase verification fails, fallback to Manual JWT
    try {
      const decodedJwtToken = this.jwtService.verify(token);
      request.user = { provider: 'manual', ...decodedJwtToken }; // ✅ Attach JWT user
      return true;
    } catch (error) {
      throw new UnauthorizedException(error);
    }
  }
}
