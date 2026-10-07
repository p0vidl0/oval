"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { GalleryImage } from "@/components/nl/photo-gallery";
import { NlPhotoLightbox } from "@/components/nl/photo-lightbox";

type Ctx = {
  openAt: (index: number) => void;
};

const FeedCardPhotoContext = createContext<Ctx | null>(null);

export function FeedCardPhotoProvider({
  images,
  children,
}: {
  images: GalleryImage[];
  children: React.ReactNode;
}) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const openAt = useCallback((index: number) => {
    setLightboxIndex(index);
  }, []);
  const value = useMemo(() => ({ openAt }), [openAt]);

  return (
    <FeedCardPhotoContext.Provider value={value}>
      {children}
      <NlPhotoLightbox
        images={images}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onIndexChange={setLightboxIndex}
      />
    </FeedCardPhotoContext.Provider>
  );
}

export function useFeedCardPhotoOpen() {
  const ctx = useContext(FeedCardPhotoContext);
  return ctx?.openAt;
}
