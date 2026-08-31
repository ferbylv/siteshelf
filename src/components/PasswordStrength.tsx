import { scorePassword } from '../lib/password-strength';

export function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const { score, label, colorVar } = scorePassword(password);
  const width = score === 0 ? '20%' : `${score * 25}%`;
  return (
    <div className="pw-meter" aria-live="polite">
      <div className="pw-meter-track">
        <div
          className="pw-meter-fill"
          style={{ width, background: `var(${colorVar})` }}
        />
      </div>
      <span className="pw-meter-label" style={{ color: `var(${colorVar})` }}>
        {label}
      </span>
    </div>
  );
}
