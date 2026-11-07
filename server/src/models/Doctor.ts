import { Schema, model } from 'mongoose';
const s = new Schema({
  society: { type: Schema.Types.ObjectId, ref: 'Society', required: true },
  name: { type: String, required: true, maxlength: 80 },
  speciality: { type: String, required: true, maxlength: 80 },
  qualifications: String,
  clinicName: String, clinicAddress: String, phone: String, mapUrl: String,
  timings: [{ days: [Number], from: String, to: String, _id: false }],
  consultationFee: Number,
  emergencyAvailable: { type: Boolean, default: false },
  photo: { url: String, publicId: String },
  isActive: { type: Boolean, default: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });
s.index({ society: 1, speciality: 1 });
export const Doctor = model('Doctor', s);
