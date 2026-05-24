// frontend/src/pages/Dashboard.tsx - Lease Dashboard Component
import React, { useState, useEffect } from 'react';
import { Lease, View, Broker } from '../types';
import Header from '../components/Header';
import ViewTabs from '../components/ViewTabs';
import ToolBar from '../components/ToolBar';
import LeaseGrid from '../components/LeaseGrid';
import AddLeaseModal from '../components/AddLeaseModal';
import Footer from '../components/Footer';

type DashboardView = 'all' | '12month' | '6month' | '4month';
type SortBy = 'soonest' | 'latest' | 'broker';

const Dashboard: React.FC = () => {
  // State management
  const [leases, setLeases] = useState<Lease[]>([]);
  const [filteredLeases, setFilteredLeases] = useState<Lease[]>([]);
  const [currentView, setCurrentView] = useState<DashboardView>('all');
  const [selectedBroker, setSelectedBroker] = useState<Broker | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>('soonest');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch leases on mount
  useEffect(() => {
    fetchLeases();
  }, []);

  // Filter and sort leases when state changes
  useEffect(() => {
    filterAndSortLeases();
  }, [leases, currentView, selectedBroker, sortBy]);

  const fetchLeases = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/leases?limit=100`,
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (!response.ok) throw new Error('Failed to fetch leases');

      const data = await response.json();
      setLeases(data.leases);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortLeases = () => {
    let filtered = [...leases];

    // Apply view filter (time-bucket)
    if (currentView === '12month') {
      filtered = filtered.filter((lease) => getDaysRemaining(lease.expiration_date) <= 365);
    } else if (currentView === '6month') {
      filtered = filtered.filter((lease) => getDaysRemaining(lease.expiration_date) <= 180);
    } else if (currentView === '4month') {
      filtered = filtered.filter((lease) => getDaysRemaining(lease.expiration_date) <= 120);
    }

    // Apply broker filter
    if (selectedBroker) {
      filtered = filtered.filter((lease) => lease.broker === selectedBroker);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      const daysA = getDaysRemaining(a.expiration_date);
      const daysB = getDaysRemaining(b.expiration_date);

      if (sortBy === 'soonest') {
        return daysA - daysB;
      } else if (sortBy === 'latest') {
        return daysB - daysA;
      } else {
        return a.broker.localeCompare(b.broker) || daysA - daysB;
      }
    });

    setFilteredLeases(filtered);
  };

  const handleAddLease = async (newLease: Partial<Lease>) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/leases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newLease),
      });

      if (!response.ok) throw new Error('Failed to add lease');

      const data = await response.json();
      setLeases([...leases, data.lease]);
      setIsModalOpen(false);
    } catch (err) {
      console.error('Add lease error:', err);
      alert('Failed to add lease. Please try again.');
    }
  };

  const handleDeleteLease = async (leaseId: string) => {
    if (!window.confirm('Are you sure you want to delete this lease?')) return;

    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/leases/${leaseId}`,
        { method: 'DELETE' }
      );

      if (!response.ok) throw new Error('Failed to delete lease');

      setLeases(leases.filter((lease) => lease.id !== leaseId));
    } catch (err) {
      console.error('Delete error:', err);
      alert('Failed to delete lease.');
    }
  };

  const handleExportCSV = async () => {
    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/leases/export?view=${currentView}&broker=${selectedBroker || ''}`,
        { method: 'GET' }
      );

      if (!response.ok) throw new Error('Failed to export');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `leases-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
    } catch (err) {
      console.error('Export error:', err);
      alert('Failed to export CSV.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading leases...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header />

      <div className="flex-1 container mx-auto px-4 py-6">
        <h1 className="text-3xl font-bold text-navy-dark mb-6">
          📋 LEASE EXPIRATION TRACKER
        </h1>

        <ViewTabs
          currentView={currentView}
          leaseCount={filteredLeases.length}
          onViewChange={setCurrentView}
        />

        <ToolBar
          selectedBroker={selectedBroker}
          onBrokerChange={setSelectedBroker}
          onAddLease={() => setIsModalOpen(true)}
          onExport={handleExportCSV}
          sortBy={sortBy}
          onSortChange={setSortBy}
        />

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            <p>{error}</p>
            <button
              onClick={fetchLeases}
              className="mt-2 bg-red-500 hover:bg-red-700 text-white px-4 py-2 rounded"
            >
              Retry
            </button>
          </div>
        )}

        {filteredLeases.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-300 p-12 text-center">
            <p className="text-gray-600 mb-4">
              {leases.length === 0
                ? 'No leases yet. Click "Add Lease" to get started.'
                : 'No leases match your filters.'}
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded"
            >
              Add Lease
            </button>
          </div>
        ) : (
          <LeaseGrid
            leases={filteredLeases}
            onDelete={handleDeleteLease}
          />
        )}
      </div>

      <AddLeaseModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleAddLease}
      />

      <Footer />
    </div>
  );
};

// Utility function: Calculate days remaining
export const getDaysRemaining = (expirationDate: string): number => {
  const expDate = new Date(expirationDate);
  const today = new Date();
  const diffTime = expDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

// Utility function: Get urgency badge
export const getUrgencyBadge = (daysRemaining: number) => {
  if (daysRemaining <= 30) {
    return { label: 'URGENT', color: 'bg-red-600', textColor: 'text-white' };
  } else if (daysRemaining <= 60) {
    return { label: 'SOON', color: 'bg-yellow-500', textColor: 'text-white' };
  } else {
    return { label: 'OK', color: 'bg-green-500', textColor: 'text-white' };
  }
};

export default Dashboard;
