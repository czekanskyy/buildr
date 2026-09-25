import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Award,
  Box,
  Calendar,
  ChartColumn,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  Circle,
  CircleAlert,
  ClipboardList,
  Clock,
  Code,
  Columns2,
  Columns3,
  Copy,
  CreditCard,
  Database,
  Dot,
  Ellipsis,
  Eye,
  File,
  FileText,
  Folder,
  GalleryHorizontal,
  Globe,
  Grid3x3,
  Heading,
  Heart,
  Image,
  Images,
  Layers,
  LayoutGrid,
  LayoutTemplate,
  Link,
  List,
  ListChecks,
  ListOrdered,
  Lock,
  type LucideIcon,
  Mail,
  MapPin,
  Megaphone,
  Menu,
  MessageSquare,
  MonitorSmartphone,
  MousePointerClick,
  Music,
  Navigation,
  PanelBottom,
  PanelLeft,
  PanelRight,
  PanelTop,
  Phone,
  Pilcrow,
  Play,
  Quote,
  Radio,
  RectangleHorizontal,
  RectangleVertical,
  Redo2,
  Repeat,
  RotateCcw,
  Rows2,
  Rows3,
  Search,
  SeparatorHorizontal,
  ShoppingBag,
  ShoppingCart,
  SlidersHorizontal,
  Sparkles,
  Square,
  SquareCheck,
  SquareChevronDown,
  SquareDashed,
  SquarePen,
  Star,
  Table,
  Tag,
  TextAlignStart,
  TextCursorInput,
  ToggleLeft,
  Trash2,
  TriangleAlert,
  Type,
  Undo2,
  User,
  Users,
  Video,
  X,
} from 'lucide-react';

/*
 * The icon vocabulary of the editor. Both maps are static and curated on purpose: each icon is
 * imported by name so the bundler keeps only these (no `DynamicIcon`, no whole-set import).
 * Names are lucide's canonical kebab-case names; a unit test checks every one against lucide's
 * own export list. To support another icon, add it to a map (see docs/component-registry.md).
 */

/** The icons the editor's own chrome uses. */
const EDITOR_ICONS = {
  'arrow-down': ArrowDown,
  'arrow-left': ArrowLeft,
  'arrow-up': ArrowUp,
  box: Box,
  'chevron-down': ChevronDown,
  'chevron-right': ChevronRight,
  copy: Copy,
  'circle-alert': CircleAlert,
  ellipsis: Ellipsis,
  eye: Eye,
  link: Link,
  list: List,
  'list-ordered': ListOrdered,
  lock: Lock,
  'monitor-smartphone': MonitorSmartphone,
  'mouse-pointer-click': MousePointerClick,
  'panel-left': PanelLeft,
  'panel-right': PanelRight,
  'redo-2': Redo2,
  'rotate-ccw': RotateCcw,
  'trash-2': Trash2,
  'triangle-alert': TriangleAlert,
  'undo-2': Undo2,
  x: X,
} as const satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof EDITOR_ICONS;

