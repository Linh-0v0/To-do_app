import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async signUp(email: string, password: string) {
    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new ConflictException('Email already in use');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await this.prisma.user.create({
      data: { email, password: hashedPassword },
    });

    return this.generateToken(user.id, user.email);
  }

  private generateToken(userId: string, email: string) {
    const payload = { sub: userId, email };
    return { accessToken: this.jwtService.sign(payload) };
  }

  async signIn(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
  
    const passwordValid = await bcrypt.compare(password, user.password);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }
  
    return this.generateToken(user.id, user.email);
  }
  
}


// import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
// import { Auth } from 'firebase/auth';
// import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
// import { PrismaService } from 'src/prisma/prisma.service';
// // import * as admin from 'firebase-admin';

// @Injectable()
// export class AuthService {
//   constructor(@Inject('FIREBASE_AUTH') private firebaseAuth: Auth,
//   private prisma: PrismaService) {}

//   /**
//    * Sign up a new user with email and password
//    */
//   async signUp(email: string, password: string) {
//     try {
//       const userCredential = await createUserWithEmailAndPassword(this.firebaseAuth, email, password);
//       const firebaseUser = userCredential.user;

//       if (!firebaseUser.email) {
//         throw new UnauthorizedException('Email is required but not provided by Firebase.');
//       }

//       // Save the user in PostgreSQL using Prisma
//       const newUser = await this.prisma.user.create({
//         data: {
//           id: firebaseUser.uid, // Firebase UID as Primary Key
//           email: firebaseUser.email,
//           createdAt: new Date(),
//         },
//       });

//       return {
//         message: 'User registered successfully',
//         user: firebaseUser,
//         userdb: newUser,
//       };
//       // return firebaseUser;
//     } catch (error) {
//       throw new UnauthorizedException(error.message);
//     }
//   }

//   /**
//    * Sign in an existing user with email and password
//    */
//   async signIn(email: string, password: string) {
//     try {
//       const userCredential = await signInWithEmailAndPassword(this.firebaseAuth, email, password);
      
//       return userCredential.user;
//     } catch (error) {
//       throw new UnauthorizedException(error.message);
//     }
//   }
  
//   async updateFcmToken(userId: string, fcmToken: string) {
//     return this.prisma.user.update({
//       where: { id: userId },
//       data: { fcmToken },
//     });
//   }

//   /**
//    * Verify the Firebase token sent by the frontend
//    */
//   // // in auth.guard.ts, this will be delete later
//   // async verifyToken(idToken: string) {
//   //   try {
//   //     const decodedToken = await admin.auth().verifyIdToken(idToken);
//   //     return decodedToken;
//   //   } catch (error) {
//   //     throw new UnauthorizedException('Invalid token');
//   //   }
//   // }

//   /**
//    * Get user details from Firebase UID
//    */
//   // async getUser(uid: string) {
//   //   try {
//   //     return await admin.auth().getUser(uid);
//   //   } catch (error) {
//   //     throw new UnauthorizedException('User not found');
//   //   }
//   // }
// }
