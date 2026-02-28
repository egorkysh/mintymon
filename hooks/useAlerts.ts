'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPollingIntervals } from '@/lib/polling';

export function useAlertConfigs() {
  return useQuery({
    queryKey: ['alerts'],
    queryFn: async () => {
      const res = await fetch('/api/alerts');
      if (!res.ok) throw new Error('Failed to fetch alerts');
      return res.json();
    },
    refetchInterval: getPollingIntervals().alerts,
  });
}

export function useAlertHistory(limit = 100) {
  return useQuery({
    queryKey: ['alert-history', limit],
    queryFn: async () => {
      const res = await fetch(`/api/alerts/history?limit=${limit}`);
      if (!res.ok) throw new Error('Failed to fetch alert history');
      return res.json();
    },
    refetchInterval: getPollingIntervals().alerts,
  });
}

export function useCreateAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      metricKey: string;
      condition: string;
      threshold: number;
      consecutiveBreaches?: number;
      cooldownSeconds?: number;
      slackChannel?: string;
    }) => {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create alert');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });
}

export function useUpdateAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { id: string; [key: string]: unknown }) => {
      const res = await fetch('/api/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update alert');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });
}

export function useDeleteAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/alerts?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete alert');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });
}