/** Icons a component's `meta.icon` may name: the built-in catalogue plus a common vocabulary. */
const COMPONENT_ICONS: Readonly<Record<string, LucideIcon>> = {
  // built-in components
  file: File,
  'rectangle-horizontal': RectangleHorizontal,
  'square-dashed': SquareDashed,
  'rows-3': Rows3,
  'layout-grid': LayoutGrid,
  'panel-top': PanelTop,
  heading: Heading,
  type: Type,
  pilcrow: Pilcrow,
  link: Link,
  'mouse-pointer-click': MousePointerClick,
  image: Image,
  sparkles: Sparkles,
  tag: Tag,
  'separator-horizontal': SeparatorHorizontal,
  list: List,
  dot: Dot,
  'chevrons-up-down': ChevronsUpDown,
  'chevron-down': ChevronDown,
  repeat: Repeat,
  ellipsis: Ellipsis,
  'clipboard-list': ClipboardList,
  'text-cursor-input': TextCursorInput,
  'text-align-start': TextAlignStart,
  'square-check': SquareCheck,
  'square-chevron-down': SquareChevronDown,
  // layout
  box: Box,
  square: Square,
  'rectangle-vertical': RectangleVertical,
  'rows-2': Rows2,
  'columns-2': Columns2,
  'columns-3': Columns3,
  'layout-template': LayoutTemplate,
  'panel-left': PanelLeft,
  'panel-right': PanelRight,
  'panel-bottom': PanelBottom,
  layers: Layers,
  folder: Folder,
  menu: Menu,
  navigation: Navigation,
  // text
  'file-text': FileText,
  quote: Quote,
  'list-ordered': ListOrdered,
  'list-checks': ListChecks,
  'message-square': MessageSquare,
  megaphone: Megaphone,
  // media
  video: Video,
  play: Play,
  music: Music,
  images: Images,
  'gallery-horizontal': GalleryHorizontal,
  star: Star,
  heart: Heart,
  award: Award,
  // form
  'square-pen': SquarePen,
  circle: Circle,
  radio: Radio,
  'toggle-left': ToggleLeft,
  'sliders-horizontal': SlidersHorizontal,
  search: Search,
  mail: Mail,
  phone: Phone,
  // data
  table: Table,
  'grid-3x3': Grid3x3,
  'chart-column': ChartColumn,
  database: Database,
  code: Code,
  globe: Globe,
  'map-pin': MapPin,
  calendar: Calendar,
  clock: Clock,
  user: User,
  users: Users,
  'shopping-cart': ShoppingCart,
  'shopping-bag': ShoppingBag,
  'credit-card': CreditCard,
};

/** The names `ComponentIcon` resolves (everything else shows the neutral `box`). */
export const componentIconNames: readonly string[] = Object.keys(COMPONENT_ICONS);

const SIZES = { sm: 16, md: 20 } as const;
const STROKE = 1.5;

export interface IconProps {
  readonly name: IconName;
  /** 16px in dense rows (default), 20px in palette tiles. */
  readonly size?: keyof typeof SIZES;
  /** Makes the icon meaningful (`role="img"` with this name); without it the icon is decorative. */
  readonly label?: string | undefined;
  readonly className?: string;
}

function draw(
  Glyph: LucideIcon,
  name: string,
  size: keyof typeof SIZES,
  label: string | undefined,
  className: string | undefined,
  fallback: boolean,
) {
  return (
    <Glyph
      size={SIZES[size]}
      strokeWidth={STROKE}
      absoluteStrokeWidth
      className={className === undefined ? 'bd-icon' : `bd-icon ${className}`}
      data-icon={name}
      {...(fallback ? { 'data-fallback': 'true' } : {})}
      {...(label === undefined ? { 'aria-hidden': true } : { role: 'img', 'aria-label': label })}
    />
  );
}

/** One of the editor's own icons, drawn in `currentColor`. */
export function Icon({ name, size = 'sm', label, className }: IconProps) {
  return draw(EDITOR_ICONS[name], name, size, label, className, false);
}

export interface ComponentIconProps {
  /** A component's metadata (only `icon` is read). */
  readonly meta: { readonly icon?: string | undefined } | undefined;
  readonly size?: keyof typeof SIZES;
  readonly className?: string;
}

/** The icon of a component; a missing or unknown name gives a neutral box, never a letter. */
export function ComponentIcon({ meta, size = 'sm', className }: ComponentIconProps) {
  const name = meta?.icon;
  const glyph =
    name !== undefined && Object.hasOwn(COMPONENT_ICONS, name) ? COMPONENT_ICONS[name] : undefined;
  return draw(
    glyph ?? Box,
    glyph === undefined ? 'box' : (name as string),
    size,
    undefined,
    className,
    glyph === undefined,
  );
}
