export function FloorClampBanner({ clampReason }: { clampReason?: string }) {
  if (!clampReason) return null;

  return (
    <div
      role="alert"
      className="mt-4 flex gap-3 rounded-lg border-2 border-terracotta bg-terracotta/10 px-4 py-3 text-sm"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="mt-0.5 size-5 shrink-0 text-terracotta"
        aria-hidden="true"
      >
        <path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      </svg>
      <div>
        <p className="font-display font-semibold text-ink">Your target was adjusted for safety</p>
        <p className="mt-1 text-ink-muted">
          The calorie target your goal selection would have produced was below a safe minimum, so
          we've raised it. {clampReason}
        </p>
      </div>
    </div>
  );
}
