import { Schema, model } from 'mongoose';
import { ITEM_REQUEST_STATUSES, LISTING_TYPES } from '../constants/enums';
const s = new Schema({
  society: { type: Schema.Types.ObjectId, ref: 'Society', required: true },
  item: { type: Schema.Types.ObjectId, ref: 'Item', required: true },
  owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  requester: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: LISTING_TYPES, required: true },
  startAt: Date, endAt: Date,
  message: { type: String, maxlength: 300 },
  need: { type: Schema.Types.ObjectId, ref: 'Need' },
  status: { type: String, enum: ITEM_REQUEST_STATUSES, default: 'pending' },
  handedOverAt: Date, returnedAt: Date, overdueReminderSentAt: Date,
  reason: String, responseMessage: String, conditionNote: String,
}, { timestamps: true });
s.index({ item: 1, status: 1, startAt: 1, endAt: 1 });
s.index({ society: 1, owner: 1, status: 1 });
s.index({ society: 1, requester: 1, status: 1 });
export const ItemRequest = model('ItemRequest', s);
