import express from 'express';
import { sendSuccess } from '../../utils/response.js';
const router = express.Router();
router.get('/', (_req, res) => sendSuccess(res, null, 'Requests module — implementation in Level 3'));
export default router;
