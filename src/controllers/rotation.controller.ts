import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../db/index.js";
import { AppError } from "../utils/apiResponse.js";
import { createNextCycle } from "../services/rotationEngine.js";

const createRotationSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  frequency: z.enum(["DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY", "ON_DEMAND"]),
  frequencyDay: z.number().min(0).max(28).optional(),
  memberIds: z.array(z.string()).min(2, "A rotation requires at least 2 members"),
});

export async function createRotation(req: Request, res: Response) {
  const flatId = req.params.id as string;
  const adminId = req.user!.userId;
  const data = createRotationSchema.parse(req.body);

  const rotation = await prisma.rotation.create({
    data: {
      flatId,
      name: data.name,
      description: data.description,
      frequency: data.frequency,
      frequencyDay: data.frequencyDay,
      createdBy: adminId,
      members: {
        create: data.memberIds.map((userId) => ({
          userId,
        })),
      },
    },
  });

  // Create first cycle if not on_demand
  if (rotation.frequency !== "ON_DEMAND") {
    await createNextCycle(rotation.id);
  }

  res.status(201).json({ success: true, data: rotation });
}

export async function getRotations(req: Request, res: Response) {
  const flatId = req.params.id as string;
  const rotations = await prisma.rotation.findMany({
    where: { flatId, isActive: true },
    include: {
      cycles: {
        where: { status: "PENDING" },
        include: { assignedUser: { select: { id: true, name: true } } },
      },
      _count: {
        select: { members: { where: { isActive: true } } }
      }
    },
  });

  // Format to match PRD
  const formatted = rotations.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    frequency: r.frequency,
    isActive: r.isActive,
    currentCycle: r.cycles[0] ? {
      ...r.cycles[0],
      assignedTo: r.cycles[0].assignedUser
    } : null,
    memberCount: r._count.members,
  }));

  res.json({ success: true, data: { rotations: formatted } });
}

export async function completeCycle(req: Request, res: Response) {
  const rotId = req.params.rotId as string;
  const cycleId = req.params.cycleId as string;
  const userId = req.user!.userId;
  const isAdmin = req.membership?.role === "ADMIN";

  const cycle = await prisma.rotationCycle.findUnique({
    where: { id: cycleId },
    include: { rotation: true },
  });

  if (!cycle || cycle.rotationId !== rotId) {
    throw new AppError(404, "NOT_FOUND", "Cycle not found");
  }

  if (cycle.status !== "PENDING") {
    throw new AppError(400, "CYCLE_NOT_PENDING", "Only pending cycles can be completed");
  }

  if (cycle.assignedTo !== userId && !isAdmin) {
    throw new AppError(403, "NOT_ASSIGNED", "Only the assigned member or admin can complete this cycle");
  }

  // Transaction: complete cycle, log it, create next cycle
  await prisma.$transaction(async (tx) => {
    await tx.rotationCycle.update({
      where: { id: cycleId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        completedBy: userId,
      },
    });

    await tx.rotationLog.create({
      data: {
        rotationId: rotId,
        rotationCycleId: cycleId,
        userId: cycle.assignedTo,
        outcome: "COMPLETED",
      },
    });
  });

  // Try to create next cycle (outside transaction since it handles its own failures gracefully)
  if (cycle.rotation.frequency !== "ON_DEMAND") {
    await createNextCycle(rotId);
  }

  res.json({ success: true, data: { message: "Cycle completed" } });
}

export async function skipCycle(req: Request, res: Response) {
  const rotId = req.params.rotId as string;
  const cycleId = req.params.cycleId as string;
  const { reason } = req.body;

  if (!reason) {
    throw new AppError(400, "BAD_REQUEST", "Skip reason is required");
  }

  const cycle = await prisma.rotationCycle.findUnique({
    where: { id: cycleId },
    include: { rotation: true },
  });

  if (!cycle || cycle.rotationId !== rotId) throw new AppError(404, "NOT_FOUND", "Cycle not found");
  if (cycle.status !== "PENDING") throw new AppError(400, "CYCLE_NOT_PENDING", "Only pending cycles can be skipped");

  await prisma.$transaction(async (tx) => {
    await tx.rotationCycle.update({
      where: { id: cycleId },
      data: { status: "SKIPPED", skipReason: reason },
    });
    
    await tx.rotationLog.create({
      data: {
        rotationId: rotId,
        rotationCycleId: cycleId,
        userId: cycle.assignedTo,
        outcome: "SKIPPED",
      },
    });
  });

  if (cycle.rotation.frequency !== "ON_DEMAND") {
    await createNextCycle(rotId);
  }

  res.json({ success: true, data: { message: "Cycle skipped" } });
}

// Additional basic CRUD handlers...
export async function getRotation(req: Request, res: Response) {
  const rotId = req.params.rotId as string;
  const rotation = await prisma.rotation.findUnique({
    where: { id: rotId },
    include: {
      members: { include: { user: { select: { id: true, name: true } } } },
      cycles: { where: { status: "PENDING" }, take: 1, include: { assignedUser: { select: { id: true, name: true } } } },
      logs: { orderBy: { loggedAt: "desc" }, take: 5, include: { user: { select: { id: true, name: true } } } }
    }
  });

  if (!rotation) throw new AppError(404, "NOT_FOUND", "Rotation not found");
  
  const currentCycle = rotation.cycles[0] ? {
    ...rotation.cycles[0],
    assignedTo: rotation.cycles[0].assignedUser
  } : null;

  const formattedRotation = {
    ...rotation,
    currentCycle,
  };

  res.json({ success: true, data: { rotation: formattedRotation } });
}

export async function deleteRotation(req: Request, res: Response) {
  const rotId = req.params.rotId as string;
  await prisma.rotation.update({ where: { id: rotId }, data: { isActive: false } });
  res.json({ success: true, data: { message: "Rotation deleted" } });
}
