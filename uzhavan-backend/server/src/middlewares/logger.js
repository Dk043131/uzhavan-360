import morgan from 'morgan';
import { env } from '../config/env.js';

/**
 * Request logger middleware
 */
export const requestLogger = env.NODE_ENV === 'production'
  ? morgan('combined')
  : morgan('[:date[iso]] :method :url :status :response-time ms - :res[content-length]');
