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
    @Inject('FIREBASE_ADMIN') private firebaseAdmin: admin.app.App,
  ) {}

  async getCurrentUser(request: CustomRequest) {
    const user = request.user;
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
   * Get a user from the database (Supports Firebase & Manual users)
   */
  async getUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
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
  async deleteUser(request: CustomRequest) {
    const user = request.user;
    console.log('createTask user:', user);
    const userInfo = await this.prisma.user.findUnique({
      where: { id: user.id },
    });

    if (!userInfo) {
      throw new NotFoundException('User not found');
    }

    // 🔹 If user was created with Firebase, also delete from Firebase Authentication
    if (userInfo.firebaseUid) {
      await admin.auth().deleteUser(user.uid || user.sub);
    }

    // Delete from PostgreSQL
    await this.prisma.user.delete({
      where: { id: user.id },
    });

    return { message: 'User deleted successfully' };
  }
}
