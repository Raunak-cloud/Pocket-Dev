'use client';

import { useState, useEffect } from 'react';
import { Settings, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { getMaintenanceStatus, setMaintenanceStatus } from '@/lib/maintenance';
import { useAuth } from '../contexts/AuthContext';

export default function MaintenanceToggle() {
  const { user } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState('System is currently under maintenance. Please check back soon.');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Load current status
  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      setLoading(true);
      const status = await getMaintenanceStatus();
      setEnabled(status.enabled);
      if (status.message) {
        setMessage(status.message);
      }
    } catch (err) {
      console.error('Error loading maintenance status:', err);
      setError('Failed to load maintenance status');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async () => {
    if (!user?.email) {
      setError('You must be logged in to change maintenance mode');
      return;
    }

    try {
      setUpdating(true);
      setError('');
      setSuccess('');

      const newState = !enabled;
      await setMaintenanceStatus(newState, user.email, message);
      setEnabled(newState);
      setSuccess(`Maintenance mode ${newState ? 'enabled' : 'disabled'} successfully`);

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      console.error('Error updating maintenance status:', err);
      setError(err.message || 'Failed to update maintenance mode');
    } finally {
      setUpdating(false);
    }
  };

  const handleMessageUpdate = async () => {
    if (!user?.email) {
      setError('You must be logged in to update the message');
      return;
    }

    if (!message.trim()) {
      setError('Message cannot be empty');
      return;
    }

    try {
      setUpdating(true);
      setError('');
      setSuccess('');

      await setMaintenanceStatus(enabled, user.email, message);
      setSuccess('Maintenance message updated successfully');

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      console.error('Error updating message:', err);
      setError(err.message || 'Failed to update message');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className={`p-2 rounded-lg ${enabled ? 'bg-orange-100' : 'bg-green-100'}`}>
          <Settings className={`w-6 h-6 ${enabled ? 'text-orange-600' : 'text-green-600'}`} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">System Maintenance Mode</h2>
          <p className="text-sm text-gray-600">
            Control site-wide maintenance mode for all users
          </p>
        </div>
      </div>

      {/* Status indicator */}
      <div className={`p-4 rounded-lg mb-6 ${enabled ? 'bg-orange-50 border-2 border-orange-200' : 'bg-green-50 border-2 border-green-200'}`}>
        <div className="flex items-center gap-3">
          {enabled ? (
            <>
              <AlertTriangle className="w-5 h-5 text-orange-600" />
              <div>
                <p className="font-semibold text-orange-900">Maintenance Mode Active</p>
                <p className="text-sm text-orange-700">Users will see the maintenance page</p>
              </div>
            </>
          ) : (
            <>
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div>
                <p className="font-semibold text-green-900">System Online</p>
                <p className="text-sm text-green-700">All users can access the site normally</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Error/Success messages */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-700">{success}</p>
        </div>
      )}

      {/* Maintenance message editor */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Maintenance Message
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Enter the message users will see during maintenance..."
        />
        <button
          onClick={handleMessageUpdate}
          disabled={updating || !message.trim()}
          className="mt-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
        >
          {updating ? 'Updating...' : 'Update Message'}
        </button>
      </div>

      {/* Toggle button */}
      <button
        onClick={handleToggle}
        disabled={updating}
        className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition-all duration-200 flex items-center justify-center gap-2 ${
          enabled
            ? 'bg-green-600 hover:bg-green-700'
            : 'bg-orange-600 hover:bg-orange-700'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {updating ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Updating...</span>
          </>
        ) : (
          <>
            {enabled ? (
              <>
                <CheckCircle className="w-5 h-5" />
                <span>Disable Maintenance Mode</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-5 h-5" />
                <span>Enable Maintenance Mode</span>
              </>
            )}
          </>
        )}
      </button>

      {/* Warning */}
      <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-xs text-yellow-800">
          <strong>Note:</strong> Admins will always have access to the site, even when maintenance mode is enabled.
          Regular users will be redirected to the maintenance page.
        </p>
      </div>
    </div>
  );
}
