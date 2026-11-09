import { Schema, model } from 'mongoose';
import { DEAL_STATUSES, ITEM_CATEGORIES } from '../constants/enums';
const s = new Schema({
  society: { type: Schema.Types.ObjectId, ref: 'Society', required: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  shopName: { type: String, required: true, maxlength: 80 },
  title: { type: String, required: true, maxlength: 100 },
  description: String,
  discountLabel: String,
  category: { type: String, enum: ITEM_CATEGORIES },
  terms: String,
  shopLocation: String, shopPhone: String,
  image: { url: String, publicId: String },
  validFrom: Date, validTo: Date,
  status: { type: String, enum: DEAL_STATUSES, default: 'pending' },
  reviewNote: String,
  deletedAt: { type: Date, default: null },
}, { timestamps: true });
s.index({ society: 1, status: 1, validTo: 1 });
export const Deal = model('Deal', s);
