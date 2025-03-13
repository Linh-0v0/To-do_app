import { Request } from 'express';

export interface CustomRequest extends Request {
  user: {
    uid: string;
    email?: string;
    [key: string]: any; // Allows other Firebase user properties
  };
}
