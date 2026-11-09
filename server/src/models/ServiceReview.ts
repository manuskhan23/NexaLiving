import { Schema, model } from 'mongoose';
const s = new Schema({
  society: { type: Schema.Types.ObjectId, ref: 'Society', required: true },
  service: { type: Schema.Types.ObjectId, ref: 'Service', required: true },
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  rating: { type: Number, min: 1, max: 5, required: true },
  comment: { type: String, maxlength: 500 },
  deletedAt: { type: Date, default: null },
}, { timestamps: true });
s.index({ service: 1, user: 1 }, { unique: true });
export const ServiceReview = model('ServiceReview', s);
