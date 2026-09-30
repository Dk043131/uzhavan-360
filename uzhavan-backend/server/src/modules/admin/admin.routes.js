import express from 'express';
import * as adminController from './admin.controller.js';
import { authenticate, adminOnly } from '../../middlewares/auth.js';

const router = express.Router();

// Strict RBAC: All admin routes require valid JWT + ROLE_ADMIN
router.use(authenticate, adminOnly);

router.get('/overview', adminController.getOverview);
router.get('/users', adminController.getUsers);
router.patch('/users/:id/verify', adminController.verifyFarmer);
router.get('/audit-logs', adminController.getAuditLogs);

export default router;
