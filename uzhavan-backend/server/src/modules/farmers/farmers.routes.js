import express from 'express';
import * as farmerController from './farmers.controller.js';

const router = express.Router();

router.get('/:id', farmerController.getFarmerProfile);

export default router;
