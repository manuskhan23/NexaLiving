import { Schema, model } from 'mongoose';
import { REQUEST_STATUSES } from '../constants/enums';
const s = new Schema({
  society: { type: Schema.Types.ObjectId, ref: 'Society', required: true },
  ride: { type: Schema.Types.ObjectId, ref: 'Carpool', required: true },
  driver: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  passenger: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  seats: { type: Number, min: 1, default: 1 },
  message: String, pickupNote: String,
  status: { type: String, enum: REQUEST_STATUSES, default: 'pending' },
  respondedAt: Date, reason: String,
}, { timestamps: true });
s.index({ ride: 1, passenger: 1 }, { unique: true });
export const CarpoolRequest = model('CarpoolRequest', s);
