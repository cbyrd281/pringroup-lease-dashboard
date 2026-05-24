// backend/server.js - Express API starter
import express from 'express';
import cors from 'cors';
import pg from 'pg';
import dotenv from 'dotenv';
import multer from 'multer';
import { Anthropic } from '@anthropic-ai/sdk';
import path from 'path';
import { fileURLToPath } from 'url';
import { PipedriveService } from './backend/services/pipedrive.js';
import cron from 'node-cron';
import { NotificationService } from './backend/services/notificationService.js';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const { Pool } = pg;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// File upload setup (kept for backward compatibility)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

// Anthropic client
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ===== LEASE ROUTES =====

// POST /api/leases/extract - Extract lease data from PDF using AI
app.post('/api/leases/extract', async (req, res) => {
  try {
    const { pdf, filename } = req.body;

    if (!pdf) {
      return res.status(400).json({ error: 'No PDF file provided' });
    }

    console.log(`Processing PDF: ${filename || 'unknown'}`);

    // PDF is already in base64 format
    const base64Pdf = pdf.includes('base64,') ? pdf.split('base64,')[1] : pdf;

    // Use Claude to extract lease information from PDF with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      const response = await anthropic.messages.create({
        model: 'claude-opus-4-1',
        max_tokens: 1024,
        timeout: 30000,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: base64Pdf,
                },
              },
              {
                type: 'text',
                text: `Extract lease information from this PDF document. Return a JSON object with these fields (use null for missing data):
{
  "tenant_name": "Company or person name",
  "address": "Street address",
  "city": "City",
  "state": "State code (e.g., TX)",
  "zip_code": "ZIP code",
  "expiration_date": "Expiration date in YYYY-MM-DD format",
  "broker": "Broker name (William, Steven, Marc, or Andrew) - guess from context or null",
  "lease_terms": "Key lease terms summary",
  "notes": "Any other important details"
}
Return ONLY the JSON object, no other text.`,
              },
            ],
          },
        ],
      });

      clearTimeout(timeoutId);

      // Parse the AI response
      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude');
      }

      const extractedData = JSON.parse(content.text);
      console.log('PDF extraction successful');
      res.json(extractedData);
    } catch (apiError) {
      clearTimeout(timeoutId);
      console.error('Anthropic API error:', apiError.message || apiError);

      // Return empty form so user can fill manually
      res.json({
        tenant_name: null,
        address: null,
        city: null,
        state: 'TX',
        zip_code: null,
        expiration_date: null,
        broker: null,
        lease_terms: null,
        notes: 'PDF uploaded - please fill details manually',
      });
    }
  } catch (error) {
    console.error('PDF extraction error:', error.message || error);

    // Fallback: return empty form
    res.json({
      tenant_name: null,
      address: null,
      city: null,
      state: 'TX',
      zip_code: null,
      expiration_date: null,
      broker: null,
      lease_terms: null,
      notes: 'PDF uploaded - please fill details manually',
    });
  }
});

// POST /api/leases/parse-pdf - Parse PDF file uploaded from frontend
app.post('/api/leases/parse-pdf', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file provided' });
    }

    console.log(`Received PDF: ${req.file.originalname} (${req.file.size} bytes)`);

    const pdfBase64 = req.file.buffer.toString('base64');

    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('ERROR: ANTHROPIC_API_KEY environment variable not set on Render');
      return res.status(500).json({
        error: 'ANTHROPIC_API_KEY not configured. Add it to Render environment variables.',
        tenant_name: '',
        address: '',
        city: '',
        state: '',
        zip_code: '',
        expiration_date: '',
        lease_terms: '',
      });
    }

    console.log('Sending PDF to Claude API for parsing...');

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-1',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Extract the following information from this lease document and return ONLY valid JSON (no markdown, no extra text):
{
  "tenant_name": "extracted tenant/company name or empty string",
  "address": "street address or empty string",
  "city": "city or empty string",
  "state": "state abbreviation or empty string",
  "zip_code": "zip code or empty string",
  "expiration_date": "YYYY-MM-DD format or empty string",
  "lease_terms": "key lease terms summary or empty string"
}

