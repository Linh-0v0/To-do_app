import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Req } from '@nestjs/common';
import { UserService } from './user.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CustomRequest } from '../../common/interfaces/custom-request.interface';

@Controller('users')
@UseGuards(AuthGuard) // ✅ Requires authentication
export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * Get current user info
   */
  @Get('me')
  async getCurrentUser(@Req() req: CustomRequest) {
    return this.userService.getUser(req.user.uid);
  }

  /**
   * Get a user by ID
   */
  @Get(':id')
  async getUser(@Param('id') userId: string) {
    return this.userService.getUser(userId);
  }

  /**
   * Update a user (e.g., update username, FCM token)
   */
  @Patch('me')
  async updateUser(@Req() req: CustomRequest, @Body() updateData: { username?: string; fcmToken?: string }) {
    return this.userService.updateUser(req.user.uid, updateData);
  }

  /**
   * Delete the current user
   */
  @Delete('me')
  async deleteUser(@Req() req: CustomRequest) {
    return this.userService.deleteUser(req.user.uid);
  }
}
