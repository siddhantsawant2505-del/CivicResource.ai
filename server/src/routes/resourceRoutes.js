import express from 'express';
import { getResources, createResource, updateResourceLocation, dispatchResource } from '../controllers/resourceController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
  .get(protect, getResources)
  .post(protect, admin, createResource);

router.route('/:id/location')
  .put(protect, updateResourceLocation);

router.route('/:id/dispatch')
  .put(protect, dispatchResource);

export default router;
