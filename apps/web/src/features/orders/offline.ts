'use client';
// Offline state of the order screens (L6 `offline`: stale banner "Hors ligne — données du {date}", mutations disabled):
// the browser flag plus the network failures reported by the API client.
import { useEffect, useState } from 'react';
import { apiSession } from '@/lib/api';

export function useOffline(): boolean {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    const off = apiSession.on((e) => {
      if (e === 'offline') setOffline(true);
      if (e === 'online') setOffline(!navigator.onLine);
    });
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
      off();
    };
  }, []);
  return offline;
}
