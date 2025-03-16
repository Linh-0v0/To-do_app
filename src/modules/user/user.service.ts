import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(
    private prisma: PrismaService,
    @Inject('FIREBASE_ADMIN') private firebaseAdmin: admin.app.App
  ) {}

  /**
   * Get a user from the database
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
   * Create a user (Stores in PostgreSQL)
   */
  async createUser(email: string, password: string, username?: string) {
    return await this.prisma.user.create({
        data: { 
            email, 
            password,
            ...(username && { username }), //Only add if username exists
          },
    });
  }

  /**
   * Update a user (e.g., change username, FCM token)
   */
  async updateUser(userId: string, data: Partial<{ username: string; fcmToken: string }>) {
    return await this.prisma.user.update({
      where: { id: userId },
      data,
    });
  }

  /**
   * Delete a user from PostgreSQL & Firebase Authentication
   */
  async deleteUser(userId: string) {
    // Delete from PostgreSQL
    await this.prisma.user.delete({
      where: { id: userId },
    });

    // Delete from Firebase Authentication
    await admin.auth().deleteUser(userId);

    return { message: 'User deleted successfully' };
  }
}
