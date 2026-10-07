"use client";

import { createContext, useContext } from "react";

export type TelegramMiniAppContextValue = {
  isMiniApp: boolean;
  authPending: boolean;
  authError: string | null;
};

const defaultValue: TelegramMiniAppContextValue = {
  isMiniApp: false,
  authPending: false,
  authError: null,
};

export const TelegramMiniAppContext =
  createContext<TelegramMiniAppContextValue>(defaultValue);

export function useTelegramMiniApp(): TelegramMiniAppContextValue {
  return useContext(TelegramMiniAppContext);
}
