import { Injectable, Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(
    private prisma: PrismaService,
    @Inject('FIREBASE_ADMIN') private firebaseAdmin: admin.app.App
  ) {}

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

  // /**
  //  * Create a user (Stores in PostgreSQL)
  //  */
  // async createUser(email: string, password: string, username?: string) {
  //   return await this.prisma.user.create({
  //       data: { 
  //           email, 
  //           password,
  //           ...(username && { username }), //Only add if username exists
  //         },
  //   });
  // }

 /**
   * ✅ Update a user (username, FCM token, password for manual users)
   */
 async updateUser(
  userId: string,
  data: Partial<{ username: string; fcmToken: string; password?: string }>,
) {
  const user = await this.prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new NotFoundException('User not found');
  }

  // 🔹 Prevent Firebase users from updating their password manually
  if (user.firebaseUid && data.password) {
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
  async deleteUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // 🔹 If user was created with Firebase, also delete from Firebase Authentication
    if (user.firebaseUid) {
      await admin.auth().deleteUser(user.firebaseUid);
    }

    // Delete from PostgreSQL
    await this.prisma.user.delete({
      where: { id: userId },
    });

    return { message: 'User deleted successfully' };
  }
}
