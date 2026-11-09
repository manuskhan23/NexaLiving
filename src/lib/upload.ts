import { launchImageLibrary } from 'react-native-image-picker';
import { api } from '../api';

export type Img = { url: string; publicId: string };

async function pick(multiple: boolean) {
  const r = await launchImageLibrary({
    mediaType: 'photo', selectionLimit: multiple ? 6 : 1, quality: 0.8, maxWidth: 1600, maxHeight: 1600,
  });
  if (r.didCancel) return [];
  if (r.errorCode) throw new Error(r.errorMessage || 'Could not open the photo library');
  return r.assets || [];
}

const toFile = (a: any) => ({
  uri: a.uri, name: a.fileName || `photo-${Date.now()}.jpg`, type: a.type || 'image/jpeg',
}) as any;

/** Pick photos from the gallery and upload them. Returns [{url, publicId}] */
export async function pickAndUploadImages(multiple = true): Promise<Img[]> {
  const assets = await pick(multiple);
  if (!assets.length) return [];
  const form = new FormData();
  assets.forEach(a => form.append('images', toFile(a)));
  const d: any = await api.post('/uploads/images', form, { form: true });
  return d.images || [];
}

/** Pick a photo and set it as the user's avatar. Returns the updated avatar. */
export async function pickAndSetAvatar(): Promise<any | null> {
  const assets = await pick(false);
  if (!assets.length) return null;
  const form = new FormData();
  form.append('avatar', toFile(assets[0]));
  return api.put('/users/me/avatar', form, { form: true });
}
