import type { Response } from "express";

interface ApiSuccess<T> {
  success: true;
  data: T;
}

interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode: number = 200
): void {
  res.status(statusCode).json({
    success: true,
    data,
  } satisfies ApiSuccess<T>);
}

export function sendError(
  res: Response,
  code: string,
  message: string,
  statusCode: number = 400
): void {
  res.status(statusCode).json({
    success: false,
    error: { code, message },
  } satisfies ApiError);
}

/** Custom application error that controllers can throw */
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = "AppError";
  }
}
