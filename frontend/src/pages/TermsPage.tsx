export function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
        Placeholder draft — needs legal review before launch. Not final.
      </div>
      <h1 className="text-2xl font-bold">Terms of Service</h1>
      <div className="mt-6 flex flex-col gap-4 text-sm text-neutral-600 dark:text-neutral-300">
        <p>
          FITTAYI provides deterministic, calorie- and macro-based meal plans built from a curated
          dish database. It is not a substitute for professional medical or dietetic advice.
        </p>
        <p>
          FITTAYI is not a clinical nutrition or eating-disorder treatment tool, and is not
          intended for use by anyone under 18 or with a diagnosed eating disorder.
        </p>
        <p>
          Calorie and macro targets are computed with hard safety floors and cannot be configured
          below them, regardless of the goal you select.
        </p>
        <p>By creating an account, you agree to use FITTAYI at your own discretion and to consult a qualified professional before making significant dietary changes.</p>
      </div>
    </div>
  );
}
