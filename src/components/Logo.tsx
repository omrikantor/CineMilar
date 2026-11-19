import Link from "next/link";

/** The brand mark: a gold tile with a play symbol, plus the wordmark. */
export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <span
      className={`bg-brand-gradient inline-flex items-center justify-center rounded-[10px] shadow-sm ring-1 ring-black/20 ${className}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" className="h-[52%] w-[52%]" fill="#1a1206">
        <path d="M8.5 5.6a1 1 0 0 1 1.5-.86l9 5.9a1 1 0 0 1 0 1.7l-9 5.9a1 1 0 0 1-1.5-.86V5.6Z" />
      </svg>
    </span>
  );
}

export function Logo({
  href = "/",
  className = "",
}: {
  href?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      aria-label="CineMilar"
      className={`inline-flex items-center gap-2.5 text-xl font-semibold tracking-tight ${className}`}
    >
      <LogoMark />
      <span className="font-display">
        Cine<span className="text-gradient">Milar</span>
      </span>
    </Link>
  );
}
