-- Lease Dashboard Database Schema (CYL-2699)
CREATE TABLE IF NOT EXISTS leases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_name VARCHAR(255) NOT NULL,
  address VARCHAR(255) NOT NULL,
  city VARCHAR(100),
  state VARCHAR(50),
  zip_code VARCHAR(10),
  expiration_date DATE NOT NULL,
  broker VARCHAR(50) NOT NULL CHECK (broker IN ('William', 'Steven', 'Marc', 'Andrew')),
  pdf_url VARCHAR(500),
  lease_terms TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  INDEX idx_expiration (expiration_date),
  INDEX idx_broker (broker)
);

-- Sample data for testing
INSERT INTO leases (tenant_name, address, city, state, zip_code, expiration_date, broker, notes) VALUES
('Metro Storage', '123 Oak St', 'Denver', 'CO', '80202', CURRENT_DATE + INTERVAL '18 days', 'William', 'Urgent renewal needed'),
('Capitol Medical', '456 Pine Ave', 'Denver', 'CO', '80203', CURRENT_DATE + INTERVAL '42 days', 'Steven', 'Standard renewal'),
('Union Logistics', '789 Elm Dr', 'Denver', 'CO', '80204', CURRENT_DATE + INTERVAL '156 days', 'Marc', 'Good standing'),
('Pinnacle Tech', '321 Main Blvd', 'Denver', 'CO', '80205', CURRENT_DATE + INTERVAL '203 days', 'Andrew', 'Good standing');
