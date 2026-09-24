import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Incident from '../models/Incident.js';
import Personnel from '../models/Personnel.js';

dotenv.config();

const DEFAULTS = {
  intervalMinutes: 1,
  timeScale: 0.1,
  speedKmph: 32,
  workMinutesMin: 15,
  workMinutesMax: 30,
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  const parsed = {};

  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true;
    parsed[key] = value;
    if (value !== true) i += 1;
  }

  return parsed;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const toNumber = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
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

const interpolate = (start, end, ratio) => ({
  lat: start.lat + (end.lat - start.lat) * ratio,
  lng: start.lng + (end.lng - start.lng) * ratio,
});

const clampTail = (items, limit) => (items.length > limit ? items.slice(items.length - limit) : items);

const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const chooseOutboundMinutes = (requestedValue) => {
  const parsed = Number(requestedValue);
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.max(1, parsed);
  }

  return randomInt(11, 20);
};

const addTrackingPoint = (incident, point) => {
  incident.tracking = incident.tracking || {};
  incident.tracking.path = clampTail([...(incident.tracking.path || []), point], 2500);
  incident.tracking.currentLocation = {
    lat: point.lat,
    lng: point.lng,
    at: point.at,
    phase: point.phase,
    speedKmph: point.speedKmph,
    etaMinutes: point.etaMinutes,
    etaSeconds: point.etaSeconds,
    etaUpdatedAt: point.etaUpdatedAt || point.at,
  };
};

const addTrackingEvent = (incident, event) => {
  incident.tracking = incident.tracking || {};
  incident.tracking.events = clampTail([...(incident.tracking.events || []), event], 400);
};

const jitterPoint = (point, seed) => {
  const phase = seed / 3;
  return {
    lat: point.lat + Math.sin(phase) * 0.00012,
    lng: point.lng + Math.cos(phase) * 0.00012,
  };
};

const getLiveResolutionState = async (incidentId) => {
  const fresh = await Incident.findById(incidentId).select('status dispatchStatus workflow tracking');
  return {
    resolved: String(fresh?.status || '').toLowerCase() === 'resolved',
    dispatchStatus: String(fresh?.dispatchStatus || '').toLowerCase(),
  };
};

const fastForwardToDestination = async ({ incident, personnel, destination, unitId, note, at }) => {
  const resolvedAt = at || new Date();
  incident.status = 'resolved';
  incident.dispatchStatus = 'completed';
  incident.workflow = incident.workflow || {};
  incident.workflow.resolvedAt = incident.workflow.resolvedAt || resolvedAt;
  addTrackingPoint(incident, {
    lat: Number(destination.lat.toFixed(6)),
    lng: Number(destination.lng.toFixed(6)),
    at: resolvedAt,
    phase: 'resolved',
    speedKmph: 0,
    etaMinutes: 0,
    etaSeconds: 0,
    etaUpdatedAt: resolvedAt,
  });
  addTrackingEvent(incident, {
    phase: 'resolved-fast-forward',
    message: note || `Unit ${unitId} completed the incident immediately after resolution`,
    at: resolvedAt,
    meta: { fastForwarded: true },
  });
  personnel.location = { lat: destination.lat, lng: destination.lng };
  await Promise.all([incident.save(), personnel.save()]);
};

const usage = () => {
  console.log('Usage:');
  console.log('  node src/scripts/simulateWorkerJourney.js --unitId WT-21 [--incidentId <id>] [--intervalMinutes 1] [--timeScale 0.1] [--speedKmph 32] [--plannedTravelMinutes 16] [--workMinutes 20]');
  console.log('');
  console.log('Notes:');
  console.log('  --timeScale 0.1 means one simulated minute takes 6 real seconds.');
  console.log('  If --incidentId is omitted, script uses worker currentIncident.');
};

