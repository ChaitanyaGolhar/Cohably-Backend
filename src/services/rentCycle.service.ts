import { prisma } from "../db/index.js";
import { AppError } from "../utils/apiResponse.js";
import type { PaymentMethod, SplitType } from "@prisma/client";
import { createFlatNotifications } from "./notification.service.js";

interface CustomRentSplit {
  userId: string;
  amountOwed: number;
}

export async function createRentCycle(
  flatId: string,
  month: string,
  totalAmount: number,
  dueDate: string,
  splitType: SplitType,
  customSplits: CustomRentSplit[] | undefined,
  actorId: string
) {
  // Allow multiple active cycles, removed the check for openCycle

  const members = await prisma.membership.findMany({
    where: { flatId, isActive: true },
  });

  const cycle = await prisma.$transaction(async (tx) => {
    const newCycle = await tx.rentCycle.create({
      data: {
        flatId,
        month,
        totalAmount,
        splitType,
        dueDate: new Date(dueDate),
      },
    });

    const paymentData: { rentCycleId: string; userId: string; amountOwed: number }[] = [];

    if (splitType === "EQUAL") {
      const activeMembers = members;
      if (activeMembers.length === 0) throw new AppError(400, "NO_MEMBERS", "No active members in flat");

      const share = Math.floor((totalAmount * 100) / activeMembers.length) / 100;
      const totalDistributed = share * activeMembers.length;
      const remainder = Math.round((totalAmount - totalDistributed) * 100) / 100;

      let remainderAssigned = false;
      activeMembers.forEach((m) => {
        const owes = !remainderAssigned && remainder > 0 ? share + remainder : share;
        remainderAssigned = true;
        paymentData.push({
          rentCycleId: newCycle.id,
          userId: m.userId,
          amountOwed: owes,
        });
      });
    } else if (splitType === "CUSTOM") {
      if (!customSplits || customSplits.length === 0) {
        throw new AppError(400, "INVALID_SPLIT", "Custom splits required");
      }
      const total = customSplits.reduce((sum, s) => sum + s.amountOwed, 0);
      const roundedTotal = Math.round(total * 100) / 100;
      const roundedAmount = Math.round(totalAmount * 100) / 100;
      if (roundedTotal !== roundedAmount) {
        throw new AppError(400, "SPLIT_MISMATCH", "Split amounts do not equal total amount");
      }

      for (const split of customSplits) {
        paymentData.push({
          rentCycleId: newCycle.id,
          userId: split.userId,
          amountOwed: split.amountOwed,
        });
      }
    }

    await tx.rentPayment.createMany({ data: paymentData });

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

export async function approvePayment(cycleId: string, userId: string, adminId: string) {
  const payment = await prisma.rentPayment.findUnique({
    where: { rentCycleId_userId: { rentCycleId: cycleId, userId } },
    include: { rentCycle: true },
  });

  if (!payment) throw new AppError(404, "PAYMENT_NOT_FOUND", "Payment not found");
  if (!payment.hasPaid) throw new AppError(400, "NOT_PAID", "Cannot approve an unpaid rent");
  if (payment.isApproved) throw new AppError(400, "ALREADY_APPROVED", "Already approved");

  const updated = await prisma.rentPayment.update({
    where: { id: payment.id },
    data: { isApproved: true },
    include: { user: { select: { name: true } } },
  });

  return updated;
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
