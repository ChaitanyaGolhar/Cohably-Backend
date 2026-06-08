import type { Role } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
      };
      membership?: {
        id: string;
        role: Role;
        flatId: string;
        userId: string;
        isActive: boolean;
      };
    }
  }
}

export {};
