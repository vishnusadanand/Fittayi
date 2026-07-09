export function Disclaimer({ className = "" }: { className?: string }) {
  return (
    <p className={`text-xs text-neutral-500 dark:text-neutral-400 ${className}`}>
      FITTAYI is not a substitute for professional medical or dietetic advice. Consult a doctor or
      registered dietitian before making significant changes to your diet.
    </p>
  );
}
