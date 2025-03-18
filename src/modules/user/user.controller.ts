import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Req, HttpCode } from '@nestjs/common';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CustomRequest } from '../../common/interfaces/custom-request.interface';

@Controller('users')
@UseGuards(JwtAuthGuard) // ✅ Requires authentication
export class UserController {
  constructor(private readonly userService: UserService) { }

  /**
   * Get current user info
   */
  @Get('me')
  async getCurrentUser(@Req() req: CustomRequest) {
    return this.userService.getCurrentUser(req);
  }

  /**
   * Update a user (e.g., update username, FCM token)
   */
  @Patch('me')
  async updateUser(@Req() req: CustomRequest, @Body() updateData: { username?: string; fcmToken?: string }) {
    return this.userService.updateUser(req, updateData);
  }

  /**
   * Delete the current user
   */
  @Delete('me')
  @HttpCode(204)
  async deleteUser(@Req() req: CustomRequest) {
    return this.userService.deleteUser(req);
  }
}
