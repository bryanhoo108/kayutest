import { useEffect, useRef, useState } from 'react';

/**
 * Subscribe to a Server-Sent Events stream. `handlers` maps event name → fn(data).
 * `onOpen` runs on every (re)connect so callers can refetch a fresh snapshot.
 * Returns the connection state: 'connecting' | 'live' | 'offline'.
 */
export function useLive(url, handlers, onOpen) {
  const [state, setState] = useState('connecting');
  const ref = useRef({ handlers, onOpen });
  ref.current = { handlers, onOpen };

  useEffect(() => {
    if (!url) return undefined;
    setState('connecting');
    let es;
    let retry;
    let closed = false;
    let first = true;

    const connect = () => {
      es = new EventSource(url);
      es.onopen = () => {
        setState('live');
        if (!first) ref.current.onOpen?.();
        first = false;
      };
      es.onerror = () => {
        setState('offline');
        // EventSource retries by itself unless the server closed it for good.
        if (es.readyState === EventSource.CLOSED && !closed) {
          retry = setTimeout(connect, 3000);
        }
      };
      for (const name of Object.keys(ref.current.handlers)) {
        es.addEventListener(name, (e) => {
          try { ref.current.handlers[name]?.(JSON.parse(e.data)); } catch { /* ignore malformed */ }
        });
      }
    };
    connect();
    const onVisible = () => {
      if (document.visibilityState === 'visible') ref.current.onOpen?.();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      closed = true;
      clearTimeout(retry);
      es?.close();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [url]);

  return state;
}

/** Re-render every `ms` (for running timers). */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}
