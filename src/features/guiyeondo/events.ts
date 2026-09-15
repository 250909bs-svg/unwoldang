export const GUIYEONDO_EVENT_NAMES = [
  'guiyeondo_tab_open',
  'guiyeondo_map_created',
  'guiyeondo_invite_clicked',
  'guiyeondo_share',
  'guiyeondo_invite_open',
  'guiyeondo_guest_start',
  'guiyeondo_guest_complete',
  'guiyeondo_reveal',
  'guiyeondo_node_open',
  'guiyeondo_detail_open',
  'guiyeondo_create_own',
  'guiyeondo_find_benefactor',
  'guiyeondo_find_partner',
  'guiyeondo_report_cta'
] as const;

export type GuiyeondoEventName = (typeof GUIYEONDO_EVENT_NAMES)[number];

export function trackGuiyeondoEvent(name: GuiyeondoEventName, detail: Record<string, string | number | boolean> = {}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('unwoldang:analytics', { detail: { name, ...detail } }));
  const dataLayer = (window as Window & { dataLayer?: unknown[] }).dataLayer;
  dataLayer?.push({ event: name, ...detail });
}