const simulateLeg = async ({
  incident,
  personnel,
  from,
  to,
  phase,
  intervalMinutes,
  speedKmph,
  timeScale,
  startedAt,
  plannedMinutes,
}) => {
  const distanceKm = haversineKm(from.lat, from.lng, to.lat, to.lng);
  const travelMinutes = Math.max(1, Math.round(chooseOutboundMinutes(plannedMinutes || Math.round((distanceKm / Math.max(8, speedKmph)) * 60))));
  const steps = Math.max(2, Math.ceil(travelMinutes / Math.max(0.25, intervalMinutes)));

  for (let i = 1; i <= steps; i += 1) {
    const liveState = await getLiveResolutionState(incident._id);
    if (liveState.resolved) {
      const now = new Date();
      await fastForwardToDestination({
        incident,
        personnel,
        destination: to,
        unitId: personnel.contact?.unitId || 'UNKNOWN',
        note: `Unit ${personnel.contact?.unitId || 'UNKNOWN'} fast-forwarded to target after worker resolution`,
        at: now,
      });
      return {
        travelMinutes,
        finishedAt: now,
        interrupted: true,
      };
    }

    const ratio = i / steps;
    const point = interpolate(from, to, ratio);
    const simulatedAt = new Date(startedAt.getTime() + i * intervalMinutes * 60 * 1000);
    const remainingMinutes = Math.max(0, travelMinutes - i * intervalMinutes);
    const etaMinutes = Math.max(0, Math.round(remainingMinutes));
    const etaSeconds = Math.max(0, Math.round(remainingMinutes * 60));

    personnel.location = { lat: point.lat, lng: point.lng };
    addTrackingPoint(incident, {
      lat: Number(point.lat.toFixed(6)),
      lng: Number(point.lng.toFixed(6)),
      at: new Date(),
      phase,
      speedKmph: Number(speedKmph.toFixed(1)),
      etaMinutes,
      etaSeconds,
      etaUpdatedAt: new Date(),
    });

    await Promise.all([incident.save(), personnel.save()]);
    console.log(`[${simulatedAt.toISOString()}] ${phase} ping ${i}/${steps} - ETA ${etaMinutes}m`);

    const waitMs = Math.max(50, Math.round(intervalMinutes * 60 * 1000 * Math.max(0.01, timeScale)));
    await sleep(waitMs);
  }

  return {
    travelMinutes,
    finishedAt: new Date(startedAt.getTime() + steps * intervalMinutes * 60 * 1000),
  };
};

