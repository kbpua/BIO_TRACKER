import { Link } from 'react-router-dom';
import { Eye, SquarePen, FilePenLine, Trash2 } from 'lucide-react';

const focus =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-mint-500/45 focus-visible:ring-offset-1';

function wrapClass(base, compact) {
  const wrap = compact ? 'h-7 w-7' : 'h-8 w-8';
  return `inline-flex ${wrap} shrink-0 items-center justify-center rounded-lg shadow-sm transition-colors ${focus} ${base}`;
}

function iconClass(compact) {
  return compact ? 'h-3.5 w-3.5' : 'h-[17px] w-[17px]';
}

/** View — neutral (tables, project/organism list) */
export function ViewIconLink({ to, label = 'View', compact, className = '', onClick }) {
  const ic = iconClass(compact);
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`${wrapClass(
        'border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 hover:text-gray-900',
        compact
      )} ${className}`}
      aria-label={label}
      title={label}
    >
      <Eye className={ic} strokeWidth={2} aria-hidden />
    </Link>
  );
}

/** Edit — primary solid */
export function EditIconLink({ to, state, label = 'Edit', compact, className = '', onClick }) {
  const ic = iconClass(compact);
  return (
    <Link
      to={to}
      state={state}
      onClick={onClick}
      className={`${wrapClass('border border-mint-700/90 bg-mint-800 bg-gradient-to-r from-[#0F766E] to-[#115E59] text-white hover:opacity-90 transition-opacity', compact)} ${className}`}
      aria-label={label}
      title={label}
    >
      <SquarePen className={ic} strokeWidth={2} aria-hidden />
    </Link>
  );
}

/** Co-researcher: request edit workflow */
export function RequestEditIconLink({ to, state, compact, className = '', onClick }) {
  const label = 'Request edit (requires approval)';
  const ic = iconClass(compact);
  return (
    <Link
      to={to}
      state={state}
      onClick={onClick}
      className={`${wrapClass(
        'border border-dashed border-mint-600 bg-mint-50 text-mint-800 hover:bg-mint-100',
        compact
      )} ${className}`}
      aria-label={label}
      title={label}
    >
      <FilePenLine className={ic} strokeWidth={2} aria-hidden />
    </Link>
  );
}

/** Edit that opens a modal (e.g. projects list) */
export function EditIconButton({ onClick, label = 'Edit', compact, className = '' }) {
  const ic = iconClass(compact);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${wrapClass('border border-mint-700/90 bg-mint-800 bg-gradient-to-r from-[#0F766E] to-[#115E59] text-white hover:opacity-90 transition-opacity', compact)} ${className}`}
      aria-label={label}
      title={label}
    >
      <SquarePen className={ic} strokeWidth={2} aria-hidden />
    </button>
  );
}

/** Delete — solid danger */
export function DeleteIconButton({ onClick, label = 'Delete', compact, className = '' }) {
  const ic = iconClass(compact);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${wrapClass('border border-red-600 bg-red-600 text-white hover:bg-red-700', compact)} ${className}`}
      aria-label={label}
      title={label}
    >
      <Trash2 className={ic} strokeWidth={2} aria-hidden />
    </button>
  );
}

/** Co-researcher: request delete workflow */
export function RequestDeleteIconButton({ onClick, compact, className = '' }) {
  const label = 'Request delete (requires approval)';
  const ic = iconClass(compact);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${wrapClass(
        'border border-dashed border-red-500 bg-red-50 text-red-800 hover:bg-red-100',
        compact
      )} ${className}`}
      aria-label={label}
      title={label}
    >
      <Trash2 className={ic} strokeWidth={2} aria-hidden />
    </button>
  );
}

/** Toggle / drill-in (e.g. user management row) */
export function ViewIconButton({ onClick, pressed, label = 'View details', compact, className = '' }) {
  const ic = iconClass(compact);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      className={`${wrapClass(
        'border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 hover:text-gray-900',
        compact
      )} ${pressed ? 'ring-2 ring-mint-400/60 border-mint-300' : ''} ${className}`}
    >
      <Eye className={ic} strokeWidth={2} aria-hidden />
    </button>
  );
}
