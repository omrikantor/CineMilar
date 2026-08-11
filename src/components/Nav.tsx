import Link from "next/link";
import { logout } from "@/app/login/actions";

export function Nav() {
  return (
    <div className="flex items-center justify-between border-b pb-3">
      <div className="flex items-center gap-4">
        <Link href="/recommend" className="text-lg font-semibold">
          CineMilar
        </Link>
        <Link href="/history" className="text-sm underline">
          History
        </Link>
        <Link href="/saved" className="text-sm underline">
          Saved
        </Link>
      </div>
      <form action={logout}>
        <button type="submit" className="text-sm underline">
          Log out
        </button>
      </form>
    </div>
  );
}
