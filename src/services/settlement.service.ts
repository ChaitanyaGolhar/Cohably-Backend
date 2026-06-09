import { prisma } from "../db/index.js";
import { AppError } from "../utils/apiResponse.js";
import type { PaymentMethod } from "@prisma/client";
import { createFlatNotifications } from "./notification.service.js";

export async function recordSettlement(
  flatId: string,
  fromUserId: string,
  toUserId: string,
  amount: number,
  method: PaymentMethod,
  note?: string
) {
  if (fromUserId === toUserId) {
    throw new AppError(400, "SELF_SETTLEMENT", "Cannot settle with yourself");
  }

  // Validate both users are active members
  const [fromMember, toMember] = await Promise.all([
    prisma.membership.findUnique({ where: { flatId_userId: { flatId, userId: fromUserId } } }),
    prisma.membership.findUnique({ where: { flatId_userId: { flatId, userId: toUserId } } }),
  ]);

  if (!fromMember?.isActive) {
    throw new AppError(404, "MEMBER_NOT_FOUND", "Payer is not an active member of this flat");
  }
  if (!toMember?.isActive) {
    throw new AppError(404, "MEMBER_NOT_FOUND", "Recipient is not an active member of this flat");
  }

  const settlement = await prisma.settlement.create({
    data: { flatId, fromUser: fromUserId, toUser: toUserId, amount, method, note },
    include: {
      payer: { select: { id: true, name: true, avatarUrl: true } },
      payee: { select: { id: true, name: true, avatarUrl: true } },
    },
  });

  await createFlatNotifications(
    flatId,
    fromUserId,
    "SETTLEMENT_CREATED",
    "Payment Settled",
    `${settlement.payer.name} settled ₹${amount} with ${settlement.payee.name}`
  );

  return settlement;
}

export async function getSettlements(flatId: string, page: number = 1, limit: number = 20, filters?: { withUser?: string; currentUserId?: string }) {
  const where: Record<string, any> = { flatId };

  if (filters?.withUser && filters?.currentUserId) {
    where.OR = [
      { fromUser: filters.currentUserId, toUser: filters.withUser },
      { fromUser: filters.withUser, toUser: filters.currentUserId },
    ];
  }

  const [settlements, total] = await Promise.all([
    prisma.settlement.findMany({
      where,
      include: {
        payer: { select: { id: true, name: true, avatarUrl: true } },
        payee: { select: { id: true, name: true, avatarUrl: true } },
      },
      orderBy: { settledAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.settlement.count({ where }),
  ]);

  return {
    settlements,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}
