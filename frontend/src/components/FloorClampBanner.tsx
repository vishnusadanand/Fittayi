export function FloorClampBanner({ clampReason }: { clampReason?: string }) {
  if (!clampReason) return null;

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
      <p className="font-semibold">Your target was adjusted for safety</p>
      <p className="mt-1">
        The calorie target your goal selection would have produced was below a safe minimum, so
        we've raised it. {clampReason}
      </p>
    </div>
  );
}
