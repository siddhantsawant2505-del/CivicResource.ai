import Resource from '../models/Resource.js';
import Incident from '../models/Incident.js';

// @desc    Create a new resource
// @route   POST /api/resources
// @access  Private
export const createResource = async (req, res, next) => {
  try {
    const {
      name,
      type,
      status,
      location,
      batteryOrFuelLevel,
    } = req.body;

    const resource = await Resource.create({
      name,
      type,
      status: status || 'patrol',
      location,
      batteryOrFuelLevel: batteryOrFuelLevel ?? 100,
    });

    res.status(201).json(resource);
  } catch (error) {
    next(error);
  }
};

// @desc    Get all resources
// @route   GET /api/resources
// @access  Private
export const getResources = async (req, res, next) => {
  try {
    const filters = req.query.type ? { type: req.query.type } : {};
    const resources = await Resource.find(filters).populate('currentIncident', 'title severity location');
    res.json(resources);
  } catch (error) {
    next(error);
  }
};

// @desc    Update resource location (telemetry)
// @route   PUT /api/resources/:id/location
// @access  Private
export const updateResourceLocation = async (req, res, next) => {
  try {
    const { lat, lng, batteryOrFuelLevel } = req.body;
    const resource = await Resource.findById(req.params.id);

    if (resource) {
      if (lat && lng) {
        resource.location = { lat, lng };
      }
      if (batteryOrFuelLevel !== undefined) {
        resource.batteryOrFuelLevel = batteryOrFuelLevel;
      }
      const updatedResource = await resource.save();
      res.json(updatedResource);
    } else {
      res.status(404);
      throw new Error('Resource not found');
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Dispatch resource to incident
// @route   PUT /api/resources/:id/dispatch
// @access  Private
export const dispatchResource = async (req, res, next) => {
  try {
    const { incidentId } = req.body;
    const resource = await Resource.findById(req.params.id);
    const incident = await Incident.findById(incidentId);

    if (!incident) {
      res.status(404);
      throw new Error('Incident not found');
    }

    if (resource) {
      const previousIncidentId = resource.currentIncident ? String(resource.currentIncident) : null;

      if (previousIncidentId && previousIncidentId !== String(incidentId)) {
        await Incident.findByIdAndUpdate(previousIncidentId, {
          $pull: { assignedResources: resource._id },
        });
      }

      resource.status = 'dispatched';
      resource.currentIncident = incidentId;
      const updatedResource = await resource.save();

      incident.dispatchStatus = 'dispatched';
      if (incident.status === 'resolved') {
        incident.status = 'active';
      }
      incident.assignedResources = incident.assignedResources || [];
      if (!incident.assignedResources.map((id) => String(id)).includes(String(resource._id))) {
        incident.assignedResources.push(resource._id);
      }
      await incident.save();

      res.json(updatedResource);
    } else {
      res.status(404);
      throw new Error('Resource not found');
    }
  } catch (error) {
    next(error);
  }
};
