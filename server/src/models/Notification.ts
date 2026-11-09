import { Schema, model } from 'mongoose';
const s = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  society: { type: Schema.Types.ObjectId, ref: 'Society' },
  type: { type: String, required: true },
  title: { type: String, required: true, maxlength: 120 },
  body: { type: String, maxlength: 500 },
  data: { screen: String, params: Schema.Types.Mixed },
  readAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
});
s.index({ user: 1, readAt: 1, createdAt: -1 });
s.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });
export const Notification = model('Notification', s);
