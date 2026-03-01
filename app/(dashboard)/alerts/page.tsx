'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable } from '@/components/dashboard/data-table';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { useAlertConfigs, useAlertHistory, useCreateAlert, useDeleteAlert, useUpdateAlert } from '@/hooks/useAlerts';
import { formatDistanceToNow } from 'date-fns';
import { Plus, Trash2, X } from 'lucide-react';

interface AlertConfigRow {
  id: string;
  name: string;
  metricKey: string;
  condition: string;
  threshold: number;
  consecutiveBreaches: number;
  cooldownSeconds: number;
  enabled: boolean;
  currentBreachCount: number;
  lastFiredAt: string | null;
}

interface AlertHistoryRow {
  id: string;
  alertConfigId: string;
  type: 'fired' | 'resolved';
  metricKey: string;
  metricValue: number;
  threshold: number;
  message: string;
  createdAt: string;
}

export default function AlertsPage() {
  const { data: configData, isLoading: configLoading } = useAlertConfigs();
  const { data: historyData, isLoading: historyLoading } = useAlertHistory(50);
  const createAlert = useCreateAlert();
  const deleteAlert = useDeleteAlert();
  const updateAlert = useUpdateAlert();
  const [showForm, setShowForm] = useState(false);

  const configs: AlertConfigRow[] = configData?.configs ?? [];
  const history: AlertHistoryRow[] = historyData?.history ?? [];

  const configColumns = [
    {
      key: 'enabled',
      header: '',
      className: 'w-12',
      render: (c: AlertConfigRow) => (
        <button
          onClick={() => updateAlert.mutate({ id: c.id, enabled: !c.enabled })}
          className={`h-4 w-8 rounded-full transition-colors ${c.enabled ? 'bg-healthy' : 'bg-surface-raised'}`}
        >
          <span className={`block h-3 w-3 rounded-full bg-white transition-transform ${c.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
        </button>
      ),
    },
    {
      key: 'name',
      header: 'Name',
      render: (c: AlertConfigRow) => (
        <span className="text-sm font-medium text-text-primary">{c.name}</span>
      ),
    },
    {
      key: 'rule',
      header: 'Rule',
      render: (c: AlertConfigRow) => (
        <span className="text-xs font-mono text-text-secondary">
          {c.metricKey} {c.condition} {c.threshold}
        </span>
      ),
    },
    {
      key: 'breaches',
      header: 'Breaches',
      className: 'w-20',
      render: (c: AlertConfigRow) => (
        <span className="text-xs font-mono text-text-secondary">
          {c.currentBreachCount}/{c.consecutiveBreaches}
        </span>
      ),
    },
    {
      key: 'lastFired',
      header: 'Last Fired',
      className: 'w-32',
      render: (c: AlertConfigRow) => (
        <span className="text-xs text-text-tertiary">
          {c.lastFiredAt ? formatDistanceToNow(new Date(c.lastFiredAt), { addSuffix: true }) : 'Never'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-12',
      render: (c: AlertConfigRow) => (
        <button
          onClick={() => deleteAlert.mutate(c.id)}
          className="p-1 text-text-tertiary hover:text-critical transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      ),
    },
  ];

  const historyColumns = [
    {
      key: 'type',
      header: 'Event',
      className: 'w-24',
      render: (h: AlertHistoryRow) => (
        <StatusBadge
          status={h.type === 'fired' ? 'critical' : 'healthy'}
          label={h.type === 'fired' ? 'Fired' : 'Resolved'}
        />
      ),
    },
    {
      key: 'metric',
      header: 'Metric',
      render: (h: AlertHistoryRow) => (
        <span className="text-xs font-mono text-text-secondary">{h.metricKey}</span>
      ),
    },
    {
      key: 'value',
      header: 'Value',
      className: 'w-20',
      render: (h: AlertHistoryRow) => (
        <span className="text-xs font-mono text-text-primary">{h.metricValue}</span>
      ),
    },
    {
      key: 'when',
      header: 'When',
      className: 'w-32',
      render: (h: AlertHistoryRow) => (
        <span className="text-xs text-text-tertiary">
          {formatDistanceToNow(new Date(h.createdAt), { addSuffix: true })}
        </span>
      ),
    },
  ];

  const handleCreateSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createAlert.mutate({
      name: formData.get('name') as string,
      metricKey: formData.get('metricKey') as string,
      condition: formData.get('condition') as string,
      threshold: Number(formData.get('threshold')),
      consecutiveBreaches: Number(formData.get('consecutiveBreaches') || 1),
      cooldownSeconds: Number(formData.get('cooldownSeconds') || 300),
    }, {
      onSuccess: () => setShowForm(false),
    });
  };

  return (
    <div>
      <PageHeader title="Alerts" description="Alert rules and event history">
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent text-bg text-xs font-semibold hover:bg-accent/90 transition-colors"
        >
          {showForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {showForm ? 'Cancel' : 'New Alert'}
        </button>
      </PageHeader>

      {showForm && (
        <form onSubmit={handleCreateSubmit} className="rounded-lg border border-border bg-surface p-5 mb-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <input name="name" placeholder="Alert name" required className="sm:col-span-2 px-3 py-2 rounded-md border border-border bg-bg text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/40" />
          <input name="metricKey" placeholder="Metric key" required className="sm:col-span-2 px-3 py-2 rounded-md border border-border bg-bg text-sm text-text-primary font-mono placeholder:text-text-tertiary focus:outline-none focus:border-accent/40" />
          <select name="condition" className="px-3 py-2 rounded-md border border-border bg-bg text-sm text-text-primary focus:outline-none focus:border-accent/40">
            <option value="gt">Greater than</option>
            <option value="lt">Less than</option>
            <option value="gte">Greater or equal</option>
            <option value="lte">Less or equal</option>
            <option value="eq">Equal to</option>
          </select>
          <input name="threshold" type="number" step="any" placeholder="Threshold" required className="px-3 py-2 rounded-md border border-border bg-bg text-sm text-text-primary font-mono placeholder:text-text-tertiary focus:outline-none focus:border-accent/40" />
          <input name="consecutiveBreaches" type="number" placeholder="Breaches (1)" defaultValue={1} className="px-3 py-2 rounded-md border border-border bg-bg text-sm text-text-primary font-mono placeholder:text-text-tertiary focus:outline-none focus:border-accent/40" />
          <div className="flex justify-end items-end">
            <button type="submit" className="px-4 py-2 rounded-md bg-accent text-bg text-xs font-semibold hover:bg-accent/90 transition-colors">
              Create
            </button>
          </div>
        </form>
      )}

      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-medium text-text-secondary mb-3">Alert Rules</h3>
          <DataTable
            columns={configColumns}
            data={configs}
            isLoading={configLoading}
            emptyMessage="No alerts configured"
          />
        </div>

        <div>
          <h3 className="text-sm font-medium text-text-secondary mb-3">Event History</h3>
          <DataTable
            columns={historyColumns}
            data={history}
            isLoading={historyLoading}
            emptyMessage="No alert events"
          />
        </div>
      </div>
    </div>
  );
}
