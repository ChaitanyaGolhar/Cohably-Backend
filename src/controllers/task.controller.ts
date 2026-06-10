import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../db/index.js";
import { assignTask, completeTask } from "../services/taskService.js";
import { AppError } from "../utils/apiResponse.js";
import type { TaskPriority } from "@prisma/client";

const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  assignedTo: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  dueDate: z.string().optional(),
});

export async function createTask(req: Request, res: Response) {
  const flatId = req.params.id as string;
  const userId = req.user!.userId;
  const isAdmin = req.membership?.role === "ADMIN";
  const data = createTaskSchema.parse(req.body);

  const task = await prisma.task.create({
    data: {
      flatId,
      title: data.title,
      description: data.description,
      priority: (data.priority as TaskPriority) || "MEDIUM",
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      createdBy: userId,
      // If unassigned, null. If assigned, we will use the service logic right after creation to send notification.
    },
  });

  if (data.assignedTo) {
    await assignTask(task.id, data.assignedTo, userId, isAdmin);
  }

  const updatedTask = await prisma.task.findUnique({ where: { id: task.id } });
  res.status(201).json({ success: true, data: updatedTask });
}

export async function getTasks(req: Request, res: Response) {
  const flatId = req.params.id as string;
  const { status, assignedTo, priority, page = "1", limit = "20" } = req.query;

  const where: any = { flatId };
  if (status) {
    const statuses = (status as string).split(',');
    where.status = statuses.length > 1 ? { in: statuses } : statuses[0];
  }
  if (assignedTo) where.assignedTo = assignedTo;
  if (priority) where.priority = priority;

  const take = parseInt(limit as string, 10);
  const skip = (parseInt(page as string, 10) - 1) * take;

  const [tasks, total] = await Promise.all([
    prisma.task.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: {
        creator: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true } },
      },
    }),
    prisma.task.count({ where }),
  ]);

  res.json({
    success: true,
    data: {
      tasks,
      pagination: {
        page: parseInt(page as string, 10),
        limit: take,
        total,
        hasMore: skip + take < total,
      },
    },
  });
}

export async function updateTaskAssignee(req: Request, res: Response) {
  const taskId = req.params.taskId as string;
  const { assignedTo } = req.body;
  const userId = req.user!.userId;
  const isAdmin = req.membership?.role === "ADMIN";

  if (!assignedTo) throw new AppError(400, "BAD_REQUEST", "assignedTo is required");

  const task = await assignTask(taskId, assignedTo, userId, isAdmin);
  res.json({ success: true, data: task });
}

export async function completeTaskController(req: Request, res: Response) {
  const taskId = req.params.taskId as string;
  const userId = req.user!.userId;
  const isAdmin = req.membership?.role === "ADMIN";

  const task = await completeTask(taskId, userId, isAdmin);
  res.json({ success: true, data: task });
}

export async function cancelTask(req: Request, res: Response) {
  const taskId = req.params.taskId as string;
  const userId = req.user!.userId;
  const isAdmin = req.membership?.role === "ADMIN";

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new AppError(404, "NOT_FOUND", "Task not found");
  if (task.status === "COMPLETED" || task.status === "CANCELLED") {
    throw new AppError(400, "TASK_IMMUTABLE", "Task cannot be cancelled in its current state");
  }

  if (task.createdBy !== userId && !isAdmin) {
    throw new AppError(403, "FORBIDDEN", "Only creator or admin can cancel the task");
  }

  await prisma.task.update({
    where: { id: taskId },
    data: { status: "CANCELLED" },
  });

  res.json({ success: true, data: { message: "Task cancelled" } });
}

export async function getTask(req: Request, res: Response) {
  const taskId = req.params.taskId as string;

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      creator: { select: { id: true, name: true, avatarUrl: true } },
      assignee: { select: { id: true, name: true, avatarUrl: true } },
    },
  });

  if (!task) throw new AppError(404, "NOT_FOUND", "Task not found");
  res.json({ success: true, data: { task } });
}

export async function markInProgress(req: Request, res: Response) {
  const taskId = req.params.taskId as string;
  const userId = req.user!.userId;
  const isAdmin = req.membership?.role === "ADMIN";

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new AppError(404, "NOT_FOUND", "Task not found");

  if (task.assignedTo !== userId && !isAdmin) {
    throw new AppError(403, "FORBIDDEN", "Only the assignee or admin can mark in progress");
  }

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: { status: "IN_PROGRESS" },
  });

  res.json({ success: true, data: updated });
}
