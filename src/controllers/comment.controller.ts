import type { Request, Response, NextFunction } from "express";
import { createCommentSchema } from "../utils/validators.js";
import * as commentService from "../services/comment.service.js";
import { sendSuccess } from "../utils/apiResponse.js";

export async function addComment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = createCommentSchema.parse(req.body);
    const comment = await commentService.addComment(req.params.expId!, req.user!.userId, data.message);
    sendSuccess(res, comment, 201);
  } catch (error) { next(error); }
}

export async function getComments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const comments = await commentService.getComments(req.params.expId!);
    sendSuccess(res, comments);
  } catch (error) { next(error); }
}

export async function toggleDispute(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const expense = await commentService.toggleDispute(req.params.expId!, req.user!.userId);
    sendSuccess(res, expense);
  } catch (error) { next(error); }
}

export async function resolveDispute(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const expense = await commentService.resolveDispute(req.params.expId!);
    sendSuccess(res, expense);
  } catch (error) { next(error); }
}
