import type { ImgHTMLAttributes } from 'react';

const LOVE_READING_CARD_AVIF_SRCSET =
  '/home-love-reading-card-496.avif 496w, /home-love-reading-card.avif 992w';
const LOVE_READING_CARD_WEBP_SRCSET =
  '/home-love-reading-card-496.webp 496w, /home-love-reading-card.webp 992w';

type LoveReadingCardPictureProps = Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  'src' | 'srcSet' | 'sizes' | 'loading' | 'decoding' | 'width' | 'height'
> & {
  alt: string;
  sizes: string;
  pictureClassName?: string;
};

/**
 * Runtime-optimized artwork for the MZ love-reading product card.
 * The original PNG remains the universal fallback and social/OG source.
 */
export default function LoveReadingCardPicture({
  alt,
  sizes,
  pictureClassName,
  ...imageProps
}: LoveReadingCardPictureProps) {
  return (
    <picture className={pictureClassName} style={{ display: 'contents' }}>
      <source type="image/avif" srcSet={LOVE_READING_CARD_AVIF_SRCSET} sizes={sizes} />
      <source type="image/webp" srcSet={LOVE_READING_CARD_WEBP_SRCSET} sizes={sizes} />
      <img
        {...imageProps}
        src="/home-love-reading-card.png"
        alt={alt}
        width={992}
        height={1586}
        loading="lazy"
        decoding="async"
      />
    </picture>
  );
}
