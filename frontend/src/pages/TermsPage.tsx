export function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
        Placeholder draft — needs legal review before launch. Not final, and not a substitute for
        advice from a qualified lawyer.
      </div>
      <h1 className="text-2xl font-bold">Terms of Service</h1>

      <div className="mt-8 flex flex-col gap-8 text-sm text-neutral-600 dark:text-neutral-300">
        <section>
          <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">What FITTAYI is</h2>
          <p className="mt-2">
            FITTAYI provides deterministic, calorie- and macro-based meal plans built from a
            curated Indian dish database. Calorie and macro targets are computed with hard safety
            floors that cannot be configured below, regardless of the goal you select — if your
            selected goal would produce a target below that floor, we clamp to the floor and tell
            you why, rather than silently applying it.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">What FITTAYI is not</h2>
          <p className="mt-2">
            FITTAYI is not a substitute for professional medical or dietetic advice. It is not a
            clinical nutrition or eating-disorder treatment tool, is not a medical device, and
            makes no diagnostic claims. It is not intended for use by anyone under 18 or with a
            diagnosed eating disorder — our quiz screens for both and will not generate a plan if
            either applies.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">Your responsibility</h2>
          <p className="mt-2">
            By creating an account, you agree to use FITTAYI at your own discretion and to consult
            a qualified professional (a doctor or registered dietitian) before making significant
            changes to your diet, especially if you have any pre-existing health condition.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">Accounts</h2>
          <p className="mt-2">
            You're responsible for keeping your account credentials secure. You may delete your
            account at any time, which deletes your associated profile, plan, and history data.
          </p>
        </section>
      </div>
    </div>
  );
}
