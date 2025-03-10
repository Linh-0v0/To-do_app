import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Auth } from 'firebase/auth';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import * as admin from 'firebase-admin';

@Injectable()
export class AuthService {
  constructor(private readonly firebaseAuth: Auth) {}

  /**
   * Sign up a new user with email and password
   */
  async signUp(email: string, password: string) {
    try {
      const userCredential = await createUserWithEmailAndPassword(this.firebaseAuth, email, password);
      return userCredential.user;
    } catch (error) {
      throw new UnauthorizedException(error.message);
    }
  }

  /**
   * Sign in an existing user with email and password
   */
  async signIn(email: string, password: string) {
    try {
      const userCredential = await signInWithEmailAndPassword(this.firebaseAuth, email, password);
      return userCredential.user;
    } catch (error) {
      throw new UnauthorizedException(error.message);
    }
  }

  /**
   * Verify the Firebase token sent by the frontend
   */
  async verifyToken(idToken: string) {
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      return decodedToken;
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  /**
   * Get user details from Firebase UID
   */
  async getUser(uid: string) {
    try {
      return await admin.auth().getUser(uid);
    } catch (error) {
      throw new UnauthorizedException('User not found');
    }
  }
}
