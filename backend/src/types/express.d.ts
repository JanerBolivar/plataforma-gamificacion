import { Role, UserStatus } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        microsoftId: string;
        email: string;
        firstName: string;
        lastName: string;
        role: Role;
        status: UserStatus;
        createdAt: Date;
        updatedAt: Date;
      };
    }
  }
}

export {};
