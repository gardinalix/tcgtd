import { useState } from "react";
import { TacticalPageHeader, TacticalPageShell } from "../components/tactical/TacticalPageShell";

const SOCIAL_PROVIDERS = [
  ["discord", "Continue with Discord"],
  ["google", "Continue with Google"],
  ["facebook", "Continue with Facebook"],
];

export function RegisterPage({ onCreateAccount, onSocialLogin, onLogin, onPlatformLogin }) {
  const [form, setForm] = useState({ email: "", password: "", displayName: "", username: "" });
  const [status, setStatus] = useState("Create a pilot account to save and publish deck lists.");
  const [isLoading, setIsLoading] = useState(false);
  const isLocalAuth = ["localhost", "127.0.0.1"].includes(window.location.hostname);

  async function submit(event) {
    event.preventDefault();
    setIsLoading(true);
    setStatus("Creating pilot profile...");
    try {
      await onCreateAccount(form);
      setStatus("Account created. Pilot synchronized.");
    } catch (error) {
      setStatus(error.message || "Registration failed.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <TacticalPageShell className="auth-page register-terminal-page">
      <TacticalPageHeader
        eyebrow="ACCESS TERMINAL"
        title="Create account"
        subtitle={isLocalAuth
          ? "Register a local development profile."
          : "Hosted accounts use the platform identity provider; the application never receives your password."}
      />

      {!isLocalAuth ? (
        <div className="tactical-data-panel react-form-panel auth-terminal-card">
          <div className="panel-head">
            <h2>Secure platform account</h2>
            <p>Sign in with ChatGPT to create or reconnect your alpha pilot identity.</p>
          </div>
          <button type="button" onClick={onPlatformLogin}>Continue with ChatGPT</button>
          <button type="button" className="ghost-command" onClick={onLogin}>Return to access terminal</button>
        </div>
      ) : null}

      {isLocalAuth ? <form className="tactical-data-panel react-form-panel auth-terminal-card" onSubmit={submit}>
        <div className="panel-head"><h2>Email registration</h2><p>{status}</p></div>
        <label>
          <span>Display name</span>
          <input value={form.displayName} required onChange={(event) => setForm({ ...form, displayName: event.target.value })} />
        </label>
        <label>
          <span>Username</span>
          <input value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} />
        </label>
        <label>
          <span>E-mail</span>
          <input type="email" value={form.email} required onChange={(event) => setForm({ ...form, email: event.target.value })} />
        </label>
        <label>
          <span>Password</span>
          <input type="password" value={form.password} minLength={8} required onChange={(event) => setForm({ ...form, password: event.target.value })} />
        </label>
        <button type="submit" disabled={isLoading}>{isLoading ? "Processing..." : "Create account with e-mail"}</button>
        <button type="button" className="ghost-command" onClick={onLogin}>Already have an account</button>
      </form> : null}

      {isLocalAuth ? <div className="tactical-data-panel react-form-panel auth-terminal-card">
        <div className="panel-head"><h2>Social registration</h2><p>Social providers create or link the pilot automatically after OAuth callback.</p></div>
        <div className="auth-provider-grid">
          {SOCIAL_PROVIDERS.map(([provider, label]) => (
            <button key={provider} type="button" onClick={() => onSocialLogin(provider)}>
              {label}
            </button>
          ))}
        </div>
      </div> : null}
    </TacticalPageShell>
  );
}
