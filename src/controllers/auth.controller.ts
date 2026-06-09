import type { Request, Response, NextFunction } from 'express';
import { signupSchema, loginSchema } from '../utils/validators.js';
import * as authService from '../services/auth.service.js';
import { sendSuccess } from '../utils/apiResponse.js';

export async function signup(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = signupSchema.parse(req.body);
    const result = await authService.signup(data.name, data.email, data.password);
    sendSuccess(res, result, 201);
  } catch (error) { next(error); }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = loginSchema.parse(req.body);
    const result = await authService.login(data.email, data.password);
    sendSuccess(res, result);
  } catch (error) { next(error); }
}

export async function me(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId;
    const profile = await authService.getProfile(userId);
    sendSuccess(res, profile);
  } catch (error) { next(error); }
}

export async function updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { name } = req.body;
    if (!name || name.trim().length < 2) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Name must be at least 2 characters' } });
      return;
    }
    const profile = await authService.updateProfile(userId, name.trim());
    sendSuccess(res, profile);
  } catch (error) { next(error); }
}
