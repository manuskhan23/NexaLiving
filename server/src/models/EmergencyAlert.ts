import { Schema, model } from 'mongoose';
import { ALERT_TYPES, ALERT_SEVERITIES, ALERT_STATUSES } from '../constants/enums';
const s = new Schema({
  society: { type: Schema.Types.ObjectId, ref: 'Society', required: true, index: true },
  type: { type: String, enum: ALERT_TYPES, required: true },
  severity: { type: String, enum: ALERT_SEVERITIES, required: true },
  title: { type: String, required: true, minlength: 3, maxlength: 80 },
  message: { type: String, required: true, maxlength: 1000 },
  location: { type: String, maxlength: 120 },
  status: { type: String, enum: ALERT_STATUSES, default: 'active' },
  acknowledgements: [{ user: { type: Schema.Types.ObjectId, ref: 'User' }, at: Date, _id: false }],
  resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  resolvedAt: Date, resolutionNote: String,
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });
s.index({ society: 1, status: 1, createdAt: -1 });
export const EmergencyAlert = model('EmergencyAlert', s);
