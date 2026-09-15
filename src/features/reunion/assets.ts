export type ReunionImageKey = 'hero' | 'reflection' | 'contact' | 'reunion' | 'moveOn';

export type ReunionImageAsset = {
  src: string;
  srcSet: string;
  sizes: string;
};

const asset = (fileName: string): ReunionImageAsset => ({
  src: `/assets/reunion/${fileName}-960.webp`,
  srcSet: `/assets/reunion/${fileName}-640.webp 640w, /assets/reunion/${fileName}-960.webp 960w`,
  sizes: '(max-width: 680px) 100vw, 960px'
});

export const reunionImages: Readonly<Record<ReunionImageKey, ReunionImageAsset>> = Object.freeze({
  hero: asset('hero'),
  reflection: asset('reflection'),
  contact: asset('contact'),
  reunion: asset('reunion'),
  moveOn: asset('move-on')
});

export function getReunionImage(key: ReunionImageKey) {
  return reunionImages[key];
}
