import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { authGuard } from '../middleware/auth.middleware.js';

const router = Router();

router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.get('/me', authGuard, authController.me);
router.patch('/me', authGuard, authController.updateProfile);

export default router;
