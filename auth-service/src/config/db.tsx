import mongoose from 'mongoose';
import { connectMongo } from '@doctor-tracker/common';
import { env } from './env';

export const connectDb = () => connectMongo(mongoose, env.MONGO_URI, 'auth-service');
export const disconnectDb = () => mongoose.disconnect();
