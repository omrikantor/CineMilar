import { PageShell } from "@/components/PageShell";

/** Placeholder shown by loading.tsx while a signed-in page streams in. */
export function PageSkeleton({
  variant,
}: {
  variant: "form" | "list" | "grid" | "cards";
}) {
  return (
    <PageShell width={variant === "grid" || variant === "cards" ? "default" : "narrow"}>
      <div role="status" aria-label="Loading" className="flex flex-col gap-3">
        <div className="skeleton h-4 w-24" />
        <div className="skeleton h-10 w-2/3 max-w-md" />
        <div className="skeleton mb-6 h-4 w-1/2 max-w-sm" />

        {variant === "form" && <div className="skeleton h-[420px] w-full rounded-2xl" />}

        {variant === "list" &&
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton h-[84px] w-full rounded-2xl" />
          ))}

        {variant === "grid" && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-3">
                <div className="skeleton aspect-[2/3] w-full rounded-lg" />
                <div className="skeleton h-4 w-3/4" />
              </div>
            ))}
          </div>
        )}

        {variant === "cards" && (
          <div className="grid gap-5 md:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton h-[200px] w-full rounded-2xl" />
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}
