import express from 'express';
import { sendSuccess } from '../../utils/response.js';
const router = express.Router();
router.get('/', (_req, res) => sendSuccess(res, null, 'Uzhavan AI module — implementation in Level 4'));
export default router;
