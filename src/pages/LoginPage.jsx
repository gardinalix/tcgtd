import { useState } from "react";
import { TacticalPageHeader, TacticalPageShell } from "../components/tactical/TacticalPageShell";

const SOCIAL_PROVIDERS = [
  ["discord", "Continue with Discord"],
  ["google", "Continue with Google"],
  ["facebook", "Continue with Facebook"],
];

export function LoginPage({ onLogin, onSocialLogin, onRegister, onPlatformLogin, message = "" }) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [status, setStatus] = useState(message);
  const [isLoading, setIsLoading] = useState(false);
  const isLocalAuth = ["localhost", "127.0.0.1"].includes(window.location.hostname);

  async function submit(event) {
    event.preventDefault();
    setIsLoading(true);
    setStatus("Synchronizing pilot credentials...");
    try {
      await onLogin(form);
      setStatus("Access granted. Pilot synchronized.");
    } catch (error) {
      setStatus(error.message || "Invalid credentials.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <TacticalPageShell className="auth-page login-terminal-page">
      <TacticalPageHeader
        eyebrow="ACCESS TERMINAL"
        title="Identify pilot"
        subtitle="Identify the pilot to synchronize private and published deck lists."
      />

      {!isLocalAuth ? (
        <div className="tactical-data-panel react-form-panel auth-terminal-card">
          <div className="panel-head">
            <h2>Secure platform access</h2>
            <p>{message || "Use the hosted identity provider to synchronize your private cockpit."}</p>
          </div>
          <button type="button" onClick={onPlatformLogin}>Enter the tactical system</button>
        </div>
      ) : null}

      {isLocalAuth ? <div className="tactical-data-panel react-form-panel auth-terminal-card">
        <div className="panel-head">
          <h2>Social uplink</h2>
          <p>Use an OAuth provider when the auth server and provider credentials are configured.</p>
        </div>
        <div className="auth-provider-grid">
          {SOCIAL_PROVIDERS.map(([provider, label]) => (
            <button key={provider} type="button" onClick={() => onSocialLogin(provider)}>
              {label}
            </button>
          ))}
        </div>
      </div> : null}

      {isLocalAuth ? <form className="tactical-data-panel react-form-panel auth-terminal-card" onSubmit={submit}>
        <div className="panel-head">
          <h2>Email access</h2>
          <p>{status || "Enter with e-mail and password."}</p>
        </div>
        <label>
          <span>E-mail</span>
          <input type="email" value={form.email} required onChange={(event) => setForm({ ...form, email: event.target.value })} />
        </label>
        <label>
          <span>Password</span>
          <input type="password" value={form.password} required onChange={(event) => setForm({ ...form, password: event.target.value })} />
        </label>
        <button type="submit" disabled={isLoading}>{isLoading ? "Processing..." : "Enter with e-mail"}</button>
        <button type="button" className="ghost-command" onClick={onRegister}>Create new account</button>
      </form> : null}
    </TacticalPageShell>
  );
}
