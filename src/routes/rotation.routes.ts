import { Router } from "express";
import * as rotationController from "../controllers/rotation.controller.js";
import { authGuard } from "../middleware/auth.middleware.js";
import { requireFlatMember } from "../middleware/flatMember.middleware.js";
import { requireAdmin } from "../middleware/role.middleware.js";

const router = Router({ mergeParams: true }); // mergeParams lets us access :id from parent

// Mount on /api/flats/:id/rotations
router.post("/", authGuard, requireFlatMember, requireAdmin, rotationController.createRotation);
router.get("/", authGuard, requireFlatMember, rotationController.getRotations);
router.get("/:rotId", authGuard, requireFlatMember, rotationController.getRotation);
router.delete("/:rotId", authGuard, requireFlatMember, requireAdmin, rotationController.deleteRotation);

router.patch("/:rotId/cycles/:cycleId/complete", authGuard, requireFlatMember, rotationController.completeCycle);
router.patch("/:rotId/cycles/:cycleId/skip", authGuard, requireFlatMember, requireAdmin, rotationController.skipCycle);

export default router;
