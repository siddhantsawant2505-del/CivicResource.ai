import Incident from '../models/Incident.js';
import Personnel from '../models/Personnel.js';
import Resource from '../models/Resource.js';

const AI_ENGINE_URL = process.env.AI_ENGINE_URL || 'http://localhost:8000';

const TYPE_MAP = {
  public_safety: 'safety',
  utility_fault: 'utility',
  road: 'roads',
  infrastructure: 'infrastructure',
  sanitation: 'sanitation',
  safety: 'safety',
  utility: 'utility',
  water: 'water',
  roads: 'roads',
  maintenance: 'maintenance',
  medical: 'medical',
  fire: 'fire',
  crime: 'crime',
  traffic: 'traffic',
};

const COORD_FALLBACK = {
  lat: 19.076,
  lng: 72.8777,
};

const buildTrackingId = () => `CF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

const PUBLIC_FIELDS = 'title type severity location status dispatchStatus createdAt updatedAt trackingId details detailsEnglish sourceLanguage titleOriginal detailsOriginal titleEnglish aiPredictionConfidence verificationMode trustScore aiTriage fusion sla workflow outcomeLearning';

const roundNumber = (value, digits = 1) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  const p = 10 ** digits;
  return Math.round(n * p) / p;
};

const buildPublicTimeline = (incident = {}) => {
  const workflow = incident.workflow || {};
  const aiConfidence = Number(incident?.aiTriage?.confidence || incident?.aiPredictionConfidence || 0);
  const aiReason = incident?.aiTriage?.reason || 'Complaint evaluated against civic relevance signals';
  const dispatchStatus = String(incident.dispatchStatus || '').toLowerCase();
  const incidentStatus = String(incident.status || '').toLowerCase();

  const allocatedDone = Boolean(workflow.allocatedAt || dispatchStatus !== 'unassigned' || incident?.assignedPersonnel || (incident?.assignedResources || []).length);
  const enRouteDone = Boolean(workflow.enRouteAt || ['dispatched', 'on-site', 'resolving', 'completed'].includes(dispatchStatus) || ['investigating', 'resolved'].includes(incidentStatus));
  const resolvedDone = incidentStatus === 'resolved';

  return [
    {
      key: 'received',
      label: 'Received',
      done: true,
      timestamp: workflow.receivedAt || incident.createdAt,
      explanation: 'Complaint registered in civic intake queue',
      confidence: null,
    },
    {
      key: 'validated',
      label: 'Validated',
      done: Boolean(workflow.validatedAt || incident?.aiTriage?.reviewedAt),
      timestamp: workflow.validatedAt || incident?.aiTriage?.reviewedAt || null,
      explanation: aiReason,
      confidence: aiConfidence || null,
    },
    {
      key: 'allocated',
      label: 'Allocated',
      done: allocatedDone,
      timestamp: workflow.allocatedAt || (allocatedDone ? incident.updatedAt : null),
      explanation: allocatedDone ? 'Nearest suitable field resource was allocated' : 'Waiting for dispatch allocation',
      confidence: null,
    },
    {
      key: 'en_route',
      label: 'En Route',
      done: enRouteDone,
      timestamp: workflow.enRouteAt || (enRouteDone ? incident.updatedAt : null),
      explanation: enRouteDone ? 'Field unit acknowledged and moved toward location' : 'Field unit not yet in transit',
      confidence: null,
    },
    {
      key: 'resolved',
      label: 'Resolved',
      done: resolvedDone,
      timestamp: workflow.resolvedAt || (resolvedDone ? incident.updatedAt : null),
      explanation: resolvedDone ? 'Issue marked complete by operations' : 'Work still in progress',
      confidence: null,
    },
  ];
};

const toPublicIncident = (incidentDoc) => {
  if (!incidentDoc) return null;
  const incident = typeof incidentDoc.toObject === 'function' ? incidentDoc.toObject() : incidentDoc;
  const timeline = buildPublicTimeline(incident);
  return {
    ...incident,
    timeline,
    transparency: {
      aiConfidence: roundNumber(incident?.aiTriage?.confidence || incident?.aiPredictionConfidence || 0, 1),
      aiExplanation: incident?.aiTriage?.reason || 'Complaint validated through triage model',
    },
  };
};

const ensureTrackingIds = async (incidents = []) => {
  const missing = incidents.filter((incident) => !incident.trackingId);
  if (missing.length === 0) {
    return incidents;
  }

  await Promise.all(
    missing.map(async (incident) => {
      incident.trackingId = buildTrackingId();
      await incident.save();
    })
  );

  return incidents;
};

const inferCoordinates = (location = {}) => {
  if (typeof location.lat === 'number' && typeof location.lng === 'number') {
    return { lat: location.lat, lng: location.lng };
  }

  const address = (location.address || '').toLowerCase();
  if (address.includes('andheri')) return { lat: 19.1136, lng: 72.8697 };
  if (address.includes('bandra')) return { lat: 19.0544, lng: 72.8406 };
  if (address.includes('thane')) return { lat: 19.1176, lng: 72.906 };

  return COORD_FALLBACK;
};

const haversineKm = (lat1, lng1, lat2, lng2) => {
  const toRad = (v) => (Math.PI / 180) * Number(v || 0);
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const tokenize = (value = '') =>
  String(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);

const textSimilarity = (a = '', b = '') => {
  const aSet = new Set(tokenize(a));
  const bSet = new Set(tokenize(b));
  if (!aSet.size || !bSet.size) return 0;
  const intersection = [...aSet].filter((x) => bSet.has(x)).length;
  const union = new Set([...aSet, ...bSet]).size;
  return union ? intersection / union : 0;
};

const nextSeverity = (current = 'medium') => {
  const order = ['low', 'medium', 'high', 'critical'];
  const idx = Math.max(0, order.indexOf(current));
  return order[Math.min(order.length - 1, idx + 1)];
};

const computeSlaMinutes = ({ severity = 'medium', type = 'infrastructure' }) => {
  const severityBase = {
    critical: 35,
    high: 60,
    medium: 120,
    low: 240,
  };
  const typeModifier = {
    water: -15,
    sanitation: -10,
    safety: -20,
    roads: 10,
    maintenance: 5,
    utility: 0,
    infrastructure: 15,
    traffic: 0,
  };

  const base = severityBase[severity] ?? 120;
  const modifier = typeModifier[type] ?? 0;
  return Math.max(20, base + modifier);
};

const computeVerificationMode = (trustScore = 0) => {
  if (trustScore >= 85) return 'verified';
  if (trustScore >= 65) return 'likely-valid';
  if (trustScore >= 45) return 'needs-confirmation';
  return 'likely-fake';
};

const computeTrustScore = ({ aiTriage, normalizedPhone, locationWithCoords, reporterStats }) => {
  const baseConfidence = Number(aiTriage?.confidence || 50);
  const fakePenalty = Number(aiTriage?.fake_score || 0) * 0.55;
  const phoneBonus = normalizedPhone ? 8 : -8;
  const locationBonus = Number.isFinite(locationWithCoords?.lat) && Number.isFinite(locationWithCoords?.lng) ? 7 : -6;
  const historyBonus = Math.min(15, (reporterStats?.resolved || 0) * 2.5);
  const rejectionPenalty = Math.min(18, (reporterStats?.rejected || 0) * 6);

  const score = baseConfidence + phoneBonus + locationBonus + historyBonus - rejectionPenalty - fakePenalty;
  return Math.max(0, Math.min(100, Math.round(score)));
};

const detectDuplicateFusion = async ({ titleEnglish, detailsEnglish, locationWithCoords, triagedType }) => {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const candidateIncidents = await Incident.find({
    status: { $ne: 'resolved' },
    type: triagedType,
    createdAt: { $gte: oneDayAgo },
  })
    .sort({ createdAt: -1 })
    .limit(30)
    .select('title details location severity fusion');

  let best = null;
  const currentText = `${titleEnglish} ${detailsEnglish}`;
  for (const incident of candidateIncidents) {
    const distance = haversineKm(locationWithCoords.lat, locationWithCoords.lng, incident?.location?.lat, incident?.location?.lng);
    if (distance > 1.5) continue;

    const similarity = textSimilarity(currentText, `${incident.title || ''} ${incident.details || ''}`);
    const geoScore = Math.max(0, 1 - distance / 1.5);
    const combinedScore = similarity * 0.7 + geoScore * 0.3;
    if (!best || combinedScore > best.score) {
      best = { incident, similarity, distance, score: combinedScore };
    }
  }

  if (!best || best.score < 0.42) return null;
  const primaryIncident = best.incident.fusion?.primaryIncident ? best.incident.fusion.primaryIncident : best.incident._id;
  const clusterId = best.incident.fusion?.clusterId || `FUS-${Date.now().toString(36).toUpperCase()}`;

  return {
    clusterId,
    primaryIncident,
    similarityScore: Number((best.score * 100).toFixed(1)),
    duplicateIncidentId: best.incident._id,
  };
};

const normalizeLanguage = (lang = 'english') => {
  const value = String(lang).toLowerCase();
  if (value === 'hi' || value === 'hindi') return 'hindi';
  if (value === 'mr' || value === 'marathi') return 'marathi';
  return 'english';
};

const normalizeType = (type = 'infrastructure') => {
  const value = String(type || '').toLowerCase().replace(/\s+/g, '_');
  return TYPE_MAP[value] || 'infrastructure';
};

const analyzeComplaintIntake = async (payload) => {
  try {
    const response = await fetch(`${AI_ENGINE_URL}/analyze/complaint-intake`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch {
    return null;
  }
};

const nlpNormalize = async ({ text, language }) => {
  try {
    const response = await fetch(`${AI_ENGINE_URL}/nlp/normalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, language }),
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch {
    return null;
  }
};

