import { useCallback, useEffect, useRef, useState } from 'react';

// Tiny data-fetching hook used by every page:
//   const { data, loading, error, reload } = useAsync(() => api.listRequests());
// Returns a reload() that re-runs the same function (silent refresh).
export default function useAsync(fn, deps = []) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const [state, setState] = useState({ data: null, loading: true, error: null });

  const reload = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fnRef.current();
      setState({ data, loading: false, error: null });
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: err?.message || 'Something went wrong.' }));
    }
  }, []);

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { ...state, reload };
}
