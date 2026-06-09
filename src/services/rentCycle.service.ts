import { prisma } from "../db/index.js";
import { AppError } from "../utils/apiResponse.js";
import type { PaymentMethod } from "@prisma/client";
import { createFlatNotifications } from "./notification.service.js";

export async function createRentCycle(
  flatId: string,
  month: string,
  amountPerPerson: number,
  dueDate: string,
  actorId: string
) {
  // Check no open cycle exists
  const openCycle = await prisma.rentCycle.findFirst({
    where: { flatId, isClosed: false },
  });
  if (openCycle) {
    throw new AppError(409, "OPEN_CYCLE_EXISTS", `An open rent cycle already exists for ${openCycle.month}`);
  }

  // Get all active members
  const members = await prisma.membership.findMany({
    where: { flatId, isActive: true },
  });

  const cycle = await prisma.$transaction(async (tx) => {
    const newCycle = await tx.rentCycle.create({
      data: {
        flatId,
        month,
        amountPerPerson,
        dueDate: new Date(dueDate),
      },
    });

    // Create rent payment rows for all active members
    await tx.rentPayment.createMany({
      data: members.map((m) => ({
        rentCycleId: newCycle.id,
        userId: m.userId,
      })),
    });

    return newCycle;
  });

  const result = await prisma.rentCycle.findUnique({
    where: { id: cycle.id },
    include: {
      payments: {
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      },
    },
  });

  await createFlatNotifications(
    flatId,
    actorId,
    "RENT_CREATED",
    "Rent Cycle Created",
    `${month} rent cycle created`
  );

  return result;
}

export async function getRentCycles(flatId: string) {
  const cycles = await prisma.rentCycle.findMany({
    where: { flatId },
    include: {
      payments: {
        select: { hasPaid: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return cycles.map((cycle) => ({
    ...cycle,
    paidCount: cycle.payments.filter((p) => p.hasPaid).length,
    totalCount: cycle.payments.length,
    payments: undefined,
  }));
}

export async function getRentCycleDetail(cycleId: string) {
  const cycle = await prisma.rentCycle.findUnique({
    where: { id: cycleId },
    include: {
      payments: {
        include: {
          user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        },
        orderBy: { user: { name: "asc" } },
      },
    },
  });

  if (!cycle) {
    throw new AppError(404, "CYCLE_NOT_FOUND", "Rent cycle not found");
  }

  return cycle;
}

export async function markAsPaid(cycleId: string, userId: string, method: PaymentMethod) {
  const cycle = await prisma.rentCycle.findUnique({ where: { id: cycleId } });
  if (!cycle) {
    throw new AppError(404, "CYCLE_NOT_FOUND", "Rent cycle not found");
  }
  if (cycle.isClosed) {
    throw new AppError(400, "CYCLE_CLOSED", "This rent cycle is already closed");
  }

  const payment = await prisma.rentPayment.findUnique({
    where: { rentCycleId_userId: { rentCycleId: cycleId, userId } },
  });
  if (!payment) {
    throw new AppError(404, "PAYMENT_NOT_FOUND", "No rent payment record found for this user");
  }
  if (payment.hasPaid) {
    throw new AppError(400, "ALREADY_PAID", "You have already marked this rent as paid");
  }

  const updated = await prisma.rentPayment.update({
    where: { id: payment.id },
    data: { hasPaid: true, paidAt: new Date(), method },
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
  });

  await createFlatNotifications(
    cycle.flatId,
    userId,
    "RENT_PAID",
    "Rent Paid",
    `${updated.user.name} paid ${cycle.month} rent`
  );

  return updated;
}

export async function closeCycle(cycleId: string) {
  const cycle = await prisma.rentCycle.findUnique({
    where: { id: cycleId },
    include: { payments: true },
  });

  if (!cycle) {
    throw new AppError(404, "CYCLE_NOT_FOUND", "Rent cycle not found");
  }
  if (cycle.isClosed) {
    throw new AppError(400, "ALREADY_CLOSED", "This cycle is already closed");
  }

  const unpaid = cycle.payments.filter((p) => !p.hasPaid);
  if (unpaid.length > 0) {
    throw new AppError(400, "NOT_ALL_PAID", `${unpaid.length} member(s) have not paid yet`);
  }

  const closed = await prisma.rentCycle.update({
    where: { id: cycleId },
    data: { isClosed: true },
  });

  return closed;
}
