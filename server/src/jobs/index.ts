import * as cron from 'node-cron';
import { logger } from '../utils/logger';
export function startJobs() {
  // Booking reminders every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    try { const { runBookingReminders } = require('./bookingReminder.job'); await runBookingReminders(); }
    catch (e) { logger.error(e, 'booking reminders failed'); }
  });
  // Overdue item check daily at 09:00
  cron.schedule('0 9 * * *', async () => {
    try { const { runOverdueItems } = require('./overdueItems.job'); await runOverdueItems(); }
    catch (e) { logger.error(e, 'overdue items check failed'); }
  });
  // Expire needs daily at 03:00
  cron.schedule('0 3 * * *', async () => {
    try { const { runNeedExpiry } = require('./needExpiry.job'); await runNeedExpiry(); }
    catch (e) { logger.error(e, 'need expiry failed'); }
  });
  // Complete past bookings hourly
  cron.schedule('5 * * * *', async () => {
    try { const { runBookingComplete } = require('./bookingComplete.job'); await runBookingComplete(); }
    catch (e) { logger.error(e, 'booking completion failed'); }
  });
  // Admin signup codes: keep exactly 3 live, rotate all when they pass 24h
  cron.schedule('*/10 * * * *', async () => {
    try { const { ensureAdminCodes } = require('../services/adminCode.service'); await ensureAdminCodes(); }
    catch (e) { logger.error(e, 'admin code rotation failed'); }
  });
  // Free emails/CNICs held by signups that were never verified (hourly, older than 24h)
  cron.schedule('20 * * * *', async () => {
    try {
      const { User } = require('../models/User');
      const { UNVERIFIED_TTL_MS } = require('../services/auth.service');
      const r = await User.deleteMany({ isVerified: false, deletedAt: null, createdAt: { $lt: new Date(Date.now() - UNVERIFIED_TTL_MS) } });
      if (r.deletedCount) logger.info({ count: r.deletedCount }, 'removed stale unverified signups');
    } catch (e) { logger.error(e, 'unverified signup cleanup failed'); }
  });
  logger.info('Background jobs started');
}
