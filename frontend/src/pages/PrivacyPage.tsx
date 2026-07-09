export function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
        Placeholder draft — needs legal review before launch. Not final.
      </div>
      <h1 className="text-2xl font-bold">Privacy Policy</h1>
      <div className="mt-6 flex flex-col gap-4 text-sm text-neutral-600 dark:text-neutral-300">
        <p>
          FITTAYI collects the information you provide in the quiz (sex, age, height, weight,
          activity level, goal, dietary restrictions, allergens) and your account email, in order
          to generate and store your personalized meal plan.
        </p>
        <p>
          This is health-adjacent data. It is stored in a Postgres database with row-level
          security, so only you can read or write your own plan and history data. We do not sell
          or share this data with third parties.
        </p>
        <p>
          Under India's Digital Personal Data Protection Act (DPDP), you have the right to access,
          correct, and request deletion of your personal data. Contact us to exercise these rights.
        </p>
        <p>We retain your data for as long as your account is active. You may delete your account at any time.</p>
      </div>
    </div>
  );
}
