import { Request } from 'express';

export interface CustomRequest extends Request {
  user: {
    id: string;
    provider: 'firebase' | 'manual';
    uid: string;
    email?: string;
    [key: string]: any; // Allows other Firebase user properties
  };
}
