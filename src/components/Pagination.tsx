import Link from "next/link";
import { ArrowLeftIcon, ArrowRightIcon } from "@/components/Icons";

export function Pagination({
  basePath,
  page,
  totalPages,
}: {
  basePath: string;
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;

  return (
    <nav
      aria-label="Pagination"
      className="mt-10 flex items-center justify-between gap-4 text-sm"
    >
      {page > 1 ? (
        <Link href={`${basePath}?page=${page - 1}`} className="btn-secondary">
          <ArrowLeftIcon /> Previous
        </Link>
      ) : (
        <span />
      )}
      <span className="text-muted">
        Page {page} of {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={`${basePath}?page=${page + 1}`} className="btn-secondary">
          Next <ArrowRightIcon />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
