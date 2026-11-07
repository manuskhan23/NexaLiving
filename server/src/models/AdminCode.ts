import { Schema, model } from 'mongoose';
// Stored in the `codes` collection. Exactly 3 codes are live at a time; all 3 rotate every 24h.
const s = new Schema({
  code: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true, index: true },
}, { timestamps: true, collection: 'codes' });
export const AdminCode = model('AdminCode', s);
