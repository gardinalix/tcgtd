import { useEffect, useState } from "react";
import { TacticalPageHeader, TacticalPageShell, TacticalLoadingState } from "../components/tactical/TacticalPageShell";

export function LogoutPage({ onLogout, onDone }) {
  const [message, setMessage] = useState("Terminating pilot session...");

  useEffect(() => {
    let isMounted = true;
    Promise.resolve(onLogout())
      .then(() => {
        if (isMounted) setMessage("Session closed. Returning to public cockpit.");
        setTimeout(() => onDone(), 650);
      })
      .catch((error) => {
        if (isMounted) setMessage(error.message || "Logout failed.");
      });
    return () => {
      isMounted = false;
    };
  }, [onDone, onLogout]);

  return (
    <TacticalPageShell className="logout-terminal-page">
      <TacticalPageHeader
        eyebrow="LOGOUT"
        title="Disconnecting"
        subtitle={message}
      />
      <TacticalLoadingState label="Closing session link..." />
    </TacticalPageShell>
  );
}
