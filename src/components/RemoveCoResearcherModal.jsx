import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';

/**
 * Two-step style confirmation: user must type exactly `Remove [Full Name]` (case-sensitive).
 */
export default function RemoveCoResearcherModal({
  open,
  onClose,
  coResearcherName,
  projectName,
  onConfirm,
}) {
  const [value, setValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const requiredPhrase = `Remove ${coResearcherName ?? ''}`;
  const matches = value === requiredPhrase;
  const showMismatch = value.length > 0 && !matches;

  useEffect(() => {
    if (open) setValue('');
  }, [open, coResearcherName]);

  const handleConfirm = useCallback(async () => {
    if (!matches || submitting) return;
    setSubmitting(true);
    try {
      const result = await onConfirm();
      if (result?.ok) onClose();
    } finally {
      setSubmitting(false);
    }
  }, [matches, submitting, onConfirm, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto overscroll-y-contain bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="remove-co-researcher-title"
    >
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-5 shadow-xl dark:border-slate-600 dark:bg-[#1E293B]">
        <div className="flex gap-3">
          <AlertTriangle
            className="h-7 w-7 shrink-0 text-red-600 dark:text-[#F87171]"
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <h2
              id="remove-co-researcher-title"
              className="text-lg font-semibold text-[#DC2626] dark:text-[#F87171]"
            >
              Remove Co-Researcher
            </h2>
            <p className="mt-3 text-sm text-gray-700 dark:text-slate-200">
              Are you sure you want to remove{' '}
              <span className="font-semibold">{coResearcherName}</span> from{' '}
              <span className="font-semibold">{projectName}</span>? This action cannot be undone.{' '}
              <span className="font-semibold">{coResearcherName}</span> will lose access to this project
              and all associated permissions.
            </p>
          </div>
        </div>

        <div className="mt-5">
          <label htmlFor="remove-co-confirm-input" className="block text-sm font-medium text-gray-800 dark:text-slate-200">
            Type <span className="font-semibold">Remove {coResearcherName}</span> to confirm
          </label>
          <input
            id="remove-co-confirm-input"
            type="text"
            autoComplete="off"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={requiredPhrase}
            className={`mt-2 w-full rounded-lg border px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 ${
              matches
                ? 'border-green-600 focus:border-green-600 focus:ring-green-500/30 dark:border-green-500 dark:focus:ring-green-500/30'
                : showMismatch
                  ? 'border-red-600 focus:border-red-600 focus:ring-red-500/30 dark:border-red-500 dark:focus:ring-red-500/30'
                  : 'border-gray-300 focus:border-gray-400 focus:ring-gray-400/30 dark:border-slate-600 dark:focus:ring-slate-500/30'
            }`}
          />
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={!matches || submitting}
            className="rounded-lg bg-[#DC2626] px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-400 disabled:text-gray-200 disabled:opacity-70 dark:disabled:bg-slate-600 dark:disabled:text-slate-400"
          >
            {submitting ? 'Removing…' : 'Remove Co-Researcher'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
