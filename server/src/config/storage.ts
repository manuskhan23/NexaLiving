import { env } from './env';
import { v4 as uuidv4 } from 'uuid';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';

const IMAGEKIT_API = 'https://api.imagekit.io/v1';
const authorization = `Basic ${Buffer.from(`${env.IMAGEKIT_PRIVATE_KEY}:`).toString('base64')}`;

export interface StoredImage {
  url: string;
  publicId: string;
}

export async function uploadBuffer(buffer: Buffer, opts: { folder?: string } = {}): Promise<StoredImage> {
  const form = new FormData();
  form.append('file', buffer.toString('base64'));
  form.append('fileName', `${uuidv4()}.jpg`);
  form.append('folder', opts.folder || 'nexaliving');

  let response: Response;
  try {
    response = await fetch(`${IMAGEKIT_API}/files/upload`, {
      method: 'POST',
      headers: { Authorization: authorization },
      body: form,
    });
  } catch (error) {
    logger.error({ error }, 'ImageKit upload request failed');
    throw new ApiError(502, 'UPLOAD_FAILED', 'Image upload failed. Please try again later.');
  }

  const result = await response.json().catch(() => null) as {
    fileId?: string;
    url?: string;
    message?: string;
  } | null;
  if (!response.ok || !result?.fileId || !result?.url) {
    logger.error({ status: response.status, message: result?.message }, 'ImageKit upload failed');
    throw new ApiError(502, 'UPLOAD_FAILED', 'Image upload failed. Please try again later.');
  }
  return { url: result.url, publicId: result.fileId };
}

export async function deleteByPublicId(publicId: string): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${IMAGEKIT_API}/files/${encodeURIComponent(publicId)}`, {
      method: 'DELETE',
      headers: { Authorization: authorization },
    });
  } catch (error) {
    logger.error({ error }, 'ImageKit delete request failed');
    throw new ApiError(502, 'DELETE_FAILED', 'Image deletion failed. Please try again later.');
  }
  if (!response.ok) {
    const message = await response.text();
    logger.error({ status: response.status, message }, 'ImageKit delete failed');
    throw new ApiError(502, 'DELETE_FAILED', 'Image deletion failed. Please try again later.');
  }
}
