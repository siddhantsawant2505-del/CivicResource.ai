import Incident from '../models/Incident.js';
import Personnel from '../models/Personnel.js';
import Resource from '../models/Resource.js';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const AI_ENGINE_URL = process.env.AI_ENGINE_URL || 'http://localhost:8000';

const CRISIS_TEMPLATES = {
  normal: {
    label: 'Normal Operations',
    weights: { urgency: 0.35, eta: 0.25, family: 0.25, severity: 0.15 },
    slaMultiplier: 1,
    resourcePriority: ['maintenance', 'water', 'garbage'],
    trafficIndex: 1,
    roadConditionIndex: 1,
  },
  flood: {
    label: 'Flood Mode',
    weights: { urgency: 0.4, eta: 0.2, family: 0.25, severity: 0.15 },
    slaMultiplier: 0.75,
    resourcePriority: ['water', 'maintenance', 'garbage'],
    trafficIndex: 1.3,
    roadConditionIndex: 1.35,
  },
  heatwave: {
    label: 'Heatwave Mode',
    weights: { urgency: 0.32, eta: 0.22, family: 0.28, severity: 0.18 },
    slaMultiplier: 0.82,
    resourcePriority: ['water', 'maintenance', 'garbage'],
    trafficIndex: 1.1,
    roadConditionIndex: 1.05,
  },
  festival: {
    label: 'Festival Mode',
    weights: { urgency: 0.34, eta: 0.28, family: 0.24, severity: 0.14 },
    slaMultiplier: 0.85,
    resourcePriority: ['garbage', 'water', 'maintenance'],
    trafficIndex: 1.4,
    roadConditionIndex: 1.15,
  },
  strike: {
    label: 'Strike Mode',
    weights: { urgency: 0.42, eta: 0.2, family: 0.22, severity: 0.16 },
    slaMultiplier: 0.78,
    resourcePriority: ['maintenance', 'garbage', 'water'],
    trafficIndex: 1.25,
    roadConditionIndex: 1.25,
  },
};

let activeCrisisMode = 'normal';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const safeNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const classifyNeed = (value) => {
  const text = String(value || '').toLowerCase();
  if (/(garbage|trash|waste|sanitation|litter|dump)/.test(text)) return 'garbage';
  if (/(water|tank|tanker|pipe|leak|hydrant)/.test(text)) return 'water';
  if (/(maintenance|repair|road|street|drain|sewer|electric|infrastructure)/.test(text)) return 'maintenance';
  return 'general';
};

const classifyIncidentFamily = (incident) => {
  const text = `${incident?.type || ''} ${incident?.title || ''} ${incident?.details || ''}`.toLowerCase();
  if (/(water|tanker|pipe|leak|hydrant|flood|drain|sewer)/.test(text)) return 'water';
  if (/(garbage|trash|waste|sanitation|litter|dump)/.test(text)) return 'garbage';
  if (/(road|pothole|street|bridge|traffic|signal|maintenance)/.test(text)) return 'maintenance';
  if (/(fire|crime|unsafe|hazard|assault|police)/.test(text)) return 'safety';
  return 'general';
};

const classifyResourceServiceFamily = (resource) => {
  const text = `${resource?.type || ''} ${resource?.name || ''}`.toLowerCase();
  if (/(garbage|trash|waste|sanitation|litter|dump)/.test(text)) return 'garbage';
  if (/(water|tanker|pipe|hydrant|flood|drain|sewer)/.test(text)) return 'water';
  if (/(road|pothole|maintenance|repair|utility|public_works|public works)/.test(text)) return 'maintenance';
  if (/(fire)/.test(text)) return 'fire';
  if (/(medical|ambulance)/.test(text)) return 'medical';
  if (/(police|patrol)/.test(text)) return 'safety';
  return 'general';
};

const scoreResourceForIncident = ({ incident, resource, aiPreferredResourceId }) => {
  const family = classifyIncidentFamily(incident);
  const resourceFamily = classifyResourceServiceFamily(resource);
  const km = distanceKm(resource?.location, incident?.location);

  const familyPenalty =
    family === 'general'
      ? 0.7
      : resourceFamily === family
        ? 0
        : resourceFamily === 'general'
          ? 1.2
          : 2.4;

  const aiPreferenceBonus = String(resource?._id) === String(aiPreferredResourceId || '') ? -0.5 : 0;
  return km + familyPenalty + aiPreferenceBonus;
};

const incidentToPersonnelType = (incident) => {
  const incidentType = String(incident?.type || '').toLowerCase();
  const need = incidentNeed(incident);

  if (incidentType === 'fire') return 'fire';
  if (incidentType === 'medical') return 'medical';
  if (incidentType === 'crime' || incidentType === 'safety' || incidentType === 'traffic') return 'police';
  if (incidentType === 'sanitation' || need === 'garbage') return 'sanitation';
  return 'utility';
};

const distanceKm = (a, b) => {
  const lat1 = safeNumber(a?.lat, 19.076);
  const lng1 = safeNumber(a?.lng, 72.8777);
  const lat2 = safeNumber(b?.lat, 19.076);
  const lng2 = safeNumber(b?.lng, 72.8777);
  const toRad = (v) => (Math.PI / 180) * Number(v || 0);
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const c =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c));
};

const incidentNeed = (incident) => {
  const triageNeed = String(incident?.aiTriage?.resourceFamily || incident?.aiTriage?.predictedType || '').toLowerCase();
  if (triageNeed && triageNeed !== 'general') {
    return classifyNeed(triageNeed);
  }

  return classifyNeed(`${incident?.type || ''} ${incident?.title || ''} ${incident?.details || ''}`);
};

const getCrisisTemplate = (mode) => {
  const key = String(mode || activeCrisisMode || 'normal').toLowerCase();
  return {
    mode: CRISIS_TEMPLATES[key] ? key : 'normal',
    ...(CRISIS_TEMPLATES[key] || CRISIS_TEMPLATES.normal),
  };
};

