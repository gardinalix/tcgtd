import { useEffect } from "react";
import { TacticalPageHeader, TacticalPageShell } from "../components/tactical/TacticalPageShell";

export function AuthCallbackPage({ onRefreshSession, onDone }) {
  const params = new URLSearchParams(window.location.search);
  const status = params.get("status") || "processing";
  const provider = params.get("provider") || "provider";
  const message = params.get("message") || (status === "success" ? "Provider synchronized." : "Processing OAuth callback.");

  useEffect(() => {
    if (status === "success") {
      Promise.resolve(onRefreshSession()).finally(() => setTimeout(() => onDone(), 700));
    }
  }, [onDone, onRefreshSession, status]);

  return (
    <TacticalPageShell className="auth-callback-terminal-page">
      <TacticalPageHeader
        eyebrow="AUTH CALLBACK"
        title={`${provider.toUpperCase()} uplink`}
        subtitle={message}
        actions={status !== "success" ? <button type="button" onClick={onDone}>Return to login</button> : null}
      />
    </TacticalPageShell>
  );
}
