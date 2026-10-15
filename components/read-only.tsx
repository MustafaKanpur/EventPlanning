"use client";

import { createContext, useContext } from "react";

/**
 * Whether the viewer is read-only, for client components deep inside an event page, so
 * the flag doesn't have to be threaded through every prop. Hiding controls is courtesy;
 * the server refuses read-only writes regardless (requireEventAccess).
 */
const ReadOnlyContext = createContext(false);

export function ReadOnlyProvider({ readOnly, children }: { readOnly: boolean; children: React.ReactNode }) {
  return <ReadOnlyContext.Provider value={readOnly}>{children}</ReadOnlyContext.Provider>;
}

export function useReadOnly() {
  return useContext(ReadOnlyContext);
}

/** Wraps an edit control so read-only viewers never see it. Usable from server components. */
export function EditOnly({ children }: { children: React.ReactNode }) {
  return useReadOnly() ? null : <>{children}</>;
}
