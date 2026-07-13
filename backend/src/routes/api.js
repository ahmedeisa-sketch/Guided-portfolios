import express from 'express';
import { query } from '../db.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { asyncHandler, HttpError } from '../utils/http.js';
import { audit } from '../utils/audit.js';
import { getAdminClientSummaries, getClientPortfolios } from '../services/valuation.js';
import { dividendCreateSchema, requestCreateSchema, requestUpdateSchema } from '../validation.js';

export const apiRouter = express.Router();
apiRouter.use(authenticate);

apiRouter.get('/products', asyncHandler(async (_req, res) => {
  const result = await query(
    `SELECT id, name, type, currency, description, status, isin, inception_date,
            min_subscription, management_fee, benchmark
     FROM products WHERE status = 'Active' ORDER BY name`
  );
  res.json({ products: result.rows });
}));

apiRouter.get('/portfolios/me', requireRole('client'), asyncHandler(async (req, res) => {
  res.json({ portfolios: await getClientPortfolios(req.user.id) });
}));

apiRouter.get('/dividends/me', requireRole('client'), asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT d.id, d.amount, d.payment_date, d.status, p.name AS product_name, p.currency
     FROM dividends d
     JOIN clients c ON c.id = d.client_id
     LEFT JOIN products p ON p.id = d.product_id
     WHERE c.user_id = $1
     ORDER BY d.payment_date DESC`,
    [req.user.id]
  );
  res.json({ dividends: result.rows });
}));

apiRouter.get('/statements/me', requireRole('client'), asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT s.id, s.title, s.statement_date
     FROM statements s
     JOIN clients c ON c.id = s.client_id
     WHERE c.user_id = $1
     ORDER BY s.statement_date DESC`,
    [req.user.id]
  );
  res.json({ statements: result.rows });
}));

apiRouter.get('/requests/me', requireRole('client'), asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT r.id, r.request_type, r.product_id, r.amount, r.message, r.status,
            r.admin_note, r.created_at, r.updated_at, p.name AS product_name
     FROM service_requests r
     JOIN clients c ON c.id = r.client_id
     LEFT JOIN products p ON p.id = r.product_id
     WHERE c.user_id = $1
     ORDER BY r.created_at DESC`,
    [req.user.id]
  );
  res.json({ requests: result.rows });
}));

apiRouter.post('/requests', requireRole('client'), asyncHandler(async (req, res) => {
  const input = requestCreateSchema.parse(req.body);
  const clientResult = await query('SELECT id FROM clients WHERE user_id = $1', [req.user.id]);
  const clientId = clientResult.rows[0]?.id;
  if (!clientId) throw new HttpError(404, 'Client profile not found', 'CLIENT_NOT_FOUND');

  const result = await query(
    `INSERT INTO service_requests
      (client_id, request_type, product_id, amount, message, status, admin_note)
     VALUES ($1, $2, $3, $4, $5, 'Submitted', '')
     RETURNING *`,
    [clientId, input.type, input.productId || null, input.amount || null, input.message]
  );
  await audit({ actorId: req.user.id, action: 'CREATE_REQUEST', entityType: 'service_request', entityId: result.rows[0].id });
  res.status(201).json({ request: result.rows[0] });
}));

apiRouter.get('/admin/clients', requireRole('admin'), asyncHandler(async (_req, res) => {
  res.json({ clients: await getAdminClientSummaries() });
}));

apiRouter.get('/admin/requests', requireRole('admin'), asyncHandler(async (_req, res) => {
  const result = await query(
    `SELECT r.id, r.request_type, r.amount, r.message, r.status, r.admin_note,
            r.created_at, r.updated_at, c.client_code, u.full_name, p.name AS product_name
     FROM service_requests r
     JOIN clients c ON c.id = r.client_id
     JOIN users u ON u.id = c.user_id
     LEFT JOIN products p ON p.id = r.product_id
     ORDER BY r.created_at DESC`
  );
  res.json({ requests: result.rows });
}));

apiRouter.put('/admin/requests/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  const input = requestUpdateSchema.parse(req.body);
  const result = await query(
    `UPDATE service_requests
     SET status = $1, admin_note = $2, updated_at = NOW()
     WHERE id = $3
     RETURNING *`,
    [input.status, input.adminNote, req.params.id]
  );
  if (!result.rows[0]) throw new HttpError(404, 'Request not found', 'NOT_FOUND');
  await audit({ actorId: req.user.id, action: 'UPDATE_REQUEST', entityType: 'service_request', entityId: req.params.id, metadata: { status: input.status } });
  res.json({ request: result.rows[0] });
}));

apiRouter.post('/admin/dividends', requireRole('admin'), asyncHandler(async (req, res) => {
  const input = dividendCreateSchema.parse(req.body);
  const result = await query(
    `INSERT INTO dividends (client_id, product_id, amount, payment_date, status)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [input.clientId, input.productId || null, input.amount, input.date, input.status]
  );
  await audit({ actorId: req.user.id, action: 'CREATE_DIVIDEND', entityType: 'dividend', entityId: result.rows[0].id });
  res.status(201).json({ dividend: result.rows[0] });
}));
