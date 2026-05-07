"use client";

import Image from "next/image";
import Link from "next/link";
import clsx from "clsx";

type BrandLogoProps = {
  href?: string;
  className?: string;
  imageClassName?: string;
  priority?: boolean;
};

export function BrandLogo({
  href = "/",
  className,
  imageClassName,
  priority = false,
}: BrandLogoProps) {
  return (
    <Link
      href={href}
      className={clsx(
        "inline-flex items-center rounded-2xl border border-emerald-100 bg-white/80 px-3 py-2 shadow-[0_10px_24px_rgba(21,128,61,0.08)] backdrop-blur transition hover:border-emerald-200 hover:bg-white",
        className,
      )}
      aria-label="VIVO union"
    >
      <Image
        src="/brand/vivo-union-logo.jpeg"
        alt="VIVO union"
        width={1919}
        height={533}
        priority={priority}
        className={clsx("h-10 w-auto object-contain sm:h-11", imageClassName)}
      />
    </Link>
  );
}
