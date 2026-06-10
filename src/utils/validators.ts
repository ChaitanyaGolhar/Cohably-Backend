import { z } from "zod";

// ──────────────────────────────────────────
// Auth Schemas
// ──────────────────────────────────────────

export const signupSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be 100 characters or less"),
  email: z.string().email("Invalid email format"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters"),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

// ──────────────────────────────────────────
// Flat Schemas
// ──────────────────────────────────────────

export const createFlatSchema = z.object({
  name: z
    .string()
    .min(1, "Flat name is required")
    .max(100, "Flat name must be 100 characters or less"),
});

export const joinFlatSchema = z.object({
  inviteCode: z
    .string()
    .min(6, "Invite code must be 6 characters")
    .max(10, "Invalid invite code"),
});

// ──────────────────────────────────────────
// Expense Schemas
// ──────────────────────────────────────────

const categoryEnum = z.enum(["FOOD", "UTILITIES", "RENT", "TRANSPORT", "OTHER"]);
const splitTypeEnum = z.enum(["EQUAL", "CUSTOM"]);

const splitItemSchema = z.object({
  userId: z.string().uuid("Invalid user ID"),
  amountOwed: z.number().min(0, "Amount owed cannot be negative"),
});

export const createExpenseSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be 200 characters or less"),
  amount: z.number().positive("Amount must be positive"),
  category: categoryEnum.default("OTHER"),
  splitType: splitTypeEnum.default("EQUAL"),
  note: z.string().optional(),
  participants: z
    .array(z.string().uuid("Invalid user ID"))
    .min(1, "At least one participant must be included"),
  customSplits: z.array(splitItemSchema).optional(),
});

export const updateExpenseSchema = z.object({
  title: z
    .string()
    .min(1)
    .max(200)
    .optional(),
  amount: z.number().positive().optional(),
  category: categoryEnum.optional(),
  note: z.string().optional(),
});

// ──────────────────────────────────────────
// Settlement Schemas
// ──────────────────────────────────────────

const paymentMethodEnum = z.enum(["CASH", "UPI", "BANK", "OTHER"]);

export const createSettlementSchema = z.object({
  toUser: z.string().uuid("Invalid user ID"),
  amount: z.number().positive("Amount must be positive"),
  method: paymentMethodEnum.default("OTHER"),
  note: z.string().optional(),
});

// ──────────────────────────────────────────
// Rent Cycle Schemas
// ──────────────────────────────────────────

export const createRentCycleSchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Month must be in YYYY-MM format"),
  totalAmount: z.number().positive("Amount must be positive"),
  splitType: splitTypeEnum.default("EQUAL"),
  customSplits: z.array(splitItemSchema).optional(),
  dueDate: z.string().refine(
    (val) => !isNaN(Date.parse(val)),
    "Invalid date format"
  ),
});

export const markRentPaidSchema = z.object({
  method: paymentMethodEnum,
});

// ──────────────────────────────────────────
// Comment Schemas
// ──────────────────────────────────────────

export const createCommentSchema = z.object({
  message: z
    .string()
    .min(1, "Comment message is required")
    .max(1000, "Comment must be 1000 characters or less"),
});

// ──────────────────────────────────────────
// Pagination
// ──────────────────────────────────────────

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
