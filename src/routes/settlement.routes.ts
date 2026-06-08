import { Router } from "express";
import * as settlementController from "../controllers/settlement.controller.js";
import { authGuard } from "../middleware/auth.middleware.js";
import { requireFlatMember } from "../middleware/flatMember.middleware.js";

const router = Router({ mergeParams: true });

router.post("/", authGuard, requireFlatMember, settlementController.recordSettlement);
router.get("/", authGuard, requireFlatMember, settlementController.getSettlements);

export default router;
