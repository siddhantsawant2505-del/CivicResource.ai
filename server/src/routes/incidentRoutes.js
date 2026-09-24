import express from 'express';
import { getIncidents, createIncident, updateIncidentStatus } from '../controllers/incidentController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
  .get(protect, getIncidents)
  .post(protect, createIncident);

router.route('/:id/status')
  .put(protect, updateIncidentStatus);

export default router;
