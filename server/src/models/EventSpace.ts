import { Schema, model } from 'mongoose';
import { SLOT_MINUTES } from '../constants/enums';
const s = new Schema({
  society: { type: Schema.Types.ObjectId, ref: 'Society', required: true },
  name: { type: String, required: true, minlength: 2, maxlength: 60 },
  description: { type: String, maxlength: 1000 },
  capacity: { type: Number, required: true, min: 1, max: 5000 },
  images: [{ url: String, publicId: String, _id: false }],
  amenities: [String],
  rules: { type: String, maxlength: 1500 },
  openingHours: [{ day: { type: Number, min: 0, max: 6 }, open: String, close: String, _id: false }],
  slotMinutes: { type: Number, enum: SLOT_MINUTES, default: 60 },
  minBookingMinutes: { type: Number, default: 60 },
  maxBookingMinutes: { type: Number, default: 480 },
  minNoticeHours: { type: Number, default: 24 },
  maxAdvanceDays: { type: Number, default: 60 },
  fee: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  version: { type: Number, default: 0 },
  deletedAt: { type: Date, default: null },
}, { timestamps: true });
s.index({ society: 1, isActive: 1 });
export const EventSpace = model('EventSpace', s);
