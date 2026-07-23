import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import * as store from "./gateways.js";

export interface GatewayContextValue {
  gateways: string[];
  current: string | undefined;
  setCurrent: (url: string | undefined) => void;
  add: (url: string) => void;
  remove: (url: string) => void;
}

const GatewayContext = createContext<GatewayContextValue | undefined>(undefined);

/**
 * The gateway allow-list + "which one is active" selection, shared across
 * every route (`Browse`/`Library`/`Watch`/`Listen`/`Settings`) the same
 * way `@evermesh/ui`'s `QueueProvider` shares one playback queue —
 * without this, adding a gateway in `Settings` wouldn't show up in
 * `Browse`'s selector until a full reload.
 */
export function GatewayProvider({ children }: { children: ReactNode }): JSX.Element {
  const [gateways, setGateways] = useState<string[]>(() => store.listGateways());
  const [current, setCurrentState] = useState<string | undefined>(() => store.getCurrentGateway() ?? store.listGateways()[0]);

  const setCurrent = useCallback((url: string | undefined) => {
    store.setCurrentGateway(url);
    setCurrentState(url);
  }, []);

  const add = useCallback(
    (url: string) => {
      const next = store.addGateway(url);
      setGateways(next);
      if (!current) setCurrent(next[next.length - 1]);
    },
    [current, setCurrent],
  );

  const remove = useCallback(
    (url: string) => {
      const next = store.removeGateway(url);
      setGateways(next);
      if (current === url) setCurrentState(store.getCurrentGateway());
    },
    [current],
  );

  const value = useMemo<GatewayContextValue>(
    () => ({ gateways, current, setCurrent, add, remove }),
    [gateways, current, setCurrent, add, remove],
  );

  return <GatewayContext.Provider value={value}>{children}</GatewayContext.Provider>;
}

export function useGateways(): GatewayContextValue {
  const ctx = useContext(GatewayContext);
  if (!ctx) throw new Error("useGateways must be used within a GatewayProvider");
  return ctx;
}
