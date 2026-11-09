import { Schema, model } from 'mongoose';
import { SERVICE_CATEGORIES, SERVICE_STATUSES } from '../constants/enums';
const s = new Schema({
  society: { type: Schema.Types.ObjectId, ref: 'Society', required: true },
  owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  category: { type: String, enum: SERVICE_CATEGORIES, required: true },
  providerName: { type: String, required: true, maxlength: 80 },
  businessName: String,
  description: { type: String, maxlength: 1000 },
  phone: String, whatsapp: String,
  serviceAreas: [String], priceNote: String, availability: String,
  emergencyAvailable: { type: Boolean, default: false },
  images: [{ url: String, publicId: String, _id: false }],
  isExternal: { type: Boolean, default: false },
  isVerified: { type: Boolean, default: false },
  status: { type: String, enum: SERVICE_STATUSES, default: 'active' },
  avgRating: { type: Number, default: 0 }, reviewCount: { type: Number, default: 0 },
  deletedAt: { type: Date, default: null },
  isHidden: { type: Boolean, default: false },
  hiddenReason: String,
}, { timestamps: true });
s.index({ society: 1, category: 1, status: 1, avgRating: -1 });
export const Service = model('Service', s);
