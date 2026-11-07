import { Schema, model } from 'mongoose';
import { NEED_KINDS, NEED_VISIBILITIES, NEED_STATUSES, ITEM_CATEGORIES } from '../constants/enums';
const s = new Schema({
  society: { type: Schema.Types.ObjectId, ref: 'Society', required: true },
  owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  kind: { type: String, enum: NEED_KINDS, required: true },
  title: { type: String, required: true, minlength: 3, maxlength: 80 },
  description: { type: String, maxlength: 500 },
  category: { type: String, enum: ITEM_CATEGORIES },
  tags: [String],
  neededFrom: Date, neededTo: Date, expiresAt: Date,
  visibility: { type: String, enum: NEED_VISIBILITIES, default: 'community' },
  status: { type: String, enum: NEED_STATUSES, default: 'open' },
  offers: [{
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    item: { type: Schema.Types.ObjectId, ref: 'Item' },
    message: String,
    status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' },
    createdAt: { type: Date, default: Date.now },
  }],
  deletedAt: { type: Date, default: null },
  isHidden: { type: Boolean, default: false },
  hiddenReason: String,
}, { timestamps: true });
s.index({ society: 1, status: 1, visibility: 1, neededFrom: 1 });
export const Need = model('Need', s);
