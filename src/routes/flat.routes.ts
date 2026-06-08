import { Router } from "express";
import * as flatController from "../controllers/flat.controller.js";
import { authGuard } from "../middleware/auth.middleware.js";
import { requireFlatMember } from "../middleware/flatMember.middleware.js";
import { requireAdmin } from "../middleware/role.middleware.js";

const router = Router();

router.post("/", authGuard, flatController.createFlat);
router.post("/join", authGuard, flatController.joinFlat);
router.get("/:id", authGuard, requireFlatMember, flatController.getFlatDetails);
router.get("/:id/members", authGuard, requireFlatMember, flatController.getMembers);
router.delete("/:id/members/:userId", authGuard, requireFlatMember, requireAdmin, flatController.removeMember);
router.get("/:id/invite", authGuard, requireFlatMember, requireAdmin, flatController.regenerateInviteCode);

export default router;
