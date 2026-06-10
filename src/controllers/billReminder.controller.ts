import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../db/index.js";
import { markPaid, computeNextDueDate } from "../services/billReminderService.js";
import { AppError } from "../utils/apiResponse.js";
import type { Category, BillRecurrence } from "@prisma/client";

const createBillReminderSchema = z.object({
  title: z.string().min(1),
  amountEstimate: z.number().optional(),
  category: z.enum(["FOOD", "UTILITIES", "RENT", "TRANSPORT", "OTHER"]).optional(),
  recurrence: z.enum(["MONTHLY", "QUARTERLY", "BIANNUAL", "ANNUAL", "CUSTOM"]),
  recurrenceDay: z.number().min(1).max(28).optional(),
  customNextDate: z.string().optional(),
  responsibleMember: z.string().optional(),
  remindDaysBefore: z.number().default(3),
});

export async function createBillReminder(req: Request, res: Response) {
  const flatId = req.params.id as string;
  const adminId = req.user!.userId;
  const data = createBillReminderSchema.parse(req.body);

  const initialNextDate = computeNextDueDate({
    recurrence: data.recurrence as BillRecurrence,
    recurrenceDay: data.recurrenceDay || null,
    customNextDate: data.customNextDate ? new Date(data.customNextDate) : null,
  } as any);

  const reminder = await prisma.billReminder.create({
    data: {
      flatId,
      title: data.title,
      amountEstimate: data.amountEstimate,
      category: (data.category as Category) || "OTHER",
      recurrence: data.recurrence as BillRecurrence,
      recurrenceDay: data.recurrenceDay,
      customNextDate: data.customNextDate ? new Date(data.customNextDate) : null,
      responsibleMember: data.responsibleMember,
      remindDaysBefore: data.remindDaysBefore,
      createdBy: adminId,
      nextDueDate: initialNextDate,
    },
  });

  res.status(201).json({ success: true, data: reminder });
}

export async function getBillReminders(req: Request, res: Response) {
  const flatId = req.params.id as string;

  const reminders = await prisma.billReminder.findMany({
    where: { flatId, isActive: true },
    orderBy: { nextDueDate: "asc" },
    include: {
      responsible: { select: { id: true, name: true } },
    },
  });
  const formatted = reminders.map(r => ({
    ...r,
    responsibleMember: r.responsible
  }));

  res.json({ success: true, data: { reminders: formatted } });
}

export async function getBillReminder(req: Request, res: Response) {
  const remId = req.params.remId as string;

  const reminder = await prisma.billReminder.findUnique({
    where: { id: remId },
    include: {
      responsible: { select: { id: true, name: true } },
    },
  });

  if (!reminder) throw new AppError(404, "NOT_FOUND", "Bill reminder not found");

  const formatted = {
    ...reminder,
    responsibleMember: reminder.responsible
  };

  res.json({ success: true, data: { reminder: formatted } });
}

export async function markBillPaid(req: Request, res: Response) {
  const remId = req.params.remId as string;
  const userId = req.user!.userId;
  const isAdmin = req.membership?.role === "ADMIN";
  const { createExpense, expenseNote } = req.body;

  const result = await markPaid(remId, userId, isAdmin, !!createExpense, expenseNote);
  res.json({ success: true, data: result });
}

export async function deleteBillReminder(req: Request, res: Response) {
  const remId = req.params.remId as string;
  await prisma.billReminder.update({
    where: { id: remId },
    data: { isActive: false },
  });

  res.json({ success: true, data: { message: "Bill reminder deleted" } });
}
