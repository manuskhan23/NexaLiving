import { Schema, model } from 'mongoose';
import { PROPERTY_TYPES, FURNISHING, PREFERRED_TENANTS, CONTACT_PREFERENCES, RENTAL_STATUSES } from '../constants/enums';
const s = new Schema({
  society: { type: Schema.Types.ObjectId, ref: 'Society', required: true },
  owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, minlength: 5, maxlength: 100 },
  propertyType: { type: String, enum: PROPERTY_TYPES, required: true },
  monthlyRent: { type: Number, required: true },
  securityDeposit: Number, advanceMonths: { type: Number, min: 0, max: 12 },
  bedrooms: { type: Number, min: 0, max: 20 }, bathrooms: { type: Number, min: 0, max: 20 },
  areaSqft: Number, areaSqYards: Number,
  furnishing: { type: String, enum: FURNISHING },
  features: [String],
  images: [{ url: String, publicId: String, _id: false }],
  block: String, streetLabel: String, availableFrom: Date,
  contactPreference: { type: String, enum: CONTACT_PREFERENCES, default: 'in_app' },
  preferredTenants: { type: String, enum: PREFERRED_TENANTS, default: 'any' },
  description: { type: String, maxlength: 2000 },
  status: { type: String, enum: RENTAL_STATUSES, default: 'active' },
  isVerified: { type: Boolean, default: false },
  viewCount: { type: Number, default: 0 },
  reviewNote: String,
  deletedAt: { type: Date, default: null },
  isHidden: { type: Boolean, default: false },
  hiddenReason: String,
}, { timestamps: true });
s.index({ society: 1, status: 1, monthlyRent: 1 });
s.index({ society: 1, propertyType: 1, bedrooms: 1 });
export const Rental = model('Rental', s);
