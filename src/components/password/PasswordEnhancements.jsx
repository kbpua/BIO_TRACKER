import { CircleCheck, CircleX, Sparkles } from 'lucide-react';

export function getPasswordStrength(password) {
  let score = 0;
  if ((password || '').length >= 8) score += 1;
  if (/[A-Z]/.test(password || '')) score += 1;
  if (/[a-z]/.test(password || '')) score += 1;
  if (/[0-9]/.test(password || '')) score += 1;
  if (/[^A-Za-z0-9]/.test(password || '')) score += 1;
  if ((password || '').length >= 12) score += 1;

  if (score <= 2) return { label: 'Weak', color: 'bg-red-500', width: 'w-1/3' };
  if (score <= 4) return { label: 'Medium', color: 'bg-amber-400', width: 'w-2/3' };
  return { label: 'Strong', color: 'bg-mint-500', width: 'w-full' };
}

export function generateSecurePassword(length = 14) {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const numbers = '23456789';
  const symbols = '!@#$%^&*()-_=+[]{}?';
  const all = upper + lower + numbers + symbols;

  const pick = (set) => set[Math.floor(Math.random() * set.length)];
  const chars = [pick(upper), pick(lower), pick(numbers), pick(symbols)];
  while (chars.length < length) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

export function GeneratePasswordButton({ onGenerate, className = 'mt-2' }) {
  return (
    <button
      type="button"
      onClick={onGenerate}
      className={`${className} inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-mint-200 bg-mint-50 text-mint-700 hover:bg-mint-100`}
    >
      <Sparkles className="h-3.5 w-3.5" />
      Generate Secure Password
    </button>
  );
}

export function PasswordStrengthIndicator({ password, className = 'mt-2' }) {
  const strength = getPasswordStrength(password);

  return (
    <div className={className}>
      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full ${strength.color} ${strength.width} transition-all`} />
      </div>
      <p className="text-xs text-gray-600 mt-1">Strength: {strength.label}</p>
    </div>
  );
}

export function PasswordRequirementsHint({ className = 'mt-1' }) {
  return (
    <p className={`text-xs text-gray-500 ${className}`}>
      Minimum 8 characters, at least one uppercase letter, one number, and one special character.
    </p>
  );
}

export function PasswordMatchIndicator({ password, confirmPassword, className = 'mt-1' }) {
  if (!confirmPassword || confirmPassword.length === 0) return null;

  const matches = String(password || '') === String(confirmPassword || '');
  const textClass = matches ? 'text-mint-600' : 'text-red-600';
  const Icon = matches ? CircleCheck : CircleX;
  const label = matches ? 'Passwords match.' : 'Passwords do not match.';

  return (
    <p className={`text-xs ${textClass} ${className} inline-flex items-center gap-1`}>
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
    </p>
  );
}
