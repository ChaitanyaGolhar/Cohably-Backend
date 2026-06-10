import { prisma } from "../db/index.js";
import { AppError } from "../utils/apiResponse.js";
import { createDirectNotification } from "./notification.service.js";

/**
 * Finds the fairest member to take on the next cycle of a rotation.
 * Follows the algorithm:
 * 1. Active members only.
 * 2. Fewest completed cycles for this rotation.
 * 3. Tie-breaker: earliest joined.
 */
export async function getNextAssignee(rotationId: string) {
  const rotation = await prisma.rotation.findUnique({
    where: { id: rotationId },
    include: {
      members: {
        where: { isActive: true },
      },
    },
  });

  if (!rotation) {
    throw new AppError(404, "NOT_FOUND", "Rotation not found");
  }

  if (rotation.members.length < 2) {
    throw new AppError(400, "ROTATION_MIN_MEMBERS", "A rotation requires at least 2 active members to assign cycles.");
  }

  // Get completion counts
  const memberIds = rotation.members.map((m) => m.userId);

  const completionCounts = await prisma.rotationLog.groupBy({
    by: ["userId"],
    where: {
      rotationId,
      outcome: "COMPLETED",
      userId: { in: memberIds },
    },
    _count: {
      id: true,
    },
  });

  const countMap = new Map<string, number>();
  for (const row of completionCounts) {
    countMap.set(row.userId, row._count.id);
  }

  // Sort members based on logic
  const sortedMembers = [...rotation.members].sort((a, b) => {
    const countA = countMap.get(a.userId) || 0;
    const countB = countMap.get(b.userId) || 0;

    if (countA !== countB) {
      return countA - countB;
    }

    // Tie-breaker: earliest join date
    return (a.joinedAt?.getTime() || 0) - (b.joinedAt?.getTime() || 0);
  });

  return sortedMembers[0].userId;
}

/**
 * Computes the due date for the next cycle based on frequency.
 */
function computeDueDate(frequency: string, frequencyDay: number | null): Date {
  const now = new Date();
  
  if (frequency === "DAILY") {
    now.setDate(now.getDate() + 1);
    return now;
  }
  
  if (frequency === "WEEKLY") {
    const dayOfWeek = frequencyDay ?? 0; // 0=Sun, 6=Sat
    let daysUntil = dayOfWeek - now.getDay();
    if (daysUntil <= 0) daysUntil += 7; // Next week's occurrence
    now.setDate(now.getDate() + daysUntil);
    return now;
  }
  
  if (frequency === "BIWEEKLY") {
    const dayOfWeek = frequencyDay ?? 0;
    let daysUntil = dayOfWeek - now.getDay();
    if (daysUntil <= 0) daysUntil += 14;
    else daysUntil += 7; // BIWEEKLY means skip a week
    now.setDate(now.getDate() + daysUntil);
    return now;
  }
  
  if (frequency === "MONTHLY") {
    const dayOfMonth = frequencyDay ?? 1;
    let target = new Date(now.getFullYear(), now.getMonth(), dayOfMonth);
    if (target <= now) {
      target = new Date(now.getFullYear(), now.getMonth() + 1, dayOfMonth);
    }
    return target;
  }
  
  // ON_DEMAND defaults to 3 days from now if triggered
  now.setDate(now.getDate() + 3);
  return now;
}

/**
 * Creates the next cycle for a rotation using the fair assignment engine.
 */
export async function createNextCycle(rotationId: string) {
  // Check if there is already a pending cycle
  const existingPending = await prisma.rotationCycle.findFirst({
    where: { rotationId, status: "PENDING" },
  });

  if (existingPending) {
    throw new AppError(409, "CYCLE_ALREADY_PENDING", "A pending cycle already exists for this rotation.");
  }

  const rotation = await prisma.rotation.findUnique({
    where: { id: rotationId },
  });

  if (!rotation || !rotation.isActive) {
    throw new AppError(400, "INACTIVE_ROTATION", "Cannot create cycle for an inactive rotation.");
  }

  const assigneeId = await getNextAssignee(rotationId);
  
  // Get last cycle number
  const lastCycle = await prisma.rotationCycle.findFirst({
    where: { rotationId },
    orderBy: { cycleNumber: "desc" },
  });
  
  const nextCycleNumber = lastCycle ? lastCycle.cycleNumber + 1 : 1;
  const dueDate = computeDueDate(rotation.frequency, rotation.frequencyDay);

  const cycle = await prisma.rotationCycle.create({
    data: {
      rotationId,
      assignedTo: assigneeId,
      dueDate,
      cycleNumber: nextCycleNumber,
      status: "PENDING",
    },
  });

  // Notify the assigned user
  await createDirectNotification(
    assigneeId,
    rotation.flatId,
    "ROTATION_ASSIGNED" as any,
    "New Rotation Assignment",
    `You have been assigned to ${rotation.name} for Cycle ${nextCycleNumber}`
  );

  return cycle;
}
