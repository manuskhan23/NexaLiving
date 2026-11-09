import { Schema, model } from 'mongoose';
import { ANNOUNCEMENT_CATEGORIES } from '../constants/enums';
import { ImageRefSchema } from './imageRef';
const s = new Schema({
  society: { type: Schema.Types.ObjectId, ref: 'Society', required: true, index: true },
  title: { type: String, required: true, minlength: 3, maxlength: 120 },
  body: { type: String, required: true, maxlength: 5000 },
  category: { type: String, enum: ANNOUNCEMENT_CATEGORIES, default: 'general' },
  images: [ImageRefSchema],
  attachments: [{ url: String, name: String, _id: false }],
  isPinned: { type: Boolean, default: false },
  publishedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: null },
  editedAt: Date,
  readBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  deletedAt: { type: Date, default: null },
  isHidden: { type: Boolean, default: false },
  hiddenReason: String,
}, { timestamps: true });
s.index({ society: 1, isPinned: -1, publishedAt: -1 });
export const Announcement = model('Announcement', s);
