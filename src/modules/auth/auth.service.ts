import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { Inject } from '@nestjs/common';
import { Auth } from 'firebase/auth';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import * as admin from 'firebase-admin';
import { CustomRequest } from '../../common/interfaces/custom-request.interface';
import { getUserId } from 'src/common/utils/get-user-id';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    @Inject('FIREBASE_AUTH') private firebaseAuth: Auth, // Firebase Authentication
  ) {}

  async signUp(
    firstname: string,
    lastname: string,
    email: string,
    password: string,
    username?: string,
  ) {
    // ✅ Check if the email exists in the PostgreSQL database
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existingUser) {
      throw new ConflictException(
        'Email already registered manually. Please log in manually.',
      );
    }

    // ✅ Check if the email is already registered in Firebase
    try {
      const firebaseUser = await admin.auth().getUserByEmail(email);
      if (firebaseUser) {
        throw new ConflictException(
          'Email already registered with Firebase. Please log in with Firebase.',
        );
      }
    } catch (error) {
      if (error.code !== 'auth/user-not-found') {
        throw new UnauthorizedException(
          'Error checking Firebase authentication.',
        );
      }
    }

    // ✅ Hash the password for manual authentication
    const hashedPassword = await bcrypt.hash(password, 10);

    // ✅ Create a new user in PostgreSQL
    const user = await this.prisma.user.create({
      data: {
        firstname,
        lastname,
        email,
        username,
        password: hashedPassword,
      },
    });

    return this.generateTokens(user.id, user.email);
  }

  async signIn(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(password, user.password ?? '');
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateTokens(user.id, user.email);
  }

  async generateTokens(userId: string, email: string) {
    const accessToken = this.jwtService.sign(
      { sub: userId, email },
      { expiresIn: '15m' },
    );
    const refreshToken = this.jwtService.sign(
      { sub: userId },
      { expiresIn: '7d' },
    );

    // 🔹 Save refresh token in the database (hashed for security)
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: hashedRefreshToken },
    });

    return { accessToken, refreshToken };
  }

  async refreshAccessToken(refreshToken: string) {
    try {
      const decoded = this.jwtService.verify(refreshToken);
      const user = await this.prisma.user.findUnique({
        where: { id: decoded.sub },
      });

      if (!user || !user.refreshToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // 🔹 Verify stored refresh token
      const isValid = await bcrypt.compare(refreshToken, user.refreshToken);
      if (!isValid) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      return this.generateTokens(user.id, user.email);
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  /**
   * Firebase Google Authentication
   */
  async firebaseGoogleAuth(idToken: string) {
    try {
      // 🔐 Verify ID token from frontend
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const firebaseUid = decodedToken.uid;

      // 🔎 Get Firebase user (includes displayName, email, etc.)
      const firebaseUser = await admin.auth().getUser(firebaseUid);

      // 💾 Check if user exists in DB
      let user = await this.prisma.user.findUnique({
        where: { firebaseUid },
      });

      if (!user) {
        user = await this.prisma.user.create({
          data: {
            firebaseUid,
            email: firebaseUser.email || '',
            firstname: firebaseUser.displayName?.split(' ')[0] || '',
            lastname: firebaseUser.displayName?.split(' ')[1] || '',
            createdAt: new Date(),
          },
        });
      }

      const accessToken = this.jwtService.sign(
        { sub: user.id, email: user.email },
        { expiresIn: '15m' },
      );

      const refreshToken = this.jwtService.sign(
        { sub: user.id },
        { expiresIn: '7d' },
      );

      // Save hashed refresh token in the database
      const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
      await this.prisma.user.update({
        where: { id: user.id },
        data: { refreshToken: hashedRefreshToken },
      });

      return {
        message: 'User authenticated with Google',
        accessToken,
        refreshToken,
        firebaseUser,
        userdb: user,
      };
    } catch (error) {
      console.error('Google Auth Error:', error);
      throw new UnauthorizedException('Invalid Google credentials');
    }
  }

  async changePassword(
    request: CustomRequest,
    oldPassword: string,
    newPassword: string,
  ) {
    const user = request.user;
    const userId = getUserId(request.user);

    const userInfo = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { password: true },
    });

    if (!userInfo) {
      throw new NotFoundException('User not found');
    }

    if (user.provider == 'firebase') {
      try {
        await admin.auth().updateUser(user.sub, {
          password: newPassword,
        });
        return { message: 'Password updated in Firebase' };
      } catch (error) {
        console.error(`❌ Error updating password in Firebase:`, error);
        throw new ForbiddenException('Failed to update password in Firebase');
      }
    } else {
      // 🔹 Check if old password is correct
      const isMatch = await bcrypt.compare(
        oldPassword,
        userInfo.password ?? '',
      );
      if (!isMatch) {
        throw new ForbiddenException('Incorrect old password');
      }

      // 🔹 Hash new password and update it
      const hashedNewPassword = await bcrypt.hash(newPassword, 10);
      await this.prisma.user.update({
        where: { id: userId },
        data: { password: hashedNewPassword },
      });

      return { message: 'Password changed successfully' };
    }
  }

  /**
   * Logout user - Firebase Authentication (Invalidate Session)
   */
  async logout(request: CustomRequest) {
    try {
      const userId = getUserId(request.user);
      if (!userId) {
        throw new UnauthorizedException('User ID is missing in token');
      }

      // Check if the user exists in DB with the correct identifier
      let userExists;
      if (request.user.provider === 'firebase') {
        // For Firebase/Google auth, we need to check by firebaseUid
        userExists = await this.prisma.user.findFirst({
          where: {
            OR: [{ firebaseUid: userId }, { firebaseUid: request.user.uid }],
          },
        });
      } else {
        // For manual auth, check by our internal ID
        userExists = await this.prisma.user.findUnique({
          where: { id: userId },
        });
      }

      if (!userExists) {
        throw new UnauthorizedException('User not found in database');
      }

      if (request.user.provider === 'firebase') {
        // 🔹 Remove FCM token (optional)
        await this.prisma.user.update({
          where: { id: userExists.id }, // Always use our internal ID for updates
          data: { fcmToken: null },
        });

        // 🔹 Firebase Admin: Revoke user's refresh tokens if we have the firebase UID
        if (userExists.firebaseUid) {
          await admin.auth().revokeRefreshTokens(userExists.firebaseUid);
        }
      } else {
        // 🔹 Manual JWT Logout: Remove refreshToken from DB
        await this.prisma.user.update({
          where: { id: userExists.id },
          data: { refreshToken: null },
        });
      }

      return { message: 'User logged out successfully' };
    } catch (error) {
      throw new UnauthorizedException(error?.message || 'Failed to log out');
    }
  }

  async updateFcmToken(userId: string, fcmToken: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { fcmToken },
    });
  }
}
