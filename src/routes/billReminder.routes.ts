import { Router } from "express";
import * as billReminderController from "../controllers/billReminder.controller.js";
import { authGuard } from "../middleware/auth.middleware.js";
import { requireFlatMember } from "../middleware/flatMember.middleware.js";
import { requireAdmin } from "../middleware/role.middleware.js";

const router = Router({ mergeParams: true });

// Mount on /api/flats/:id/bill-reminders
router.post("/", authGuard, requireFlatMember, requireAdmin, billReminderController.createBillReminder);
router.get("/", authGuard, requireFlatMember, billReminderController.getBillReminders);
router.get("/:remId", authGuard, requireFlatMember, billReminderController.getBillReminder);
router.patch("/:remId/paid", authGuard, requireFlatMember, billReminderController.markBillPaid);
router.delete("/:remId", authGuard, requireFlatMember, requireAdmin, billReminderController.deleteBillReminder);

export default router;
