import {
  IconHome,
  IconSearch,
  IconChat,
  IconBook,
  IconMemory,
  IconHash,
  IconSpaces,
  IconPlug,
  IconLayers,
  IconSettings,
} from './icons';

export interface NavItem {
  href: string;
  label: string;
  icon: typeof IconHome;
  exact?: boolean;
  /** Grouped so the rail reads as ask / hold / operate rather than a flat list. */
  group: 'retrieve' | 'library' | 'operate';
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Overview', icon: IconHome, exact: true, group: 'retrieve' },
  { href: '/search', label: 'Search', icon: IconSearch, group: 'retrieve' },
  { href: '/chat', label: 'Ask', icon: IconChat, group: 'retrieve' },
  { href: '/playbooks', label: 'Playbooks', icon: IconBook, group: 'retrieve' },
  { href: '/memories', label: 'Memories', icon: IconMemory, group: 'library' },
  { href: '/topics', label: 'Topics', icon: IconHash, group: 'library' },
  { href: '/spaces', label: 'Spaces', icon: IconSpaces, group: 'library' },
  { href: '/connections', label: 'Connections', icon: IconPlug, group: 'operate' },
  { href: '/analytics', label: 'Analytics', icon: IconLayers, group: 'operate' },
  { href: '/settings', label: 'Settings', icon: IconSettings, group: 'operate' },
];

export const NAV_GROUPS: { key: NavItem['group']; label: string }[] = [
  { key: 'retrieve', label: 'Recall' },
  { key: 'library', label: 'Library' },
  { key: 'operate', label: 'Operate' },
];
