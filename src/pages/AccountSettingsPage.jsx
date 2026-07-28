import { useState } from "react";
import {
  TacticalDataPanel,
  TacticalPageHeader,
  TacticalPageShell,
} from "../components/tactical/TacticalPageShell";

export function AccountSettingsPage({ user, onUpdateProfile, onChangePassword, onRequestPasswordReset, onLogout }) {
  const [profile, setProfile] = useState({
    publicName: user?.publicName || "",
    displayName: user?.displayName || "",
    username: user?.username || "",
    avatarUrl: user?.avatarUrl || "",
  });
  const [password, setPassword] = useState({ currentPassword: "", newPassword: "" });
  const [status, setStatus] = useState("Account systems ready.");

  async function saveProfile(event) {
    event.preventDefault();
    try {
      await onUpdateProfile(user.id, profile);
      setStatus("Account profile updated.");
    } catch (error) {
      setStatus(error.message || "Could not update profile.");
    }
  }

  async function changePassword(event) {
    event.preventDefault();
    try {
      await onChangePassword(password);
      setPassword({ currentPassword: "", newPassword: "" });
      setStatus("Password changed.");
    } catch (error) {
      setStatus(error.message || "Could not change password.");
    }
  }

  async function requestReset() {
    try {
      await onRequestPasswordReset(user.email);
      setStatus("Password reset request registered. Configure e-mail delivery in production.");
    } catch (error) {
      setStatus(error.message || "Could not request password reset.");
    }
  }

  return (
    <TacticalPageShell className="auth-page account-terminal-page">
      <TacticalPageHeader
        eyebrow="Account settings"
        title={user.publicName || user.displayName}
        subtitle={status}
      />

      <form className="tactical-data-panel react-form-panel auth-terminal-card" onSubmit={saveProfile}>
        <div className="panel-head"><h2>Pilot identity</h2><p>Public account information.</p></div>
        <Field label="Public name" value={profile.publicName} onChange={(publicName) => setProfile({ ...profile, publicName })} />
        <Field label="Display name" value={profile.displayName} onChange={(displayName) => setProfile({ ...profile, displayName })} />
        <Field label="Username" value={profile.username} onChange={(username) => setProfile({ ...profile, username })} />
        <Field label="Avatar URL" value={profile.avatarUrl} onChange={(avatarUrl) => setProfile({ ...profile, avatarUrl })} />
        <button type="submit">Save account</button>
      </form>

      <form className="tactical-data-panel react-form-panel auth-terminal-card" onSubmit={changePassword}>
        <div className="panel-head"><h2>Password control</h2><p>Available for e-mail accounts.</p></div>
        <Field label="Current password" type="password" value={password.currentPassword} onChange={(currentPassword) => setPassword({ ...password, currentPassword })} />
        <Field label="New password" type="password" value={password.newPassword} onChange={(newPassword) => setPassword({ ...password, newPassword })} />
        <button type="submit">Change password</button>
        <button type="button" className="ghost-command" onClick={requestReset}>Request password reset</button>
      </form>

      <TacticalDataPanel title="Provider links" subtitle={`Primary provider: ${user.provider || "email"}. Additional linking can be enabled through OAuth settings.`} className="react-form-panel auth-terminal-card">
        <button type="button" className="ghost-command" onClick={onLogout}>Logout securely</button>
        <button type="button" className="danger-command" disabled>Request account deletion</button>
      </TacticalDataPanel>
    </TacticalPageShell>
  );
}

function Field({ label, type = "text", value, onChange }) {
  return (
    <label>
      <span>{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
