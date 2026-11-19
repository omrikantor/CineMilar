import Link from "next/link";
import { Logo } from "@/components/Logo";
import { ArrowLeftIcon } from "@/components/Icons";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center">
      <Logo />
      <p className="text-gradient text-8xl font-bold tracking-tight">404</p>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          We couldn&apos;t find that page
        </h1>
        <p className="mt-2 max-w-sm text-muted">
          It may have moved, or you may not have access to it.
        </p>
      </div>
      <Link href="/" className="btn-secondary">
        <ArrowLeftIcon /> Back to home
      </Link>
    </main>
  );
}
