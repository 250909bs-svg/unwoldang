import { getReunionImage, type ReunionImageKey } from './assets';

type ReunionPictureProps = {
  image: ReunionImageKey;
  alt: string;
  className?: string;
  eager?: boolean;
};

export default function ReunionPicture({
  image,
  alt,
  className,
  eager = false
}: ReunionPictureProps) {
  const source = getReunionImage(image);

  return (
    <picture className={className}>
      <source media="(max-width: 680px)" srcSet={source.srcSet.split(',')[0]} />
      <img
        src={source.src}
        srcSet={source.srcSet}
        sizes={source.sizes}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        fetchPriority={eager ? 'high' : 'auto'}
        decoding="async"
      />
    </picture>
  );
}
