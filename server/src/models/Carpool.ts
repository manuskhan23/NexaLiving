import { Schema, model } from 'mongoose';
import { CARPOOL_STATUSES, CARPOOL_SCHEDULE_TYPES, CARPOOL_GENDER_PREF } from '../constants/enums';
const s = new Schema({
  society: { type: Schema.Types.ObjectId, ref: 'Society', required: true },
  driver: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  fromLabel: { type: String, required: true, maxlength: 80 },
  toLabel: { type: String, required: true, maxlength: 80 },
  departureTime: String, returnTime: String,
  schedule: { type: { type: String, enum: CARPOOL_SCHEDULE_TYPES, default: 'once' }, date: Date, days: [Number] },
  totalSeats: { type: Number, min: 1, max: 20 }, availableSeats: { type: Number, min: 0 },
  costPerSeat: { type: Number, default: 0 },
  vehicle: String, genderPreference: { type: String, enum: CARPOOL_GENDER_PREF, default: 'any' },
  contactPhone: { type: String, required: true },
  notes: String,
  status: { type: String, enum: CARPOOL_STATUSES, default: 'active' },
  deletedAt: { type: Date, default: null },
  isHidden: { type: Boolean, default: false },
  hiddenReason: String,
}, { timestamps: true });
s.index({ society: 1, status: 1, 'schedule.days': 1 });
export const Carpool = model('Carpool', s);
