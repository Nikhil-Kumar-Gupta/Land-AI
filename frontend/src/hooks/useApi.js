import { useCallback, useEffect, useState } from "react";

import { api } from "../api/client";

/** GET a backend resource with loading / error state. Pass null to skip. */
export function useApi(path) {
  const [state, setState] = useState({ data: null, loading: Boolean(path), error: "" });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!path) return undefined;
    let cancelled = false;
    setState(s => ({ ...s, loading: true, error: "" }));
    api(path)
      .then(data => !cancelled && setState({ data, loading: false, error: "" }))
      .catch(err => !cancelled && setState({ data: null, loading: false, error: err.message }));
    return () => {
      cancelled = true;
    };
  }, [path, nonce]);

  const reload = useCallback(() => setNonce(n => n + 1), []);
  return { ...state, reload };
}
