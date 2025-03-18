import {
  Injectable,
  ConflictException,
  UnauthorizedException,
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

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    @Inject('FIREBASE_AUTH') private firebaseAuth: Auth, // Firebase Authentication
  ) {}

  async signUp(email: string, password: string) {
    // ✅ Check if the email exists in the PostgreSQL database
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existingUser) {
      throw new ConflictException(
        'Email already registered manually. Please log in manually.',
      );
    }
    console.log('after existing user')

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
    console.log('after try catch')

    let hashedPassword = '';
    // ✅ Hash the password for manual authentication
    try {
      hashedPassword = await bcrypt.hash(password, 10);
    } catch (error) {
      console.log(error);
    }
    
    console.log('after hashed password')
    // ✅ Create a new user in PostgreSQL
    const user = await this.prisma.user.create({
      data: { email, password: hashedPassword },
    });
    console.log('after create user in postgresql')

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

  // ✅ Firebase Auth - Sign Up
  async firebaseSignUp(email: string, password: string) {
    try {
      const userCredential = await createUserWithEmailAndPassword(
        this.firebaseAuth,
        email,
        password,
      );
      const firebaseUser = userCredential.user;

      if (!firebaseUser.email) {
        throw new UnauthorizedException(
          'Email is required but not provided by Firebase.',
        );
      }

      // Check if the email is already registered in our DB
      const existingUser = await this.prisma.user.findUnique({
        where: { email: firebaseUser.email },
      });

      if (existingUser) {
        throw new ConflictException('Email already registered.');
      }

      const newUser = await this.prisma.user.create({
        data: {
          // id: firebaseUser.uid,
          firebaseUid: firebaseUser.uid,
          email: firebaseUser.email,
          createdAt: new Date(),
        },
      });

      return {
        message: 'User registered successfully with Firebase',
        user: firebaseUser,
        userdb: newUser,
      };
    } catch (error) {
      throw new UnauthorizedException(error.message);
    }
  }

  // ✅ Firebase Auth - Sign In
  async firebaseSignIn(email: string, password: string) {
    try {
      // ✅ Firebase Authentication
      const userCredential = await admin.auth().getUserByEmail(email);
      if (!userCredential) {
        throw new UnauthorizedException('User not found');
      }

      // ✅ Check if user exists in PostgreSQL, if not, create a new entry
      let user = await this.prisma.user.findUnique({
        where: { firebaseUid: userCredential.uid },
      });

      const userCredentialInfo = await signInWithEmailAndPassword(
        this.firebaseAuth,
        email,
        password,
      );
      if (!user) {
        user = await this.prisma.user.create({
          data: {
            // id: userCredential.uid,
            email: userCredential.email || email,
            createdAt: new Date(),
          },
        });
      }

      return { message: 'User signed in with Firebase', userCredentialInfo };
    } catch (error) {
      throw new UnauthorizedException('Invalid Firebase credentials');
    }
  }
  /**
   * Logout user - Firebase Authentication (Invalidate Session)
   */
  async logout(request: CustomRequest) {
    const user = request.user;
    console.log('req.user:', request.user);
    try {
      console.log('provider: ', user.provider);
      const userId =
        user.provider == 'firebase' ? user.uid || user.sub : ""; // const provider = request.user.provider; // ✅ Determine provider automatically
      if (!userId) {
        throw new UnauthorizedException('User ID is missing in token');
      }
      // Check if the user exists in DB
      const userExists = await this.prisma.user.findUnique({
        where: { firebaseUid: user.uid || user.sub },
      });
      if (!userExists) {
        throw new UnauthorizedException('User not found in database');
      }
      if (user.provider == 'firebase') {
        // 🔹 Remove FCM token (optional)
        await this.prisma.user.update({
          where: { firebaseUid: userId },
          data: { fcmToken: null },
        });

        // 🔹 Firebase Admin: Revoke user's refresh tokens
        await admin.auth().revokeRefreshTokens(userId);
      } else {
        // 🔹 Manual JWT Logout: Remove refreshToken from DB
        await this.prisma.user.update({
          where: { id: userId },
          data: { refreshToken: null },
        });
      }

      return { message: 'User logged out successfully' };
    } catch (error) {
      console.error('❌ Error during logout:', error);
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
