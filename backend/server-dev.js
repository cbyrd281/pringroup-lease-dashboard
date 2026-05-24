import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';

const app = express();

// Mock in-memory database
let leases = [
  {
    id: '550e8400-e29b-41d4-a716-446655440001',
    tenant_name: 'Acme Corp',
    address: '123 Main St',
    city: 'San Francisco',
    state: 'CA',
    zip_code: '94105',
    expiration_date: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    broker: 'William',
    notes: 'Premium office space',
    is_active: true,
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440002',
    tenant_name: 'Tech Startup Inc',
    address: '456 Oak Ave',
    city: 'San Francisco',
    state: 'CA',
    zip_code: '94107',
    expiration_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    broker: 'Steven',
    notes: 'Flexible terms',
    is_active: true,
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440003',
    tenant_name: 'Global Services LLC',
    address: '789 Pine Rd',
    city: 'San Francisco',
    state: 'CA',
    zip_code: '94102',
    expiration_date: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    broker: 'Marc',
    notes: 'Industrial warehouse',
    is_active: true,
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440004',
    tenant_name: 'Enterprise Co',
    address: '321 Elm St',
    city: 'San Francisco',
    state: 'CA',
    zip_code: '94103',
    expiration_date: new Date(Date.now() + 400 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    broker: 'Andrew',
    notes: 'Long-term lease',
    is_active: true,
  },
];

// Helper to calculate days remaining
function calculateDaysRemaining(expirationDate) {
  const exp = new Date(expirationDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = exp - today;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// GET /api/leases - List all leases
app.get('/api/leases', (req, res) => {
  const { broker, view } = req.query;
  let filtered = leases.filter(l => l.is_active);

  if (broker && broker !== 'all') {
    filtered = filtered.filter(l => l.broker === broker);
  }

  const now = new Date();
  if (view === '4-month') {
    filtered = filtered.filter(l => new Date(l.expiration_date) <= new Date(now.getTime() + 4 * 30 * 24 * 60 * 60 * 1000));
  } else if (view === '6-month') {
    filtered = filtered.filter(l => new Date(l.expiration_date) <= new Date(now.getTime() + 6 * 30 * 24 * 60 * 60 * 1000));
  } else if (view === '12-month') {
    filtered = filtered.filter(l => new Date(l.expiration_date) <= new Date(now.getTime() + 12 * 30 * 24 * 60 * 60 * 1000));
  }

  filtered.sort((a, b) => new Date(a.expiration_date) - new Date(b.expiration_date));

  const withDays = filtered.map(l => ({
    ...l,
    daysRemaining: calculateDaysRemaining(l.expiration_date),
  }));

  res.json({ leases: withDays });
});

// POST /api/leases - Create new lease
app.post('/api/leases', (req, res) => {
  const { tenantName, address, city, state, zipCode, expirationDate, broker, notes } = req.body;

  if (!tenantName || !address || !expirationDate) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const newLease = {
    id: uuidv4(),
    tenant_name: tenantName,
    address,
    city,
    state,
    zip_code: zipCode,
    expiration_date: expirationDate,
    broker: broker || 'William',
    notes: notes || '',
    is_active: true,
  };

  leases.push(newLease);
  const withDays = { ...newLease, daysRemaining: calculateDaysRemaining(newLease.expiration_date) };
  res.status(201).json(withDays);
});

// PATCH /api/leases/:id - Update lease
app.patch('/api/leases/:id', (req, res) => {
  const { id } = req.params;
  const lease = leases.find(l => l.id === id);

  if (!lease) {
    return res.status(404).json({ error: 'Lease not found' });
  }

  Object.assign(lease, req.body);
  const withDays = { ...lease, daysRemaining: calculateDaysRemaining(lease.expiration_date) };
  res.json(withDays);
});

// DELETE /api/leases/:id - Delete lease
app.delete('/api/leases/:id', (req, res) => {
  const { id } = req.params;
  const index = leases.findIndex(l => l.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Lease not found' });
  }

  const deleted = leases.splice(index, 1)[0];
  res.json(deleted);
});

// GET /api/leases/export/csv - Export to CSV
app.get('/api/leases/export/csv', (req, res) => {
  const filtered = leases.filter(l => l.is_active);

  const headers = ['Tenant Name', 'Address', 'City', 'State', 'ZIP Code', 'Expiration Date', 'Broker', 'Notes', 'Days Remaining'];
  const rows = filtered.map(l => [
    l.tenant_name,
    l.address,
    l.city,
    l.state,
    l.zip_code,
    l.expiration_date,
    l.broker,
    l.notes,
    calculateDaysRemaining(l.expiration_date),
  ]);

  const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=leases.csv');
  res.send(csv);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Dev server running on http://localhost:${PORT}`);
});
