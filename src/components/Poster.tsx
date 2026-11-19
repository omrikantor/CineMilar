import Image from "next/image";
import { FilmIcon } from "@/components/Icons";

/**
 * A movie/TV poster with a consistent frame and a graceful placeholder when
 * TMDB has no image. The caller sets the size (width/height or aspect ratio)
 * through `className`; the image fills the frame.
 */
export function Poster({
  url,
  alt,
  className = "",
  sizes = "120px",
  priority = false,
}: {
  url: string | null;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-lg bg-surface-2 ring-1 ring-border ${className}`}
    >
      {url ? (
        <Image
          src={url}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-muted">
          <FilmIcon className="h-1/3 w-1/3 opacity-60" />
        </div>
      )}
    </div>
  );
}
