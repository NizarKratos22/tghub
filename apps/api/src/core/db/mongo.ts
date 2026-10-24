import mongoose from 'mongoose';
import { env } from '../../config/env';
import { logger } from '../logger';

export async function connectMongo(uri = env.MONGO_URI): Promise<typeof mongoose> {
  mongoose.set('strictQuery', true);
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
  mongoose.connection.on('reconnected', () => logger.info('MongoDB reconnected'));

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5_000 });
  logger.info({ db: mongoose.connection.name }, 'MongoDB connected');
  return mongoose;
}

export async function disconnectMongo(): Promise<void> {
  await mongoose.disconnect();
}
