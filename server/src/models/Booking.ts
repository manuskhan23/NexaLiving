import { Schema, model } from 'mongoose';
import { BOOKING_STATUSES, EVENT_TYPES } from '../constants/enums';
const s = new Schema({
  society: { type: Schema.Types.ObjectId, ref: 'Society', required: true },
  space: { type: Schema.Types.ObjectId, ref: 'EventSpace', required: true },
  requester: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  spaceName: String, fee: Number,
  eventTitle: { type: String, required: true, minlength: 3, maxlength: 80 },
  eventType: { type: String, enum: EVENT_TYPES },
  guestCount: { type: Number, required: true, min: 1 },
  notes: { type: String, maxlength: 500 },
  contactPhone: String,
  startAt: Date, endAt: Date,
  status: { type: String, enum: BOOKING_STATUSES, default: 'pending' },
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: Date, adminNote: String, rejectionReason: String,
  cancelledBy: { type: Schema.Types.ObjectId, ref: 'User' }, cancelReason: String,
  statusHistory: [{ status: String, by: { type: Schema.Types.ObjectId, ref: 'User' }, at: Date, note: String, _id: false }],
}, { timestamps: true });
s.index({ space: 1, status: 1, startAt: 1, endAt: 1 });
s.index({ society: 1, requester: 1, startAt: 1 });
export const Booking = model('Booking', s);
