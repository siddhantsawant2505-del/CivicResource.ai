import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const userSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    organization: {
      type: String,
      required: true,
      default: 'City Government',
    },
    role: {
      type: String,
      enum: ['operator', 'admin', 'responder'],
      default: 'operator',
    },
    unitId: {
      type: String,
      uppercase: true,
      trim: true,
      sparse: true,
      unique: true,
    },
    department: {
      type: String,
      enum: ['police', 'fire', 'medical', 'utility', 'sanitation'],
    },
  },
  {
    timestamps: true,
  }
);

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.pre('save', async function () {
  if (!this.isModified('password')) {
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

const User = mongoose.model('User', userSchema);
export default User;
