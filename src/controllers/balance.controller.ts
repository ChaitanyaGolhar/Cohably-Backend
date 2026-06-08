import type { Request, Response, NextFunction } from "express";
import * as balanceService from "../services/balance.service.js";
import { sendSuccess } from "../utils/apiResponse.js";

export async function getBalances(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const matrix = await balanceService.getBalanceMatrix(req.params.id!);
    sendSuccess(res, matrix);
  } catch (error) { next(error); }
}

export async function getMyBalances(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const balances = await balanceService.getMyBalances(req.params.id!, req.user!.userId);
    sendSuccess(res, balances);
  } catch (error) { next(error); }
}
