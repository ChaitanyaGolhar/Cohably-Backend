import { Router } from "express";
import * as expenseController from "../controllers/expense.controller.js";
import { authGuard } from "../middleware/auth.middleware.js";
import { requireFlatMember } from "../middleware/flatMember.middleware.js";
import { requireAdmin } from "../middleware/role.middleware.js";

const router = Router({ mergeParams: true });

router.post("/", authGuard, requireFlatMember, expenseController.addExpense);
router.get("/", authGuard, requireFlatMember, expenseController.getExpenses);
router.get("/:expId", authGuard, requireFlatMember, expenseController.getExpenseDetail);
router.patch("/:expId", authGuard, requireFlatMember, expenseController.editExpense);
router.delete("/:expId", authGuard, requireFlatMember, requireAdmin, expenseController.deleteExpense);

export default router;