const applyScenarioPreset = (liveInputs = {}) => {
  const scenarioMode = String(liveInputs?.scenario_mode || activeCrisisMode || 'normal').toLowerCase();
  const presets = {
    normal: { weather_rain_mm: 6, event_factor: 1.1, population_density_boost: 1.0, traffic_index: 1.0, road_condition_index: 1.0 },
    flood: { weather_rain_mm: 28, event_factor: 1.45, population_density_boost: 1.2, traffic_index: 1.3, road_condition_index: 1.35 },
    festival: { weather_rain_mm: 4, event_factor: 1.7, population_density_boost: 1.35, traffic_index: 1.4, road_condition_index: 1.15 },
    strike: { weather_rain_mm: 5, event_factor: 1.35, population_density_boost: 1.1, traffic_index: 1.25, road_condition_index: 1.25 },
    heatwave: { weather_rain_mm: 1, event_factor: 1.25, population_density_boost: 1.05, traffic_index: 1.1, road_condition_index: 1.05 },
  };

  const base = presets[scenarioMode] || presets.normal;
  const crisisTemplate = getCrisisTemplate(scenarioMode);
  return {
    scenario_mode: crisisTemplate.mode,
    weather_rain_mm: Number.isFinite(Number(liveInputs?.weather_rain_mm)) ? Number(liveInputs.weather_rain_mm) : base.weather_rain_mm,
    weather_temp_c: Number.isFinite(Number(liveInputs?.weather_temp_c)) ? Number(liveInputs.weather_temp_c) : undefined,
    event_factor: Number.isFinite(Number(liveInputs?.event_factor)) ? Number(liveInputs.event_factor) : base.event_factor,
    population_density_boost: Number.isFinite(Number(liveInputs?.population_density_boost))
      ? Number(liveInputs.population_density_boost)
      : base.population_density_boost,
    traffic_index: Number.isFinite(Number(liveInputs?.traffic_index)) ? Number(liveInputs.traffic_index) : crisisTemplate.trafficIndex,
    road_condition_index: Number.isFinite(Number(liveInputs?.road_condition_index)) ? Number(liveInputs.road_condition_index) : crisisTemplate.roadConditionIndex,
  };
};

const estimateTravelTime = ({ distanceKm, severity, liveInputs, crisisTemplate }) => {
  const trafficIndex = Math.max(0.75, safeNumber(liveInputs?.traffic_index, crisisTemplate.trafficIndex || 1));
  const roadConditionIndex = Math.max(0.7, safeNumber(liveInputs?.road_condition_index, crisisTemplate.roadConditionIndex || 1));
  const rainPenalty = 1 + Math.min(0.5, safeNumber(liveInputs?.weather_rain_mm, 0) / 120);
  const hour = new Date().getHours();
  const peakFactor = (hour >= 8 && hour <= 11) || (hour >= 17 && hour <= 21) ? 1.18 : 1;
  const severityBoost = severity === 'critical' ? 0.88 : severity === 'high' ? 0.93 : 1;

  const effectiveSpeedKmh = Math.max(14, 34 / (trafficIndex * roadConditionIndex * rainPenalty * peakFactor));
  const predictedMinutes = Math.max(4, (safeNumber(distanceKm, 0) / effectiveSpeedKmh) * 60 * severityBoost);
  return {
    predictedMinutes: Number(predictedMinutes.toFixed(1)),
    factors: {
      trafficIndex: Number(trafficIndex.toFixed(2)),
      roadConditionIndex: Number(roadConditionIndex.toFixed(2)),
      rainPenalty: Number(rainPenalty.toFixed(2)),
      peakFactor: Number(peakFactor.toFixed(2)),
    },
  };
};

const deriveLearningWeights = (resolvedIncidents = [], crisisTemplate) => {
  if (!resolvedIncidents.length) {
    return {
      urgency: crisisTemplate.weights.urgency,
      eta: crisisTemplate.weights.eta,
      family: crisisTemplate.weights.family,
      severity: crisisTemplate.weights.severity,
      confidence: 0,
      samples: 0,
    };
  }

  const rows = resolvedIncidents
    .map((incident) => ({
      success: incident?.outcomeLearning?.success !== false,
      rating: safeNumber(incident?.outcomeLearning?.citizenRating, 3),
      resolutionMins: safeNumber(incident?.outcomeLearning?.actualResolutionMinutes, 120),
      trust: safeNumber(incident?.trustScore, 50),
      family: incidentNeed(incident),
    }))
    .filter((row) => Number.isFinite(row.resolutionMins));

  if (!rows.length) {
    return {
      urgency: crisisTemplate.weights.urgency,
      eta: crisisTemplate.weights.eta,
      family: crisisTemplate.weights.family,
      severity: crisisTemplate.weights.severity,
      confidence: 0,
      samples: 0,
    };
  }

  const avgResolution = rows.reduce((sum, row) => sum + row.resolutionMins, 0) / rows.length;
  const successRate = rows.filter((row) => row.success).length / rows.length;
  const avgRating = rows.reduce((sum, row) => sum + row.rating, 0) / rows.length;
  const avgTrust = rows.reduce((sum, row) => sum + row.trust, 0) / rows.length;

  const etaShift = avgResolution <= 70 ? 0.05 : avgResolution >= 150 ? -0.04 : 0;
  const familyShift = avgRating >= 4 ? 0.04 : avgRating <= 2.5 ? -0.03 : 0;
  const urgencyShift = successRate < 0.7 ? 0.04 : 0;
  const severityShift = avgTrust < 55 ? 0.03 : 0;

  const raw = {
    urgency: Math.max(0.15, crisisTemplate.weights.urgency + urgencyShift),
    eta: Math.max(0.12, crisisTemplate.weights.eta + etaShift),
    family: Math.max(0.12, crisisTemplate.weights.family + familyShift),
    severity: Math.max(0.1, crisisTemplate.weights.severity + severityShift),
  };
  const total = raw.urgency + raw.eta + raw.family + raw.severity;

  return {
    urgency: Number((raw.urgency / total).toFixed(3)),
    eta: Number((raw.eta / total).toFixed(3)),
    family: Number((raw.family / total).toFixed(3)),
    severity: Number((raw.severity / total).toFixed(3)),
    confidence: Number(((Math.min(rows.length, 60) / 60) * 100).toFixed(1)),
    samples: rows.length,
    successRate: Number((successRate * 100).toFixed(1)),
    avgRating: Number(avgRating.toFixed(2)),
    avgResolutionMinutes: Number(avgResolution.toFixed(1)),
  };
};

const severityWeight = (severity) => ({ critical: 1.0, high: 0.75, medium: 0.5, low: 0.25 }[severity] || 0.5);

const buildAllocationExplainability = (allocation, zone, incident, scenarioMode, learningWeights, travelModel, crisisTemplate) => {
  const etaNorm = Math.max(0.1, 1 - Number(travelModel?.predictedMinutes || allocation.eta_minutes || 60) / 60);
  const urgencyNorm = Math.min(1, Number(zone?.urgency_score || allocation?.urgency_score || 0) / 30);
  const familyMatch = allocation.preferred_family !== 'general' && allocation.preferred_family === allocation.resource_family ? 1 : 0;
  const severityNorm = severityWeight(incident?.severity);
  const crisisBoost = crisisTemplate.resourcePriority.includes(String(allocation.resource_family || '').toLowerCase()) ? 0.12 : 0;
  const scenarioBoost = scenarioMode !== 'normal' ? 0.08 : 0;

  const score = Math.min(
    100,
    Math.round(
      (
        urgencyNorm * learningWeights.urgency +
        etaNorm * learningWeights.eta +
        familyMatch * learningWeights.family +
        severityNorm * learningWeights.severity +
        scenarioBoost +
        crisisBoost
      ) * 100
    )
  );
  return {
    score,
    why: [
      `Urgency score ${Number(zone?.urgency_score || allocation?.urgency_score || 0).toFixed(1)} with rank #${zone?.urgency_rank || allocation?.urgency_rank}`,
      `Predicted travel time ${travelModel?.predictedMinutes || allocation.eta_minutes} minutes for ${allocation.distance_km} km`,
      familyMatch ? `Resource family match confirmed (${allocation.resource_family})` : `Nearest feasible resource selected (fallback from ${allocation.preferred_family || 'general'})`,
      `Incident severity contribution: ${(severityNorm * 100).toFixed(0)}%`,
    ],
    factors: {
      urgency: Number((urgencyNorm * 100).toFixed(1)),
      eta: Number((etaNorm * 100).toFixed(1)),
      familyMatch: Number((familyMatch * 100).toFixed(1)),
      severity: Number((severityNorm * 100).toFixed(1)),
      trafficIndex: Number(travelModel?.factors?.trafficIndex || 1),
      roadConditionIndex: Number(travelModel?.factors?.roadConditionIndex || 1),
      learningConfidence: Number(learningWeights?.confidence || 0),
    },
  };
};

