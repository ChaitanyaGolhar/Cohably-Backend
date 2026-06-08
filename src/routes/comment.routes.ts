import { Router } from "express";
import * as commentController from "../controllers/comment.controller.js";
import { authGuard } from "../middleware/auth.middleware.js";
import { requireFlatMember } from "../middleware/flatMember.middleware.js";
import { requireAdmin } from "../middleware/role.middleware.js";

const router = Router({ mergeParams: true });

router.post("/", authGuard, requireFlatMember, commentController.addComment);
router.get("/", authGuard, requireFlatMember, commentController.getComments);
router.patch("/dispute", authGuard, requireFlatMember, commentController.toggleDispute);
router.patch("/resolve", authGuard, requireFlatMember, requireAdmin, commentController.resolveDispute);

export default router;
