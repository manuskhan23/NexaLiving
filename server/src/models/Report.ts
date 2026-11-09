import { Schema, model } from 'mongoose';
import { REPORT_TARGET_TYPES, REPORT_REASONS, REPORT_STATUSES } from '../constants/enums';
const s = new Schema({
  society: { type: Schema.Types.ObjectId, ref: 'Society', required: true },
  reporter: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  targetType: { type: String, enum: REPORT_TARGET_TYPES, required: true },
  targetId: { type: Schema.Types.ObjectId, required: true },
  targetOwner: { type: Schema.Types.ObjectId, ref: 'User' },
  reason: { type: String, enum: REPORT_REASONS, required: true },
  details: String,
  status: { type: String, enum: REPORT_STATUSES, default: 'open' },
  action: String, resolutionNote: String,
  resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' }, resolvedAt: Date,
}, { timestamps: true });
s.index({ reporter: 1, targetType: 1, targetId: 1 }, { unique: true });
s.index({ society: 1, status: 1, targetType: 1, targetId: 1 });
export const Report = model('Report', s);
