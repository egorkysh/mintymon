'use client';

import { PageHeader } from '@/components/layout/page-header';
import { DataTable } from '@/components/dashboard/data-table';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { useDeployments } from '@/hooks/useDeployments';
import { formatDistanceToNow } from 'date-fns';
import type { StatusLevel } from '@/components/dashboard/status-badge';

interface Deployment {
  uid: string;
  name: string;
  state: string;
  url: string;
  created: number;
  ready?: number;
  buildingAt?: number;
  commitSha?: string;
  commitMessage?: string;
  commitRef?: string;
  target?: string;
}

function stateToStatus(state: string): StatusLevel {
  switch (state) {
    case 'READY': return 'healthy';
    case 'ERROR': return 'critical';
    case 'BUILDING':
    case 'QUEUED':
    case 'INITIALIZING': return 'warning';
    default: return 'unknown';
  }
}

function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

const columns = [
  {
    key: 'status',
    header: 'Status',
    className: 'w-28',
    render: (d: Deployment) => (
      <StatusBadge status={stateToStatus(d.state)} label={d.state} />
    ),
  },
  {
    key: 'commit',
    header: 'Commit',
    render: (d: Deployment) => (
      <div>
        <p className="text-sm text-text-primary font-medium truncate max-w-xs">
          {d.commitMessage || 'No commit message'}
        </p>
        <p className="text-[11px] text-text-tertiary font-mono mt-0.5">
          {d.commitRef && <span className="text-accent">{d.commitRef}</span>}
          {d.commitSha && <span className="ml-2">{d.commitSha.slice(0, 7)}</span>}
        </p>
      </div>
    ),
  },
  {
    key: 'target',
    header: 'Target',
    className: 'w-24',
    render: (d: Deployment) => (
      <span className="text-xs font-mono text-text-secondary">
        {d.target ?? 'preview'}
      </span>
    ),
  },
  {
    key: 'duration',
    header: 'Build',
    className: 'w-20',
    render: (d: Deployment) => (
      <span className="text-xs font-mono text-text-secondary">
        {d.ready && d.buildingAt ? formatDuration(d.ready - d.buildingAt) : '-'}
      </span>
    ),
  },
  {
    key: 'created',
    header: 'When',
    className: 'w-32',
    render: (d: Deployment) => (
      <span className="text-xs text-text-tertiary">
        {formatDistanceToNow(new Date(d.created), { addSuffix: true })}
      </span>
    ),
  },
];

export default function DeploymentsPage() {
  const { data, isLoading } = useDeployments();
  const deployments: Deployment[] = data?.data?.deployments ?? [];

  return (
    <div>
      <PageHeader
        title="Deployments"
        description="Vercel deployment history for MintCV"
      />
      <DataTable
        columns={columns}
        data={deployments}
        isLoading={isLoading}
        emptyMessage="No deployments found"
      />
    </div>
  );
}
