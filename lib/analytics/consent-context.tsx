"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  type AnalyticsConsent,
  readAnalyticsConsentFromStorage,
  writeAnalyticsConsentToStorage,
} from "@/lib/analytics/consent";

export type AnalyticsConsentState = "unknown" | AnalyticsConsent;

type AnalyticsConsentContextValue = {
  consent: AnalyticsConsentState;
  setConsent: (value: AnalyticsConsent) => void;
  analyticsAllowed: boolean;
};

const AnalyticsConsentContext = createContext<AnalyticsConsentContextValue>({
  consent: "unknown",
  setConsent: () => {},
  analyticsAllowed: false,
});

export function useAnalyticsConsent(): AnalyticsConsentContextValue {
  return useContext(AnalyticsConsentContext);
}

export function AnalyticsConsentProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [consent, setConsentState] = useState<AnalyticsConsentState>("unknown");

  useEffect(() => {
    setConsentState(readAnalyticsConsentFromStorage() ?? "unknown");
  }, []);

  const setConsent = useCallback((value: AnalyticsConsent) => {
    writeAnalyticsConsentToStorage(value);
    setConsentState(value);
  }, []);

  const value = useMemo(
    () => ({
      consent,
      setConsent,
      analyticsAllowed: consent === "granted",
    }),
    [consent, setConsent],
  );

  return (
    <AnalyticsConsentContext.Provider value={value}>
      {children}
    </AnalyticsConsentContext.Provider>
  );
}
