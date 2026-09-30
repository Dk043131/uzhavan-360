import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from '../config/env.js';
import { requestLogger } from '../middlewares/logger.js';
import { errorHandler, notFoundHandler } from '../middlewares/errorHandler.js';

// Health
import healthRoutes from './routes/health.routes.js';

// Modules — real business implementations
import authRoutes from '../modules/auth/auth.routes.js';
import usersRoutes from '../modules/users/users.routes.js';
import farmersRoutes from '../modules/farmers/farmers.routes.js';
import productsRoutes from '../modules/products/products.routes.js';
import marketplaceRoutes from '../modules/marketplace/marketplace.routes.js';
import requestsRoutes from '../modules/requests/requests.routes.js';
import ordersRoutes from '../modules/orders/orders.routes.js';
import inventoryRoutes from '../modules/inventory/inventory.routes.js';
import notificationsRoutes from '../modules/notifications/notifications.routes.js';
import demandRoutes from '../modules/demand/demand.routes.js';
import byproductsRoutes from '../modules/byproducts/byproducts.routes.js';
import uzhavanRoutes from '../modules/uzhavan/uzhavan.routes.js';
import adminRoutes from '../modules/admin/admin.routes.js';

const app = express();

// ── Security ─────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: env.CLIENT_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
}));

// ── Parsing ───────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// ── Logging ───────────────────────────────────────────────────────────────────
app.use(requestLogger);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/health',             healthRoutes);
app.use('/api/health',         healthRoutes);
app.use('/api/auth',           authRoutes);
app.use('/api/users',          usersRoutes);
app.use('/api/farmers',        farmersRoutes);
app.use('/api/products',       productsRoutes);
app.use('/api/marketplace',    marketplaceRoutes);
app.use('/api/requests',       requestsRoutes);
app.use('/api/orders',         ordersRoutes);
app.use('/api/inventory',      inventoryRoutes);
app.use('/api/notifications',  notificationsRoutes);
app.use('/api/demand',         demandRoutes);
app.use('/api/byproducts',     byproductsRoutes);
app.use('/api/uzhavan',        uzhavanRoutes);
app.use('/api/admin',          adminRoutes);

// ── 404 & Error Handling ──────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
