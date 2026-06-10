import { prisma } from "../db/index.js";
import { AppError } from "../utils/apiResponse.js";
import { createDirectNotification, createFlatNotifications } from "./notification.service.js";
import type { TaskStatus } from "@prisma/client";

/**
 * Assign a task to a user.
 */
export async function assignTask(taskId: string, targetUserId: string, requesterId: string, isAdmin: boolean) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) {
    throw new AppError(404, "NOT_FOUND", "Task not found");
  }

  if (task.status === "COMPLETED" || task.status === "CANCELLED") {
    throw new AppError(400, "TASK_IMMUTABLE", "This task cannot be modified in its current state");
  }

  if (task.assignedTo && task.assignedTo !== requesterId && !isAdmin) {
    throw new AppError(403, "FORBIDDEN", "Only an admin can reassign a task already assigned to someone else");
  }

  const updatedTask = await prisma.task.update({
    where: { id: taskId },
    data: { assignedTo: targetUserId },
  });

  // Notifications
  if (targetUserId !== requesterId) {
    await createDirectNotification(
      targetUserId,
      task.flatId,
      "TASK_ASSIGNED" as any,
      "Task Assigned",
      `You have been assigned to task: ${task.title}`
    );
  }

  return updatedTask;
}

/**
 * Mark a task as completed.
 */
export async function completeTask(taskId: string, requesterId: string, isAdmin: boolean) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) {
    throw new AppError(404, "NOT_FOUND", "Task not found");
  }

  if (task.status === "COMPLETED" || task.status === "CANCELLED") {
    throw new AppError(400, "TASK_IMMUTABLE", "This task cannot be modified in its current state");
  }

  if (task.assignedTo && task.assignedTo !== requesterId && !isAdmin) {
    throw new AppError(403, "NOT_ASSIGNED", "Only the assigned member or admin can complete this task");
  }

  const updatedTask = await prisma.task.update({
    where: { id: taskId },
    data: { 
      status: "COMPLETED", 
      completedAt: new Date(), 
      completedBy: requesterId 
    },
  });

  // Notify creator and admin if they aren't the completer
  // For simplicity here, we notify everyone except the completer, or we can use the specific logic.
  // The PRD says: "Task completed -> Task creator + flat admin (if neither is the completer)"
  // Since we don't have a specific group target easily accessible, we will query them and use createDirectNotification.
  const flat = await prisma.flat.findUnique({
    where: { id: task.flatId },
    include: { memberships: { where: { role: "ADMIN" } } }
  });

  const admins = flat?.memberships.map(m => m.userId) || [];
  const notifyUsers = new Set<string>();
  
  if (task.createdBy !== requesterId) {
    notifyUsers.add(task.createdBy);
  }
  
  for (const adminId of admins) {
    if (adminId !== requesterId) {
      notifyUsers.add(adminId);
    }
  }

  for (const userId of notifyUsers) {
    await createDirectNotification(
      userId,
      task.flatId,
      "TASK_COMPLETED" as any,
      "Task Completed",
      `The task '${task.title}' has been completed.`
    );
  }

  return updatedTask;
}
