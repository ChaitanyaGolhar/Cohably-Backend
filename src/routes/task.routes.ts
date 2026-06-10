import { Router } from "express";
import * as taskController from "../controllers/task.controller.js";
import { authGuard } from "../middleware/auth.middleware.js";
import { requireFlatMember } from "../middleware/flatMember.middleware.js";
import { requireAdmin } from "../middleware/role.middleware.js";

const router = Router({ mergeParams: true });

// Mount on /api/flats/:id/tasks
router.post("/", authGuard, requireFlatMember, taskController.createTask);
router.get("/", authGuard, requireFlatMember, taskController.getTasks);
router.get("/:taskId", authGuard, requireFlatMember, taskController.getTask);
router.patch("/:taskId/assign", authGuard, requireFlatMember, taskController.updateTaskAssignee);
router.patch("/:taskId/in-progress", authGuard, requireFlatMember, taskController.markInProgress);
router.patch("/:taskId/complete", authGuard, requireFlatMember, taskController.completeTaskController);
router.patch("/:taskId/cancel", authGuard, requireFlatMember, taskController.cancelTask);

export default router;
