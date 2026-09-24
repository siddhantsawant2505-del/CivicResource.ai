import mongoose from 'mongoose';

const resourceSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['police', 'fire', 'medical', 'public_works', 'drone', 'utility', 'sanitation'],
      required: true,
    },
    status: {
      type: String,
      enum: ['patrol', 'dispatched', 'maintenance', 'offline'],
      default: 'patrol',
    },
    location: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
    currentIncident: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Incident',
      default: null,
    },
    assignedPersonnel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Personnel',
      default: null,
    },
    batteryOrFuelLevel: {
      type: Number,
      required: true,
      default: 100,
    },
  },
  {
    timestamps: true,
  }
);

const Resource = mongoose.model('Resource', resourceSchema);
export default Resource;