If you cannot find a field, use an empty string. Return ONLY the JSON object, nothing else.`,
            },
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: pdfBase64,
              },
            },
          ],
        },
      ],
    });

    const content = response.content[0]?.text || '{}';
    console.log('Claude API response:', content);

    let parsed = {};
    try {
      parsed = JSON.parse(content);
      console.log('Successfully parsed lease data:', parsed);
    } catch (e) {
      console.error('Failed to parse Claude response as JSON:', content);
    }

    const result = {
      tenant_name: parsed.tenant_name || '',
      address: parsed.address || '',
      city: parsed.city || '',
      state: parsed.state || '',
      zip_code: parsed.zip_code || '',
      expiration_date: parsed.expiration_date || '',
      lease_terms: parsed.lease_terms || '',
    };

    console.log('Returning parsed result:', result);
    res.json(result);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('POST /api/leases/parse-pdf error:', errorMsg);
    console.error('Full error:', error);
    res.status(500).json({
      error: `Failed to parse PDF: ${errorMsg}`,
      tenant_name: '',
      address: '',
      city: '',
      state: '',
      zip_code: '',
      expiration_date: '',
      lease_terms: '',
    });
  }
});

// GET /api/leases - List all leases with filtering
app.get('/api/leases', async (req, res) => {
  try {
    const { broker, view, sort = 'soonest', limit = 50, offset = 0 } = req.query;

    let query = 'SELECT * FROM leases WHERE is_active = true';
    const params = [];

    // Broker filter
    if (broker && ['William', 'Steven', 'Marc', 'Andrew'].includes(broker)) {
      params.push(broker);
      query += ` AND broker = $${params.length}`;
    }

    // Time-bucket view filtering
    if (view === '12month') {
      query += ` AND (expiration_date - CURRENT_DATE) BETWEEN 0 AND 365`;
    } else if (view === '6month') {
      query += ` AND (expiration_date - CURRENT_DATE) BETWEEN 0 AND 180`;
    } else if (view === '4month') {
      query += ` AND (expiration_date - CURRENT_DATE) BETWEEN 0 AND 120`;
    }

    // Sorting
    if (sort === 'soonest') {
      query += ' ORDER BY expiration_date ASC';
    } else if (sort === 'latest') {
      query += ' ORDER BY expiration_date DESC';
    } else if (sort === 'broker') {
      query += ' ORDER BY broker ASC, expiration_date ASC';
    }

    // Pagination
    query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM leases WHERE is_active = true'
    );

    res.json({
      leases: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit,
      offset,
    });
  } catch (error) {
    console.error('GET /api/leases error:', error);
    res.status(500).json({ error: 'Failed to fetch leases' });
  }
});

// GET /api/leases/:id - Fetch single lease
app.get('/api/leases/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM leases WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lease not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('GET /api/leases/:id error:', error);
    res.status(500).json({ error: 'Failed to fetch lease' });
  }
});

// POST /api/leases - Create new lease
app.post('/api/leases', async (req, res) => {
  try {
    const { tenant_name, address, city, state, zip_code, expiration_date, broker, pdf_url, notes } = req.body;

    // Validation
    if (!tenant_name || !address || !expiration_date || !broker) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await pool.query(
      `INSERT INTO leases (tenant_name, address, city, state, zip_code, expiration_date, broker, pdf_url, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [tenant_name, address, city, state, zip_code, expiration_date, broker, pdf_url, notes]
    );

    res.status(201).json({
      id: result.rows[0].id,
      lease: result.rows[0],
    });
  } catch (error) {
    console.error('POST /api/leases error:', error);
    res.status(500).json({ error: 'Failed to create lease' });
  }
});

