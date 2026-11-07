import { Schema, model } from 'mongoose';
import { TUTOR_SUBJECTS, TUTOR_GRADES, TEACHING_MODES, FEE_UNITS } from '../constants/enums';
const s = new Schema({
  society: { type: Schema.Types.ObjectId, ref: 'Society', required: true },
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  headline: { type: String, required: true, minlength: 5, maxlength: 80 },
  bio: { type: String, maxlength: 1000 },
  qualifications: { type: String, maxlength: 300 },
  phone: { type: String, required: true },
  whatsapp: { type: String },
  subjects: [{ type: String, enum: TUTOR_SUBJECTS }],
  grades: [{ type: String, enum: TUTOR_GRADES }],
  teachingMode: [{ type: String, enum: TEACHING_MODES }],
  availability: [{ day: { type: Number, min: 0, max: 6 }, from: String, to: String, _id: false }],
  feeMin: Number, feeMax: Number, feeUnit: { type: String, enum: FEE_UNITS, default: 'per_month' },
  experienceYears: { type: Number, min: 0, max: 50 },
  photo: { url: String, publicId: String },
  isActive: { type: Boolean, default: true },
  isVerified: { type: Boolean, default: false },
  verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  verifiedAt: Date,
  verificationNote: { type: String, select: false },
  deletedAt: { type: Date, default: null },
  isHidden: { type: Boolean, default: false },
  hiddenReason: String,
}, { timestamps: true });
s.index({ society: 1, user: 1 }, { unique: true });
s.index({ society: 1, subjects: 1 });
export const TutorProfile = model('TutorProfile', s);
