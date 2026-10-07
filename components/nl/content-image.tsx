"use client";

import Image from "next/image";
import type { CSSProperties, KeyboardEvent, MouseEvent } from "react";

type Props = {
  src: string;
  alt: string;
  className?: string;
  style?: CSSProperties;
  sizes?: string;
  priority?: boolean;
  /** Parent must be `position: relative` with defined size. */
  mode?: "fill" | "intrinsic";
  width?: number;
  height?: number;
  role?: React.AriaRole;
  tabIndex?: number;
  onClick?: (event: MouseEvent<HTMLImageElement>) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLImageElement>) => void;
};

function unoptimizedSrc(src: string): boolean {
  return src.startsWith("blob:") || src.startsWith("data:");
}

export function NlContentImage({
  src,
  alt,
  className,
  style,
  sizes = "100vw",
  priority,
  mode = "fill",
  width = 1200,
  height = 900,
  role,
  tabIndex,
  onClick,
  onKeyDown,
}: Props) {
  const unoptimized = unoptimizedSrc(src);

  if (mode === "intrinsic") {
    return (
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        className={className}
        style={style}
        sizes={sizes}
        unoptimized={unoptimized}
        priority={priority}
        role={role}
        tabIndex={tabIndex}
        onClick={onClick}
        onKeyDown={onKeyDown}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      className={className}
      style={{ objectFit: "cover", ...style }}
      sizes={sizes}
      unoptimized={unoptimized}
      priority={priority}
      role={role}
      tabIndex={tabIndex}
      onClick={onClick}
      onKeyDown={onKeyDown}
    />
  );
}
