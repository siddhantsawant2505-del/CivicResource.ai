import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Incident from '../models/Incident.js';
import Resource from '../models/Resource.js';
import Analytics from '../models/Analytics.js';
import Personnel from '../models/Personnel.js';

dotenv.config();

const isDryRun = process.argv.includes('--dry-run');

const seedUserEmails = [
  'admin@civicflow.ai',
  'operator@civicflow.ai',
];

const seedIncidentTitles = [
  'Water tanker delay in Dharavi sector 5',
  'Garbage overflow near Andheri East station',
  'Road pothole cluster near Sion Circle',
  'Streetlight failure chain in Powai',
  'Traffic choke near Dadar TT flyover',
  'Minor fire in market electrical panel',
  'Public safety crowd surge at festival route',
  'Drainage choke after rainfall in Kurla',
  'Ambulance access blocked by illegal parking in Dadar',
  'Transformer sparking complaint',
  'Construction debris blocking lane',
  'Night sanitation pickup missed',
  'Waterlogging near CST pedestrian underpass',
  'Public bus stop electrical hazard at Ghatkopar',
];

const seedResourceNames = [
  'Water Tanker WT-17',
  'Garbage Truck GT-22',
  'Fire Tender FT-04',
  'Drone Recon X1',
  'Patrol 14',
  'Ambulance AMB-09',
  'Road Repair Unit RR-31',
  'Public Works Van PW-08',
];

const seedPersonnelUnitIds = [
  'POL-101',
  'FIR-204',
  'MED-115',
  'UTL-320',
  'SAN-410',
];

const analyticsSeedFilter = {
  organization: 'Mumbai Command',
  aiPredictionsCount: 3480,
};

const connect = async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not set in environment');
  }
  await mongoose.connect(process.env.MONGODB_URI);
  const dbName = mongoose.connection.db?.databaseName || '(unknown)';
  console.log(`Connected to MongoDB: ${dbName}`);
};

const countMatches = async () => {
  const users = await User.countDocuments({ email: { $in: seedUserEmails } });
  const incidents = await Incident.countDocuments({ title: { $in: seedIncidentTitles } });
  const resources = await Resource.countDocuments({ name: { $in: seedResourceNames } });
  const personnel = await Personnel.countDocuments({ 'contact.unitId': { $in: seedPersonnelUnitIds } });
  const analytics = await Analytics.countDocuments(analyticsSeedFilter);

  return { users, incidents, resources, personnel, analytics };
};

const deleteMatches = async () => {
  const users = await User.deleteMany({ email: { $in: seedUserEmails } });
  const incidents = await Incident.deleteMany({ title: { $in: seedIncidentTitles } });
  const resources = await Resource.deleteMany({ name: { $in: seedResourceNames } });
  const personnel = await Personnel.deleteMany({ 'contact.unitId': { $in: seedPersonnelUnitIds } });
  const analytics = await Analytics.deleteMany(analyticsSeedFilter);

  return {
    users: users.deletedCount || 0,
    incidents: incidents.deletedCount || 0,
    resources: resources.deletedCount || 0,
    personnel: personnel.deletedCount || 0,
    analytics: analytics.deletedCount || 0,
  };
};

const run = async () => {
  try {
    await connect();

    const matches = await countMatches();
    console.log('Seed data match count:', matches);

    if (isDryRun) {
      console.log('Dry run mode: no records deleted.');
      process.exit(0);
    }

    const removed = await deleteMatches();
    console.log('Seed data removed:', removed);
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

run();
