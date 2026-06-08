import { Router } from "express";
import * as rentCycleController from "../controllers/rentCycle.controller.js";
import { authGuard } from "../middleware/auth.middleware.js";
import { requireFlatMember } from "../middleware/flatMember.middleware.js";
import { requireAdmin } from "../middleware/role.middleware.js";

const router = Router({ mergeParams: true });

router.post("/", authGuard, requireFlatMember, requireAdmin, rentCycleController.createRentCycle);
router.get("/", authGuard, requireFlatMember, rentCycleController.getRentCycles);
router.get("/:cycleId", authGuard, requireFlatMember, rentCycleController.getRentCycleDetail);
router.patch("/:cycleId/pay", authGuard, requireFlatMember, rentCycleController.markAsPaid);
router.patch("/:cycleId/close", authGuard, requireFlatMember, requireAdmin, rentCycleController.closeCycle);

export default router;