// @desc    Get all active incidents
// @route   GET /api/incidents
// @access  Private
export const getIncidents = async (req, res, next) => {
  try {
    // Only return non-resolved by default; allow explicit status or all.
    let statusFilter = { status: { $ne: 'resolved' } };
    if (req.query.status && req.query.status !== 'all') {
      statusFilter = { status: req.query.status };
    }
    if (req.query.status === 'all') {
      statusFilter = {};
    }
    const incidents = await Incident.find(statusFilter).sort({ createdAt: -1 });
    res.json(incidents.map((incident) => toPublicIncident(incident)));
  } catch (error) {
    next(error);
  }
};

// @desc    Get public complaint archive
// @route   GET /api/public/incidents
// @access  Public
export const getPublicIncidents = async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit || 24), 50);
    const incidents = await Incident.find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .select(PUBLIC_FIELDS);

    await ensureTrackingIds(incidents);

    res.json(incidents);
  } catch (error) {
    next(error);
  }
};

// @desc    Get a single public complaint detail
// @route   GET /api/public/incidents/:id
// @access  Public
export const getPublicIncidentById = async (req, res, next) => {
  try {
    const incident = await Incident.findById(req.params.id).select(PUBLIC_FIELDS);

    if (!incident) {
      res.status(404);
      throw new Error('Incident not found');
    }

    await ensureTrackingIds([incident]);
    res.json(toPublicIncident(incident));
  } catch (error) {
    next(error);
  }
};

