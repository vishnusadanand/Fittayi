export function Disclaimer({ className = "" }: { className?: string }) {
  return (
    <p className={`text-xs text-ink-muted ${className}`}>
      FITTAYI is not a substitute for professional medical or dietetic advice. Consult a doctor or
      registered dietitian before making significant changes to your diet.
    </p>
  );
}
