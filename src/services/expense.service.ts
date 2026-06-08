import { prisma } from "../db/index.js";
import { AppError } from "../utils/apiResponse.js";
import type { Category, SplitType } from "@prisma/client";

interface CustomSplit {
  userId: string;
  amountOwed: number;
}

interface ExpenseFilters {
  category?: Category;
  month?: string;
  memberId?: string;
}

export async function addExpense(
  flatId: string,
  paidBy: string,
  title: string,
  amount: number,
  category: Category,
  splitType: SplitType,
  splitMembers: string[],
  customSplits?: CustomSplit[],
  note?: string
) {
  return await prisma.$transaction(async (tx) => {
    const expense = await tx.expense.create({
      data: {
        flatId,
        paidBy,
        title,
        amount,
        category,
        splitType,
        note,
      },
    });

    const splitData: { expenseId: string; userId: string; amountOwed: number }[] = [];

    if (splitType === "EQUAL") {
      // Members who owe money (everyone except the payer)
      const owingMembers = splitMembers.filter((id) => id !== paidBy);

      if (owingMembers.length === 0) {
        throw new AppError(400, "INVALID_SPLIT", "At least one other member must be included in the split");
      }

      const perPerson = Math.floor((amount * 100) / owingMembers.length) / 100;
      const totalDistributed = perPerson * owingMembers.length;
      const remainder = Math.round((amount - totalDistributed) * 100) / 100;

      owingMembers.forEach((userId, index) => {
        splitData.push({
          expenseId: expense.id,
          userId,
          amountOwed: index === 0 ? perPerson + remainder : perPerson,
        });
      });

      // Payer's own split row (they owe 0)
      if (splitMembers.includes(paidBy)) {
        splitData.push({
          expenseId: expense.id,
          userId: paidBy,
          amountOwed: 0,
        });
      }
    } else if (splitType === "CUSTOM") {
      if (!customSplits || customSplits.length === 0) {
        throw new AppError(400, "INVALID_SPLIT", "Custom splits are required for custom split type");
      }

      const total = customSplits.reduce((sum, s) => sum + s.amountOwed, 0);
      const roundedTotal = Math.round(total * 100) / 100;
      const roundedAmount = Math.round(amount * 100) / 100;

      if (roundedTotal !== roundedAmount) {
        throw new AppError(
          400,
          "SPLIT_SUM_MISMATCH",
          `Split amounts sum to ${roundedTotal} but expense amount is ${roundedAmount}`
        );
      }

      for (const split of customSplits) {
        splitData.push({
          expenseId: expense.id,
          userId: split.userId,
          amountOwed: split.userId === paidBy ? 0 : split.amountOwed,
        });
      }
    }

    await tx.split.createMany({ data: splitData });

    return await tx.expense.findUnique({
      where: { id: expense.id },
      include: {
        splits: {
          include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        },
        payer: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
  });
}

export async function getExpenses(
  flatId: string,
  page: number = 1,
  limit: number = 20,
  filters?: ExpenseFilters
) {
  const where: Record<string, unknown> = { flatId };

  if (filters?.category) {
    where.category = filters.category;
  }
  if (filters?.month) {
    const [year, month] = filters.month.split("-").map(Number);
    if (year && month) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);
      where.createdAt = { gte: startDate, lte: endDate };
    }
  }
  if (filters?.memberId) {
    where.paidBy = filters.memberId;
  }

  const [expenses, total] = await Promise.all([
    prisma.expense.findMany({
      where,
      include: {
        payer: { select: { id: true, name: true, avatarUrl: true } },
        splits: { select: { userId: true, amountOwed: true, isSettled: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.expense.count({ where }),
  ]);

  return {
    expenses,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getExpenseDetail(expenseId: string) {
  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    include: {
      payer: { select: { id: true, name: true, email: true, avatarUrl: true } },
      splits: {
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
      },
      comments: {
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!expense) {
    throw new AppError(404, "EXPENSE_NOT_FOUND", "Expense not found");
  }

  return expense;
}

export async function editExpense(
  expenseId: string,
  userId: string,
  updates: { title?: string; amount?: number; category?: Category; note?: string }
) {
  const expense = await prisma.expense.findUnique({ where: { id: expenseId } });

  if (!expense) {
    throw new AppError(404, "EXPENSE_NOT_FOUND", "Expense not found");
  }

  if (expense.paidBy !== userId) {
    throw new AppError(403, "NOT_PAYER", "Only the person who paid can edit this expense");
  }

  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  if (expense.createdAt < tenMinutesAgo) {
    throw new AppError(403, "EDIT_WINDOW_CLOSED", "Expenses can only be edited within 10 minutes of creation");
  }

  const updated = await prisma.expense.update({
    where: { id: expenseId },
    data: updates,
    include: {
      payer: { select: { id: true, name: true, avatarUrl: true } },
      splits: {
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      },
    },
  });

  return updated;
}

export async function deleteExpense(expenseId: string) {
  const expense = await prisma.expense.findUnique({ where: { id: expenseId } });
  if (!expense) {
    throw new AppError(404, "EXPENSE_NOT_FOUND", "Expense not found");
  }

  await prisma.expense.delete({ where: { id: expenseId } });
  return { success: true };
}
