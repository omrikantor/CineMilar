import { Logo } from "@/components/Logo";

export function Footer({ className = "" }: { className?: string }) {
  return (
    <footer className={`border-t border-border ${className}`}>
      <div className="mx-auto flex w-full max-w-5xl flex-col items-start justify-between gap-4 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:px-6">
        <Logo className="text-base!" />
        <p className="max-w-md text-xs leading-relaxed sm:text-right">
          Movie and TV data from{" "}
          <a
            href="https://www.themoviedb.org"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium underline-offset-2 hover:text-foreground hover:underline"
          >
            TMDB
          </a>
          . This product uses the TMDB API but is not endorsed or certified by
          TMDB. Explanations are AI-generated.
        </p>
      </div>
    </footer>
  );
}
