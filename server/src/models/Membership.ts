import { Schema, model } from 'mongoose';
import { MEMBERSHIP_ROLES, MEMBERSHIP_STATUSES, RESIDENT_TYPES } from '../constants/enums';
const s = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  society: { type: Schema.Types.ObjectId, ref: 'Society', required: true },
  role: { type: String, enum: MEMBERSHIP_ROLES, default: 'resident' },
  status: { type: String, enum: MEMBERSHIP_STATUSES, default: 'pending' },
  block: String, unitLabel: String,
  residentType: { type: String, enum: RESIDENT_TYPES },
  note: String,
  canReviewAssistance: { type: Boolean, default: false },
  isVerifiedResident: { type: Boolean, default: false },
  isTutor: { type: Boolean, default: false },
  isServiceProvider: { type: Boolean, default: false },
  approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  approvedAt: Date,
  verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  verifiedAt: Date,
  rejectionReason: String, suspendReason: String,
}, { timestamps: true });
s.index({ user: 1, society: 1 }, { unique: true });
s.index({ society: 1, status: 1, role: 1 });
export const Membership = model('Membership', s);
