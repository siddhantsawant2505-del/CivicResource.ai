import express from 'express';
import { getDashboardAnalytics, updateAnalytics } from '../controllers/analyticsController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
  .get(protect, getDashboardAnalytics)
  .post(protect, updateAnalytics);

export default router;