// @desc    Track public complaints by phone or tracking id
// @route   GET /api/public/incidents/track
// @access  Public
export const trackPublicComplaint = async (req, res, next) => {
  try {
    const { phone, trackingId } = req.query;
    const filters = [];

    if (trackingId) {
      filters.push({ trackingId: String(trackingId).trim().toUpperCase() });
    }

    if (phone) {
      filters.push({ reporterPhone: String(phone).trim() });
    }

    if (filters.length === 0) {
      return res.json([]);
    }

    const incidents = await Incident.find({ $and: filters })
      .sort({ createdAt: -1 })
      .select(PUBLIC_FIELDS);

    await ensureTrackingIds(incidents);

    res.json(incidents.map((incident) => toPublicIncident(incident)));
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new incident report
// @route   POST /api/incidents
// @access  Private
export const createIncident = async (req, res, next) => {
  try {
    const {
      title,
      type,
      severity,
      location,
      details,
      description,
      aiPredictionConfidence,
      sourceLanguage,
      reporterPhone,
      isAnonymous = true,
    } = req.body;

    const isPublicSubmission = req.originalUrl.includes('/api/public/incidents');
    const normalizedPhone = reporterPhone ? String(reporterPhone).trim() : '';
    if (isPublicSubmission && !normalizedPhone) {
      res.status(400);
      throw new Error('Mobile number is required for public complaint submission');
    }

    const normalizedLanguage = normalizeLanguage(sourceLanguage);
    const normalizedType = normalizeType(type);
    const detailsText = details || description || '';
    const locationWithCoords = {
      ...(location || {}),
      ...inferCoordinates(location),
    };
    const hasLocation = typeof locationWithCoords.lat === 'number' && typeof locationWithCoords.lng === 'number';

    const aiTriage = (await analyzeComplaintIntake({
      title: title || '',
      details: detailsText,
      reported_type: normalizedType,
      language: normalizedLanguage,
      location_address: locationWithCoords.address || '',
      reporter_phone_present: Boolean(normalizedPhone),
      location_present: hasLocation,
    })) || {
      is_fake: false,
      fake_score: 28,
      confidence: 72,
      intent_confidence: 58,
      predicted_type: normalizedType,
      resource_family: normalizedType,
      keywords: [],
      reason: 'Fallback triage used because the AI engine was unavailable',
      signals: {
        strongest_label: normalizedType,
        reported_family: normalizedType,
        civic_hits: 1,
        location_present: hasLocation,
        reporter_phone_present: Boolean(normalizedPhone),
      },
    };

    const aiPredictedType = normalizeType(aiTriage.predicted_type || aiTriage.resource_family || normalizedType);
    const triagedType = normalizedType !== 'general' ? normalizedType : aiPredictedType;
    const shouldRejectComplaint = Boolean(isPublicSubmission && aiTriage.is_fake);

    if (shouldRejectComplaint) {
      res.status(422);
      throw new Error(aiTriage.reason || 'Complaint rejected by AI triage as likely fake or non-civic');
    }

    const [titleNlp, detailsNlp] = await Promise.all([
      nlpNormalize({ text: title || '', language: normalizedLanguage }),
      nlpNormalize({ text: detailsText, language: normalizedLanguage }),
    ]);

    const titleEnglish = titleNlp?.english_text || title || 'Untitled incident';
    const detailsEnglish = detailsNlp?.english_text || detailsText;
    const reporterStats = normalizedPhone
      ? await Incident.aggregate([
        { $match: { reporterPhone: normalizedPhone } },
        {
          $group: {
            _id: '$reporterPhone',
            total: { $sum: 1 },
            resolved: {
              $sum: {
                $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0],
              },
            },
            rejected: {
              $sum: {
                $cond: [{ $eq: ['$verificationMode', 'likely-fake'] }, 1, 0],
              },
            },
          },
        },
      ])
      : [];
    const trustScore = computeTrustScore({
      aiTriage,
      normalizedPhone,
      locationWithCoords,
      reporterStats: reporterStats[0] || { total: 0, resolved: 0, rejected: 0 },
    });
    const verificationMode = computeVerificationMode(trustScore);
    const duplicateFusion = await detectDuplicateFusion({
      titleEnglish,
      detailsEnglish,
      locationWithCoords,
      triagedType,
    });
    const slaTargetMinutes = computeSlaMinutes({ severity, type: triagedType });
    const deadlineAt = new Date(Date.now() + slaTargetMinutes * 60 * 1000);

    const incident = new Incident({
      trackingId: buildTrackingId(),
      title: titleEnglish,
      type: triagedType,
      severity: ['low', 'medium', 'high', 'critical'].includes(severity) ? severity : 'medium',
      status: 'active',
      dispatchStatus: 'unassigned',
      assignedPersonnel: null,
      assignedPersonnelList: [],
      assignedResources: [],
      location: locationWithCoords,
      details: detailsEnglish,
      aiPredictionConfidence: Math.max(
        Number(aiPredictionConfidence || 0),
        Number(aiTriage.confidence || aiTriage.intent_confidence || 0)
      ),
      trustScore,
      verificationMode,
      aiTriage: {
        predictedType: triagedType,
        resourceFamily: aiTriage.resource_family || triagedType,
        isFake: Boolean(aiTriage.is_fake),
        fakeScore: Number(aiTriage.fake_score || 0),
        confidence: Number(aiTriage.confidence || 0),
        intentConfidence: Number(aiTriage.intent_confidence || 0),
        reason: aiTriage.reason || 'Complaint accepted',
        keywords: Array.isArray(aiTriage.keywords) ? aiTriage.keywords.slice(0, 8) : [],
        signals: aiTriage.signals || {},
        reviewedAt: new Date(),
        sourceModel: 'civicresource-complaint-triage-v1',
      },
      fusion: {
        clusterId: duplicateFusion?.clusterId || `SGL-${Date.now().toString(36).toUpperCase()}`,
        isPrimary: !duplicateFusion,
        primaryIncident: duplicateFusion?.primaryIncident,
        duplicateCount: 0,
        similarityScore: Number(duplicateFusion?.similarityScore || 0),
        fusedAt: duplicateFusion ? new Date() : null,
      },
      sla: {
        targetMinutes: slaTargetMinutes,
        deadlineAt,
        escalated: false,
        escalationLevel: 0,
      },
      workflow: {
        receivedAt: new Date(),
        validatedAt: new Date(),
      },
      reporterPhone: normalizedPhone,
      isAnonymous: isPublicSubmission ? true : Boolean(isAnonymous),
      sourceLanguage: normalizedLanguage,
      titleOriginal: title || titleEnglish,
      detailsOriginal: detailsText,
      titleEnglish,
      detailsEnglish,
    });

    let createdIncident = await incident.save();

    if (duplicateFusion?.duplicateIncidentId) {
      const existing = await Incident.findById(duplicateFusion.duplicateIncidentId);
      if (existing) {
        existing.fusion = existing.fusion || {};
        existing.fusion.clusterId = duplicateFusion.clusterId;
        existing.fusion.isPrimary = true;
        existing.fusion.duplicateCount = Number(existing.fusion.duplicateCount || 0) + 1;
        existing.severity = nextSeverity(existing.severity);
        await existing.save();
      }
    }

    res.status(201).json(createdIncident);
  } catch (error) {
    next(error);
  }
};

// @desc    Update incident status
// @route   PUT /api/incidents/:id/status
// @access  Private
export const updateIncidentStatus = async (req, res, next) => {
  try {
    const { status, dispatchStatus } = req.body;
    const incident = await Incident.findById(req.params.id);

    if (incident) {
      if (status) {
        incident.status = status;
      }
      if (dispatchStatus) {
        incident.dispatchStatus = dispatchStatus;
      }

      incident.workflow = incident.workflow || {};

      if (incident.dispatchStatus && incident.dispatchStatus !== 'unassigned' && !incident.workflow.allocatedAt) {
        incident.workflow.allocatedAt = new Date();
      }

      if ((status === 'investigating' || ['dispatched', 'on-site', 'resolving', 'completed'].includes(String(dispatchStatus || '').toLowerCase())) && !incident.workflow.enRouteAt) {
        incident.workflow.enRouteAt = new Date();
      }

      // Closing an incident must release the assigned responder back to the available pool,
      // while preserving assignment references for historical views.
      if (status === 'resolved') {
        incident.dispatchStatus = 'completed';
        incident.workflow.resolvedAt = new Date();
        incident.tracking = incident.tracking || {};
        incident.tracking.currentLocation = {
          ...(incident.tracking.currentLocation || {}),
          etaMinutes: 0,
          etaSeconds: 0,
          etaUpdatedAt: new Date(),
          phase: 'resolved',
        };

        const resolvedAtTs = incident.workflow.resolvedAt || new Date();
        const actualResolutionMinutes = Math.max(1, Math.round((resolvedAtTs.getTime() - new Date(incident.createdAt).getTime()) / 60000));
        incident.outcomeLearning = {
          ...(incident.outcomeLearning || {}),
          actualResolutionMinutes,
          success: incident.outcomeLearning?.success ?? true,
          recordedAt: new Date(),
          usedForTraining: Boolean(incident.outcomeLearning?.citizenRating),
        };

        const personnelIds = [
          ...(incident.assignedPersonnel ? [incident.assignedPersonnel] : []),
          ...(incident.assignedPersonnelList || []),
        ].map((id) => String(id));

        const uniquePersonnelIds = [...new Set(personnelIds)].filter(Boolean);

        if (uniquePersonnelIds.length > 0) {
          for (const personnelId of uniquePersonnelIds) {
            const personnel = await Personnel.findById(personnelId);
            if (personnel) {
              if (personnel.taskQueue && personnel.taskQueue.length > 0) {
                // Pop from queue and assign as current
                const nextIncidentId = personnel.taskQueue.shift();
                personnel.currentIncident = nextIncidentId;
                personnel.status = 'busy'; // Remains busy
                await personnel.save();

                // Update the next incident to be dispatched
                const nextIncident = await Incident.findById(nextIncidentId);
                if (nextIncident) {
                  nextIncident.assignedPersonnel = personnel._id;
                  nextIncident.dispatchStatus = 'dispatched';
                  if (personnel.assignedResource) {
                    nextIncident.assignedResources = [personnel.assignedResource];
                  }
                  await nextIncident.save();
                }
              } else {
                personnel.status = 'available';
                personnel.currentIncident = null;
                // Resource also becomes available if no more tasks
                if (personnel.assignedResource) {
                  await Resource.findByIdAndUpdate(personnel.assignedResource, { 
                    status: 'available', 
                    currentIncident: null,
                    assignedPersonnel: null 
                  });
                }
                await personnel.save();
              }
            }
          }
        }
      }

      const updatedIncident = await incident.save();
      res.json(updatedIncident);
    } else {
      res.status(404);
      throw new Error('Incident not found');
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Record post-resolution public outcome feedback
// @route   POST /api/public/incidents/:id/feedback
// @access  Public
export const submitPublicOutcomeFeedback = async (req, res, next) => {
  try {
    const { citizenRating, success, followUpNotes } = req.body || {};
    const incident = await Incident.findById(req.params.id);

    if (!incident) {
      res.status(404);
      throw new Error('Incident not found');
    }

    const numericRating = Number(citizenRating);
    if (!Number.isFinite(numericRating) || numericRating < 1 || numericRating > 5) {
      res.status(400);
      throw new Error('citizenRating must be between 1 and 5');
    }

    incident.workflow = incident.workflow || {};
    if (!incident.workflow.resolvedAt && incident.status === 'resolved') {
      incident.workflow.resolvedAt = new Date(incident.updatedAt || new Date());
    }

    const resolvedAt = incident.workflow.resolvedAt || new Date();
    const actualResolutionMinutes = Math.max(1, Math.round((new Date(resolvedAt).getTime() - new Date(incident.createdAt).getTime()) / 60000));
    incident.outcomeLearning = {
      ...(incident.outcomeLearning || {}),
      actualResolutionMinutes,
      success: typeof success === 'boolean' ? success : true,
      citizenRating: numericRating,
      followUpNotes: String(followUpNotes || '').slice(0, 600),
      recordedAt: new Date(),
      usedForTraining: true,
    };

    await incident.save();

    res.status(200).json({
      message: 'Outcome feedback recorded',
      incident: toPublicIncident(incident),
    });
  } catch (error) {
    next(error);
  }
};
