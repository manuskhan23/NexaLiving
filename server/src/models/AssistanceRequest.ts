import { Schema, model } from 'mongoose';
import { ASSISTANCE_CATEGORIES, ASSISTANCE_URGENCY, ASSISTANCE_STATUSES } from '../constants/enums';
const s = new Schema({
  society: { type: Schema.Types.ObjectId, ref: 'Society', required: true },
  requester: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  category: { type: String, enum: ASSISTANCE_CATEGORIES, required: true },
  urgency: { type: String, enum: ASSISTANCE_URGENCY, default: 'medium' },
  preferredContact: String, bestTimeToContact: String, onBehalfOf: String,
  householdSize: Number,
  detailsEnc: { iv: String, tag: String, data: String, _id: false },
  internalNotes: [{ by: { type: Schema.Types.ObjectId, ref: 'User' }, noteEnc: { iv: String, tag: String, data: String, _id: false }, at: Date }],
  status: { type: String, enum: ASSISTANCE_STATUSES, default: 'submitted' },
  assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
  statusHistory: [{ status: String, by: { type: Schema.Types.ObjectId, ref: 'User' }, at: Date, note: String, _id: false }],
}, { timestamps: true });
s.index({ society: 1, status: 1, urgency: 1 });
s.index({ society: 1, requester: 1 });
export const AssistanceRequest = model('AssistanceRequest', s);
