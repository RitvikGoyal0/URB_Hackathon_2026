/** Product wordmark. Single place to rename. */
export const BRAND = "Rentezvous";
export const TAGLINE = "Good places. Better company.";

/**
 * Four roommates, one in each member colour, meeting under one roof.
 * Drawn for a dark tile; src/app/icon.svg is the same mark as the favicon.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        d="M4.4 10.9 12 4.7l7.6 6.2v7.7a1.5 1.5 0 0 1-1.5 1.5H5.9a1.5 1.5 0 0 1-1.5-1.5z"
        fill="none"
        stroke="#f5f6f2"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="11.85" r="1.7" fill="#2bb594" />
      <circle cx="14.75" cy="14.6" r="1.7" fill="#eaa63e" />
      <circle cx="12" cy="17.35" r="1.7" fill="#9a86ea" />
      <circle cx="9.25" cy="14.6" r="1.7" fill="#49aee6" />
    </svg>
  );
}
