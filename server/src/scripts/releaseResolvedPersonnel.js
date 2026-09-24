import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Incident from '../models/Incident.js';
import Personnel from '../models/Personnel.js';

dotenv.config();

const releaseResolvedPersonnel = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const resolvedIncidents = await Incident.find({
      status: 'resolved',
      assignedPersonnel: { $ne: null },
    }).select('assignedPersonnel');

    const personnelIds = [...new Set(resolvedIncidents.map((inc) => String(inc.assignedPersonnel)).filter(Boolean))];

    if (personnelIds.length > 0) {
      await Personnel.updateMany(
        { _id: { $in: personnelIds } },
        { $set: { status: 'available', currentIncident: null } }
      );
    }

    console.log(`Released ${personnelIds.length} personnel from resolved incidents.`);
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

releaseResolvedPersonnel();
