import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Incident from '../models/Incident.js';
import Resource from '../models/Resource.js';
import Analytics from '../models/Analytics.js';
import Personnel from '../models/Personnel.js';

dotenv.config();

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB for Seeding'))
  .catch(err => { console.error(err); process.exit(1); });

const cleanupLegacyUserIndexes = async () => {
  if (!mongoose.connection.db) {
    await mongoose.connection.asPromise();
  }

  const userCollection = mongoose.connection.db.collection('users');
  let indexes = [];
  try {
    indexes = await userCollection.indexes();
  } catch (error) {
    // Fresh databases may not have the users collection yet.
    if (error?.code === 26 || error?.codeName === 'NamespaceNotFound') {
      return;
    }
    throw error;
  }
  const legacyPhoneIndex = indexes.find((idx) => idx.name === 'phone_1' && idx.unique);

  if (legacyPhoneIndex) {
    await userCollection.dropIndex('phone_1');
    console.log('Dropped legacy users.phone_1 unique index');
  }
};

const seedData = async () => {
  try {
    await mongoose.connection.asPromise();
    const dbName = mongoose.connection.db?.databaseName || '';
    const isProtectedDefaultDb = ['test', 'admin', 'local'].includes(dbName);
    if (isProtectedDefaultDb && process.env.SEED_ALLOW_DEFAULT_DB !== 'true') {
      throw new Error(
        `Refusing to seed default database '${dbName}'. Set an explicit DB name in MONGODB_URI (recommended), or set SEED_ALLOW_DEFAULT_DB=true to override.`
      );
    }

    await cleanupLegacyUserIndexes();

    await User.deleteMany();
    await Incident.deleteMany();
    await Resource.deleteMany();
    await Analytics.deleteMany();
    await Personnel.deleteMany();

    // Create admin and operator users - pass plain passwords, pre-save hook will hash them
    const createdUsers = await User.create([
      { name: 'Admin', email: 'admin@civicflow.ai', password: 'admin123', role: 'admin', organization: 'Mumbai Command' },
      { name: 'Operator 1', email: 'operator@civicflow.ai', password: 'admin123', role: 'operator', organization: 'Mumbai Command' }
    ]);

    // Create worker users (responders) - 10 workers of different types
    // Pass plain passwords, the User.pre('save') hook will hash them
    const workerUsers = await User.create([
      // Police Officers (2)
      { name: 'Worker 1 - Police Officer', email: 'worker1@civicflow.ai', password: 'worker1', role: 'responder', organization: 'Mumbai Police', unitId: 'POL-001' },
      { name: 'Worker 2 - Police Officer', email: 'worker2@civicflow.ai', password: 'worker2', role: 'responder', organization: 'Mumbai Police', unitId: 'POL-002' },
      // Firefighters (2)
      { name: 'Worker 3 - Firefighter', email: 'worker3@civicflow.ai', password: 'worker3', role: 'responder', organization: 'Mumbai Fire Brigade', unitId: 'FIR-001' },
      { name: 'Worker 4 - Firefighter', email: 'worker4@civicflow.ai', password: 'worker4', role: 'responder', organization: 'Mumbai Fire Brigade', unitId: 'FIR-002' },
      // Medical Officers (2)
      { name: 'Worker 5 - Medical Officer', email: 'worker5@civicflow.ai', password: 'worker5', role: 'responder', organization: 'Mumbai Health Department', unitId: 'MED-001' },
      { name: 'Worker 6 - Medical Officer', email: 'worker6@civicflow.ai', password: 'worker6', role: 'responder', organization: 'Mumbai Health Department', unitId: 'MED-002' },
      // Utility Workers (2)
      { name: 'Worker 7 - Utility Technician', email: 'worker7@civicflow.ai', password: 'worker7', role: 'responder', organization: 'Mumbai Electricity Board', unitId: 'UTL-001' },
      { name: 'Worker 8 - Utility Technician', email: 'worker8@civicflow.ai', password: 'worker8', role: 'responder', organization: 'Mumbai Electricity Board', unitId: 'UTL-002' },
      // Sanitation Worker (1)
      { name: 'Worker 9 - Sanitation Supervisor', email: 'worker9@civicflow.ai', password: 'worker9', role: 'responder', organization: 'Mumbai Sanitation Department', unitId: 'SAN-001' },
      // Water/Sewage Worker (1)
      { name: 'Worker 10 - Water Supply Technician', email: 'worker10@civicflow.ai', password: 'worker10', role: 'responder', organization: 'Mumbai Water Supply', unitId: 'WAT-001' }
    ]);

    // Additional civic-service responders for denser hackathon demo volume
    const additionalWorkerUsers = await User.create([
      { name: 'Worker 11 - Sanitation Route Lead', email: 'worker11@civicflow.ai', password: 'worker11', role: 'responder', organization: 'Mumbai Sanitation Department', unitId: 'SAN-002' },
      { name: 'Worker 12 - Sanitation Operations', email: 'worker12@civicflow.ai', password: 'worker12', role: 'responder', organization: 'Mumbai Sanitation Department', unitId: 'SAN-003' },
      { name: 'Worker 13 - Water Supply Lead', email: 'worker13@civicflow.ai', password: 'worker13', role: 'responder', organization: 'Mumbai Water Supply', unitId: 'WAT-002' },
      { name: 'Worker 14 - Water Supply Crew', email: 'worker14@civicflow.ai', password: 'worker14', role: 'responder', organization: 'Mumbai Water Supply', unitId: 'WAT-003' },
      { name: 'Worker 15 - Roads Maintenance Lead', email: 'worker15@civicflow.ai', password: 'worker15', role: 'responder', organization: 'Mumbai Public Works', unitId: 'UTL-003' },
      { name: 'Worker 16 - Roads Maintenance Crew', email: 'worker16@civicflow.ai', password: 'worker16', role: 'responder', organization: 'Mumbai Public Works', unitId: 'UTL-004' },
      { name: 'Worker 17 - Utility Grid Field Unit', email: 'worker17@civicflow.ai', password: 'worker17', role: 'responder', organization: 'Mumbai Electricity Board', unitId: 'UTL-005' },
      { name: 'Worker 18 - Utility Grid Supervisor', email: 'worker18@civicflow.ai', password: 'worker18', role: 'responder', organization: 'Mumbai Electricity Board', unitId: 'UTL-006' },
      { name: 'Worker 19 - Flood Response Unit', email: 'worker19@civicflow.ai', password: 'worker19', role: 'responder', organization: 'Mumbai Disaster Response', unitId: 'WAT-004' },
      { name: 'Worker 20 - Drainage Repair Unit', email: 'worker20@civicflow.ai', password: 'worker20', role: 'responder', organization: 'Mumbai Public Works', unitId: 'UTL-007' },
      { name: 'Worker 21 - Goregaon Sanitation Team', email: 'worker21@civicflow.ai', password: 'worker21', role: 'responder', organization: 'Mumbai Sanitation Department', unitId: 'SAN-004' },
      { name: 'Worker 22 - Malad Sanitation Team', email: 'worker22@civicflow.ai', password: 'worker22', role: 'responder', organization: 'Mumbai Sanitation Department', unitId: 'SAN-005' },
      { name: 'Worker 23 - Goregaon Water Supply', email: 'worker23@civicflow.ai', password: 'worker23', role: 'responder', organization: 'Mumbai Water Supply', unitId: 'WAT-005' },
      { name: 'Worker 24 - Malad Water Supply', email: 'worker24@civicflow.ai', password: 'worker24', role: 'responder', organization: 'Mumbai Water Supply', unitId: 'WAT-006' }
    ]);

    const incidents = await Incident.create([
      // Police incidents (assign to POL-001, POL-002)
      {
        title: 'Traffic choke near Dadar TT flyover',
        type: 'traffic',
        severity: 'high',
        location: { lat: 19.0178, lng: 72.8478, address: 'Dadar TT Flyover, Mumbai' },
        aiPredictionConfidence: 82,
        sourceLanguage: 'english',
      },
      {
        title: 'Public safety crowd surge at festival route',
        type: 'safety',
        severity: 'medium',
        location: { lat: 19.033, lng: 72.838, address: 'Worli Sea Face, Mumbai' },
        aiPredictionConfidence: 70,
      },
      // Fire incidents (assign to FIR-001, FIR-002)
      {
        title: 'Minor fire in market electrical panel',
        type: 'fire',
        severity: 'critical',
        location: { lat: 19.0765, lng: 72.877, address: 'Kurla Market, Mumbai' },
        aiPredictionConfidence: 92,
      },
      {
        title: 'Building electrical fire - high rise apartment',
        type: 'fire',
        severity: 'critical',
        location: { lat: 19.1200, lng: 72.8500, address: 'Bandra High Rise, Mumbai' },
        aiPredictionConfidence: 95,
      },
      // Medical incidents (assign to MED-001, MED-002)
      {
        title: 'Ambulance access blocked by illegal parking in Dadar',
        type: 'medical',
        severity: 'critical',
        location: { lat: 19.0174, lng: 72.8479, address: 'Dadar West, Mumbai' },
        aiPredictionConfidence: 88,
      },
      {
        title: 'Road accident with multiple casualties near Vile Parle',
        type: 'medical',
        severity: 'critical',
        location: { lat: 19.1150, lng: 72.8000, address: 'Vile Parle Junction, Mumbai' },
        aiPredictionConfidence: 93,
      },
      // Utility incidents (assign to UTL-001, UTL-002)
      {
        title: 'Streetlight failure chain in Powai',
        type: 'utility',
        severity: 'medium',
        location: { lat: 19.1176, lng: 72.906, address: 'Powai Lake Road, Mumbai' },
        aiPredictionConfidence: 78,
      },
      {
        title: 'Public bus stop electrical hazard at Ghatkopar',
        type: 'utility',
        severity: 'critical',
        location: { lat: 19.0856, lng: 72.9081, address: 'Ghatkopar East Bus Depot, Mumbai' },
        aiPredictionConfidence: 91,
      },
      // Sanitation incidents (assign to SAN-001)
      {
        title: 'Garbage overflow near Andheri East station',
        type: 'sanitation',
        severity: 'high',
        location: { lat: 19.1136, lng: 72.8697, address: 'Andheri East Station, Mumbai' },
        aiPredictionConfidence: 90,
      },
      {
        title: 'Night sanitation pickup missed',
        type: 'sanitation',
        severity: 'medium',
        location: { lat: 19.0759, lng: 72.8258, address: 'Mahim Causeway, Mumbai' },
        aiPredictionConfidence: 75,
      },
      // Water incidents (assign to WAT-001)
      {
        title: 'Water tanker delay in Dharavi sector 5',
        type: 'water',
        severity: 'critical',
        location: { lat: 19.0413, lng: 72.8553, address: 'Dharavi Sector 5, Mumbai' },
        aiPredictionConfidence: 94,
      },
      {
        title: 'Waterlogging near CST pedestrian underpass',
        type: 'water',
        severity: 'high',
        location: { lat: 18.9398, lng: 72.8355, address: 'CST Underpass, Mumbai' },
        aiPredictionConfidence: 86,
      },
      // Maintenance/Roads incidents
      {
        title: 'Road pothole cluster near Sion Circle',
        type: 'roads',
        severity: 'high',
        location: { lat: 19.0476, lng: 72.8664, address: 'Sion Circle, Mumbai' },
        aiPredictionConfidence: 87,
      },
      {
        title: 'Drainage choke after rainfall in Kurla',
        type: 'maintenance',
        severity: 'high',
        location: { lat: 19.0728, lng: 72.8826, address: 'Kurla West, Mumbai' },
        aiPredictionConfidence: 84,
      }
    ]);

    const baseResources = await Resource.create([
      { name: 'Water Tanker WT-17', type: 'public_works', status: 'patrol', location: { lat: 19.05, lng: 72.86 }, batteryOrFuelLevel: 78 },
      { name: 'Garbage Truck GT-22', type: 'public_works', status: 'patrol', location: { lat: 19.11, lng: 72.87 }, batteryOrFuelLevel: 70 },
      { name: 'Fire Tender FT-04', type: 'fire', status: 'patrol', location: { lat: 19.08, lng: 72.88 }, batteryOrFuelLevel: 82 },
      { name: 'Drone Recon X1', type: 'drone', status: 'patrol', location: { lat: 19.07, lng: 72.90 }, batteryOrFuelLevel: 62 },
      { name: 'Patrol 14', type: 'police', status: 'patrol', location: { lat: 19.02, lng: 72.85 }, batteryOrFuelLevel: 90 },
      { name: 'Ambulance AMB-09', type: 'medical', status: 'patrol', location: { lat: 19.02, lng: 72.85 }, batteryOrFuelLevel: 76 },
      { name: 'Road Repair Unit RR-31', type: 'public_works', status: 'maintenance', location: { lat: 19.09, lng: 72.89 }, batteryOrFuelLevel: 68 },
      { name: 'Public Works Van PW-08', type: 'public_works', status: 'patrol', location: { lat: 19.13, lng: 72.84 }, batteryOrFuelLevel: 88 }
    ]);

    const extraResources = await Resource.create([
      { name: 'Garbage Truck GT-31', type: 'public_works', status: 'patrol', location: { lat: 19.08, lng: 72.83 }, batteryOrFuelLevel: 86 },
      { name: 'Garbage Truck GT-32', type: 'public_works', status: 'patrol', location: { lat: 19.14, lng: 72.88 }, batteryOrFuelLevel: 79 },
      { name: 'Water Tanker WT-21', type: 'public_works', status: 'patrol', location: { lat: 19.03, lng: 72.89 }, batteryOrFuelLevel: 83 },
      { name: 'Water Tanker WT-22', type: 'public_works', status: 'maintenance', location: { lat: 19.16, lng: 72.91 }, batteryOrFuelLevel: 67 },
      { name: 'Maintenance Unit MU-12', type: 'public_works', status: 'patrol', location: { lat: 19.06, lng: 72.93 }, batteryOrFuelLevel: 88 },
      { name: 'Maintenance Unit MU-13', type: 'public_works', status: 'patrol', location: { lat: 19.1, lng: 72.82 }, batteryOrFuelLevel: 90 },
      { name: 'Drainage Repair DR-05', type: 'public_works', status: 'patrol', location: { lat: 19.04, lng: 72.84 }, batteryOrFuelLevel: 84 },
      { name: 'Drainage Repair DR-06', type: 'public_works', status: 'patrol', location: { lat: 19.17, lng: 72.86 }, batteryOrFuelLevel: 76 },
      { name: 'Road Service RS-41', type: 'public_works', status: 'patrol', location: { lat: 19.09, lng: 72.9 }, batteryOrFuelLevel: 81 },
      { name: 'Road Service RS-42', type: 'public_works', status: 'patrol', location: { lat: 19.12, lng: 72.85 }, batteryOrFuelLevel: 78 },
      { name: 'Garbage Truck GT-43 Goregaon', type: 'public_works', status: 'patrol', location: { lat: 19.1655, lng: 72.8475 }, batteryOrFuelLevel: 91 },
      { name: 'Garbage Truck GT-44 Malad', type: 'public_works', status: 'patrol', location: { lat: 19.1862, lng: 72.8421 }, batteryOrFuelLevel: 88 },
      { name: 'Water Tanker WT-33 Goregaon', type: 'public_works', status: 'patrol', location: { lat: 19.1618, lng: 72.8512 }, batteryOrFuelLevel: 92 },
      { name: 'Water Tanker WT-34 Malad', type: 'public_works', status: 'patrol', location: { lat: 19.1901, lng: 72.8397 }, batteryOrFuelLevel: 89 }
    ]);

    const personnel = await Personnel.create([
      // Police Officers (2)
      { name: 'Worker 1 - Police Officer', type: 'police', status: 'available', location: { lat: 19.05, lng: 72.84 }, contact: { phone: '+91-9000000001', unitId: 'POL-001' } },
      { name: 'Worker 2 - Police Officer', type: 'police', status: 'available', location: { lat: 19.02, lng: 72.85 }, contact: { phone: '+91-9000000002', unitId: 'POL-002' } },
      // Firefighters (2)
      { name: 'Worker 3 - Firefighter', type: 'fire', status: 'available', location: { lat: 19.08, lng: 72.88 }, contact: { phone: '+91-9000000003', unitId: 'FIR-001' } },
      { name: 'Worker 4 - Firefighter', type: 'fire', status: 'available', location: { lat: 19.07, lng: 72.87 }, contact: { phone: '+91-9000000004', unitId: 'FIR-002' } },
      // Medical Officers (2)
      { name: 'Worker 5 - Medical Officer', type: 'medical', status: 'available', location: { lat: 19.2, lng: 72.97 }, contact: { phone: '+91-9000000005', unitId: 'MED-001' } },
      { name: 'Worker 6 - Medical Officer', type: 'medical', status: 'available', location: { lat: 19.18, lng: 72.95 }, contact: { phone: '+91-9000000006', unitId: 'MED-002' } },
      // Utility Workers (2)
      { name: 'Worker 7 - Utility Technician', type: 'utility', status: 'available', location: { lat: 19.11, lng: 72.9 }, contact: { phone: '+91-9000000007', unitId: 'UTL-001' } },
      { name: 'Worker 8 - Utility Technician', type: 'utility', status: 'available', location: { lat: 19.12, lng: 72.92 }, contact: { phone: '+91-9000000008', unitId: 'UTL-002' } },
      // Sanitation Worker (1)
      { name: 'Worker 9 - Sanitation Supervisor', type: 'sanitation', status: 'available', location: { lat: 19.07, lng: 72.82 }, contact: { phone: '+91-9000000009', unitId: 'SAN-001' } },
      // Water/Sewage Worker (1)
      { name: 'Worker 10 - Water Supply Technician', type: 'utility', status: 'available', location: { lat: 19.09, lng: 72.91 }, contact: { phone: '+91-9000000010', unitId: 'WAT-001' } }
    ]);

    const extraPersonnel = await Personnel.create([
      { name: 'Worker 11 - Sanitation Route Lead', type: 'sanitation', status: 'available', location: { lat: 19.1, lng: 72.86 }, contact: { phone: '+91-9000000011', unitId: 'SAN-002' } },
      { name: 'Worker 12 - Sanitation Operations', type: 'sanitation', status: 'available', location: { lat: 19.13, lng: 72.89 }, contact: { phone: '+91-9000000012', unitId: 'SAN-003' } },
      { name: 'Worker 13 - Water Supply Lead', type: 'utility', status: 'available', location: { lat: 19.06, lng: 72.88 }, contact: { phone: '+91-9000000013', unitId: 'WAT-002' } },
      { name: 'Worker 14 - Water Supply Crew', type: 'utility', status: 'available', location: { lat: 19.15, lng: 72.9 }, contact: { phone: '+91-9000000014', unitId: 'WAT-003' } },
      { name: 'Worker 15 - Roads Maintenance Lead', type: 'utility', status: 'available', location: { lat: 19.08, lng: 72.94 }, contact: { phone: '+91-9000000015', unitId: 'UTL-003' } },
      { name: 'Worker 16 - Roads Maintenance Crew', type: 'utility', status: 'available', location: { lat: 19.11, lng: 72.87 }, contact: { phone: '+91-9000000016', unitId: 'UTL-004' } },
      { name: 'Worker 17 - Utility Grid Field Unit', type: 'utility', status: 'available', location: { lat: 19.02, lng: 72.9 }, contact: { phone: '+91-9000000017', unitId: 'UTL-005' } },
      { name: 'Worker 18 - Utility Grid Supervisor', type: 'utility', status: 'available', location: { lat: 19.17, lng: 72.83 }, contact: { phone: '+91-9000000018', unitId: 'UTL-006' } },
      { name: 'Worker 19 - Flood Response Unit', type: 'utility', status: 'available', location: { lat: 19.07, lng: 72.95 }, contact: { phone: '+91-9000000019', unitId: 'WAT-004' } },
      { name: 'Worker 20 - Drainage Repair Unit', type: 'utility', status: 'available', location: { lat: 19.04, lng: 72.9 }, contact: { phone: '+91-9000000020', unitId: 'UTL-007' } },
      { name: 'Worker 21 - Goregaon Sanitation Team', type: 'sanitation', status: 'available', location: { lat: 19.1642, lng: 72.8488 }, contact: { phone: '+91-9000000021', unitId: 'SAN-004' } },
      { name: 'Worker 22 - Malad Sanitation Team', type: 'sanitation', status: 'available', location: { lat: 19.1855, lng: 72.8428 }, contact: { phone: '+91-9000000022', unitId: 'SAN-005' } },
      { name: 'Worker 23 - Goregaon Water Supply', type: 'utility', status: 'available', location: { lat: 19.1621, lng: 72.8504 }, contact: { phone: '+91-9000000023', unitId: 'WAT-005' } },
      { name: 'Worker 24 - Malad Water Supply', type: 'utility', status: 'available', location: { lat: 19.1884, lng: 72.8406 }, contact: { phone: '+91-9000000024', unitId: 'WAT-006' } }
    ]);

    const extraIncidents = await Incident.create([
      { title: 'Overflowing community bins near Kurla East market', type: 'sanitation', severity: 'high', location: { lat: 19.064, lng: 72.888, address: 'Kurla East Market, Mumbai' }, aiPredictionConfidence: 89 },
      { title: 'Garbage backlog after weekend event in Bandra', type: 'sanitation', severity: 'medium', location: { lat: 19.061, lng: 72.834, address: 'Bandra Reclamation, Mumbai' }, aiPredictionConfidence: 82 },
      { title: 'Delayed water tanker supply in Govandi blocks', type: 'water', severity: 'critical', location: { lat: 19.055, lng: 72.923, address: 'Govandi Block C, Mumbai' }, aiPredictionConfidence: 93 },
      { title: 'Low water pressure complaints in Chembur colony', type: 'water', severity: 'high', location: { lat: 19.052, lng: 72.901, address: 'Chembur Colony, Mumbai' }, aiPredictionConfidence: 88 },
      { title: 'Road patch failure near Andheri subway', type: 'roads', severity: 'high', location: { lat: 19.118, lng: 72.846, address: 'Andheri Subway, Mumbai' }, aiPredictionConfidence: 86 },
      { title: 'Pothole spread expanding near Sakinaka junction', type: 'roads', severity: 'critical', location: { lat: 19.102, lng: 72.887, address: 'Sakinaka Junction, Mumbai' }, aiPredictionConfidence: 94 },
      { title: 'Drainage desilting required in Mahim lowlands', type: 'maintenance', severity: 'high', location: { lat: 19.041, lng: 72.84, address: 'Mahim Lowlands, Mumbai' }, aiPredictionConfidence: 84 },
      { title: 'Broken manhole cover near Byculla bridge', type: 'maintenance', severity: 'critical', location: { lat: 18.977, lng: 72.832, address: 'Byculla Bridge, Mumbai' }, aiPredictionConfidence: 92 },
      { title: 'Streetlight blackout corridor in Jogeshwari East', type: 'utility', severity: 'medium', location: { lat: 19.132, lng: 72.857, address: 'Jogeshwari East, Mumbai' }, aiPredictionConfidence: 79 },
      { title: 'Transformer overload alerts in Ghatkopar West', type: 'utility', severity: 'high', location: { lat: 19.09, lng: 72.89, address: 'Ghatkopar West, Mumbai' }, aiPredictionConfidence: 87 },
      { title: 'Traffic diversions causing service delays near Dharavi', type: 'traffic', severity: 'medium', location: { lat: 19.045, lng: 72.86, address: 'Dharavi Main Road, Mumbai' }, aiPredictionConfidence: 76 },
      { title: 'Roadside debris obstructing tanker routes', type: 'infrastructure', severity: 'high', location: { lat: 19.02, lng: 72.872, address: 'Lower Parel Connector, Mumbai' }, aiPredictionConfidence: 83 }
    ]);

    // Reset seed to a neutral dispatch state:
    // active incidents are mostly unassigned, while a few resolved incidents remain for realism.
    const allIncidents = [...incidents, ...extraIncidents];
    const resolvedIncidentIndexes = new Set([1, 4, 9, 15]);

    allIncidents.forEach((incident, idx) => {
      incident.assignedPersonnel = null;
      incident.assignedPersonnelList = [];
      incident.assignedResources = [];
      incident.workflow = incident.workflow || {};

      if (resolvedIncidentIndexes.has(idx)) {
        incident.status = 'resolved';
        incident.dispatchStatus = 'completed';
        incident.workflow.resolvedAt = new Date();
        incident.outcomeLearning = {
          actualResolutionMinutes: 95,
          success: true,
          citizenRating: 4,
          followUpNotes: 'Seeded resolved sample for normal dashboard history.',
          recordedAt: new Date(),
          usedForTraining: true,
        };
      } else {
        incident.status = 'active';
        incident.dispatchStatus = 'unassigned';
      }
    });

    [...personnel, ...extraPersonnel].forEach((worker) => {
      worker.status = 'available';
      worker.currentIncident = null;
    });

    await Promise.all([
      ...allIncidents.map((incident) => incident.save()),
      ...personnel.map((worker) => worker.save()),
      ...extraPersonnel.map((worker) => worker.save()),
    ]);

    const totalIncidentCount = incidents.length + extraIncidents.length;
    const totalResources = baseResources.length + extraResources.length;

    await Analytics.create([
      {
        organization: 'Mumbai Command',
        activeIncidentsCount: totalIncidentCount,
        unitsDeployed: totalResources,
        avgResponseTimeMinutes: 8.6,
        slaCompliancePercent: 93,
        aiPredictionsCount: totalIncidentCount * 240,
        systemHealthPercent: 99.8,
        demandTimeSeries: [
          { time: '00:00', actual: 32, predicted: 35, optimized: 29 },
          { time: '02:00', actual: 28, predicted: 30, optimized: 25 },
          { time: '04:00', actual: 26, predicted: 28, optimized: 24 },
          { time: '06:00', actual: 38, predicted: 41, optimized: 34 },
          { time: '08:00', actual: 72, predicted: 68, optimized: 61 },
          { time: '10:00', actual: 81, predicted: 78, optimized: 70 },
          { time: '12:00', actual: 88, predicted: 91, optimized: 76 },
          { time: '14:00', actual: 79, predicted: 83, optimized: 69 },
          { time: '16:00', actual: 96, predicted: 99, optimized: 84 },
          { time: '18:00', actual: 102, predicted: 96, optimized: 87 },
          { time: '20:00', actual: 74, predicted: 77, optimized: 66 },
          { time: '22:00', actual: 48, predicted: 52, optimized: 43 }
        ],
        categoryBreakdown: [
          { name: 'Sanitation', value: 22, color: 'hsl(160, 84%, 39%)' },
          { name: 'Water', value: 19, color: 'hsl(207, 90%, 54%)' },
          { name: 'Roads', value: 18, color: 'hsl(38, 92%, 50%)' },
          { name: 'Fire', value: 14, color: 'hsl(0, 84%, 60%)' },
          { name: 'Medical', value: 12, color: 'hsl(270, 70%, 60%)' },
          { name: 'Other', value: 15, color: 'hsl(215, 20%, 55%)' }
        ],
        weeklyTrend: [
          { day: 'Mon', incidents: 58, resolved: 50 },
          { day: 'Tue', incidents: 61, resolved: 54 },
          { day: 'Wed', incidents: 67, resolved: 60 },
          { day: 'Thu', incidents: 72, resolved: 63 },
          { day: 'Fri', incidents: 80, resolved: 69 },
          { day: 'Sat', incidents: 64, resolved: 56 },
          { day: 'Sun', incidents: 52, resolved: 47 }
        ]
      }
    ]);

    console.log(`Seeded users: ${createdUsers.length + workerUsers.length + additionalWorkerUsers.length}`);
    console.log(`Seeded personnel: ${personnel.length + extraPersonnel.length}`);
    console.log(`Seeded incidents: ${totalIncidentCount}`);
    console.log(`Seeded resources: ${totalResources}`);

    console.log('✅ Data Seeded Successfully');
    process.exit();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

seedData();
