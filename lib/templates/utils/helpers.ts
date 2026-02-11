// ── JSX / attribute escaping ─────────────────────────────────────

/** Escape text for safe inclusion inside JSX text nodes. */
export function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\{/g, "&#123;")
    .replace(/\}/g, "&#125;");
}

/** Escape text for safe inclusion inside a JSX string attribute (double-quoted). */
export function escAttr(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Escape text for safe inclusion inside a JS/TS template literal. */
export function escTpl(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\$/g, "\\$");
}

/** Escape text for safe inclusion inside a JS string literal (single-quoted). */
export function escStr(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\n/g, "\\n");
}

// ── Icon mapping ─────────────────────────────────────────────────
// Maps friendly icon names → lucide-react component names

const ICON_MAP: Record<string, string> = {
  // General
  star: "Star",
  heart: "Heart",
  check: "Check",
  "check-circle": "CheckCircle",
  x: "X",
  plus: "Plus",
  minus: "Minus",
  search: "Search",
  menu: "Menu",
  close: "X",
  arrow_right: "ArrowRight",
  "arrow-right": "ArrowRight",
  "arrow-left": "ArrowLeft",
  "chevron-down": "ChevronDown",
  "chevron-right": "ChevronRight",
  "chevron-up": "ChevronUp",
  external: "ExternalLink",

  // Communication
  phone: "Phone",
  email: "Mail",
  mail: "Mail",
  message: "MessageCircle",
  chat: "MessageCircle",
  send: "Send",

  // Location
  location: "MapPin",
  map: "MapPin",
  "map-pin": "MapPin",
  globe: "Globe",
  navigation: "Navigation",

  // Time
  clock: "Clock",
  calendar: "Calendar",
  timer: "Timer",

  // Business
  building: "Building",
  briefcase: "Briefcase",
  store: "Store",
  "shopping-cart": "ShoppingCart",
  cart: "ShoppingCart",
  "credit-card": "CreditCard",
  dollar: "DollarSign",
  receipt: "Receipt",
  package: "Package",
  truck: "Truck",

  // Tech
  code: "Code",
  terminal: "Terminal",
  database: "Database",
  cloud: "Cloud",
  server: "Server",
  cpu: "Cpu",
  shield: "Shield",
  lock: "Lock",
  key: "Key",
  wifi: "Wifi",
  zap: "Zap",
  lightning: "Zap",
  rocket: "Rocket",
  settings: "Settings",
  tool: "Wrench",

  // Content
  image: "Image",
  camera: "Camera",
  video: "Video",
  music: "Music",
  file: "FileText",
  book: "BookOpen",
  pen: "Pen",
  edit: "Edit",

  // People
  user: "User",
  users: "Users",
  "user-plus": "UserPlus",
  award: "Award",
  crown: "Crown",

  // Social
  share: "Share2",
  link: "Link",
  thumbs_up: "ThumbsUp",
  "thumbs-up": "ThumbsUp",

  // Food / Restaurant
  utensils: "UtensilsCrossed",
  "chef-hat": "ChefHat",
  coffee: "Coffee",
  wine: "Wine",
  leaf: "Leaf",
  flame: "Flame",

  // Fitness
  dumbbell: "Dumbbell",
  activity: "Activity",
  target: "Target",
  trophy: "Trophy",

  // Misc
  sparkles: "Sparkles",
  sun: "Sun",
  moon: "Moon",
  eye: "Eye",
  download: "Download",
  upload: "Upload",
  refresh: "RefreshCw",
  layers: "Layers",
  grid: "Grid",
  list: "List",
  bar_chart: "BarChart3",
  "bar-chart": "BarChart3",
  pie_chart: "PieChart",
  trending_up: "TrendingUp",
  "trending-up": "TrendingUp",
  layout: "Layout",
  monitor: "Monitor",
  smartphone: "Smartphone",
  headphones: "Headphones",
  gift: "Gift",
  percent: "Percent",
  tag: "Tag",
  filter: "Filter",
  home: "Home",
  info: "Info",
  "help-circle": "HelpCircle",
  alert: "AlertCircle",
  bell: "Bell",
  bookmark: "Bookmark",
  flag: "Flag",
  anchor: "Anchor",
  compass: "Compass",
};

/** Resolve a friendly icon name to a lucide-react component name. Falls back to "Star". */
export function resolveIcon(name: string): string {
  const lower = name.toLowerCase().trim();
  return ICON_MAP[lower] || name || "Star";
}

/** Collect all unique lucide icon names used in a list of icon references. */
export function collectIcons(iconNames: string[]): string[] {
  const set = new Set<string>();
  for (const n of iconNames) {
    set.add(resolveIcon(n));
  }
  return Array.from(set);
}

// ── Link helpers ─────────────────────────────────────────────────

/** Check if an href is internal (starts with / or #) vs external. */
export function isInternalHref(href: string): boolean {
  return href.startsWith("/") || href.startsWith("#");
}

// ── Component naming ─────────────────────────────────────────────

/** Convert a section type like "feature-grid" to a PascalCase component name like "FeatureGrid". */
export function sectionComponentName(type: string): string {
  return type
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
}

/** Get the component name for a section — uses componentName for custom sections, PascalCase type for others. */
export function getSectionComponentName(section: { type: string; componentName?: string }): string {
  if (section.type === "custom" && section.componentName) return section.componentName;
  return sectionComponentName(section.type);
}

// ── Image placeholder tracking ───────────────────────────────────

let _imgCounter = 0;

export function resetImageCounter(): void {
  _imgCounter = 0;
}

export function nextImagePlaceholder(): string {
  _imgCounter++;
  return `REPLICATE_IMG_${_imgCounter}`;
}

export function currentImageCount(): number {
  return _imgCounter;
}

/** Generate an <img> tag with a REPLICATE_IMG placeholder. Max 6 images total. */
export function imgTag(description: string, className: string): string {
  if (_imgCounter >= 6) {
    // Fallback: gradient SVG placeholder instead of exceeding max
    return `<div className="${className} bg-gradient-to-br from-gray-200 to-gray-300" aria-label="${escAttr(description)}" />`;
  }
  const key = nextImagePlaceholder();
  return `<img src="${key}" alt="${escAttr(description)}" className="${className}" />`;
}

// ── Social icon mapping ──────────────────────────────────────────

const SOCIAL_ICONS: Record<string, string> = {
  facebook: "Facebook",
  twitter: "Twitter",
  instagram: "Instagram",
  linkedin: "Linkedin",
  youtube: "Youtube",
  github: "Github",
  tiktok: "Music2",
  pinterest: "Pin",
};

export function resolveSocialIcon(platform: string): string {
  return SOCIAL_ICONS[platform.toLowerCase()] || "Globe";
}

export function collectSocialIcons(platforms: string[]): string[] {
  const set = new Set<string>();
  for (const p of platforms) {
    set.add(resolveSocialIcon(p));
  }
  return Array.from(set);
}