const run = async () => {
  const args = parseArgs();
  const unitId = String(args.unitId || '').trim().toUpperCase();
  const incidentId = String(args.incidentId || '').trim();
  const intervalMinutes = Math.max(0.25, toNumber(args.intervalMinutes, DEFAULTS.intervalMinutes));
  const timeScale = Math.max(0.01, toNumber(args.timeScale, DEFAULTS.timeScale));
  const speedKmph = Math.max(8, toNumber(args.speedKmph, DEFAULTS.speedKmph));
  const fixedWorkMinutes = toNumber(args.workMinutes, NaN);
  const outboundMinutes = chooseOutboundMinutes(args.plannedTravelMinutes);

  if (!unitId) {
    usage();
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);

  try {
    const personnel = await Personnel.findOne({ 'contact.unitId': unitId });
    if (!personnel) {
      throw new Error(`Personnel not found for unitId ${unitId}`);
    }

    let incident = null;
    if (incidentId) {
      incident = await Incident.findById(incidentId);
    } else if (personnel.currentIncident) {
      incident = await Incident.findById(personnel.currentIncident);
    }

    if (!incident) {
      throw new Error('No incident found. Pass --incidentId or assign one to worker first.');
    }

    const base = {
      lat: Number(personnel.location?.lat || 19.076),
      lng: Number(personnel.location?.lng || 72.8777),
    };
    const destination = {
      lat: Number(incident.location?.lat || 19.076),
      lng: Number(incident.location?.lng || 72.8777),
    };

    personnel.status = 'busy';
    personnel.currentIncident = incident._id;

    incident.assignedPersonnel = incident.assignedPersonnel || personnel._id;
    incident.assignedPersonnelList = incident.assignedPersonnelList || [];
    if (!incident.assignedPersonnelList.some((id) => String(id) === String(personnel._id))) {
      incident.assignedPersonnelList.push(personnel._id);
    }

    incident.status = 'investigating';
    incident.dispatchStatus = 'dispatched';
    incident.workflow = incident.workflow || {};
    incident.workflow.allocatedAt = incident.workflow.allocatedAt || new Date();
    incident.workflow.enRouteAt = incident.workflow.enRouteAt || new Date();

    addTrackingEvent(incident, {
      phase: 'accepted',
      message: `Unit ${unitId} accepted dispatch`,
      at: new Date(),
      meta: { unitId, incidentId: String(incident._id) },
    });

    await Promise.all([incident.save(), personnel.save()]);
    console.log(`Starting simulation for incident ${incident.trackingId || incident._id} with unit ${unitId}`);

    const outboundStart = new Date();
    const outbound = await simulateLeg({
      incident,
      personnel,
      from: base,
      to: destination,
      phase: 'en-route',
      intervalMinutes,
      speedKmph,
      timeScale,
      startedAt: outboundStart,
      plannedMinutes: outboundMinutes,
    });

    if (outbound.interrupted) {
      personnel.status = 'available';
      personnel.currentIncident = null;
      await personnel.save();
      console.log('Simulation fast-forwarded after worker resolution');
      return;
    }

    incident.dispatchStatus = 'on-site';
    addTrackingEvent(incident, {
      phase: 'arrived',
      message: `Unit ${unitId} reached incident site`,
      at: outbound.finishedAt,
      meta: { travelMinutes: outbound.travelMinutes },
    });

    await incident.save();

    const workMinutes = Number.isFinite(fixedWorkMinutes)
      ? Math.max(1, fixedWorkMinutes)
      : Math.floor(Math.random() * (DEFAULTS.workMinutesMax - DEFAULTS.workMinutesMin + 1)) + DEFAULTS.workMinutesMin;

    const workSteps = Math.max(1, Math.ceil(workMinutes / intervalMinutes));
    const workStart = outbound.finishedAt;
    incident.dispatchStatus = 'resolving';

    for (let i = 1; i <= workSteps; i += 1) {
      const liveState = await getLiveResolutionState(incident._id);
      if (liveState.resolved) {
        await fastForwardToDestination({
          incident,
          personnel,
          destination,
          unitId,
          note: `Unit ${unitId} completed work immediately after worker resolution`,
          at: new Date(),
        });
        personnel.status = 'available';
        personnel.currentIncident = null;
        personnel.location = base;
        await personnel.save();
        console.log('Simulation fast-completed during work phase');
        return;
      }

      const simulatedAt = new Date(workStart.getTime() + i * intervalMinutes * 60 * 1000);
      const wPoint = jitterPoint(destination, i);

      personnel.location = { lat: wPoint.lat, lng: wPoint.lng };
      addTrackingPoint(incident, {
        lat: Number(wPoint.lat.toFixed(6)),
        lng: Number(wPoint.lng.toFixed(6)),
        at: new Date(),
        phase: 'resolving',
        speedKmph: 0,
        etaMinutes: 0,
        etaSeconds: 0,
        etaUpdatedAt: new Date(),
      });

      await Promise.all([incident.save(), personnel.save()]);
      console.log(`[${simulatedAt.toISOString()}] resolving ping ${i}/${workSteps}`);

      const waitMs = Math.max(50, Math.round(intervalMinutes * 60 * 1000 * Math.max(0.01, timeScale)));
      await sleep(waitMs);
    }

    incident.status = 'resolved';
    incident.dispatchStatus = 'completed';
    incident.workflow.resolvedAt = new Date(workStart.getTime() + workSteps * intervalMinutes * 60 * 1000);

    const actualResolutionMinutes = Math.max(
      1,
      Math.round((incident.workflow.resolvedAt.getTime() - new Date(incident.createdAt).getTime()) / 60000)
    );

    incident.outcomeLearning = {
      ...(incident.outcomeLearning || {}),
      actualResolutionMinutes,
      success: incident.outcomeLearning?.success ?? true,
      recordedAt: new Date(),
      usedForTraining: Boolean(incident.outcomeLearning?.citizenRating),
    };

    addTrackingEvent(incident, {
      phase: 'resolved',
      message: `Unit ${unitId} marked incident resolved`,
      at: incident.workflow.resolvedAt,
      meta: { actualResolutionMinutes },
    });

    await incident.save();

    const returnStart = incident.workflow.resolvedAt;
    const back = await simulateLeg({
      incident,
      personnel,
      from: destination,
      to: base,
      phase: 'returning',
      intervalMinutes,
      speedKmph,
      timeScale,
      startedAt: returnStart,
      plannedMinutes: Math.max(1, Math.round(outboundMinutes * 0.25)),
    });

    personnel.status = 'available';
    personnel.currentIncident = null;
    personnel.location = base;

    addTrackingEvent(incident, {
      phase: 'return-complete',
      message: `Unit ${unitId} returned to base`,
      at: back.finishedAt,
      meta: { returnMinutes: back.travelMinutes },
    });

    await Promise.all([incident.save(), personnel.save()]);

    console.log('Simulation complete');
    console.log(`Travel out: ${outbound.travelMinutes} min | Work: ${workMinutes} min | Return: ${back.travelMinutes} min`);
  } finally {
    await mongoose.disconnect();
  }
};

run().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
