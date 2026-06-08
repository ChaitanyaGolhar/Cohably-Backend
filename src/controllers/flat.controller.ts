import type { Request, Response, NextFunction } from "express";
import { createFlatSchema, joinFlatSchema } from "../utils/validators.js";
import * as flatService from "../services/flat.service.js";
import { sendSuccess } from "../utils/apiResponse.js";

export async function createFlat(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = createFlatSchema.parse(req.body);
    const flat = await flatService.createFlat(data.name, req.user!.userId);
    sendSuccess(res, flat, 201);
  } catch (error) { next(error); }
}

export async function joinFlat(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = joinFlatSchema.parse(req.body);
    const result = await flatService.joinFlat(data.inviteCode, req.user!.userId);
    sendSuccess(res, result);
  } catch (error) { next(error); }
}

export async function getFlatDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const flat = await flatService.getFlatDetails(req.params.id!);
    sendSuccess(res, flat);
  } catch (error) { next(error); }
}

export async function getMembers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const members = await flatService.getMembers(req.params.id!);
    sendSuccess(res, members);
  } catch (error) { next(error); }
}

export async function removeMember(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await flatService.removeMember(req.params.id!, req.params.userId!, req.user!.userId);
    sendSuccess(res, result);
  } catch (error) { next(error); }
}

export async function regenerateInviteCode(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await flatService.regenerateInviteCode(req.params.id!);
    sendSuccess(res, result);
  } catch (error) { next(error); }
}
