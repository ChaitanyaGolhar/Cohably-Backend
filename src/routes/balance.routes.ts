import { Router } from "express";
import * as balanceController from "../controllers/balance.controller.js";
import { authGuard } from "../middleware/auth.middleware.js";
import { requireFlatMember } from "../middleware/flatMember.middleware.js";

const router = Router({ mergeParams: true });

router.get("/", authGuard, requireFlatMember, balanceController.getBalances);
router.get("/me", authGuard, requireFlatMember, balanceController.getMyBalances);

export default router;
