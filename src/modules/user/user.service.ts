import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import * as admin from 'firebase-admin';
import { PrismaService } from '../../prisma/prisma.service';
import { CustomRequest } from '../../common/interfaces/custom-request.interface';

@Injectable()
export class UserService {
  constructor(
    private prisma: PrismaService,
  ) {}

  async getCurrentUser(request: CustomRequest) {
    const user = request.user;
    console.log(request.user);
    console.log('createTask user:', user);
    const userId = user.provider == 'firebase' ? user.id : user.uid || user.sub;

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
    data: Partial<{ username: string; fcmToken: string; password?: string }>,
  ) {
    const user = request.user;
    console.log('createTask user:', user);
    const userId = user.provider == 'firebase' ? user.id : user.uid || user.sub;

    const userInfo = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!userInfo) {
      throw new NotFoundException('User not found');
    }

    // 🔹 Prevent Firebase users from updating their password manually
    if (userInfo.firebaseUid && data.password) {
      throw new ForbiddenException(
        'Cannot update password for Firebase-authenticated users.',
      );
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
    const user = request.user;
    console.log('deleteUser user:', user);
  
    const userId = user.provider === 'firebase' ? user.id : user.uid || user.sub;
  
    const userInfo = await this.prisma.user.findUnique({
      where: { id: userId },
    });
  
    if (!userInfo) {
      throw new NotFoundException('User not found');
    }
  
    // 🔹 If user was created with Firebase, also delete from Firebase Authentication
    if (userInfo.firebaseUid) {
      await admin.auth().deleteUser(user.uid || user.sub); // Delete from Firebase Auth
    }
  
    // 🔹 Delete user from PostgreSQL
    await this.prisma.user.delete({
      where: { id: userId },
    });
  
    // ✅ No return statement → Automatically responds with 204 No Content
  }
  
}
