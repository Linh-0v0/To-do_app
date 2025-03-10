import { Controller, Post, Body, Headers, Get, Param } from '@nestjs/common';
import { AuthService } from './auth.service';

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

  @Post('verify')
  async verifyToken(@Headers('Authorization') authHeader: string) {
    const token = authHeader?.split(' ')[1];
    if (!token) throw new Error('No token provided');
    return this.authService.verifyToken(token);
  }

  @Get('user/:uid')
  async getUser(@Param('uid') uid: string) {
    return this.authService.getUser(uid);
  }
}
