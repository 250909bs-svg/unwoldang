import { getReunionPanelImage, type ReunionPanelKey } from './reunionPanelAssets';

/**
 * 웹툰 랜딩 패널 전용 <picture>.
 * ReunionPicture.tsx 와 마크업 규약은 같지만 에셋 소스가 다르다.
 * (ReunionPicture / assets.ts 는 계약 테스트가 키 목록을 고정하고 있어 건드리지 않는다.)
 */
type ReunionPanelPictureProps = {
  image: ReunionPanelKey;
  alt: string;
  className?: string;
  eager?: boolean;
};

export default function ReunionPanelPicture({
  image,
  alt,
  className,
  eager = false
}: ReunionPanelPictureProps) {
  const source = getReunionPanelImage(image);

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
