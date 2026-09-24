import User from '../models/User.js';
import Personnel from '../models/Personnel.js';
import generateToken from '../utils/generateToken.js';

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
export const authUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        organization: user.organization,
        role: user.role,
        unitId: user.unitId || null,
        token: generateToken(user._id),
      });
    } else {
      res.status(401);
      throw new Error('Invalid email or password');
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
export const registerUser = async (req, res, next) => {
  try {
    const { name, email, password, organization, role, department } = req.body;
    const userExists = await User.findOne({ email });

    if (userExists) {
      res.status(400);
      throw new Error('User already exists');
    }

    let unitId = null;
    if (role === 'responder') {
      const personnelCount = await Personnel.countDocuments();
      const nextId = personnelCount + 1;
      unitId = `STAFF-${String(nextId).padStart(2, '0')}`;
    }

    const user = await User.create({
      name,
      email,
      password,
      organization: organization || 'CivicResource.ai Registry',
      role: role || 'operator',
      department: role === 'responder' ? (department || 'utility') : undefined,
      unitId,
    });

    if (user) {
      // If responder, create matching Personnel entry
      if (user.role === 'responder') {
        await Personnel.create({
          name: user.name,
          type: department || 'utility',
          status: 'available',
          location: { lat: 19.0760, lng: 72.8777 }, // Default Mumbai Center
          contact: { unitId },
        });
      }

      res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        organization: user.organization,
        role: user.role,
        unitId: user.unitId || null,
        token: generateToken(user._id),
      });
    } else {
      res.status(400);
      throw new Error('Invalid user data');
    }
  } catch (error) {
    console.error('Registration Error:', error.message);
    next(error);
  }
};

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
export const getUserProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (user) {
      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        organization: user.organization,
        role: user.role,
        unitId: user.unitId || null,
      });
    } else {
      res.status(404);
      throw new Error('User not found');
    }
  } catch (error) {
    next(error);
  }
};
