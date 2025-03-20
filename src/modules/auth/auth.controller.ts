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
    @Body('firstname') firstname: string,
    @Body('lastname') lastname: string,
    @Body('email') email: string,
    @Body('password') password: string,
  ) {
    return this.authService.signUp(firstname, lastname, email, password);
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
    @Body('firstname') firstname: string,
    @Body('lastname') lastname: string,
    @Body('email') email: string,
    @Body('password') password: string,
  ) {
    return this.authService.firebaseSignUp(
      firstname,
      lastname,
      email,
      password,
    );
  }

  // ✅ Firebase Authentication - Sign In
  @Post('firebase-signin')
  async firebaseSignIn(
    @Body('email') email: string,
    @Body('password') password: string,
  ) {
    return this.authService.firebaseSignIn(email, password);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @Request() req,
    @Body('newPassword') newPassword: string,
    @Body('oldPassword') oldPassword: string,
  ) {
    return this.authService.changePassword(req, oldPassword, newPassword);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@Request() req) {
    return this.authService.logout(req);
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
