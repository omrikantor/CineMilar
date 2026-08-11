import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="text-4xl font-semibold">CineMilar</h1>
      <p className="text-lg text-gray-600">
        Tell us a movie or TV series you loved — and why — and get real,
        explained recommendations for what to watch next.
      </p>
      <Link
        href="/login"
        className="rounded bg-black px-5 py-3 text-white"
      >
        Get started
      </Link>
    </main>
  );
}
