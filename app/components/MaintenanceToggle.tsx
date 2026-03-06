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
  const [backendDisabled, setBackendDisabled] = useState(false);
  const [paymentsDisabled, setPaymentsDisabled] = useState(false);
  const [apisDisabled, setApisDisabled] = useState(false);
  const [togglingFeature, setTogglingFeature] = useState<string | null>(null);

  // Load current status
  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      setLoading(true);
      const status = await getMaintenanceStatus();
      setEnabled(status.enabled);
      if (status.message) setMessage(status.message);
      setBackendDisabled(status.backendDisabled ?? false);
      setPaymentsDisabled(status.paymentsDisabled ?? false);
      setApisDisabled(status.apisDisabled ?? false);
    } catch (err) {
      console.error('Error loading maintenance status:', err);
      setError('Failed to load maintenance status');
    } finally {
      setLoading(false);
    }
  };

  const toggleFeature = async (feature: 'backendDisabled' | 'paymentsDisabled' | 'apisDisabled', current: boolean) => {
    setTogglingFeature(feature);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [feature]: !current }),
      });
      if (!res.ok) throw new Error('Failed to update');
      if (feature === 'backendDisabled') setBackendDisabled(!current);
      if (feature === 'paymentsDisabled') setPaymentsDisabled(!current);
      if (feature === 'apisDisabled') setApisDisabled(!current);
      const label = feature === 'backendDisabled' ? 'Backend' : feature === 'paymentsDisabled' ? 'Payments' : 'APIs';
      setSuccess(`${label} ${!current ? 'disabled' : 'enabled'} for all users`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setTogglingFeature(null);
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
      <div className="bg-bg-secondary rounded-lg shadow-lg p-6 border border-border-primary">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-bg-secondary rounded-lg shadow-lg p-6 border border-border-primary">
      <div className="flex items-center gap-3 mb-6">
        <div className={`p-2 rounded-lg ${enabled ? 'bg-orange-100 dark:bg-orange-500/15' : 'bg-green-100 dark:bg-green-500/15'}`}>
          <Settings className={`w-6 h-6 ${enabled ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'}`} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-text-primary">System Maintenance Mode</h2>
          <p className="text-sm text-text-secondary">
            Control site-wide maintenance mode for all users
          </p>
        </div>
      </div>

      {/* Status indicator */}
      <div className={`p-4 rounded-lg mb-6 ${enabled ? 'bg-orange-50 dark:bg-orange-500/10 border-2 border-orange-200 dark:border-orange-500/20' : 'bg-green-50 dark:bg-green-500/10 border-2 border-green-200 dark:border-green-500/20'}`}>
        <div className="flex items-center gap-3">
          {enabled ? (
            <>
              <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              <div>
                <p className="font-semibold text-orange-900 dark:text-orange-300">Maintenance Mode Active</p>
                <p className="text-sm text-orange-700 dark:text-orange-400/80">Users will see the maintenance page</p>
              </div>
            </>
          ) : (
            <>
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
              <div>
                <p className="font-semibold text-green-900 dark:text-green-300">System Online</p>
                <p className="text-sm text-green-700 dark:text-green-400/80">All users can access the site normally</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Error/Success messages */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg">
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 rounded-lg">
          <p className="text-sm text-green-700 dark:text-green-400">{success}</p>
        </div>
      )}

      {/* Maintenance message editor */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-text-secondary mb-2">
          Maintenance Message
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          className="w-full px-4 py-2 border border-border-primary rounded-lg bg-bg-tertiary text-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Enter the message users will see during maintenance..."
        />
        <button
          onClick={handleMessageUpdate}
          disabled={updating || !message.trim()}
          className="mt-2 px-4 py-2 bg-bg-tertiary text-text-primary rounded-lg hover:bg-border-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium border border-border-primary"
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
      <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/20 rounded-lg">
        <p className="text-xs text-yellow-800 dark:text-yellow-400/90">
          <strong>Note:</strong> Admins will always have access to the site, even when maintenance mode is enabled.
          Regular users will be redirected to the maintenance page.
        </p>
      </div>

      {/* System Feature Controls */}
      <div className="mt-6 pt-6 border-t border-border-primary">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 rounded-lg bg-violet-100 dark:bg-violet-500/15">
            <Settings className="w-4 h-4 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-primary">System Feature Controls</h3>
            <p className="text-xs text-text-muted">Disable features globally for all users</p>
          </div>
        </div>

        <div className="space-y-3">
          {([
            {
              key: 'backendDisabled' as const,
              label: 'Backend (Auth + Database)',
              description: 'Prevents any app from being generated with authentication or database features',
              value: backendDisabled,
              color: 'violet',
            },
            {
              key: 'paymentsDisabled' as const,
              label: 'Payments (Stripe)',
              description: 'Prevents any app from being generated with Stripe payment integration',
              value: paymentsDisabled,
              color: 'amber',
            },
            {
              key: 'apisDisabled' as const,
              label: 'Custom API Integrations',
              description: 'Prevents custom API configurations from being injected into generated apps',
              value: apisDisabled,
              color: 'blue',
            },
          ]).map((feat) => (
            <div
              key={feat.key}
              className={`flex items-start justify-between gap-4 p-4 rounded-xl border ${feat.value ? 'bg-red-50 dark:bg-red-500/5 border-red-200 dark:border-red-500/20' : 'bg-bg-tertiary border-border-primary'}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-sm font-medium ${feat.value ? 'text-red-700 dark:text-red-400' : 'text-text-primary'}`}>
                    {feat.label}
                  </span>
                  {feat.value && (
                    <span className="px-1.5 py-0.5 bg-red-500/10 border border-red-500/20 rounded-full text-[10px] font-semibold text-red-400 uppercase tracking-wide">
                      Disabled
                    </span>
                  )}
                </div>
                <p className="text-xs text-text-muted">{feat.description}</p>
              </div>
              <button
                disabled={togglingFeature === feat.key}
                onClick={() => toggleFeature(feat.key, feat.value)}
                className={`flex-shrink-0 px-3 py-1.5 text-xs font-semibold rounded-lg transition disabled:opacity-50 ${
                  feat.value
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    : 'bg-red-600 hover:bg-red-500 text-white'
                }`}
              >
                {togglingFeature === feat.key ? '...' : feat.value ? 'Enable' : 'Disable'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
