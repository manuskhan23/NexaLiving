import { Schema } from 'mongoose';
export const ImageRefSchema = new Schema({ url: { type: String, required: true }, publicId: { type: String, required: true } }, { _id: false });