import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import * as admin from 'firebase-admin';
import { PrismaService } from '../../prisma/prisma.service';
import { CustomRequest } from '../../common/interfaces/custom-request.interface';
import { UpdateUserDto } from '../dto/user.dto';
import { getUserId } from 'src/common/utils/get-user-id';

@Injectable()
export class UserService {
  constructor(
    private prisma: PrismaService,
  ) {}

  async getCurrentUser(request: CustomRequest) {
    const userId = getUserId(request.user);

    if (!userId) {
      throw new NotFoundException('User ID not found in request');
    }

    const userInfo = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, username: true, createdAt: true },
    });

    if (!userInfo) {
      throw new NotFoundException('User not found in database');
    }

    return userInfo;
  }

  /**
   * ✅ Update a user (username, FCM token, password for manual users)
   */
  async updateUser(
    request: CustomRequest,
    data: UpdateUserDto,
  ) {
    const userId = getUserId(request.user);
  
    const userInfo = await this.prisma.user.findUnique({
      where: { id: userId },
    });
  
    if (!userInfo) {
      throw new NotFoundException('User not found');
    }

    if ('password' in data) {
      throw new ForbiddenException('Password updates are not allowed here.');
    }
    
    return await this.prisma.user.update({
      where: { id: userId },
      data,
    });
  }

  /**
   * ✅ Delete a user from PostgreSQL & Firebase Authentication if applicable
   */
  async deleteUser(request: CustomRequest): Promise<void> {
    const userId = getUserId(request.user);
  
    const userInfo = await this.prisma.user.findUnique({
      where: { id: userId },
    });
  
    if (!userInfo) {
      throw new NotFoundException('User not found');
    }
  
    // 🔹 If user was created with Firebase, also delete from Firebase Authentication
    if (userInfo.firebaseUid) {
      await admin.auth().deleteUser(request.user.uid || request.user.sub); // Delete from Firebase Auth
    }
  
    // 🔹 Delete user from PostgreSQL
    await this.prisma.user.delete({
      where: { id: userId },
    });

    // ✅ No return statement → Automatically responds with 204 No Content
  }
  
}
