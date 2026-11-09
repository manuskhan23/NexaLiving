import { Router } from 'express';
import mongoose from 'mongoose';
import { ok } from '../utils/respond';
import * as enums from '../constants/enums';

const r = Router();
r.get('/health', (_req, res) => {
  const db = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  const status = db === 'connected' ? 'ok' : 'degraded';
  res.status(db === 'connected' ? 200 : 503).json({ success: true, data: { status, db, uptime: process.uptime(), time: new Date().toISOString() } });
});
r.get('/meta/enums', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=3600');
  ok(res, enums);
});
export default r;
