import {
  Controller,
  Post,
  Body,
  Patch,
  Get,
  UseGuards,
  Request,
  Req,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CustomRequest } from '../../common/interfaces/custom-request.interface';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  async signUp(
    @Body('email') email: string,
    @Body('password') password: string,
  ) {
    return this.authService.signUp(email, password);
  }

  @Post('signin')
  async signIn(
    @Body('email') email: string,
    @Body('password') password: string,
  ) {
    return this.authService.signIn(email, password);
  }

  @Post('refresh-token')
  async refreshAccessToken(@Body('refreshToken') refreshToken: string) {
    return this.authService.refreshAccessToken(refreshToken);
  }

  // ✅ Firebase Authentication - Sign Up
  @Post('firebase-signup')
  async firebaseSignUp(
    @Body('email') email: string,
    @Body('password') password: string,
  ) {
    return this.authService.firebaseSignUp(email, password);
  }

  // ✅ Firebase Authentication - Sign In
  @Post('firebase-signin')
  async firebaseSignIn(
    @Body('email') email: string,
    @Body('password') password: string,
  ) {
    return this.authService.firebaseSignIn(email, password);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@Request() req) {
    return this.authService.logout(req);
  }

  // ✅ Get Profile (Protected Route)
  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Request() req) {
    return req.user; // ✅ Returns the authenticated user's data
  }

  // ✅ Update FCM Token for Firebase Cloud Messaging (Protected)
  @Patch('update-fcm-token')
  @UseGuards(JwtAuthGuard)
  async updateFcmToken(
    @Req() req: CustomRequest,
    @Body('fcmToken') fcmToken: string,
  ) {
    const user = req.user;
    const userId = user.provider == 'firebase' ? user.id : user.uid || user.sub;
    return this.authService.updateFcmToken(userId, fcmToken);
  }
}
