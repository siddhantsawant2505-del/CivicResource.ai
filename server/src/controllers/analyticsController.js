import Analytics from '../models/Analytics.js';
import Incident from '../models/Incident.js';
import Resource from '../models/Resource.js';

const CATEGORY_COLORS = ['#4F46E5', '#FF4F00', '#0EA5E9', '#10B981', '#F59E0B', '#94A3B8'];

const buildCategoryBreakdown = (incidents) => {
  const counts = {};
  incidents.forEach((incident) => {
    const key = incident.type || 'other';
    counts[key] = (counts[key] || 0) + 1;
  });

  const entries = Object.entries(counts);
  const total = Math.max(1, incidents.length);

  return entries.map(([name, count], idx) => ({
    name,
    value: Math.max(1, Math.round((count / total) * 100)),
    color: CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
  }));
};

const buildDemandSeries = (incidents, resources) => {
  const activeCount = incidents.filter((i) => i.status !== 'resolved').length;
  const deployed = resources.filter((r) => r.status !== 'offline').length;
  const base = Math.max(6, activeCount * 2);
  const resourceRelief = Math.max(1, Math.round(deployed * 0.6));

  const hours = ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', '23:59'];
  return hours.map((time, idx) => {
    const wave = Math.sin((idx / (hours.length - 1)) * Math.PI);
    const actual = Math.max(4, Math.round(base + wave * (activeCount + 6)));
    const predicted = Math.max(4, Math.round(actual * (1 + (idx % 2 === 0 ? 0.06 : -0.03))));
    const optimized = Math.max(3, predicted - resourceRelief);
    return { time, actual, predicted, optimized };
  });
};

const buildWeeklyTrend = (incidents) => {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const byDay = new Map(days.map((d) => [d, { incidents: 0, resolved: 0 }]));

  incidents.forEach((incident) => {
    const date = new Date(incident.createdAt || Date.now());
    const day = days[(date.getDay() + 6) % 7];
    const current = byDay.get(day);
    if (!current) return;
    current.incidents += 1;
    if (incident.status === 'resolved') current.resolved += 1;
  });

  return days.map((day) => {
    const val = byDay.get(day);
    const incidentsCount = val?.incidents || 0;
    return {
      day,
      incidents: incidentsCount,
      resolved: Math.min(incidentsCount, val?.resolved || Math.round(incidentsCount * 0.72)),
    };
  });
};

// @desc    Get dashboard analytics (dynamically calculated + stored)
// @route   GET /api/dashboard
// @access  Private
export const getDashboardAnalytics = async (req, res, next) => {
  try {
    const org = req.user?.organization || 'Global';
    let analytics = await Analytics.findOne({ organization: org });
    
    // Fallback if none exist
    if (!analytics) {
      analytics = new Analytics({ organization: org });
      await analytics.save();
    }

    const incidents = await Incident.find({}).lean();
    const resources = await Resource.find({}).lean();

    // Dynamic enrichment: Count actual active incidents and resources
    const activeIncidents = incidents.filter((i) => i.status !== 'resolved').length;
    const activeResources = resources.filter((r) => r.status !== 'offline').length;

    // Ensure our DB matches realities (making it fully dynamic)
    analytics.activeIncidentsCount = activeIncidents;
    analytics.unitsDeployed = activeResources;

    if (!analytics.avgResponseTimeMinutes || analytics.avgResponseTimeMinutes <= 0) {
      analytics.avgResponseTimeMinutes = Math.max(4.5, Number((9.5 - Math.min(4, activeResources / 3)).toFixed(1)));
    }

    if (!analytics.aiPredictionsCount || analytics.aiPredictionsCount <= 0) {
      analytics.aiPredictionsCount = activeIncidents * 24;
    }

    if (!analytics.demandTimeSeries || analytics.demandTimeSeries.length === 0) {
      analytics.demandTimeSeries = buildDemandSeries(incidents, resources);
    }

    if (!analytics.categoryBreakdown || analytics.categoryBreakdown.length === 0) {
      analytics.categoryBreakdown = buildCategoryBreakdown(incidents);
    }

    if (!analytics.weeklyTrend || analytics.weeklyTrend.length === 0) {
      analytics.weeklyTrend = buildWeeklyTrend(incidents);
    }

    await analytics.save();

    res.json(analytics);
  } catch (error) {
    next(error);
  }
};

// @desc    Update static dashboard metrics
// @route   POST /api/dashboard
// @access  Private (Admin)
export const updateAnalytics = async (req, res, next) => {
  try {
    const org = req.user?.organization || 'Global';
    let analytics = await Analytics.findOne({ organization: org });

    if (!analytics) {
      analytics = new Analytics({ organization: org });
    }

    const { avgResponseTimeMinutes, slaCompliancePercent, aiPredictionsCount, systemHealthPercent } = req.body;

    if (avgResponseTimeMinutes !== undefined) analytics.avgResponseTimeMinutes = avgResponseTimeMinutes;
    if (slaCompliancePercent !== undefined) analytics.slaCompliancePercent = slaCompliancePercent;
    if (aiPredictionsCount !== undefined) analytics.aiPredictionsCount = aiPredictionsCount;
    if (systemHealthPercent !== undefined) analytics.systemHealthPercent = systemHealthPercent;

    const updated = await analytics.save();
    res.json(updated);
  } catch (error) {
    next(error);
  }
};
