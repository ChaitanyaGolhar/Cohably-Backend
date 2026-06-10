import { prisma } from "../db/index.js";
import { AppError } from "../utils/apiResponse.js";
import type { BillReminder } from "@prisma/client";

/**
 * Compute the next due date based on recurrence pattern.
 */
export function computeNextDueDate(reminder: BillReminder, fromDate: Date = new Date()): Date {
  const next = new Date(fromDate);
  
  switch (reminder.recurrence) {
    case "MONTHLY":
      const day = reminder.recurrenceDay || 1;
      next.setDate(day);
      if (next <= fromDate) {
        next.setMonth(next.getMonth() + 1);
      }
      break;
    case "QUARTERLY":
      next.setMonth(next.getMonth() + 3);
      break;
    case "BIANNUAL":
      next.setMonth(next.getMonth() + 6);
      break;
    case "ANNUAL":
      next.setFullYear(next.getFullYear() + 1);
      break;
    case "CUSTOM":
      // Handled manually by user, but we'll default to next month if nothing is provided
      if (reminder.customNextDate && reminder.customNextDate > fromDate) {
        return reminder.customNextDate;
      }
      next.setMonth(next.getMonth() + 1);
      break;
  }
  
  return next;
}

/**
 * Marks a bill as paid, computes next due date, and optionally creates an expense.
 */
export async function markPaid(
  reminderId: string, 
  userId: string, 
  isAdmin: boolean, 
  createExpense: boolean, 
  expenseNote?: string
) {
  const reminder = await prisma.billReminder.findUnique({ where: { id: reminderId } });
  
  if (!reminder) {
    throw new AppError(404, "NOT_FOUND", "Bill reminder not found");
  }

  if (reminder.responsibleMember && reminder.responsibleMember !== userId && !isAdmin) {
    throw new AppError(403, "NOT_RESPONSIBLE", "Only the responsible member or admin can mark this bill as paid");
  }

  const newNextDate = computeNextDueDate(reminder);

  const updatedReminder = await prisma.billReminder.update({
    where: { id: reminderId },
    data: {
      lastTriggeredAt: new Date(),
      nextDueDate: newNextDate,
    },
  });

  let createdExpenseId: string | undefined;

  if (createExpense && reminder.amountEstimate) {
    const expense = await prisma.expense.create({
      data: {
        flatId: reminder.flatId,
        paidBy: userId,
        title: reminder.title,
        amount: reminder.amountEstimate,
        category: reminder.category,
        note: expenseNote || `Auto-created from bill reminder`,
        splitType: "EQUAL",
      },
    });

    createdExpenseId = expense.id;

    // Generate equal splits for all active flat members
    const members = await prisma.membership.findMany({
      where: { flatId: reminder.flatId, isActive: true },
    });

    const splitAmount = Number(reminder.amountEstimate) / members.length;

    await prisma.split.createMany({
      data: members.map((m) => ({
        expenseId: expense.id,
        userId: m.userId,
        amountOwed: splitAmount,
        isSettled: m.userId === userId, // The payer's own split is settled
      })),
    });
  }

  return { reminder: updatedReminder, expenseId: createdExpenseId };
}
