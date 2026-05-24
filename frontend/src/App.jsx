import React, { useState, useEffect } from 'react'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

function App() {
  const [leases, setLeases] = useState([])
  const [filteredLeases, setFilteredLeases] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [view, setView] = useState('all')
  const [selectedBroker, setSelectedBroker] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [newLease, setNewLease] = useState({
    tenantName: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    expirationDate: '',
    broker: 'William',
    notes: '',
  })

  // Fetch leases on component mount and when filters change
  useEffect(() => {
    fetchLeases()
  }, [view, selectedBroker])

  // Filter leases when view or broker changes
  useEffect(() => {
    applyFilters()
  }, [leases, view, selectedBroker])

  const fetchLeases = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (view !== 'all') params.append('view', view)
      if (selectedBroker !== 'all') params.append('broker', selectedBroker)

      const response = await axios.get(`${API_URL}/leases?${params}`)
      setLeases(response.data.leases || [])
    } catch (err) {
      console.error('Error fetching leases:', err)
      setError('Failed to load leases. Make sure the backend is running on port 5000.')
    } finally {
      setLoading(false)
    }
  }

  const applyFilters = () => {
    let filtered = leases

    if (selectedBroker !== 'all') {
      filtered = filtered.filter(lease => lease.broker === selectedBroker)
    }

    filtered.sort((a, b) => new Date(a.expiration_date) - new Date(b.expiration_date))
    setFilteredLeases(filtered)
  }

  const handleAddLease = async (e) => {
    e.preventDefault()
    try {
      await axios.post(`${API_URL}/leases`, newLease)
      setShowModal(false)
      setNewLease({
        tenantName: '',
        address: '',
        city: '',
        state: '',
        zipCode: '',
        expirationDate: '',
        broker: 'William',
        notes: '',
      })
      fetchLeases()
    } catch (err) {
      setError('Failed to add lease: ' + err.message)
    }
  }

  const handleDeleteLease = async (id) => {
    if (confirm('Are you sure you want to delete this lease?')) {
      try {
        await axios.delete(`${API_URL}/leases/${id}`)
        fetchLeases()
      } catch (err) {
        setError('Failed to delete lease: ' + err.message)
      }
    }
  }

  const handleExportCSV = async () => {
    try {
      const response = await axios.get(`${API_URL}/leases/export/csv`, {
        responseType: 'blob',
      })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', 'leases.csv')
      document.body.appendChild(link)
      link.click()
      link.parentNode.removeChild(link)
    } catch (err) {
      setError('Failed to export CSV: ' + err.message)
    }
  }

  const getUrgencyClass = (daysRemaining) => {
    if (daysRemaining <= 30) return 'urgency-urgent'
    if (daysRemaining <= 60) return 'urgency-soon'
    return 'urgency-ok'
  }

  const getUrgencyLabel = (daysRemaining) => {
    if (daysRemaining <= 30) return 'Urgent'
    if (daysRemaining <= 60) return 'Soon'
    return 'OK'
  }

  return (
    <div className="app">
      {/* Header */}
      <div className="header">
        <div className="header-left">
          <div className="logo-badge">PG</div>
          <h1>LEASE TRACKER</h1>
        </div>
        <div className="header-right">
          Log Out
        </div>
      </div>

      {/* Main Container */}
      <div className="container">
        {error && <div className="error-message">{error}</div>}

        {/* Filters */}
        <div className="filters">
          <select value={view} onChange={(e) => setView(e.target.value)}>
            <option value="all">All Leases</option>
            <option value="4-month">Next 4 Months</option>
            <option value="6-month">Next 6 Months</option>
            <option value="12-month">Next 12 Months</option>
          </select>

          <select value={selectedBroker} onChange={(e) => setSelectedBroker(e.target.value)}>
            <option value="all">All Brokers</option>
            <option value="William">William</option>
            <option value="Steven">Steven</option>
            <option value="Marc">Marc</option>
            <option value="Andrew">Andrew</option>
          </select>

          <button onClick={handleExportCSV}>📥 Export CSV</button>
          <button onClick={() => setShowModal(true)}>+ Add Lease</button>
        </div>

        {/* Tabs */}
        <div className="tabs">
          <button
            className={`tab ${view === 'all' ? 'active' : ''}`}
            onClick={() => setView('all')}
          >
            All
          </button>
          <button
            className={`tab ${view === '4-month' ? 'active' : ''}`}
            onClick={() => setView('4-month')}
          >
            4 Months
          </button>
          <button
            className={`tab ${view === '6-month' ? 'active' : ''}`}
            onClick={() => setView('6-month')}
          >
            6 Months
          </button>
          <button
            className={`tab ${view === '12-month' ? 'active' : ''}`}
            onClick={() => setView('12-month')}
          >
            12 Months
          </button>
        </div>

        {/* Leases Grid */}
        {loading ? (
          <div className="loading">Loading leases...</div>
        ) : filteredLeases.length === 0 ? (
          <div className="empty-state">No leases found. Add one to get started.</div>
        ) : (
          <div className="leases-grid">
            <div className="grid-header">
              <div>Tenant Name</div>
              <div>Address</div>
              <div>Days Left</div>
              <div>Broker</div>
              <div>Status</div>
            </div>
            {filteredLeases.map((lease) => (
              <div key={lease.id} className="grid-row">
                <div className="grid-cell">{lease.tenant_name}</div>
                <div className="grid-cell">
                  {lease.address}, {lease.city}, {lease.state} {lease.zip_code}
                </div>
                <div className="grid-cell">
                  <strong>{lease.daysRemaining || '?'}</strong>
                </div>
                <div className="grid-cell">{lease.broker}</div>
                <div className="grid-cell">
                  <span className={`urgency-badge ${getUrgencyClass(lease.daysRemaining)}`}>
                    {getUrgencyLabel(lease.daysRemaining)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      <div className={`modal ${showModal ? 'show' : ''}`}>
        <div className="modal-content">
          <div className="modal-header">Add New Lease</div>
          <form onSubmit={handleAddLease}>
            <div className="form-group">
              <label>Tenant Name</label>
              <input
                type="text"
                required
                value={newLease.tenantName}
                onChange={(e) => setNewLease({ ...newLease, tenantName: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Address</label>
              <input
                type="text"
                required
                value={newLease.address}
                onChange={(e) => setNewLease({ ...newLease, address: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>City</label>
              <input
                type="text"
                value={newLease.city}
                onChange={(e) => setNewLease({ ...newLease, city: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>State</label>
              <input
                type="text"
                value={newLease.state}
                onChange={(e) => setNewLease({ ...newLease, state: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>ZIP Code</label>
              <input
                type="text"
                value={newLease.zipCode}
                onChange={(e) => setNewLease({ ...newLease, zipCode: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Expiration Date</label>
              <input
                type="date"
                required
                value={newLease.expirationDate}
                onChange={(e) => setNewLease({ ...newLease, expirationDate: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Broker</label>
              <select
                value={newLease.broker}
                onChange={(e) => setNewLease({ ...newLease, broker: e.target.value })}
              >
                <option value="William">William</option>
                <option value="Steven">Steven</option>
                <option value="Marc">Marc</option>
                <option value="Andrew">Andrew</option>
              </select>
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea
                value={newLease.notes}
                onChange={(e) => setNewLease({ ...newLease, notes: e.target.value })}
              />
            </div>
            <div className="modal-actions">
              <button type="button" onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-save">
                Save Lease
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default App
