import type { Request, Response, NextFunction } from "express";
import { createRentCycleSchema, markRentPaidSchema } from "../utils/validators.js";
import * as rentCycleService from "../services/rentCycle.service.js";
import { sendSuccess } from "../utils/apiResponse.js";
import type { PaymentMethod } from "@prisma/client";

export async function createRentCycle(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = createRentCycleSchema.parse(req.body);
    const cycle = await rentCycleService.createRentCycle(
      req.params.id!,
      data.month,
      data.amountPerPerson,
      data.dueDate,
      req.user!.userId
    );
    sendSuccess(res, cycle, 201);
  } catch (error) { next(error); }
}

export async function getRentCycles(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const cycles = await rentCycleService.getRentCycles(req.params.id!);
    sendSuccess(res, cycles);
  } catch (error) { next(error); }
}

export async function getRentCycleDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const cycle = await rentCycleService.getRentCycleDetail(req.params.cycleId!);
    sendSuccess(res, cycle);
  } catch (error) { next(error); }
}

export async function markAsPaid(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = markRentPaidSchema.parse(req.body);
    const payment = await rentCycleService.markAsPaid(
      req.params.cycleId!,
      req.user!.userId,
      data.method as PaymentMethod
    );
    sendSuccess(res, payment);
  } catch (error) { next(error); }
}

export async function closeCycle(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const cycle = await rentCycleService.closeCycle(req.params.cycleId!);
    sendSuccess(res, cycle);
  } catch (error) { next(error); }
}
