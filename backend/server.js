import express from 'express';
import cors from 'cors';
import pg from 'pg';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const app = express();
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/pringroup_leases',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// GET /api/leases - List all leases
app.get('/api/leases', async (req, res) => {
  try {
    const { broker, view } = req.query;
    let query = 'SELECT * FROM leases WHERE is_active = true';
    const params = [];

    if (broker) {
      query += ' AND broker = $' + (params.length + 1);
      params.push(broker);
    }

    // Apply time-bucket filters if needed
    if (view === '12-month') {
      query += ' AND expiration_date <= CURRENT_DATE + INTERVAL \'12 months\'';
    } else if (view === '6-month') {
      query += ' AND expiration_date <= CURRENT_DATE + INTERVAL \'6 months\'';
    } else if (view === '4-month') {
      query += ' AND expiration_date <= CURRENT_DATE + INTERVAL \'4 months\'';
    }

    query += ' ORDER BY expiration_date ASC';

    const result = await pool.query(query, params);

    // Calculate days remaining for each lease
    const leases = result.rows.map(lease => ({
      ...lease,
      daysRemaining: Math.ceil((new Date(lease.expiration_date) - new Date()) / (1000 * 60 * 60 * 24)),
      urgency: getUrgency(lease.expiration_date),
    }));

    res.json({ leases });
  } catch (error) {
    console.error('Error fetching leases:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/leases - Create new lease
app.post('/api/leases', async (req, res) => {
  try {
    const { tenantName, address, city, state, zipCode, expirationDate, broker, notes } = req.body;
    const id = uuidv4();

    const query = `
      INSERT INTO leases (id, tenant_name, address, city, state, zip_code, expiration_date, broker, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const result = await pool.query(query, [
      id, tenantName, address, city, state, zipCode, expirationDate, broker, notes,
    ]);

    res.json({ lease: result.rows[0], message: 'Lease created successfully' });
  } catch (error) {
    console.error('Error creating lease:', error);
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/leases/:id - Update lease
app.patch('/api/leases/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { tenantName, address, city, state, zipCode, expirationDate, broker, notes } = req.body;

    const query = `
      UPDATE leases
      SET tenant_name = $1, address = $2, city = $3, state = $4, zip_code = $5,
          expiration_date = $6, broker = $7, notes = $8, updated_at = CURRENT_TIMESTAMP
      WHERE id = $9
      RETURNING *
    `;

    const result = await pool.query(query, [
      tenantName, address, city, state, zipCode, expirationDate, broker, notes, id,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lease not found' });
    }

    res.json({ lease: result.rows[0], message: 'Lease updated successfully' });
  } catch (error) {
    console.error('Error updating lease:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/leases/:id - Soft delete lease
app.delete('/api/leases/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      UPDATE leases
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lease not found' });
    }

    res.json({ message: 'Lease deleted successfully' });
  } catch (error) {
    console.error('Error deleting lease:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/leases/export/csv - Export leases as CSV
app.get('/api/leases/export/csv', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM leases WHERE is_active = true ORDER BY expiration_date ASC');

    const csv = 'Tenant,Address,City,State,ZIP,Expiration Date,Broker,Days Remaining\n' +
      result.rows.map(lease => {
        const daysRemaining = Math.ceil((new Date(lease.expiration_date) - new Date()) / (1000 * 60 * 60 * 24));
        return `"${lease.tenant_name}","${lease.address}","${lease.city}","${lease.state}","${lease.zip_code}","${lease.expiration_date}","${lease.broker}",${daysRemaining}`;
      }).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="leases.csv"');
    res.send(csv);
  } catch (error) {
    console.error('Error exporting CSV:', error);
    res.status(500).json({ error: error.message });
  }
});

function getUrgency(expirationDate) {
  const daysRemaining = Math.ceil((new Date(expirationDate) - new Date()) / (1000 * 60 * 60 * 24));
  if (daysRemaining <= 30) return 'urgent';
  if (daysRemaining <= 60) return 'soon';
  return 'ok';
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Lease Dashboard API running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});

export default app;
