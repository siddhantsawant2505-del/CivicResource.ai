import mongoose from 'mongoose';

const analyticsSchema = mongoose.Schema(
  {
    organization: {
      type: String,
      required: true,
      default: 'Global',
    },
    activeIncidentsCount: {
      type: Number,
      required: true,
      default: 0,
    },
    unitsDeployed: {
      type: Number,
      required: true,
      default: 0,
    },
    avgResponseTimeMinutes: {
      type: Number,
      required: true,
      default: 0,
    },
    slaCompliancePercent: {
      type: Number,
      required: true,
      default: 100,
    },
    aiPredictionsCount: {
      type: Number,
      required: true,
      default: 0,
    },
    systemHealthPercent: {
      type: Number,
      required: true,
      default: 100,
    },
    demandTimeSeries: [{
      time: String,
      actual: Number,
      predicted: Number,
      optimized: Number
    }],
    categoryBreakdown: [{
      name: String,
      value: Number,
      color: String
    }],
    weeklyTrend: [{
      day: String,
      incidents: Number,
      resolved: Number
    }]
  },
  {
    timestamps: true,
  }
);

const Analytics = mongoose.model('Analytics', analyticsSchema);
export default Analytics;
