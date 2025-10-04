import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  username: {
    type: String,
    default: 'User',
    trim: true,
    maxlength: 30
  },
  tokens: {
    type: Number,
    default: 5
  },
  lastActive: {
    type: Date,
    default: Date.now
  },
  usedCoupons: [{
    type: String,
    ref: 'Coupon'
  }]
}, {
  timestamps: true
});

export default mongoose.model('User', userSchema)
