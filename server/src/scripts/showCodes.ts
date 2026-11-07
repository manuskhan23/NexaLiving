// Prints the 3 currently valid admin signup codes:  npm run codes
import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { ensureAdminCodes } from '../services/adminCode.service';
import { AdminCode } from '../models/AdminCode';

(async () => {
  await connectDB();
  await ensureAdminCodes();
  const codes = await AdminCode.find({}).sort({ createdAt: 1 }).lean();
  for (const c of codes as any[]) console.log(c.code, ' expires', c.expiresAt.toISOString());
  await mongoose.disconnect();
})().catch((e) => { console.error(e?.message || e); process.exit(1); });
