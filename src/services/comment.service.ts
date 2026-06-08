import { prisma } from "../db/index.js";
import { AppError } from "../utils/apiResponse.js";

export async function addComment(expenseId: string, userId: string, message: string) {
  const expense = await prisma.expense.findUnique({ where: { id: expenseId } });
  if (!expense) {
    throw new AppError(404, "EXPENSE_NOT_FOUND", "Expense not found");
  }

  const comment = await prisma.expenseComment.create({
    data: { expenseId, userId, message },
    include: {
      user: { select: { id: true, name: true, avatarUrl: true } },
    },
  });

  return comment;
}

export async function getComments(expenseId: string) {
  const comments = await prisma.expenseComment.findMany({
    where: { expenseId },
    include: {
      user: { select: { id: true, name: true, avatarUrl: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return comments;
}

export async function toggleDispute(expenseId: string, userId: string) {
  const expense = await prisma.expense.findUnique({ where: { id: expenseId } });
  if (!expense) {
    throw new AppError(404, "EXPENSE_NOT_FOUND", "Expense not found");
  }

  if (expense.paidBy === userId) {
    throw new AppError(400, "PAYER_CANNOT_DISPUTE", "The person who paid cannot dispute their own expense");
  }

  const updated = await prisma.expense.update({
    where: { id: expenseId },
    data: { isDisputed: true },
  });

  return updated;
}

export async function resolveDispute(expenseId: string) {
  const expense = await prisma.expense.findUnique({ where: { id: expenseId } });
  if (!expense) {
    throw new AppError(404, "EXPENSE_NOT_FOUND", "Expense not found");
  }

  const updated = await prisma.expense.update({
    where: { id: expenseId },
    data: { isDisputed: false },
  });

  return updated;
}
