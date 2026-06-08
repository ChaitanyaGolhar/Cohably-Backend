import type { Request, Response, NextFunction } from "express";
import { prisma } from "../db/index.js";
import { sendError } from "../utils/apiResponse.js";

/**
 * Middleware that verifies the authenticated user is an active member of the flat
 * specified by the `:id` route parameter. Attaches membership to `req.membership`.
 */
export async function requireFlatMember(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const flatId = req.params.id;
  const userId = req.user?.userId;

  if (!userId) {
    sendError(res, "UNAUTHORIZED", "Authentication required", 401);
    return;
  }

  if (!flatId) {
    sendError(res, "BAD_REQUEST", "Flat ID is required", 400);
    return;
  }

  try {
    const membership = await prisma.membership.findUnique({
      where: {
        flatId_userId: { flatId, userId },
      },
    });

    if (!membership || !membership.isActive) {
      sendError(
        res,
        "FORBIDDEN",
        "You are not a member of this flat",
        403
      );
      return;
    }

    req.membership = {
      id: membership.id,
      role: membership.role,
      flatId: membership.flatId,
      userId: membership.userId,
      isActive: membership.isActive,
    };

    next();
  } catch (error) {
    next(error);
  }
}
