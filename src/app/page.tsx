import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <span
        className="mb-6 rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase"
        style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}
      >
        Movies &amp; TV, grounded in real data
      </span>
      <h1 className="max-w-xl text-5xl font-bold tracking-tight text-balance">
        CineMilar
      </h1>
      <p className="mt-4 max-w-md text-lg leading-relaxed" style={{ color: "var(--muted)" }}>
        Tell us a movie or TV series you loved — and why — and get real,
        explained recommendations for what to watch next.
      </p>
      <Link href="/login" className="btn-primary mt-8 px-6 py-3 text-base">
        Get started
      </Link>
    </main>
  );
}
