import { Controller, Post, Body, Patch, Req, Headers, Get, Param, Logger, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { CustomRequest } from 'src/common/interfaces/custom-request.interface';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  async signUp(@Body() body: { email: string; password: string }) {
    return this.authService.signUp(body.email, body.password);
  }

  @Post('login')
  async signIn(@Body() body: { email: string; password: string }) {
    return this.authService.signIn(body.email, body.password);
  }

   // 🔥 Manually update the FCM token for testing
   @Patch('update-fcm-token')
   @UseGuards(AuthGuard) // ✅ Protect with Firebase Auth Guard
   async updateFcmToken(@Req() req: CustomRequest, @Body() body: { fcmToken: string }) {
     const userId = req.user.uid; // ✅ Get Firebase UID from request
     return this.authService.updateFcmToken(userId, body.fcmToken);
   }



  // @Post('verify')
  // async verifyToken(@Headers('Authorization') authHeader: string) {
  //   const token = authHeader.replace('Bearer ', '').trim();
  //   if (!token) throw new Error('No token provided');
  //   console.log('Token:', token);
  //   return this.authService.verifyToken(token);
  // }

  // @Get('user/:uid')
  // async getUser(@Param('uid') uid: string) {
  //   return this.authService.getUser(uid);
  // }
}
