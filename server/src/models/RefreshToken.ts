import { Schema, model, Types } from 'mongoose';
export interface IRefreshToken {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  jti: string;
  tokenHash: string;
  deviceName?: string;
  expiresAt: Date;
  revokedAt?: Date | null;
  replacedBy?: string;
}
const s = new Schema<IRefreshToken>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  jti: { type: String, required: true, unique: true },
  tokenHash: { type: String, required: true },
  deviceName: String,
  expiresAt: { type: Date, required: true },
  revokedAt: { type: Date, default: null },
  replacedBy: String,
}, { timestamps: true });
s.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const RefreshToken = model<IRefreshToken>('RefreshToken', s);
