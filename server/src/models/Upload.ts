import { Schema, model } from 'mongoose';
const s = new Schema({
  uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  publicId: { type: String, required: true, unique: true },
  url: String, purpose: String,
  width: Number, height: Number,
  attached: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});
s.index({ attached: 1, createdAt: 1 });
export const Upload = model('Upload', s);
