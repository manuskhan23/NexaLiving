import { Schema, model } from 'mongoose';
import { ITEM_CATEGORIES, ITEM_CONDITIONS, LISTING_TYPES, ITEM_STATUSES } from '../constants/enums';
const s = new Schema({
  society: { type: Schema.Types.ObjectId, ref: 'Society', required: true },
  owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  listingType: { type: String, enum: LISTING_TYPES, required: true },
  title: { type: String, required: true, minlength: 3, maxlength: 80 },
  description: { type: String, maxlength: 1000 },
  category: { type: String, enum: ITEM_CATEGORIES },
  condition: { type: String, enum: ITEM_CONDITIONS },
  tags: [String],
  images: [{ url: String, publicId: String, _id: false }],
  availableFrom: Date, availableTo: Date, maxBorrowDays: { type: Number, default: 3, min: 1, max: 30 },
  pickupNote: { type: String, maxlength: 200 }, depositNote: { type: String, maxlength: 100 },
  status: { type: String, enum: ITEM_STATUSES, default: 'available' },
  version: { type: Number, default: 0 },
  deletedAt: { type: Date, default: null },
  isHidden: { type: Boolean, default: false },
  hiddenReason: String,
}, { timestamps: true });
s.index({ society: 1, status: 1, listingType: 1, category: 1 });
s.index({ society: 1, tags: 1 });
export const Item = model('Item', s);
