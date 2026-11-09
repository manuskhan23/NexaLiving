import { app } from './app';
import { connectDB } from './config/db';
import { env } from './config/env';
import { logger } from './utils/logger';
import { ensureAdminCodes } from './services/adminCode.service';
import { startJobs } from './jobs';

async function main() {
  await connectDB();
  await ensureAdminCodes();
  app.listen(env.PORT, () => {
    logger.info('NexaLiving backend listening on port ' + env.PORT);
    logger.info('Admin codes: 3 live codes in the "codes" collection, rotated every 24h (npm run codes)');
    startJobs();
  });
}

main().catch((e) => {
  logger.error(e, 'Fatal startup error');
  process.exit(1);
});
