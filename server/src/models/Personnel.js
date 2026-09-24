import mongoose from 'mongoose';

const personnelSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['police', 'fire', 'medical', 'utility', 'sanitation'],
      required: true,
    },
    status: {
      type: String,
      enum: ['available', 'busy', 'off-duty'],
      default: 'available',
    },
    location: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
    currentIncident: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Incident',
    },
    assignedResource: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Resource',
    },
    taskQueue: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Incident',
      },
    ],
    contact: {
      phone: { type: String },
      unitId: { type: String, required: true, unique: true },
    },
  },
  {
    timestamps: true,
  }
);

const Personnel = mongoose.model('Personnel', personnelSchema);
export default Personnel;
