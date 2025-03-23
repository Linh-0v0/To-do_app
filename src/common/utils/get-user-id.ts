import { CustomRequest } from '../interfaces/custom-request.interface';

export function getUserId(user: CustomRequest['user']): string {
  return user.provider === 'firebase' ? user.id : user.uid || user.sub;
}
