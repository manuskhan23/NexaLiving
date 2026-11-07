import { Schema, model } from 'mongoose';
import { REQUEST_STATUSES, TUTOR_GRADES, TEACHING_MODES } from '../constants/enums';
const s = new Schema({
  society: { type: Schema.Types.ObjectId, ref: 'Society', required: true },
  tutor: { type: Schema.Types.ObjectId, ref: 'TutorProfile', required: true },
  tutorUser: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  requester: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  studentName: { type: String, required: true, minlength: 2, maxlength: 60 },
  grade: { type: String, enum: TUTOR_GRADES },
  subjects: [String],
  preferredMode: { type: String, enum: TEACHING_MODES },
  preferredDays: [Number], preferredTime: String,
  message: { type: String, maxlength: 500 },
  status: { type: String, enum: REQUEST_STATUSES, default: 'pending' },
  responseMessage: String, respondedAt: Date, reason: String,
}, { timestamps: true });
s.index({ society: 1, tutorUser: 1, status: 1 });
s.index({ society: 1, requester: 1, status: 1 });
export const TutorRequest = model('TutorRequest', s);
