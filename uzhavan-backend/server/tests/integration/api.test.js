import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import app from '../../src/api/app.js';

describe('Uzhavan 360 API Integration Tests', () => {
  it('GET /api/health returns 200 and healthy status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('HEALTHY');
    expect(res.body.data.integrations).toBeDefined();
  });

  it('GET /api/uzhavan returns public tool registry status', async () => {
    const res = await request(app).get('/api/uzhavan');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('tool_layer_active');
    expect(res.body.data.totalTools).toBeGreaterThan(15);
    expect(Array.isArray(res.body.data.tools)).toBe(true);
  });

  it('POST /api/auth/logout returns 200 and success status', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.loggedOut).toBe(true);
  });

  it('GET /api/auth/me rejects without token with 401', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/products rejects without authentication with 401', async () => {
    const res = await request(app)
      .post('/api/products')
      .send({ name: 'Test Product', quantity: 100 });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/uzhavan/tool rejects unauthenticated requests with 401', async () => {
    const res = await request(app)
      .post('/api/uzhavan/tool')
      .send({ toolName: 'getMyProducts' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('GET /api/nonexistent-route returns standard 404', async () => {
    const res = await request(app).get('/api/nonexistent-route');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('Route not found');
  });
});
