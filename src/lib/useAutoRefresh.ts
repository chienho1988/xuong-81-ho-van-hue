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

    console.log(`[AutoRefresh] Starting for table=${table} interval=${intervalMs}ms`);

    // Initial fetch
    callback().then(() => console.log(`[AutoRefresh] Initial fetch done for ${table}`));

    // Realtime subscription
    const channelName = `${table}-${Math.random().toString(36).slice(2, 8)}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event, schema: 'public', table }, (payload) => {
        console.log(`[AutoRefresh] 🔴 Realtime event on ${table}:`, payload.eventType, (payload.new as any)?.id || (payload.old as any)?.id);
        callback();
      })
      .subscribe((status) => {
        console.log(`[AutoRefresh] Realtime channel ${channelName} status:`, status);
      });

    // Poll interval (fallback)
    const interval = setInterval(() => {
      console.log(`[AutoRefresh] ⏱ Polling ${table}...`);
      callback();
    }, intervalMs);

    // visibilitychange
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        console.log(`[AutoRefresh] 👁 Tab visible → refetch ${table}`);
        callback();
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    // window focus
    const onFocus = () => {
      console.log(`[AutoRefresh] 🎯 Window focus → refetch ${table}`);
      callback();
    };
    window.addEventListener('focus', onFocus);

    return () => {
      console.log(`[AutoRefresh] Cleaning up for ${table}`);
      supabase.removeChannel(channel);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, table, event, intervalMs]);
}