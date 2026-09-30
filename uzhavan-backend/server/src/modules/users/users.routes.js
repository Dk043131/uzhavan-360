import express from 'express';
import * as usersController from './users.controller.js';
import { authenticate } from '../../middlewares/auth.js';

const router = express.Router();

router.use(authenticate);
router.get('/profile', usersController.getProfile);
router.patch('/profile', usersController.updateProfile);

export default router;
