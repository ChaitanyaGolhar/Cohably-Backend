import { prisma } from "../db/index.js";
import { AppError } from "../utils/apiResponse.js";
import type { NotificationType } from "@prisma/client";

/**
 * Creates notifications for all active flat members except the actor.
 */
export async function createFlatNotifications(
  flatId: string,
  actorId: string,
  type: NotificationType,
  title: string,
  message: string
) {
  // 1. Fetch all active members of the flat
  const members = await prisma.membership.findMany({
    where: { flatId, isActive: true },
    select: { userId: true },
  });

  // 2. Filter out the actor (the person who triggered the event)
  const recipients = members.filter((m) => m.userId !== actorId);

  if (recipients.length === 0) {
    return; // No one to notify
  }

  // 3. Batch insert notifications
  const data = recipients.map((m) => ({
    userId: m.userId,
    flatId,
    type,
    title,
    message,
  }));

  await prisma.notification.createMany({
    data,
  });
}

/**
 * Retrieves paginated notifications for a user.
 */
export async function getNotifications(
  userId: string,
  page: number = 1,
  limit: number = 20
) {
  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        flat: { select: { id: true, name: true } },
      },
    }),
    prisma.notification.count({ where: { userId } }),
  ]);

  return {
    notifications,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Gets the count of unread notifications for a user.
 */
export async function getUnreadCount(userId: string) {
  const count = await prisma.notification.count({
    where: { userId, isRead: false },
  });

  return { count };
}

/**
 * Marks a specific notification as read.
 */
export async function markAsRead(notificationId: string, userId: string) {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification) {
    throw new AppError(404, "NOT_FOUND", "Notification not found");
  }

  if (notification.userId !== userId) {
    throw new AppError(403, "FORBIDDEN", "You can only modify your own notifications");
  }

  await prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });

  return { success: true };
}

/**
 * Marks all unread notifications as read for a user.
 */
export async function markAllAsRead(userId: string) {
  await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });

  return { success: true };
}
