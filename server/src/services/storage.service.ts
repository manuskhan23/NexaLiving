import * as sharp from 'sharp';
import { uploadBuffer, deleteByPublicId, StoredImage } from '../config/storage';
import { ApiError } from '../utils/ApiError';

export interface ProcessedImage { url: string; publicId: string; }

export async function processAndStoreImage(
  buffer: Buffer,
  opts: { folder?: string; width?: number; height?: number; cover?: boolean } = {}
): Promise<StoredImage> {
  let pipeline = (sharp as any).default ? (sharp as any).default(buffer) : (sharp as any)(buffer);
  if (opts.width && opts.height) {
    pipeline = pipeline.resize(opts.width, opts.height, { fit: 'cover', withoutEnlargement: true }).rotate();
  } else {
    pipeline = pipeline.rotate();
  }
  let out: Buffer;
  try {
    out = await pipeline.jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  } catch {
    // Not an image sharp can read (text file, corrupt photo, unsupported format such as HEIC).
    throw new ApiError(400, 'INVALID_IMAGE', 'This file is not a supported photo. Please choose a JPG, PNG or WebP image.');
  }
  return uploadBuffer(out, { folder: opts.folder });
}

export { deleteByPublicId };
