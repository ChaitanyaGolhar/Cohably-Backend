import type { Request, Response, NextFunction } from "express";
import * as notificationService from "../services/notification.service.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { paginationSchema } from "../utils/validators.js";

export async function getNotifications(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { page, limit } = paginationSchema.parse(req.query);
    const result = await notificationService.getNotifications(req.user!.userId, page, limit);
    sendSuccess(res, result);
  } catch (error) { next(error); }
}

export async function getUnreadCount(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await notificationService.getUnreadCount(req.user!.userId);
    sendSuccess(res, result);
  } catch (error) { next(error); }
}

export async function markAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await notificationService.markAsRead(req.params.id!, req.user!.userId);
    sendSuccess(res, result);
  } catch (error) { next(error); }
}

export async function markAllAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await notificationService.markAllAsRead(req.user!.userId);
    sendSuccess(res, result);
  } catch (error) { next(error); }
}
