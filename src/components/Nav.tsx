import { logout } from "@/app/login/actions";
import { Logo } from "@/components/Logo";
import { NavLinks } from "@/components/NavLinks";

export function Nav() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex items-center gap-3 sm:gap-6">
          <Logo href="/recommend" className="[&>span:last-child]:max-sm:hidden" />
          <NavLinks />
        </div>
        <form action={logout}>
          <button type="submit" className="btn-ghost">
            Log out
          </button>
        </form>
      </div>
    </header>
  );
}