const buildDemandZones = (incidents, liveInputs = {}) => {
  const bins = {};
  const rainOverride = safeNumber(liveInputs?.weather_rain_mm, NaN);
  const tempOverride = safeNumber(liveInputs?.weather_temp_c, NaN);
  const eventOverride = safeNumber(liveInputs?.event_factor, NaN);
  const populationBoost = safeNumber(liveInputs?.population_density_boost, 1);

  incidents.forEach((incident) => {
    const lat = safeNumber(incident?.location?.lat, 19.076);
    const lng = safeNumber(incident?.location?.lng, 72.8777);
    const key = `${Math.round(lat * 10) / 10}_${Math.round(lng * 10) / 10}`;
    if (!bins[key]) {
      bins[key] = {
        zone_id: key,
        population_density: (9000 + Math.round(Math.abs(lat * lng)) % 7000) * Math.max(0.5, populationBoost),
        complaints_last_7d: 0,
        weather_rain_mm: Number.isFinite(rainOverride) ? rainOverride : 4 + Math.round(Math.abs(lat) % 8),
        weather_temp_c: Number.isFinite(tempOverride) ? tempOverride : 28 + Math.round(Math.abs(lng) % 6),
        event_factor: 1.0,
        historical_daily_avg: 14,
        dominant_need: 'general',
        freshness_factor: 1.0,
        latest_incident_at: null,
        need_counts: {},
      };
    }

    const need = incidentNeed(incident);
    bins[key].complaints_last_7d += 1;
    bins[key].historical_daily_avg += incident.severity === 'critical' ? 2 : 1;
    bins[key].need_counts[need] = (bins[key].need_counts[need] || 0) + 1;

    const createdAt = incident.createdAt ? new Date(incident.createdAt).getTime() : Date.now();
    const latestAt = bins[key].latest_incident_at ? new Date(bins[key].latest_incident_at).getTime() : 0;
    if (!bins[key].latest_incident_at || createdAt > latestAt) {
      bins[key].latest_incident_at = new Date(createdAt).toISOString();
    }

    if (Number.isFinite(eventOverride)) {
      bins[key].event_factor = Math.max(0, eventOverride);
    } else if (incident.severity === 'critical') {
      bins[key].event_factor = 1.25;
    }
  });

  Object.values(bins).forEach((zone) => {
    const entries = Object.entries(zone.need_counts || {});
    entries.sort((a, b) => b[1] - a[1]);
    zone.dominant_need = entries[0]?.[0] || 'general';
    const ageMinutes = zone.latest_incident_at
      ? Math.max(1, (Date.now() - new Date(zone.latest_incident_at).getTime()) / 60000)
      : 180;
    zone.freshness_factor = Math.max(0.85, Math.min(1.4, 1.25 - Math.log1p(ageMinutes) / 7));
    delete zone.need_counts;
    delete zone.latest_incident_at;
  });

  return Object.values(bins);
};

