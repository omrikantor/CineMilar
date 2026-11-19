import type { ReactNode } from "react";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";

/** The frame shared by every signed-in page: sticky nav, content column, footer. */
export function PageShell({
  children,
  width = "default",
}: {
  children: ReactNode;
  width?: "narrow" | "default";
}) {
  return (
    <div className="flex flex-1 flex-col">
      <Nav />
      <main
        className={`mx-auto w-full flex-1 px-4 py-8 sm:px-6 sm:py-12 ${
          width === "narrow" ? "max-w-2xl" : "max-w-5xl"
        }`}
      >
        {children}
      </main>
      <Footer />
    </div>
  );
}

/** Page title block used at the top of list pages. */
export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {title}
        </h1>
        {description && <p className="mt-2 text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
