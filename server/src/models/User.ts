import { Schema, model, Types } from 'mongoose';
import { GLOBAL_ROLES, THEMES, PLATFORMS } from '../constants/enums';
import { ImageRefSchema } from './imageRef';

export interface IUser {
  _id: Types.ObjectId;
  fullName: string;
  email: string;
  phone: string;
  cnic: string;
  isVerified: boolean;
  verifyOtpHash?: string;
  verifyOtpExpiresAt?: Date;
  verifyOtpAttempts: number;
  passwordHash: string;
  globalRole: 'user' | 'admin';
  avatar?: { url: string; publicId: string };
  bio?: string;
  skills: string[];
  showInDirectory: boolean;
  showPhoneInDirectory: boolean;
  settings: {
    theme: 'light' | 'dark' | 'system';
    notifications: { announcements: boolean; bookings: boolean; requests: boolean; listings: boolean; community: boolean; marketing: boolean };
  };
  pushTokens: Array<{ token: string; platform: 'android' | 'ios'; addedAt: Date }>;
  tokenVersion: number;
  resetOtpHash?: string;
  resetOtpExpiresAt?: Date;
  resetOtpAttempts: number;
  isBlocked: boolean;
  lastLoginAt?: Date;
  passwordChangedAt?: Date;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>({
  fullName: { type: String, required: true, minlength: 2, maxlength: 60 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  phone: { type: String, required: true },
  cnic: { type: String, required: true, unique: true, match: /^\d{5}-\d{7}-\d{1}$/ },
  isVerified: { type: Boolean, default: false },
  verifyOtpHash: { type: String, select: false },
  verifyOtpExpiresAt: { type: Date, select: false },
  verifyOtpAttempts: { type: Number, default: 0, select: false },
  passwordHash: { type: String, required: true, select: false },
  globalRole: { type: String, enum: GLOBAL_ROLES, default: 'user' },
  avatar: { type: ImageRefSchema },
  bio: { type: String, maxlength: 300 },
  skills: [{ type: String, maxlength: 30 }],
  showInDirectory: { type: Boolean, default: true },
  showPhoneInDirectory: { type: Boolean, default: false },
  settings: {
    theme: { type: String, enum: THEMES, default: 'system' },
    notifications: {
      announcements: { type: Boolean, default: true },
      bookings: { type: Boolean, default: true },
      requests: { type: Boolean, default: true },
      listings: { type: Boolean, default: true },
      community: { type: Boolean, default: true },
      marketing: { type: Boolean, default: true },
    },
  },
  pushTokens: [{ token: String, platform: { type: String, enum: PLATFORMS }, addedAt: Date, _id: false }],
  tokenVersion: { type: Number, default: 0 },
  resetOtpHash: { type: String, select: false },
  resetOtpExpiresAt: { type: Date, select: false },
  resetOtpAttempts: { type: Number, default: 0, select: false },
  isBlocked: { type: Boolean, default: false },
  lastLoginAt: Date,
  passwordChangedAt: Date,
  deletedAt: { type: Date, default: null },
}, { timestamps: true });

export interface IUserMethods { toPublicJSON(): any; }
export type UserModel = import('mongoose').Model<IUser, {}, IUserMethods>;

UserSchema.method('toPublicJSON', function (this: any) {
  return {
    _id: this._id, fullName: this.fullName, email: this.email, phone: this.phone,
    cnic: this.cnic, isVerified: this.isVerified,
    globalRole: this.globalRole, avatar: this.avatar, bio: this.bio, skills: this.skills,
    showInDirectory: this.showInDirectory, showPhoneInDirectory: this.showPhoneInDirectory,
    settings: this.settings, createdAt: this.createdAt,
  };
});

export const User = model<IUser, UserModel>('User', UserSchema);
export default User;
