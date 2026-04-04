import { useEffect, useRef, useState } from "react";

import type { CheckWebGpuSupportResult, MiningSession, MiningSessionState } from "saltshaker";

import { checkWebGpuSupport } from "saltshaker";

export function useMiningSession() {
  const [support, setSupport] = useState<CheckWebGpuSupportResult>({
    supported: false,
    message: "Checking WebGPU support...",
  });
  const [sessionState, setSessionState] = useState<MiningSessionState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sessionRef = useRef<MiningSession | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    void checkWebGpuSupport().then(setSupport);
    return () => {
      unsubscribeRef.current?.();
      sessionRef.current?.stop();
    };
  }, []);

  function subscribeToSession(session: MiningSession, onState?: (state: MiningSessionState) => void) {
    unsubscribeRef.current?.();
    unsubscribeRef.current = session.subscribe((nextState) => {
      setSessionState(nextState);
      if (nextState.error !== null) {
        setError(nextState.error);
      }
      onState?.(nextState);
    });
  }

  function setActiveSession(session: MiningSession | null) {
    sessionRef.current = session;
  }

  function stopSession(options?: { clearState?: boolean }) {
    sessionRef.current?.stop();
    if (options?.clearState === true) {
      setSessionState(null);
    }
  }

  function unsubscribeOnly() {
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
  }

  const active = sessionState?.status === "preparing" || sessionState?.status === "running";

  return {
    support,
    sessionState,
    setSessionState,
    error,
    setError,
    sessionRef,
    active,
    subscribeToSession,
    setActiveSession,
    stopSession,
    unsubscribeOnly,
  };
}