const postAI = async (endpoint, payload) => {
  const response = await fetch(`${AI_ENGINE_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`AI engine call failed for ${endpoint}`);
  }

  return response.json();
};

// @desc    Dispatch personnel to an incident with a resource
// @route   POST /api/dispatch/assign
// @access  Private (Officer)
export const assignPersonnel = async (req, res) => {
  const { incidentId, personnelId, personnelIds, resourceId } = req.body;
  const idsToProcess = Array.isArray(personnelIds) ? personnelIds : (personnelId ? [personnelId] : []);

  if (!incidentId || idsToProcess.length === 0) {
    return res.status(400).json({ message: 'Incident and Personnel selection required' });
  }

  try {
    const incident = await Incident.findById(incidentId);
    if (!incident) {
      return res.status(404).json({ message: 'Incident not found' });
    }

    let resource = resourceId ? await Resource.findById(resourceId) : null;
    const results = [];
    let didDispatch = false;
    let didQueue = false;
    const expectedType = incidentToPersonnelType(incident);

    for (const pId of idsToProcess) {
      const personnel = await Personnel.findById(pId);
      if (!personnel) continue;

      const personnelType = String(personnel.type || '').toLowerCase();
      if (personnelType !== expectedType) {
        results.push({ id: pId, status: 'skipped_type_mismatch', expectedType, actualType: personnelType || 'unknown' });
        continue;
      }

      // Handle Queuing if busy
      if (personnel.status === 'busy') {
        if (!personnel.taskQueue.includes(incidentId) && personnel.taskQueue.length < 5) {
          personnel.taskQueue.push(incidentId);
          await personnel.save();
          results.push({ id: pId, status: 'queued' });
          didQueue = true;
        }
        continue;
      }

      if (personnel.status === 'off-duty') {
        results.push({ id: pId, status: 'skipped_off_duty' });
        continue;
      }

      // Live Dispatch
      const finalResource = resource || (personnel.assignedResource ? await Resource.findById(personnel.assignedResource) : null);
      
      personnel.status = 'busy';
      personnel.currentIncident = incidentId;
      if (finalResource) {
        personnel.assignedResource = finalResource._id;
        finalResource.status = 'dispatched';
        finalResource.assignedPersonnel = pId;
        finalResource.currentIncident = incidentId;
        await finalResource.save();
      }
      await personnel.save();

      // Update Incident
      if (!incident.assignedPersonnel) incident.assignedPersonnel = pId;
      const assignedList = (incident.assignedPersonnelList || []).map(id => String(id));
      if (!assignedList.includes(String(pId))) {
        incident.assignedPersonnelList.push(pId);
      }
      results.push({ id: pId, status: 'dispatched' });
      didDispatch = true;
    }

    if (didDispatch) {
      incident.dispatchStatus = 'dispatched';
    } else if (!didQueue) {
      incident.dispatchStatus = 'unassigned';
    }
    if (resourceId && !incident.assignedResources.includes(resourceId)) {
      incident.assignedResources.push(resourceId);
    }
    
    incident.workflow = incident.workflow || {};
    if (!incident.workflow.allocatedAt) incident.workflow.allocatedAt = new Date();
    if (!incident.workflow.enRouteAt) incident.workflow.enRouteAt = new Date();
    
    await incident.save();

    res.status(200).json({
      message: `Processed ${idsToProcess.length} personnel for dispatch`,
      results,
      incident
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Worker rejects a queued task
// @route   POST /api/dispatch/reject-task
// @access  Private (Worker)
export const rejectTask = async (req, res) => {
  const { incidentId, reason } = req.body;
  const unitId = req.user?.unitId;

  try {
    const personnel = await Personnel.findOne({ 'contact.unitId': unitId });
    if (!personnel) {
      return res.status(404).json({ message: 'Personnel not found' });
    }

    // Remove from queue
    personnel.taskQueue = (personnel.taskQueue || []).filter(id => String(id) !== String(incidentId));
    
    // If it was the current incident (unlikely but possible if they want to drop current)
    if (String(personnel.currentIncident) === String(incidentId)) {
      personnel.currentIncident = null;
      personnel.status = personnel.taskQueue.length > 0 ? 'busy' : 'available';
    }

    await personnel.save();

    // Update incident to be unassigned
    const incident = await Incident.findById(incidentId);
    if (incident) {
      incident.assignedPersonnel = null;
      incident.dispatchStatus = 'unassigned';
      incident.assignedPersonnelList = (incident.assignedPersonnelList || []).filter(id => String(id) !== String(personnel._id));
      await incident.save();
    }

    res.status(200).json({ message: 'Task rejected successfully', personnel });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all available personnel
// @route   GET /api/dispatch/personnel
// @access  Private (Officer)
export const getAvailablePersonnel = async (req, res) => {
  try {
    const includeAll = String(req.query.all || '').toLowerCase() === 'true';
    const personnel = includeAll
      ? await Personnel.find({}).populate('currentIncident', 'title severity status dispatchStatus trackingId location tracking workflow createdAt updatedAt')
      : await Personnel.find({ status: 'available' });
    res.json(personnel);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get worker assignments by unit id
// @route   GET /api/dispatch/assignments/:unitId
// @access  Private
export const getWorkerAssignmentsByUnitId = async (req, res) => {
  const unitId = String(req.params.unitId || '').trim().toUpperCase();

  if (!unitId) {
    return res.status(400).json({ message: 'unitId is required' });
  }

  try {
    const personnel = await Personnel.findOne({ 'contact.unitId': unitId })
      .populate('currentIncident', 'title severity status dispatchStatus trackingId location createdAt updatedAt');

    if (!personnel) {
      return res.status(404).json({ message: 'Personnel unit not found' });
    }

    const assignedIncidents = await Incident.find({
      $or: [{ assignedPersonnel: personnel._id }, { assignedPersonnelList: personnel._id }],
    })
      .sort({ updatedAt: -1 })
      .select('title severity status dispatchStatus trackingId location tracking workflow createdAt updatedAt');

    res.json({
      personnel: {
        _id: personnel._id,
        name: personnel.name,
        type: personnel.type,
        status: personnel.status,
        unitId: personnel.contact?.unitId,
      },
      activeIncident: personnel.currentIncident || null,
      assignedIncidents,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get incidents assigned to logged-in worker by their user's associated personnel
// @route   GET /api/dispatch/my-assignments
// @access  Private (Worker/Responder)
export const getMyAssignments = async (req, res) => {
  try {
    let personnel = null;
    if (req.user?.unitId) {
      personnel = await Personnel.findOne({ 'contact.unitId': req.user.unitId.toUpperCase() });
    }

    if (!personnel && req.user?.name) {
      personnel = await Personnel.findOne({ name: req.user.name });
    }

    if (!personnel) {
      return res.json([]);
    }

    const incidents = await Incident.find({
      $or: [{ assignedPersonnel: personnel._id }, { assignedPersonnelList: personnel._id }],
    })
      .populate('assignedPersonnel', 'name type contact status location')
      .sort({ updatedAt: -1 })
      .select('title severity status dispatchStatus type trackingId location details tracking workflow assignedPersonnel createdAt updatedAt');

    res.json(incidents);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Start worker journey simulation for logged-in responder
// @route   POST /api/dispatch/start-journey-simulation
// @access  Private (Worker/Responder)
export const startJourneySimulation = async (req, res) => {
  try {
    let personnel = null;
    if (req.user?.unitId) {
      personnel = await Personnel.findOne({ 'contact.unitId': String(req.user.unitId).toUpperCase() });
    }

    if (!personnel && req.user?.name) {
      personnel = await Personnel.findOne({ name: req.user.name });
    }

    if (!personnel || !personnel.contact?.unitId) {
      return res.status(404).json({ message: 'Unable to resolve responder profile for simulation.' });
    }

    const requestedIncidentId = String(req.body?.incidentId || '').trim();
    let incident = null;

    if (requestedIncidentId) {
      incident = await Incident.findById(requestedIncidentId);
    }

    if (!incident && personnel.currentIncident) {
      incident = await Incident.findById(personnel.currentIncident);
    }

    if (!incident) {
      incident = await Incident.findOne({
        $or: [{ assignedPersonnel: personnel._id }, { assignedPersonnelList: personnel._id }],
        status: { $ne: 'resolved' },
      }).sort({ createdAt: -1 });
    }

    if (!incident) {
      return res.status(404).json({ message: 'No active assigned incident found for this unit.' });
    }

    if (String(incident.status || '').toLowerCase() === 'resolved') {
      return res.status(400).json({ message: 'Incident is already resolved. Choose an active incident.' });
    }

    const intervalMinutes = Math.max(0.25, safeNumber(req.body?.intervalMinutes, 1));
    const timeScale = Math.max(0.01, safeNumber(req.body?.timeScale, 0.1));
    const speedKmph = Math.max(8, safeNumber(req.body?.speedKmph, 32));
    const workMinutes = safeNumber(req.body?.workMinutes, NaN);
    const plannedTravelMinutes = Number.isFinite(Number(req.body?.plannedTravelMinutes))
      ? Math.max(1, Number(req.body.plannedTravelMinutes))
      : randomInt(11, 20);

    incident.tracking = incident.tracking || {};
    incident.tracking.currentLocation = {
      ...(incident.tracking.currentLocation || {}),
      lat: Number(personnel.location?.lat),
      lng: Number(personnel.location?.lng),
      at: new Date(),
      phase: 'en-route',
      speedKmph,
      etaMinutes: plannedTravelMinutes,
      etaSeconds: plannedTravelMinutes * 60,
      etaUpdatedAt: new Date(),
    };
    if (!Array.isArray(incident.tracking.path) || incident.tracking.path.length === 0) {
      incident.tracking.path = [
        {
          lat: Number(personnel.location?.lat),
          lng: Number(personnel.location?.lng),
          at: new Date(),
          phase: 'en-route',
          speedKmph,
          etaMinutes: plannedTravelMinutes,
          etaSeconds: plannedTravelMinutes * 60,
          etaUpdatedAt: new Date(),
        },
      ];
    }
    await incident.save();

    const scriptPath = path.resolve(__dirname, '../scripts/simulateWorkerJourney.js');
    const args = [
      scriptPath,
      '--unitId',
      String(personnel.contact.unitId).toUpperCase(),
      '--incidentId',
      String(incident._id),
      '--intervalMinutes',
      String(intervalMinutes),
      '--timeScale',
      String(timeScale),
      '--speedKmph',
      String(speedKmph),
      '--plannedTravelMinutes',
      String(plannedTravelMinutes),
    ];

    if (Number.isFinite(workMinutes)) {
      args.push('--workMinutes', String(Math.max(1, workMinutes)));
    }

    const child = spawn('node', args, {
      detached: true,
      stdio: 'ignore',
      cwd: path.resolve(__dirname, '..', '..'),
      env: process.env,
    });
    child.unref();

    return res.status(202).json({
      message: `Journey simulation started for unit ${String(personnel.contact.unitId).toUpperCase()}`,
      pid: child.pid,
      incidentId: String(incident._id),
      unitId: String(personnel.contact.unitId).toUpperCase(),
      simulation: {
        intervalMinutes,
        timeScale,
        speedKmph,
        plannedTravelMinutes,
        workMinutes: Number.isFinite(workMinutes) ? Math.max(1, workMinutes) : null,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Quick AI Analysis Proxy
// @route   POST /api/dispatch/ai-analyze
export const getAIAnalysis = async (req, res) => {
  try {
    const liveInputs = applyScenarioPreset(req.body?.liveInputs || {});
    const crisisTemplate = getCrisisTemplate(liveInputs.scenario_mode);
    const incidents = await Incident.find({ status: { $ne: 'resolved' } });
    const resolvedForLearning = await Incident.find({
      status: 'resolved',
      'outcomeLearning.usedForTraining': true,
    })
      .sort({ updatedAt: -1 })
      .limit(120)
      .select('outcomeLearning severity type trustScore aiTriage createdAt updatedAt');
    const resources = await Resource.find({ status: { $ne: 'offline' } });
    const learningWeights = deriveLearningWeights(resolvedForLearning, crisisTemplate);
    const payloadIncidents = incidents.map((i) => ({
      id: String(i._id),
      type: i.type,
      severity: i.severity,
      lat: safeNumber(i?.location?.lat, 19.076),
      lng: safeNumber(i?.location?.lng, 72.8777),
    }));

    const payloadResources = resources.map((r) => ({
      id: String(r._id),
      name: r.name,
      type: r.type,
      status: r.status,
      lat: safeNumber(r?.location?.lat, 19.076),
      lng: safeNumber(r?.location?.lng, 72.8777),
    }));

    const zones = buildDemandZones(incidents, liveInputs);

    const [clustersResp, heatmapResp, demandResp, allocationResp] = await Promise.all([
      postAI('/analyze/clustering', { incidents: payloadIncidents }),
      postAI('/analyze/heatmap-weights', { incidents: payloadIncidents }),
      postAI('/analyze/demand-forecast', { zones }),
      postAI('/analyze/resource-allocation', { 
        zones, 
        resources: payloadResources,
        personnel: (await Personnel.find({})).map(p => ({
          id: String(p._id),
          name: p.name,
          type: p.type,
          status: p.status,
          lat: safeNumber(p.location?.lat, 19.076),
          lng: safeNumber(p.location?.lng, 72.8777),
          current_task_eta_minutes: 15, // Mock current task ETA
          assigned_resource_id: p.assignedResource ? String(p.assignedResource) : null
        })),
        traffic_index: liveInputs.traffic_index,
        road_condition_index: liveInputs.road_condition_index
      }),
    ]);

    const zoneById = new Map((demandResp?.zones || []).map((zone) => [String(zone.zone_id), zone]));
    const incidentsByZone = incidents.reduce((acc, incident) => {
      const lat = safeNumber(incident?.location?.lat, 19.076);
      const lng = safeNumber(incident?.location?.lng, 72.8777);
      const key = `${Math.round(lat * 10) / 10}_${Math.round(lng * 10) / 10}`;
      acc[key] = acc[key] || [];
      acc[key].push(incident);
      return acc;
    }, {});

    const enrichedAllocationPlan = (allocationResp?.allocations || []).map((allocation) => {
      const zone = zoneById.get(String(allocation.zone_id));
      const relatedIncidents = incidentsByZone[String(allocation.zone_id)] || [];
      const topIncident = [...relatedIncidents].sort((a, b) => severityWeight(b.severity) - severityWeight(a.severity))[0] || null;
      const travelModel = estimateTravelTime({
        distanceKm: Number(allocation.distance_km || 0),
        severity: topIncident?.severity,
        liveInputs,
        crisisTemplate,
      });
      const explainability = buildAllocationExplainability(
        allocation,
        zone,
        topIncident,
        liveInputs.scenario_mode,
        learningWeights,
        travelModel,
        crisisTemplate
      );
      const crisisPriorityBoost = crisisTemplate.resourcePriority.includes(String(allocation.resource_family || '').toLowerCase()) ? 8 : 0;
      return {
        ...allocation,
        predicted_travel_time_minutes: travelModel.predictedMinutes,
        route_factors: travelModel.factors,
        ranking_score: Math.min(100, explainability.score + crisisPriorityBoost),
        explainability,
        linked_incident: topIncident
          ? {
              id: String(topIncident._id),
              title: topIncident.title,
              severity: topIncident.severity,
              verificationMode: topIncident.verificationMode,
            }
          : null,
      };
    })
      .sort((a, b) => Number(b.ranking_score || 0) - Number(a.ranking_score || 0));

    const now = new Date();
    const escalationCandidates = incidents.filter((incident) => {
      if (incident?.status === 'resolved') return false;
      const deadline = incident?.sla?.deadlineAt ? new Date(incident.sla.deadlineAt) : null;
      const adjustedDeadline = deadline
        ? new Date(new Date(incident.createdAt).getTime() + (deadline.getTime() - new Date(incident.createdAt).getTime()) * crisisTemplate.slaMultiplier)
        : null;
      return Boolean(adjustedDeadline && now > adjustedDeadline && incident?.dispatchStatus !== 'completed');
    });

    const escalationPlan = escalationCandidates.slice(0, 8).map((incident) => ({
      incidentId: String(incident._id),
      title: incident.title,
      severity: incident.severity,
      verificationMode: incident.verificationMode,
      reason: 'SLA deadline breached, prioritize reassignment and backup dispatch',
      overdueMinutes: Math.max(1, Math.round((now.getTime() - new Date(incident.sla.deadlineAt).getTime()) / 60000)),
    }));

    if (escalationCandidates.length > 0) {
      await Promise.all(
        escalationCandidates.map(async (incident) => {
          incident.sla = incident.sla || {};
          if (!incident.sla.escalated) {
            incident.sla.escalated = true;
            incident.sla.escalationLevel = Math.min(3, Number(incident.sla.escalationLevel || 0) + 1);
            incident.sla.escalationReason = 'Auto-escalated by SLA brain due to deadline breach';
            incident.sla.breachedAt = now;
            if (incident.severity !== 'critical') {
              incident.severity = incident.severity === 'high' ? 'critical' : 'high';
            }
            if (incident.status === 'active') {
              incident.status = 'investigating';
            }
            await incident.save();
          }
        })
      );
    }

    const fusionOverview = incidents.reduce(
      (acc, incident) => {
        if (incident?.fusion?.clusterId) {
          acc.clusters.add(String(incident.fusion.clusterId));
        }
        acc.duplicates += Number(incident?.fusion?.duplicateCount || 0);
        return acc;
      },
      { clusters: new Set(), duplicates: 0 }
    );

    const trustOverview = incidents.reduce(
      (acc, incident) => {
        const mode = String(incident.verificationMode || 'needs-confirmation');
        acc[mode] = (acc[mode] || 0) + 1;
        return acc;
      },
      { verified: 0, 'likely-valid': 0, 'needs-confirmation': 0, 'likely-fake': 0 }
    );

    const topZone = demandResp?.zones?.[0];
    const advice = topZone
      ? `Prioritize zone ${topZone.zone_id} with urgency rank ${topZone.urgency_rank}. Dispatch ${topZone.recommended_units} units immediately.`
      : 'Maintain current distribution and continue monitoring.';

    res.json({
      proneAreas: heatmapResp?.data || [],
      clusters: clustersResp?.clusters || [],
      demandForecast: demandResp?.zones || [],
      allocationPlan: enrichedAllocationPlan,
      allocationSummary: allocationResp?.summary || { allocated: 0, unallocated_demand: 0, zones_covered: 0 },
      growthTrend: demandResp?.growth_trend || '+0.0%',
      mitigationEfficiency: demandResp?.mitigation_efficiency || '0.0%',
      trustOverview,
      fusionOverview: {
        clusters: fusionOverview.clusters.size,
        duplicateMentions: fusionOverview.duplicates,
      },
      escalationPlan,
      strategicAdvice: advice,
      liveInputs,
      crisisMode: {
        mode: crisisTemplate.mode,
        label: crisisTemplate.label,
        resourcePriority: crisisTemplate.resourcePriority,
        slaMultiplier: crisisTemplate.slaMultiplier,
      },
      outcomeLearning: {
        weights: learningWeights,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get active crisis mode template
// @route   GET /api/dispatch/crisis-mode
// @access  Private
export const getCrisisMode = async (req, res) => {
  const template = getCrisisTemplate(activeCrisisMode);
  res.json({
    mode: template.mode,
    label: template.label,
    weights: template.weights,
    slaMultiplier: template.slaMultiplier,
    resourcePriority: template.resourcePriority,
    trafficIndex: template.trafficIndex,
    roadConditionIndex: template.roadConditionIndex,
  });
};

// @desc    Set active crisis mode template
// @route   POST /api/dispatch/crisis-mode
// @access  Private
export const setCrisisMode = async (req, res) => {
  const requested = String(req.body?.mode || '').toLowerCase();
  if (!CRISIS_TEMPLATES[requested]) {
    return res.status(400).json({
      message: 'Invalid crisis mode',
      allowedModes: Object.keys(CRISIS_TEMPLATES),
    });
  }

  activeCrisisMode = requested;
  const template = getCrisisTemplate(activeCrisisMode);
  return res.status(200).json({
    message: `${template.label} activated`,
    mode: template.mode,
    template,
  });
};

// @desc    Operator AI copilot command interface
// @route   POST /api/dispatch/copilot
// @access  Private
export const runOperatorCopilot = async (req, res) => {
  try {
    const query = String(req.body?.query || '').trim();
    if (!query) {
      return res.status(400).json({ message: 'query is required' });
    }

    const normalizedQuery = query.toLowerCase();
    const incidents = await Incident.find({ status: { $ne: 'resolved' } })
      .sort({ createdAt: -1 })
      .limit(200);
    const resources = await Resource.find({ status: { $ne: 'offline' } }).limit(200);

    const liveInputs = applyScenarioPreset(req.body?.liveInputs || {});
    const zones = buildDemandZones(incidents, liveInputs);
    const demandResp = await postAI('/analyze/demand-forecast', { zones });
    const allocationResp = await postAI('/analyze/resource-allocation', {
      zones,
      resources: resources.map((r) => ({
        id: String(r._id),
        name: r.name,
        type: r.type,
        status: r.status,
        lat: safeNumber(r?.location?.lat, 19.076),
        lng: safeNumber(r?.location?.lng, 72.8777),
      })),
    });

    if (normalizedQuery.includes('highest-risk')) {
      const need = classifyNeed(normalizedQuery);
      const highRisk = (demandResp?.zones || [])
        .filter((z) => (need === 'general' ? true : String(z?.dominant_need || '').toLowerCase() === need))
        .slice(0, 5)
        .map((z) => ({
          zone: z.zone_id,
          urgencyScore: Number(z.urgency_score || 0).toFixed(1),
          rank: z.urgency_rank,
          dominantNeed: z.dominant_need,
          recommendedUnits: z.recommended_units,
        }));

      return res.json({
        query,
        answer: highRisk.length
          ? `Top ${need === 'general' ? '' : `${need} `}risk zones for next 2 hours are ready.`
          : 'No high-risk zones detected for the requested service family.',
        cards: highRisk,
      });
    }

    if (normalizedQuery.includes('why was') && normalizedQuery.includes('chosen')) {
      const unitMatch = query.match(/[A-Za-z]{1,3}-\d{1,4}/);
      const unitId = unitMatch ? unitMatch[0].toUpperCase() : null;
      const allocations = allocationResp?.allocations || [];
      const matched = allocations.find((a) => {
        const resource = resources.find((r) => String(r._id) === String(a.resource_id));
        return unitId && String(resource?.name || '').toUpperCase().includes(unitId);
      });

      if (!matched) {
        return res.json({
          query,
          answer: unitId
            ? `No active allocation found for ${unitId}. It may be offline or not in the current recommendation set.`
            : 'Please include a unit id like WT-21 so I can explain allocation logic.',
          cards: [],
        });
      }

      const resource = resources.find((r) => String(r._id) === String(matched.resource_id));
      return res.json({
        query,
        answer: `${resource?.name || 'Selected unit'} was chosen because it matches ${matched.preferred_family} demand with ETA ${matched.eta_minutes} minutes at distance ${matched.distance_km} km.`,
        cards: [
          {
            resource: resource?.name,
            zone: matched.zone_id,
            preferredFamily: matched.preferred_family,
            resourceFamily: matched.resource_family,
            etaMinutes: matched.eta_minutes,
            distanceKm: matched.distance_km,
          },
        ],
      });
    }

    const criticalCount = incidents.filter((i) => i.severity === 'critical').length;
    const overloadedZones = (demandResp?.zones || []).filter((z) => Number(z.urgency_score || 0) >= 18).length;
    return res.json({
      query,
      answer: `Civic copilot summary: ${criticalCount} critical incidents and ${overloadedZones} high-stress zones. Ask for highest-risk zones or why a unit was chosen.`,
      cards: [
        { label: 'Critical Incidents', value: criticalCount },
        { label: 'High-Stress Zones', value: overloadedZones },
        { label: 'Mode', value: getCrisisTemplate(activeCrisisMode).label },
      ],
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Apply AI allocation plan to live incidents
// @route   POST /api/dispatch/apply-plan-live
// @access  Private
export const applyPlanLive = async (req, res) => {
  try {
    const liveInputs = applyScenarioPreset(req.body?.liveInputs || {});
    const maxAssignments = Math.max(1, Math.min(10, Number(req.body?.maxAssignments || 3)));

    const incidents = await Incident.find({ status: { $ne: 'resolved' } }).sort({ createdAt: -1 });
    const resources = await Resource.find({ status: { $ne: 'offline' } });

    if (!incidents.length) {
      return res.status(200).json({
        message: 'No active incidents to allocate',
        applied: [],
        summary: { appliedCount: 0, requested: maxAssignments },
      });
    }

    const zones = buildDemandZones(incidents, liveInputs);
    const allocationResp = await postAI('/analyze/resource-allocation', {
      zones,
      resources: resources.map((r) => ({
        id: String(r._id),
        name: r.name,
        type: r.type,
        status: r.status,
        lat: safeNumber(r?.location?.lat, 19.076),
        lng: safeNumber(r?.location?.lng, 72.8777),
      })),
    });

    const incidentsByZone = incidents.reduce((acc, incident) => {
      const lat = safeNumber(incident?.location?.lat, 19.076);
      const lng = safeNumber(incident?.location?.lng, 72.8777);
      const key = `${Math.round(lat * 10) / 10}_${Math.round(lng * 10) / 10}`;
      acc[key] = acc[key] || [];
      acc[key].push(incident);
      return acc;
    }, {});

    const personnelPool = await Personnel.find({ status: 'available' });
    const resourceById = new Map(resources.map((r) => [String(r._id), r]));
    const newestIncident = incidents.find((incident) => String(incident?.dispatchStatus || '').toLowerCase() === 'unassigned') || incidents[0] || null;
    const aiAllocations = [...(allocationResp?.allocations || [])];
    const fallbackAllocations = incidents
      .filter((incident) => String(incident?.dispatchStatus || '').toLowerCase() === 'unassigned')
      .sort((a, b) => {
        const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        const aFresh = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bFresh = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return (severityOrder[b?.severity] || 0) - (severityOrder[a?.severity] || 0) || (bFresh - aFresh);
      })
      .slice(0, Math.max(maxAssignments * 2, 6))
      .map((incident) => {
        const zoneId = `${Math.round(safeNumber(incident?.location?.lat, 19.076) * 10) / 10}_${Math.round(safeNumber(incident?.location?.lng, 72.8777) * 10) / 10}`;
        const nearestResource = [...resources]
          .filter((r) => r.status !== 'offline' && r.status !== 'dispatched' && r.status !== 'maintenance')
          .sort((a, b) => distanceKm(a.location, incident.location) - distanceKm(b.location, incident.location))[0];

        return {
          zone_id: zoneId,
          preferred_family: classifyIncidentFamily(incident),
          resource_id: nearestResource ? String(nearestResource._id) : null,
          priority_incident_id: String(incident._id),
          urgency_score: 50,
        };
      });

    const prioritizedAllocations = aiAllocations.length > 0 ? aiAllocations : fallbackAllocations;

    if (newestIncident && prioritizedAllocations.length > 0) {
      const newestIncidentId = String(newestIncident._id);
      const alreadySelected = prioritizedAllocations.some(
        (allocation) => String(allocation?.priority_incident_id || '') === newestIncidentId
      );

      if (!alreadySelected) {
        const firstAllocation = prioritizedAllocations[0] || {};
        const nearestAvailableResource = [...resources]
          .filter((r) => r.status !== 'offline' && r.status !== 'dispatched' && r.status !== 'maintenance')
          .sort((a, b) => distanceKm(a.location, newestIncident.location) - distanceKm(b.location, newestIncident.location))[0];

        prioritizedAllocations.unshift({
          ...firstAllocation,
          zone_id: `${Math.round(safeNumber(newestIncident?.location?.lat, 19.076) * 10) / 10}_${Math.round(safeNumber(newestIncident?.location?.lng, 72.8777) * 10) / 10}`,
          preferred_family: classifyIncidentFamily(newestIncident),
          resource_id: nearestAvailableResource ? String(nearestAvailableResource._id) : (firstAllocation.resource_id ? String(firstAllocation.resource_id) : null),
          priority_incident_id: newestIncidentId,
        });
      }
    }

    const applied = [];
    const usedIncidentIds = new Set();
    const usedResourceIds = new Set();

    for (const allocation of prioritizedAllocations) {
      if (applied.length >= maxAssignments) break;

      const priorityIncidentId = allocation.priority_incident_id ? String(allocation.priority_incident_id) : null;
      let zoneIncidents = (incidentsByZone[String(allocation.zone_id)] || [])
        .filter((incident) => !usedIncidentIds.has(String(incident._id)));

      if (priorityIncidentId) {
        const priorityIncident = incidents.find((incident) => String(incident._id) === priorityIncidentId);
        zoneIncidents = priorityIncident && !usedIncidentIds.has(priorityIncidentId) ? [priorityIncident] : zoneIncidents;
      }

      const preferredFamily = String(allocation.preferred_family || allocation.resource_family || 'general').toLowerCase();
      const targetIncident = priorityIncidentId
        ? zoneIncidents[0]
        : [...zoneIncidents]
            .sort((a, b) => {
              const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
              const aFamily = classifyIncidentFamily(a);
              const bFamily = classifyIncidentFamily(b);
              const aMatch = aFamily === preferredFamily ? 3 : aFamily !== 'general' ? 1 : 0;
              const bMatch = bFamily === preferredFamily ? 3 : bFamily !== 'general' ? 1 : 0;
              const aFresh = a.createdAt ? new Date(a.createdAt).getTime() : 0;
              const bFresh = b.createdAt ? new Date(b.createdAt).getTime() : 0;

              return (
                bMatch - aMatch ||
                ((severityOrder[b?.severity] || 0) - (severityOrder[a?.severity] || 0)) ||
                (bFresh - aFresh)
              );
            })
            .find((incident) => String(incident.dispatchStatus || '').toLowerCase() === 'unassigned') ||
        [...zoneIncidents].sort((a, b) => {
          const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
          const aFresh = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bFresh = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return (severityOrder[b?.severity] || 0) - (severityOrder[a?.severity] || 0) || (bFresh - aFresh);
        })[0];

      if (!targetIncident) continue;

      const aiPreferredResource = resourceById.get(String(allocation.resource_id));
      const candidateResources = resources
        .filter((r) => !usedResourceIds.has(String(r._id)))
        .filter((r) => r.status !== 'offline' && r.status !== 'dispatched' && r.status !== 'maintenance')
        .sort(
          (a, b) =>
            scoreResourceForIncident({ incident: targetIncident, resource: a, aiPreferredResourceId: aiPreferredResource?._id }) -
            scoreResourceForIncident({ incident: targetIncident, resource: b, aiPreferredResourceId: aiPreferredResource?._id })
        );

      const resource = candidateResources[0] || aiPreferredResource || null;

      if (resource) {
        const previousIncidentId = resource.currentIncident ? String(resource.currentIncident) : null;
        if (previousIncidentId && previousIncidentId !== String(targetIncident._id)) {
          await Incident.findByIdAndUpdate(previousIncidentId, {
            $pull: { assignedResources: resource._id },
          });
        }

        resource.status = 'dispatched';
        resource.currentIncident = targetIncident._id;
        await resource.save();
        usedResourceIds.add(String(resource._id));
      }

      let assignedPersonnel = null;
      if (!targetIncident.assignedPersonnel) {
        const requiredType = incidentToPersonnelType(targetIncident);
        const nearest = personnelPool
          .filter((p) => p.status === 'available' && p.type === requiredType)
          .sort(
            (a, b) =>
              distanceKm(a.location, targetIncident.location) - distanceKm(b.location, targetIncident.location)
          )[0];

        if (nearest) {
          nearest.status = 'busy';
          nearest.currentIncident = targetIncident._id;
          await nearest.save();

          targetIncident.assignedPersonnel = nearest._id;
          targetIncident.assignedPersonnelList = targetIncident.assignedPersonnelList || [];
          if (!targetIncident.assignedPersonnelList.map((id) => String(id)).includes(String(nearest._id))) {
            targetIncident.assignedPersonnelList.push(nearest._id);
          }

          assignedPersonnel = {
            id: String(nearest._id),
            name: nearest.name,
            unitId: nearest.contact?.unitId,
          };
        }
      }

      const alreadyHasPersonnel = Boolean(targetIncident.assignedPersonnel);
      const hasDispatchCapacity = Boolean(resource) || alreadyHasPersonnel || Boolean(assignedPersonnel);
      if (!hasDispatchCapacity) {
        continue;
      }

      targetIncident.dispatchStatus = 'dispatched';
      if (targetIncident.status === 'resolved') {
        targetIncident.status = 'active';
      }
      targetIncident.assignedResources = targetIncident.assignedResources || [];
      if (resource && !targetIncident.assignedResources.map((id) => String(id)).includes(String(resource._id))) {
        targetIncident.assignedResources.push(resource._id);
      }
      targetIncident.workflow = targetIncident.workflow || {};
      if (!targetIncident.workflow.allocatedAt) targetIncident.workflow.allocatedAt = new Date();
      if (!targetIncident.workflow.enRouteAt) targetIncident.workflow.enRouteAt = new Date();

      await targetIncident.save();
      usedIncidentIds.add(String(targetIncident._id));

      applied.push({
        incidentId: String(targetIncident._id),
        incidentTitle: targetIncident.title,
        incidentType: targetIncident.type,
        zoneId: allocation.zone_id,
        resource: resource
          ? {
              id: String(resource._id),
              name: resource.name,
              type: resource.type,
            }
          : null,
        personnel: assignedPersonnel,
        etaMinutes: resource
          ? Math.max(3, Math.round(distanceKm(resource.location, targetIncident.location) / 0.45))
          : null,
        urgencyScore: allocation.urgency_score,
        distanceKm: resource ? Number(distanceKm(resource.location, targetIncident.location).toFixed(2)) : null,
        resourceFamily: resource ? classifyResourceServiceFamily(resource) : 'personnel-only',
      });
    }

    if (applied.length === 0) {
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const fallbackIncidents = incidents
        .filter((incident) => String(incident?.dispatchStatus || '').toLowerCase() === 'unassigned')
        .sort((a, b) => {
          const aFresh = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bFresh = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return (severityOrder[b?.severity] || 0) - (severityOrder[a?.severity] || 0) || (bFresh - aFresh);
        });

      for (const incident of fallbackIncidents) {
        const requiredType = incidentToPersonnelType(incident);
        const nearest = personnelPool
          .filter((p) => p.status === 'available' && p.type === requiredType)
          .sort((a, b) => distanceKm(a.location, incident.location) - distanceKm(b.location, incident.location))[0];

        if (!nearest) continue;

        nearest.status = 'busy';
        nearest.currentIncident = incident._id;
        await nearest.save();

        incident.dispatchStatus = 'dispatched';
        if (incident.status === 'resolved') {
          incident.status = 'active';
        }
        incident.assignedPersonnel = nearest._id;
        incident.assignedPersonnelList = incident.assignedPersonnelList || [];
        if (!incident.assignedPersonnelList.map((id) => String(id)).includes(String(nearest._id))) {
          incident.assignedPersonnelList.push(nearest._id);
        }
        incident.workflow = incident.workflow || {};
        if (!incident.workflow.allocatedAt) incident.workflow.allocatedAt = new Date();
        if (!incident.workflow.enRouteAt) incident.workflow.enRouteAt = new Date();
        await incident.save();

        const zoneId = `${Math.round(safeNumber(incident?.location?.lat, 19.076) * 10) / 10}_${Math.round(safeNumber(incident?.location?.lng, 72.8777) * 10) / 10}`;
        applied.push({
          incidentId: String(incident._id),
          incidentTitle: incident.title,
          incidentType: incident.type,
          zoneId,
          resource: null,
          personnel: {
            id: String(nearest._id),
            name: nearest.name,
            unitId: nearest.contact?.unitId,
          },
          etaMinutes: null,
          urgencyScore: 50,
          distanceKm: Number(distanceKm(nearest.location, incident.location).toFixed(2)),
          resourceFamily: 'personnel-only',
        });
        break;
      }
    }

    return res.status(200).json({
      message: applied.length
        ? `Applied live plan to ${applied.length} incident(s)`
        : 'No suitable live allocations available at this moment',
      applied,
      summary: {
        appliedCount: applied.length,
        requested: maxAssignments,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
