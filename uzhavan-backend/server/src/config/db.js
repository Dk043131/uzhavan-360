import mongoose from 'mongoose';
import { env } from './env.js';

let isConnected = false;

/**
 * Connect to MongoDB Atlas / Local MongoDB instance
 */
export async function connectDB() {
  if (isConnected) {
    return mongoose.connection;
  }

  try {
    const conn = await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 4000,
      autoIndex: true
    });

    isConnected = true;
    console.log(`[DATABASE] MongoDB Connected successfully: ${conn.connection.host}/${conn.connection.name}`);

    mongoose.connection.on('error', (err) => {
      console.error(`[DATABASE ERROR] Connection error: ${err.message}`);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('[DATABASE] MongoDB connection disconnected.');
      isConnected = false;
    });

    return conn;
  } catch (error) {
    console.warn(`[DATABASE] Primary URI failed (${error.message}). Attempting local MongoDB fallback...`);
    try {
      const fallbackUri = 'mongodb://127.0.0.1:27017/uzhavan360';
      const fallbackConn = await mongoose.connect(fallbackUri, {
        serverSelectionTimeoutMS: 3000,
        autoIndex: true
      });
      isConnected = true;
      console.log(`[DATABASE] Connected to local fallback: ${fallbackConn.connection.host}/${fallbackConn.connection.name}`);
      return fallbackConn;
    } catch (fallbackError) {
      console.error(`[DATABASE CRITICAL] Failed to connect to MongoDB: ${fallbackError.message}`);
      if (env.NODE_ENV === 'production') {
        process.exit(1);
      }
      return null;
    }
  }
}

/**
 * Gracefully disconnect from MongoDB
 */
export async function disconnectDB() {
  if (!isConnected) return;
  try {
    await mongoose.connection.close();
    isConnected = false;
    console.log('[DATABASE] MongoDB connection cleanly closed.');
  } catch (err) {
    console.error(`[DATABASE] Error closing connection: ${err.message}`);
  }
}