// PATCH /api/leases/:id - Update lease
app.patch('/api/leases/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { tenant_name, address, broker, expiration_date, notes, renewal_status, renewal_date, is_active } = req.body;

    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (tenant_name !== undefined) {
      updates.push(`tenant_name = $${paramIndex++}`);
      params.push(tenant_name);
    }
    if (address !== undefined) {
      updates.push(`address = $${paramIndex++}`);
      params.push(address);
    }
    if (broker !== undefined) {
      updates.push(`broker = $${paramIndex++}`);
      params.push(broker);
    }
    if (expiration_date !== undefined) {
      updates.push(`expiration_date = $${paramIndex++}`);
      params.push(expiration_date);
    }
    if (notes !== undefined) {
      updates.push(`notes = $${paramIndex++}`);
      params.push(notes);
    }
    if (renewal_status !== undefined) {
      updates.push(`renewal_status = $${paramIndex++}`);
      params.push(renewal_status);
    }
    if (renewal_date !== undefined) {
      updates.push(`renewal_date = $${paramIndex++}`);
      params.push(renewal_date);
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      params.push(is_active);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    if (updates.length === 1) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(id);
    const query = `UPDATE leases SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lease not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('PATCH /api/leases/:id error:', error);
    res.status(500).json({ error: 'Failed to update lease' });
  }
});

// DELETE /api/leases/:id - Soft delete lease
app.delete('/api/leases/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'UPDATE leases SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lease not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/leases/:id error:', error);
    res.status(500).json({ error: 'Failed to delete lease' });
  }
});

// GET /api/leases/dashboard/metrics - Summary statistics
app.get('/api/leases/dashboard/metrics', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*) as total_leases,
        SUM(CASE WHEN (expiration_date - CURRENT_DATE) <= 30 THEN 1 ELSE 0 END) as urgent_count,
        SUM(CASE WHEN (expiration_date - CURRENT_DATE) BETWEEN 31 AND 60 THEN 1 ELSE 0 END) as soon_count,
        SUM(CASE WHEN (expiration_date - CURRENT_DATE) > 60 THEN 1 ELSE 0 END) as ok_count
      FROM leases WHERE is_active = true
    `);

    const brokerResult = await pool.query(`
      SELECT broker, COUNT(*) as count
      FROM leases WHERE is_active = true
      GROUP BY broker
      ORDER BY broker
    `);

    const by_broker = {};
    brokerResult.rows.forEach(row => {
      by_broker[row.broker] = row.count;
    });

    res.json({
      total_leases: parseInt(result.rows[0].total_leases) || 0,
      urgent_count: parseInt(result.rows[0].urgent_count) || 0,
      soon_count: parseInt(result.rows[0].soon_count) || 0,
      ok_count: parseInt(result.rows[0].ok_count) || 0,
      by_broker,
    });
  } catch (error) {
    console.error('GET /api/leases/dashboard/metrics error:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

// ===== ARCHIVE ROUTES =====

// GET /api/leases/archived - List archived leases
app.get('/api/leases/archived', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM leases_archived ORDER BY archived_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('GET /api/leases/archived error:', error);
    res.status(500).json({ error: 'Failed to fetch archived leases' });
  }
});

