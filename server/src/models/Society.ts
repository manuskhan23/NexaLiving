import { Schema, model, Types } from 'mongoose';
import { defaultTimezone } from '../config/env';
const s = new Schema({
  name: { type: String, required: true, minlength: 3, maxlength: 80 },
  area: { type: String, required: true },
  city: { type: String, default: 'Karachi' },
  description: { type: String, maxlength: 500 },
  coverImage: { url: String, publicId: String },
  blocks: [String],
  joinCode: { type: String, required: true, unique: true },
  // Legacy: the Atlas collection still carries a unique `slug_1` index from an older schema.
  // Always store a unique slug so inserting a second society never collides on `slug: null`.
  slug: { type: String },
  settings: {
    requireListingApproval: { type: Boolean, default: false },
    allowResidentDeals: { type: Boolean, default: true },
    maxPendingBookingsPerUser: { type: Number, default: 3, min: 1, max: 10 },
    autoHideReportThreshold: { type: Number, default: 5, min: 2, max: 20 },
    timezone: { type: String, default: defaultTimezone },
  },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });
export const Society = model('Society', s);
export type ISociety = typeof Society.prototype;
