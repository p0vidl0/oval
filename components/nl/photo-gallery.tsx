"use client";

export type GalleryImage = {
  src: string;
  alt: string;
};

type Props = {
  images: GalleryImage[];
  totalCount?: number;
  onOpenAt?: (index: number) => void;
  indexOffset?: number;
};

function openableProps(
  onOpenAt: ((index: number) => void) | undefined,
  index: number,
) {
  if (!onOpenAt) return {};
  return {
    role: "button" as const,
    tabIndex: 0,
    onClick: () => onOpenAt(index),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onOpenAt(index);
      }
    },
    style: { cursor: "pointer" } as const,
  };
}

export function NlPhotoGallery({
  images,
  totalCount,
  onOpenAt,
  indexOffset = 0,
}: Props) {
  const total = totalCount ?? images.length;
  if (images.length === 0) return null;
  if (images.length === 1) {
    return (
      <img
        className="nl-photo"
        src={images[0].src}
        alt={images[0].alt}
        {...openableProps(onOpenAt, indexOffset)}
      />
    );
  }
  if (images.length === 2) {
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 6,
          borderRadius: "var(--radius-lg)",
          overflow: "hidden",
        }}
      >
        {images.map((img, i) => (
          <img
            key={img.src}
            src={img.src}
            alt={img.alt}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            {...openableProps(onOpenAt, indexOffset + i)}
          />
        ))}
      </div>
    );
  }
  const shown = images.slice(0, 3);
  const extra = total - 3;
  return (
    <div className="nl-gallery">
      {shown.map((img, i) => (
        <div
          key={img.src}
          className={`nl-gallery__tile${i === 0 ? " nl-gallery__tile--main" : ""}`}
        >
          <img
            src={img.src}
            alt={img.alt}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
            {...openableProps(onOpenAt, indexOffset + i)}
          />
          {i === 2 && extra > 0 ? (
            <button
              type="button"
              className="nl-gallery__more"
              aria-label={`Ещё ${extra} фото`}
              onClick={() => onOpenAt?.(indexOffset + shown.length)}
            >
              +{extra}
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
