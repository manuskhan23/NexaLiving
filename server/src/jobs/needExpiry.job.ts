import { Need } from '../models/Need';
export async function runNeedExpiry() {
  await Need.updateMany({ status: 'open', expiresAt: { $lt: new Date() } }, { $set: { status: 'expired' } });
}
