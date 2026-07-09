import { Link } from "react-router-dom";
import { Disclaimer } from "./Disclaimer";

export function Footer() {
  return (
    <footer className="border-t border-neutral-200 px-4 py-8 dark:border-neutral-800">
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <Disclaimer />
        <div className="flex gap-4 text-xs text-neutral-500 dark:text-neutral-400">
          <Link to="/privacy" className="hover:underline">
            Privacy Policy
          </Link>
          <Link to="/terms" className="hover:underline">
            Terms of Service
          </Link>
          <span>&copy; {new Date().getFullYear()} FITTAYI</span>
        </div>
      </div>
    </footer>
  );
}
