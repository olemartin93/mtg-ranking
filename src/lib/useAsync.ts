import { useEffect, useState } from 'react';

export interface AsyncState<T> {
  data: T | undefined;
  error: string | undefined;
  loading: boolean;
}

/** Run an async loader whenever `deps` change; ignores stale results. */
export function useAsync<T>(load: () => Promise<T>, deps: readonly unknown[]): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ data: undefined, error: undefined, loading: true });
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: undefined }));
    load().then(
      (data) => { if (alive) setState({ data, error: undefined, loading: false }); },
      (e: unknown) => {
        if (!alive) return;
        const offline = typeof navigator !== 'undefined' && !navigator.onLine;
        const msg = offline ? "You're offline and this isn't cached yet." : e instanceof Error ? e.message : 'Something went wrong';
        setState({ data: undefined, error: msg, loading: false });
      },
    );
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}
