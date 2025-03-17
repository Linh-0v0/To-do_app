import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import * as admin from 'firebase-admin';
import { Request } from 'express';
import { JwtService } from '@nestjs/jwt';
import { CustomRequest } from '../interfaces/custom-request.interface'; 

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly jwtService: JwtService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>() as CustomRequest; // ✅ Explicitly cast to CustomRequest
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('No token provided');
    }

    const token = authHeader.replace('Bearer ', '').trim();

    // 🔹 Try Firebase Authentication First
    try {
      const decodedFirebaseToken = await admin.auth().verifyIdToken(token);
      request.user = { provider: 'firebase', ...decodedFirebaseToken }; // ✅ Attach Firebase user
      console.log('✅ Firebase User:', request.user);
      return true;
    } catch (error) {
      console.log('Firebase token verification failed, falling back to JWT...');
    }

    // 🔹 If Firebase verification fails, fallback to Manual JWT
    try {
      const decodedJwtToken = this.jwtService.verify(token);
      request.user = { provider: 'manual', ...decodedJwtToken }; // ✅ Attach JWT user

      console.log('✅ JWT User:', request.user);
      return true;
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }
}


// import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
// import { AuthGuard } from '@nestjs/passport';

// @Injectable()
// export class JwtAuthGuard extends AuthGuard('jwt') {
//   handleRequest(err, user, info) {
//     if (err || !user) {
//       throw new UnauthorizedException('Unauthorized');
//     }
//     return user;
//   }
// }


// import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
// import * as admin from 'firebase-admin';
// import { CustomRequest } from '../interfaces/custom-request.interface';

// @Injectable()
// export class JwtAuthGuard implements CanActivate {
//   async canActivate(context: ExecutionContext): Promise<boolean> {
//     const request = context.switchToHttp().getRequest<CustomRequest>(); // ✅ Use CustomRequest type
//     const authHeader = request.headers.authorization;

//     if (!authHeader) {
//       throw new UnauthorizedException('No token provided');
//     }

//     const token = authHeader.replace('Bearer ', '');
//     try {
//       const decodedToken = await admin.auth().verifyIdToken(token);
//       request.user = decodedToken; //  Attach user data to the request
//       return true;
//     } catch (error) {
//       throw new UnauthorizedException('Invalid token');
//     }
//   }
// }

