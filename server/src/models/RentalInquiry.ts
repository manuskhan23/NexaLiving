import { Schema, model } from 'mongoose';
const s = new Schema({
  society: { type: Schema.Types.ObjectId, ref: 'Society', required: true },
  rental: { type: Schema.Types.ObjectId, ref: 'Rental', required: true },
  owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  inquirer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, maxlength: 500 },
  visitPreference: String,
  status: { type: String, enum: ['pending', 'contacted', 'closed'], default: 'pending' },
}, { timestamps: true });
s.index({ rental: 1, inquirer: 1 }, { unique: true });
export const RentalInquiry = model('RentalInquiry', s);
