import mongoose from 'mongoose';
import { connectMongo } from '@doctor-tracker/common';
import { env } from './env';

export const connectDb = () => connectMongo(mongoose, env.MONGO_URI, 'patient-service');
export const disconnectDb = () => mongoose.disconnect();
