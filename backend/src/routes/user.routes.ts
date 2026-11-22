import { Router } from 'express';
import { UserController } from '../controllers/user.controller.js';
import { authenticate, requireActive, authorizeRoles } from '../middlewares/auth.middleware.js';
import { Role } from '@prisma/client';

const router = Router();

// Proteccion administrativa estricta: usuario autenticado, activo y con rol ADMIN
router.use(authenticate, requireActive, authorizeRoles(Role.ADMIN));

router.get('/', UserController.listUsers);
router.patch('/:id', UserController.updateUser);

export default router;
