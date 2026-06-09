import { Router } from "express";
import * as notificationController from "../controllers/notification.controller.js";
import { authGuard } from "../middleware/auth.middleware.js";

const router = Router();

router.get("/", authGuard, notificationController.getNotifications);
router.get("/unread-count", authGuard, notificationController.getUnreadCount);
router.patch("/read-all", authGuard, notificationController.markAllAsRead);
router.patch("/:id/read", authGuard, notificationController.markAsRead);

export default router;
