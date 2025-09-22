import mongoose from 'mongoose';

const couponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  tokenAmount: {
    type: Number,
    required: true,
    min: 1
  },
  maxUses: {
    type: Number,
    default: 0, // 0 means unlimited
    min: 0
  },
  usedCount: {
    type: Number,
    default: 0,
    min: 0
  },
  expiryDate: {
    type: Date,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Check if coupon is valid
couponSchema.methods.isValid = function() {
  if (!this.isActive) return false;
  if (this.expiryDate && new Date() > this.expiryDate) return false;
  if (this.maxUses > 0 && this.usedCount >= this.maxUses) return false;
  return true;
};

// Use the coupon
couponSchema.methods.use = function() {
  this.usedCount += 1;
  return this.save();
};

export default mongoose.model('Coupon', couponSchema);





