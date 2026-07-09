export function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <div className="mb-6 rounded-lg border border-terracotta bg-terracotta/10 px-4 py-3 text-sm text-ink">
        Placeholder draft — needs legal review before launch. Not final, and not a substitute for
        advice from a qualified lawyer familiar with India's DPDP Act.
      </div>
      <h1 className="text-2xl font-bold">Privacy Policy</h1>

      <div className="mt-8 flex flex-col gap-8 text-sm text-ink-muted">
        <section>
          <h2 className="font-display text-base font-semibold text-ink">What we collect</h2>
          <p className="mt-2">
            Your quiz answers (sex, age, height, weight, activity level, goal, dietary
            restrictions, allergens, cuisine preference), your account email, and the plan/history
            data generated from them (which dishes you've been served, what you've marked as
            eaten).
          </p>
        </section>

        <section>
          <h2 className="font-display text-base font-semibold text-ink">Why we collect it</h2>
          <p className="mt-2">
            Solely to compute and generate your personalized calorie/macro targets and meal plan,
            and to avoid repeating dishes you've recently eaten. Nothing here is used for
            advertising or sold to third parties.
          </p>
        </section>

        <section>
          <h2 className="font-display text-base font-semibold text-ink">How it's protected</h2>
          <p className="mt-2">
            This is health-adjacent data. It's stored in a Postgres database with row-level
            security enforced at the database layer, not just the application layer — your plan
            and history rows are only ever readable or writable by you, even if the application
            code has a bug. The calorie/macro engine that computes your targets runs
            server-side and is never exposed to client-side tampering.
          </p>
        </section>

        <section>
          <h2 className="font-display text-base font-semibold text-ink">Your rights (DPDP Act, India)</h2>
          <p className="mt-2">
            Under India's Digital Personal Data Protection Act, you have the right to access,
            correct, and request erasure of your personal data, and to withdraw consent at any
            time. Contact us to exercise these rights.
          </p>
        </section>

        <section>
          <h2 className="font-display text-base font-semibold text-ink">Retention &amp; deletion</h2>
          <p className="mt-2">
            We retain your data for as long as your account is active. Deleting your account
            deletes your profile, plan, and history data.
          </p>
        </section>

        <section>
          <h2 className="font-display text-base font-semibold text-ink">Not medical advice</h2>
          <p className="mt-2">
            FITTAYI is not a substitute for professional medical or dietetic advice, and none of
            the data we collect is reviewed by a clinician. See our Terms of Service for more.
          </p>
        </section>
      </div>
    </div>
  );
}
