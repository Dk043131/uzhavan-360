import express from 'express';
import { sendSuccess } from '../../utils/response.js';
const router = express.Router();
// Placeholder — full implementation in Level 3
router.get('/', (_req, res) => sendSuccess(res, null, 'Auth module — implementation in Level 3'));
export default router;
