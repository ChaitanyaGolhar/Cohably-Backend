import type { Request, Response, NextFunction } from "express";
import { createExpenseSchema, updateExpenseSchema, paginationSchema } from "../utils/validators.js";
import * as expenseService from "../services/expense.service.js";
import { sendSuccess } from "../utils/apiResponse.js";
import type { Category } from "@prisma/client";

export async function addExpense(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = createExpenseSchema.parse(req.body);
    const expense = await expenseService.addExpense(
      req.params.id!,
      req.user!.userId,
      data.title,
      data.amount,
      data.category as Category,
      data.splitType as "EQUAL" | "CUSTOM",
      data.splitMembers,
      data.customSplits,
      data.note
    );
    sendSuccess(res, expense, 201);
  } catch (error) { next(error); }
}

export async function getExpenses(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { page, limit } = paginationSchema.parse(req.query);
    const filters = {
      category: req.query.category as Category | undefined,
      month: req.query.month as string | undefined,
      memberId: req.query.memberId as string | undefined,
    };
    const result = await expenseService.getExpenses(req.params.id!, page, limit, filters);
    sendSuccess(res, result);
  } catch (error) { next(error); }
}

export async function getExpenseDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const expense = await expenseService.getExpenseDetail(req.params.expId!);
    sendSuccess(res, expense);
  } catch (error) { next(error); }
}

export async function editExpense(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = updateExpenseSchema.parse(req.body);
    const expense = await expenseService.editExpense(req.params.expId!, req.user!.userId, data);
    sendSuccess(res, expense);
  } catch (error) { next(error); }
}

export async function deleteExpense(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await expenseService.deleteExpense(req.params.expId!);
    sendSuccess(res, result);
  } catch (error) { next(error); }
}
