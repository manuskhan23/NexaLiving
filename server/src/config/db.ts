import mongoose from 'mongoose';
import { env, isTest } from './env';
import { logger } from '../utils/logger';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Connects to MongoDB and keeps retrying on network trouble (never exits the process because of a temporary outage). */
export async function connectDB(): Promise<void> {
  mongoose.set('strictQuery', true);
  if (isTest) return;
  for (let attempt = 1; ; attempt++) {
    try {
      await mongoose.connect(env.MONGODB_URI, {
        serverSelectionTimeoutMS: 20000, // fail a request after 20s (default 30s) when Atlas is unreachable
        connectTimeoutMS: 20000,
        socketTimeoutMS: 45000,
        heartbeatFrequencyMS: 5000, // notice a recovered/failed-over node sooner
        maxPoolSize: 20,
        family: 4, // IPv4 only: avoids slow IPv6/DNS fallbacks that cause ETIMEDOUT on Windows
      });
      logger.info(`MongoDB connected: ${mongoose.connection.host}`);
      return;
    } catch (err: any) {
      const wait = Math.min(5000 * attempt, 30000);
      logger.error(`MongoDB not reachable (attempt ${attempt}): ${String(err?.message).slice(0, 120)} - retrying in ${wait / 1000}s. Check your internet connection / VPN / Atlas Network Access.`);
      await sleep(wait);
    }
  }
}

export async function disconnectDB(): Promise<void> {
  await mongoose.connection.close();
}

export function isValidObjectId(id: string): boolean {
  return mongoose.isValidObjectId(id);
}

export { mongoose };