// POST /api/leases/archive-expired - Archive all expired leases
app.post('/api/leases/archive-expired', async (req, res) => {
  try {
    // Find expired leases
    const findExpiredResult = await pool.query(
      'SELECT * FROM leases WHERE is_active = true AND expiration_date::date < CURRENT_DATE'
    );

    const expiredLeases = findExpiredResult.rows;

    if (expiredLeases.length === 0) {
      return res.json({ archived: 0, message: 'No expired leases to archive' });
    }

    // Insert expired leases into archive table and mark as inactive
    await pool.query('BEGIN');

    try {
      for (const lease of expiredLeases) {
        await pool.query(
          `INSERT INTO leases_archived (
            id, tenant_name, address, city, state, zip_code, expiration_date, broker,
            pdf_url, lease_terms, notes, created_at, updated_at, created_by,
            tenant_contact_name, tenant_contact_phone, tenant_contact_email,
            broker_contact_phone, broker_contact_email, pipedrive_deal_id,
            renewal_status, renewal_date, archived_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
            $15, $16, $17, $18, $19, $20, $21, $22, CURRENT_TIMESTAMP
          )`,
          [
            lease.id, lease.tenant_name, lease.address, lease.city, lease.state,
            lease.zip_code, lease.expiration_date, lease.broker, lease.pdf_url,
            lease.lease_terms, lease.notes, lease.created_at, lease.updated_at,
            lease.created_by, lease.tenant_contact_name, lease.tenant_contact_phone,
            lease.tenant_contact_email, lease.broker_contact_phone,
            lease.broker_contact_email, lease.pipedrive_deal_id, lease.renewal_status,
            lease.renewal_date
          ]
        );
      }

      // Mark expired leases as inactive
      await pool.query(
        'UPDATE leases SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE expiration_date::date < CURRENT_DATE'
      );

      await pool.query('COMMIT');

      res.json({ archived: expiredLeases.length, leases: expiredLeases });
    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('POST /api/leases/archive-expired error:', error);
    res.status(500).json({ error: 'Failed to archive expired leases' });
  }
});

// DELETE /api/leases/archived/:id - Permanently delete archived lease
app.delete('/api/leases/archived/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM leases_archived WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Archived lease not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/leases/archived/:id error:', error);
    res.status(500).json({ error: 'Failed to delete archived lease' });
  }
});

// ===== PIPEDRIVE ROUTES =====

// GET /api/pipedrive/search - Search for Pipedrive deals
app.get('/api/pipedrive/search', async (req, res) => {
  try {
    const { query } = req.query;

    if (!query) {
      return res.status(400).json({ error: 'Search query required' });
    }

    const result = await PipedriveService.searchDeals(query);

    if (result.error) {
      return res.status(400).json({ error: result.error });
    }

    res.json(result);
  } catch (error) {
    console.error('GET /api/pipedrive/search error:', error);
    res.status(500).json({ error: 'Failed to search Pipedrive deals' });
  }
});

// PATCH /api/leases/:id/pipedrive - Link Pipedrive deal to lease
app.patch('/api/leases/:id/pipedrive', async (req, res) => {
  try {
    const { id } = req.params;
    const { pipedrive_deal_id } = req.body;

    if (!pipedrive_deal_id) {
      return res.status(400).json({ error: 'pipedrive_deal_id required' });
    }

    // Update lease with Pipedrive deal ID
    const result = await pool.query(
      'UPDATE leases SET pipedrive_deal_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [pipedrive_deal_id, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lease not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('PATCH /api/leases/:id/pipedrive error:', error);
    res.status(500).json({ error: 'Failed to link deal to lease' });
  }
});

// ===== NOTIFICATION ROUTES =====

// GET /api/leases/notifications - Get leases expiring within 7 days
app.get('/api/leases/notifications', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM leases
      WHERE is_active = true
      AND (expiration_date::date - CURRENT_DATE) BETWEEN 0 AND 7
      ORDER BY expiration_date ASC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('GET /api/leases/notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch expiring leases' });
  }
});

// POST /api/leases/send-notifications - Send email notifications for expiring leases
app.post('/api/leases/send-notifications', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM leases
      WHERE is_active = true
      AND (expiration_date::date - CURRENT_DATE) BETWEEN 0 AND 7
      ORDER BY expiration_date ASC
    `);
    const expiringSoon = result.rows;

    if (expiringSoon.length === 0) {
      return res.json({ sent: 0, message: 'No leases expiring within 7 days' });
    }

    const notifyResults = await NotificationService.sendBatchNotifications(expiringSoon);

    // Track sent notifications
    for (const notifyResult of notifyResults) {
      await pool.query(
        `INSERT INTO lease_notifications (id, lease_id, notification_type, status, sent_at, email_recipient)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          uuidv4(),
          notifyResult.lease_id,
          'expiration_alert',
          notifyResult.success ? 'sent' : 'failed',
          notifyResult.success ? new Date().toISOString() : null,
          process.env.NOTIFICATION_EMAIL || 'william@pringroup.com'
        ]
      );
    }

    res.json({
      sent: notifyResults.filter(r => r.success).length,
      failed: notifyResults.filter(r => !r.success).length,
      results: notifyResults,
    });
  } catch (error) {
    console.error('POST /api/leases/send-notifications error:', error);
    res.status(500).json({ error: 'Failed to send notifications' });
  }
});

