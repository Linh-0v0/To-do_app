import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Req, HttpCode } from '@nestjs/common';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CustomRequest } from '../../common/interfaces/custom-request.interface';
import { UpdateUserDto } from '../dto/user.dto';

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
   * Update a user
   */
  @Patch('me')
  async updateUser(@Req() req: CustomRequest, @Body() updateUserDto: UpdateUserDto ) {
    return this.userService.updateUser(req, updateUserDto);
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
