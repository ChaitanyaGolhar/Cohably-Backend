import type { Request, Response, NextFunction } from "express";
import { createSettlementSchema, paginationSchema } from "../utils/validators.js";
import * as settlementService from "../services/settlement.service.js";
import { sendSuccess } from "../utils/apiResponse.js";
import type { PaymentMethod } from "@prisma/client";

export async function recordSettlement(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = createSettlementSchema.parse(req.body);
    const settlement = await settlementService.recordSettlement(
      req.params.id!,
      req.user!.userId,
      data.toUser,
      data.amount,
      data.method as PaymentMethod,
      data.note
    );
    sendSuccess(res, settlement, 201);
  } catch (error) { next(error); }
}

export async function getSettlements(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { page, limit } = paginationSchema.parse(req.query);
    const result = await settlementService.getSettlements(req.params.id!, page, limit);
    sendSuccess(res, result);
  } catch (error) { next(error); }
}