// GET /api/leases/notifications/history - Get notification history
app.get('/api/leases/notifications/history', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT ln.*, l.tenant_name, l.address, l.expiration_date
      FROM lease_notifications ln
      LEFT JOIN leases l ON ln.lease_id = l.id
      ORDER BY ln.created_at DESC
      LIMIT 100
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('GET /api/leases/notifications/history error:', error);
    res.status(500).json({ error: 'Failed to fetch notification history' });
  }
});

// POST /api/leases/check-notifications - Check for leases needing notifications
app.post('/api/leases/check-notifications', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM leases
      WHERE is_active = true
      AND (expiration_date::date - CURRENT_DATE) BETWEEN 0 AND 7
      AND id NOT IN (
        SELECT lease_id FROM lease_notifications
        WHERE status = 'sent'
        AND notification_type = 'expiration_alert'
        AND sent_at >= NOW() - INTERVAL '24 hours'
      )
      ORDER BY expiration_date ASC
    `);
    const unnotified = result.rows;

    if (unnotified.length === 0) {
      return res.json({ count: 0, message: 'All expiring leases have been notified' });
    }

    const notifyResults = await NotificationService.sendBatchNotifications(unnotified);

    for (const notifyResult of notifyResults) {
      await pool.query(
        `INSERT INTO lease_notifications (id, lease_id, notification_type, status, sent_at, email_recipient)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          uuidv4(),
          notifyResult.lease_id,
          'expiration_alert',
          notifyResult.success ? 'sent' : 'failed',
          notifyResult.success ? new Date().toISOString() : null,
          process.env.NOTIFICATION_EMAIL || 'william@pringroup.com'
        ]
      );
    }

    res.json({
      count: notifyResults.length,
      sent: notifyResults.filter(r => r.success).length,
      failed: notifyResults.filter(r => !r.success).length,
    });
  } catch (error) {
    console.error('POST /api/leases/check-notifications error:', error);
    res.status(500).json({ error: 'Failed to check notifications' });
  }
});

// Serve static frontend build
const frontendPath = path.join(__dirname, 'frontend', 'build');
app.use(express.static(frontendPath));

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ===== SCHEDULED JOBS =====

// Daily notification check at 9 AM UTC
cron.schedule('0 9 * * *', async () => {
  console.log('⏰ Running daily notification check...');
  try {
    const result = await pool.query(`
      SELECT * FROM leases
      WHERE is_active = true
      AND (expiration_date::date - CURRENT_DATE) BETWEEN 0 AND 7
      AND id NOT IN (
        SELECT lease_id FROM lease_notifications
        WHERE status = 'sent'
        AND notification_type = 'expiration_alert'
        AND sent_at >= NOW() - INTERVAL '24 hours'
      )
      ORDER BY expiration_date ASC
    `);
    const unnotified = result.rows;

    if (unnotified.length > 0) {
      const notifyResults = await NotificationService.sendBatchNotifications(unnotified);
      for (const notifyResult of notifyResults) {
        await pool.query(
          `INSERT INTO lease_notifications (id, lease_id, notification_type, status, sent_at, email_recipient)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            uuidv4(),
            notifyResult.lease_id,
            'expiration_alert',
            notifyResult.success ? 'sent' : 'failed',
            notifyResult.success ? new Date().toISOString() : null,
            process.env.NOTIFICATION_EMAIL || 'william@pringroup.com'
          ]
        );
      }
      console.log(`📧 Daily notification check complete: ${notifyResults.filter(r => r.success).length} sent, ${notifyResults.filter(r => !r.success).length} failed`);
    } else {
      console.log('📧 Daily notification check: No new leases requiring notification');
    }
  } catch (error) {
    console.error('❌ Error in daily notification check:', error);
  }
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}`);
  console.log(`📧 Auto-notifications: Enabled (daily check at 9 AM UTC)`);
});
