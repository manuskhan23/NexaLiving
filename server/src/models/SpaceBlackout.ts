import { Schema, model } from 'mongoose';
const s = new Schema({
  society: { type: Schema.Types.ObjectId, ref: 'Society', required: true },
  space: { type: Schema.Types.ObjectId, ref: 'EventSpace', required: true },
  startAt: Date, endAt: Date, reason: String,
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
s.index({ space: 1, startAt: 1, endAt: 1 });
export const SpaceBlackout = model('SpaceBlackout', s);
