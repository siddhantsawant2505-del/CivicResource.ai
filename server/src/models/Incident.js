import mongoose from 'mongoose';

const incidentSchema = mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['medical', 'fire', 'crime', 'infrastructure', 'traffic', 'sanitation', 'utility', 'water', 'roads', 'maintenance', 'safety'],
      required: true,
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
    },
    location: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
      address: { type: String },
    },
    trackingId: {
      type: String,
      unique: true,
      sparse: true,
    },
    reporterPhone: {
      type: String,
    },
    isAnonymous: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ['active', 'investigating', 'resolved'],
      default: 'active',
    },
    dispatchStatus: {
      type: String,
      enum: ['unassigned', 'dispatched', 'on-site', 'resolving', 'completed'],
      default: 'unassigned',
    },
    assignedPersonnel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Personnel',
    },
    assignedPersonnelList: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Personnel',
      },
    ],
    assignedResources: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Resource',
      },
    ],
    aiPredictionConfidence: {
      type: Number,
      default: 0,
    },
    trustScore: {
      type: Number,
      default: 0,
    },
    verificationMode: {
      type: String,
      enum: ['verified', 'likely-valid', 'needs-confirmation', 'likely-fake'],
      default: 'needs-confirmation',
    },
    aiTriage: {
      predictedType: { type: String },
      resourceFamily: { type: String },
      isFake: { type: Boolean, default: false },
      fakeScore: { type: Number, default: 0 },
      confidence: { type: Number, default: 0 },
      intentConfidence: { type: Number, default: 0 },
      reason: { type: String },
      keywords: [{ type: String }],
      signals: {
        strongestLabel: { type: String },
        reportedFamily: { type: String },
        civicHits: { type: Number, default: 0 },
        locationPresent: { type: Boolean, default: true },
        reporterPhonePresent: { type: Boolean, default: false },
      },
      reviewedAt: { type: Date },
      sourceModel: { type: String },
    },
    fusion: {
      clusterId: { type: String },
      isPrimary: { type: Boolean, default: true },
      primaryIncident: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Incident',
      },
      duplicateCount: { type: Number, default: 0 },
      similarityScore: { type: Number, default: 0 },
      fusedAt: { type: Date },
    },
    sla: {
      targetMinutes: { type: Number, default: 120 },
      deadlineAt: { type: Date },
      escalated: { type: Boolean, default: false },
      escalationLevel: { type: Number, default: 0 },
      escalationReason: { type: String },
      breachedAt: { type: Date },
    },
    workflow: {
      receivedAt: { type: Date },
      validatedAt: { type: Date },
      allocatedAt: { type: Date },
      enRouteAt: { type: Date },
      resolvedAt: { type: Date },
    },
    tracking: {
      currentLocation: {
        lat: { type: Number },
        lng: { type: Number },
        at: { type: Date },
        phase: { type: String },
        speedKmph: { type: Number },
        etaMinutes: { type: Number },
        etaSeconds: { type: Number },
        etaUpdatedAt: { type: Date },
      },
      path: [
        {
          lat: { type: Number },
          lng: { type: Number },
          at: { type: Date },
          phase: { type: String },
          speedKmph: { type: Number },
          etaMinutes: { type: Number },
          etaSeconds: { type: Number },
          etaUpdatedAt: { type: Date },
        },
      ],
      events: [
        {
          phase: { type: String },
          message: { type: String },
          at: { type: Date },
          meta: { type: mongoose.Schema.Types.Mixed },
        },
      ],
    },
    outcomeLearning: {
      actualResolutionMinutes: { type: Number },
      success: { type: Boolean },
      citizenRating: { type: Number, min: 1, max: 5 },
      followUpNotes: { type: String },
      recordedAt: { type: Date },
      usedForTraining: { type: Boolean, default: false },
    },
    impactAnalysis: {
      growthTrend: { type: Number, default: 0 },
      mitigationEfficiency: { type: Number, default: 0 },
      areaStressScore: { type: Number, default: 0 },
    },
    details: {
      type: String,
    },
    sourceLanguage: {
      type: String,
      enum: ['english', 'hindi', 'marathi'],
      default: 'english',
    },
    titleOriginal: {
      type: String,
    },
    detailsOriginal: {
      type: String,
    },
    titleEnglish: {
      type: String,
    },
    detailsEnglish: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const Incident = mongoose.model('Incident', incidentSchema);
export default Incident;
