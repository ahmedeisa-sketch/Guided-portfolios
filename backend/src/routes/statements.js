import express from 'express';
import PDFDocument from 'pdfkit';
import { query } from '../db.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { asyncHandler, HttpError } from '../utils/http.js';

export const statementsRouter = express.Router();

statementsRouter.get('/:id/pdf', authenticate, requireRole('client'), asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT s.id, s.title, s.statement_date, c.client_code, u.full_name
     FROM statements s
     JOIN clients c ON c.id = s.client_id
     JOIN users u ON u.id = c.user_id
     WHERE s.id = $1 AND c.user_id = $2`,
    [req.params.id, req.user.id]
  );
  const statement = result.rows[0];
  if (!statement) throw new HttpError(404, 'Statement not found', 'NOT_FOUND');

  const document = new PDFDocument({ size: 'A4', margin: 54, info: { Title: statement.title } });
  document.on('error', (error) => {
    if (!res.headersSent) res.status(500).json({ error: { code: 'PDF_FAILED', message: 'Unable to generate statement' } });
    else res.destroy(error);
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="statement-${statement.id}.pdf"`);
  res.setHeader('Cache-Control', 'private, no-store');
  document.pipe(res);

  document.fontSize(22).text('EmCoin Investment Statement', { align: 'center' });
  document.moveDown(2);
  document.fontSize(12).text(`Client: ${statement.full_name}`);
  document.text(`Client Code: ${statement.client_code}`);
  document.text(`Statement: ${statement.title}`);
  document.text(`Statement Date: ${statement.statement_date}`);
  document.moveDown(2);
  document.fontSize(10).fillColor('#555').text(
    'This generated document confirms the statement record available in the portal. ' +
    'Detailed regulated reporting should be produced by the approved books-and-records system.'
  );
  document.end();
}));
