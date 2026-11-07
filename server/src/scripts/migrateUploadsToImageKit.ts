/**
 * One-time migration: moves images saved by the old local driver (server/uploads/*, referenced in Mongo
 * as "/uploads/<file>") to ImageKit and rewrites every reference in every collection.
 *   Dry run:  npm run migrate:uploads:imagekit
 *   Apply:    npm run migrate:uploads:imagekit -- --apply
 */
import * as fs from 'fs';
import * as path from 'path';
import mongoose from 'mongoose';
import { env } from '../config/env';
import { uploadBuffer } from '../config/storage';

const APPLY = process.argv.includes('--apply');
const DIR = path.resolve(process.cwd(), 'uploads');
const LOCAL = /^\/uploads\/([A-Za-z0-9._-]+)$/;
const done = new Map<string, { url: string; publicId: string }>();
const missing = new Set<string>();

async function moveFile(fname: string) {
  if (done.has(fname)) return done.get(fname)!;
  const fpath = path.join(DIR, fname);
  if (!fs.existsSync(fpath)) {
    missing.add(fname);
    return null;
  }
  const img = APPLY
    ? await uploadBuffer(await fs.promises.readFile(fpath), { folder: 'uploads' })
    : { url: `(ImageKit URL for ${fname})`, publicId: '(new file ID)' };
  done.set(fname, img);
  return img;
}

// Returns the rewritten value, or undefined when nothing changed.
async function rewrite(v: any): Promise<any> {
  if (typeof v === 'string') {
    const m = LOCAL.exec(v);
    if (!m) return undefined;
    const img = await moveFile(m[1]);
    return img ? img.url : undefined;
  }
  if (Array.isArray(v)) {
    let changed = false;
    const out = [];
    for (const x of v) {
      const r = await rewrite(x);
      if (r !== undefined) changed = true;
      out.push(r === undefined ? x : r);
    }
    return changed ? out : undefined;
  }
  if (v && typeof v === 'object' && !(v instanceof Date) && !(v instanceof mongoose.Types.ObjectId) && !Buffer.isBuffer(v) && v._bsontype === undefined) {
    // { url: '/uploads/x.jpg', publicId: '<old id>' } -> ImageKit URL + file ID
    if (typeof v.url === 'string' && LOCAL.test(v.url)) {
      const img = await moveFile(LOCAL.exec(v.url)![1]);
      if (!img) return undefined;
      const rest: any = {};
      for (const [k, x] of Object.entries(v)) if (k !== 'url' && k !== 'publicId') rest[k] = (await rewrite(x)) ?? x;
      return { ...rest, url: img.url, publicId: img.publicId };
    }
    let changed = false;
    const out: any = {};
    for (const [k, x] of Object.entries(v)) {
      const r = await rewrite(x);
      if (r !== undefined) changed = true;
      out[k] = r === undefined ? x : r;
    }
    return changed ? out : undefined;
  }
  return undefined;
}

async function main() {
  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });
  const db = mongoose.connection.db!;
  let docsChanged = 0;
  for (const { name } of await db.listCollections().toArray()) {
    if (name.startsWith('system.')) continue;
    const col = db.collection(name);
    for await (const doc of col.find({})) {
      const set: any = {};
      for (const [k, v] of Object.entries(doc)) {
        if (k === '_id') continue;
        const r = await rewrite(v);
        if (r !== undefined) set[k] = r;
      }
      if (Object.keys(set).length) {
        docsChanged++;
        console.log(`${APPLY ? 'updated' : 'would update'} ${name}/${doc._id}: ${Object.keys(set).join(', ')}`);
        if (APPLY) await col.updateOne({ _id: doc._id }, { $set: set });
      }
    }
  }
  console.log(`\n${APPLY ? 'Done' : 'Dry run'}: ${docsChanged} documents, ${done.size} files${APPLY ? ' uploaded' : ' to upload'}.`);
  if (missing.size) console.log(`Referenced but missing on disk (left unchanged): ${[...missing].join(', ')}`);
  if (!APPLY) console.log('Run again with --apply to upload and rewrite.');
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error('Migration failed:', e?.message || e);
  process.exit(1);
});
