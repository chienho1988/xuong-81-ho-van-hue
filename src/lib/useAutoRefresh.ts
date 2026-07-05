/**
 * Hook auto-refresh dùng chung cho tất cả page
 * Gồm:
 * - Realtime subscription theo table
 * - Poll mỗi 2s (fallback)
 * - visibilitychange (quay lại tab)
 * - window focus
 * - Debug logging
 */
import { useEffect } from 'react';
import { supabase } from './supabaseClient';

type UseAutoRefreshOptions = {
  callback: () => Promise<void>;
  table: string;
  event?: '*' | 'INSERT' | 'UPDATE' | 'DELETE';
  intervalMs?: number;
  enabled?: boolean;
};

export function useAutoRefresh({
  callback,
  table,
  event = '*',
  intervalMs = 2000,
  enabled = true,
}: UseAutoRefreshOptions) {
  useEffect(() => {
    if (!enabled) return;

    // Initial fetch
    callback();

    // Realtime subscription
    const channelName = `${table}-${Math.random().toString(36).slice(2, 8)}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event, schema: 'public', table }, () => {
        callback();
      })
      .subscribe();

    // Poll interval (fallback)
    const interval = setInterval(() => {
      callback();
    }, intervalMs);

    // visibilitychange
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        callback();
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    // window focus
    const onFocus = () => {
      callback();
    };
    window.addEventListener('focus', onFocus);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, table, event, intervalMs]);
}