import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err, user, info) {
    if (err || !user) {
      throw new UnauthorizedException('Unauthorized');
    }
    return user;
  }
}


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

