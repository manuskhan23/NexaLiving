import { AuditLog } from '../models/AuditLog';
import { logger } from '../utils/logger';
export async function audit(entry: { society?: string; actor: string; action: string; targetType?: string; targetId?: string; meta?: any; ip?: string }) {
  try { await AuditLog.create(entry); }
  catch (e) { logger.error({ e }, 'audit write failed'); }
}
