import Link from "next/link";
import { logout } from "@/app/login/actions";

export function Nav() {
  return (
    <header
      className="flex items-center justify-between gap-6 border-b pb-4"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="flex items-center gap-5">
        <Link href="/recommend" className="text-lg font-bold tracking-tight">
          Cine<span style={{ color: "var(--accent)" }}>Milar</span>
        </Link>
        <nav className="flex items-center gap-4">
          <Link href="/history" className="btn-ghost">
            History
          </Link>
          <Link href="/saved" className="btn-ghost">
            Saved
          </Link>
        </nav>
      </div>
      <form action={logout}>
        <button type="submit" className="btn-ghost">
          Log out
        </button>
      </form>
    </header>
  );
}
