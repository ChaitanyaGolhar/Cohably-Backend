import type { Request, Response, NextFunction } from "express";
import { sendError } from "../utils/apiResponse.js";

/**
 * Middleware factory that checks if the authenticated user has the ADMIN role
 * in the current flat. Must be used AFTER `requireFlatMember` middleware.
 */
export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.membership) {
    sendError(
      res,
      "FORBIDDEN",
      "Membership verification required before role check",
      403
    );
    return;
  }

  if (req.membership.role !== "ADMIN") {
    sendError(
      res,
      "FORBIDDEN",
      "Only flat admins can perform this action",
      403
    );
    return;
  }

  next();
}
