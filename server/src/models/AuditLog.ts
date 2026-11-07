import { Schema, model } from 'mongoose';
const s = new Schema({
  society: { type: Schema.Types.ObjectId, ref: 'Society' },
  actor: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, required: true },
  targetType: String, targetId: Schema.Types.ObjectId,
  meta: Schema.Types.Mixed,
  ip: String,
  createdAt: { type: Date, default: Date.now },
});
s.index({ society: 1, createdAt: -1 });
s.index({ action: 1 });
export const AuditLog = model('AuditLog', s);
