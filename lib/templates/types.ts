// ── WebsiteConfig: the contract between AI and templates ─────────

export interface WebsiteConfig {
  version: 1;
  templateId: TemplateId;
  business: BusinessInfo;
  theme: ThemeConfig;
  nav: NavConfig;
  hero: HeroConfig;
  sections: ConfigSection[];
  footer: FooterConfig;
  pages: PageConfig[];
}

export type TemplateId =
  | "restaurant"
  | "ecommerce"
  | "saas"
  | "portfolio"
  | "blog"
  | "fitness";

// ── Business ─────────────────────────────────────────────────────

export interface BusinessInfo {
  name: string;
  tagline: string;
  description: string;
  phone?: string;
  email?: string;
  address?: string;
  hours?: string;
  logoUrl?: string;
}

// ── Theme ────────────────────────────────────────────────────────

export type TailwindColor =
  | "slate" | "gray" | "zinc" | "neutral" | "stone"
  | "red" | "orange" | "amber" | "yellow" | "lime"
  | "green" | "emerald" | "teal" | "cyan" | "sky"
  | "blue" | "indigo" | "violet" | "purple" | "fuchsia"
  | "pink" | "rose";

export type FontStyle = "modern" | "serif" | "playful" | "minimal";

export interface ThemeConfig {
  primary: TailwindColor;
  secondary: TailwindColor;
  accent: TailwindColor;
  background: "light" | "dark";
  fontStyle: FontStyle;
}

// ── Nav ──────────────────────────────────────────────────────────

export interface NavItem {
  label: string;
  href: string;
}

export interface NavConfig {
  items: NavItem[];
  ctaButton?: { label: string; href: string };
}

// ── Hero ─────────────────────────────────────────────────────────

export type HeroVariant = "centered" | "split-left" | "split-right" | "fullscreen" | "minimal" | "gradient-animated" | "video-bg";

export interface HeroConfig {
  variant: HeroVariant;
  headline: string;
  subheadline: string;
  ctaText: string;
  ctaHref: string;
  secondaryCta?: { text: string; href: string };
  imageDescription: string;
}

// ── Sections ─────────────────────────────────────────────────────

export type SectionType =
  | "feature-grid"
  | "menu"
  | "product-grid"
  | "testimonials"
  | "pricing"
  | "gallery"
  | "stats"
  | "cta-banner"
  | "team"
  | "blog-preview"
  | "contact"
  | "faq"
  | "about"
  | "logo-cloud"
  | "newsletter"
  | "process"
  | "custom";

export interface FeatureItem {
  icon: string;
  title: string;
  description: string;
}

export interface MenuItem {
  name: string;
  description: string;
  price: string;
  imageDescription?: string;
}

export interface MenuCategory {
  name: string;
  items: MenuItem[];
}

export interface ProductItem {
  name: string;
  price: string;
  originalPrice?: string;
  badge?: string;
  description: string;
  imageDescription: string;
}

export interface TestimonialItem {
  name: string;
  role: string;
  quote: string;
  rating?: number;
}

export interface PricingTier {
  name: string;
  price: string;
  period?: string;
  description: string;
  features: string[];
  highlighted?: boolean;
  ctaText: string;
}

export interface GalleryItem {
  imageDescription: string;
  caption?: string;
}

export interface StatItem {
  value: string;
  label: string;
}

export interface TeamMember {
  name: string;
  role: string;
  bio?: string;
  imageDescription: string;
}

export interface BlogPost {
  title: string;
  excerpt: string;
  date: string;
  author: string;
  imageDescription: string;
  category?: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface FooterColumn {
  title: string;
  links: { label: string; href: string }[];
}

export interface SocialLink {
  platform: string;
  url: string;
}

// ── Section configs ──────────────────────────────────────────────

export interface FeatureGridSection {
  type: "feature-grid";
  variant: "cards" | "icons-left" | "icons-top" | "alternating";
  title: string;
  subtitle?: string;
  items: FeatureItem[];
}

export interface MenuSection {
  type: "menu";
  variant: "tabbed" | "grid" | "list" | "elegant";
  title: string;
  subtitle?: string;
  categories: MenuCategory[];
}

export interface ProductGridSection {
  type: "product-grid";
  variant: "grid" | "list" | "carousel" | "featured";
  title: string;
  subtitle?: string;
  items: ProductItem[];
}

export interface TestimonialsSection {
  type: "testimonials";
  variant: "cards" | "single-spotlight" | "slider" | "minimal";
  title: string;
  subtitle?: string;
  items: TestimonialItem[];
}

export interface PricingSection {
  type: "pricing";
  variant: "columns" | "toggle" | "comparison-table";
  title: string;
  subtitle?: string;
  tiers: PricingTier[];
}

export interface GallerySection {
  type: "gallery";
  variant: "grid" | "masonry" | "carousel";
  title: string;
  subtitle?: string;
  items: GalleryItem[];
}

export interface StatsSection {
  type: "stats";
  variant: "inline" | "cards" | "large-numbers";
  title?: string;
  items: StatItem[];
}

export interface CtaBannerSection {
  type: "cta-banner";
  variant: "gradient" | "solid" | "with-image";
  headline: string;
  description: string;
  ctaText: string;
  ctaHref: string;
  imageDescription?: string;
}

export interface TeamSection {
  type: "team";
  variant: "grid" | "carousel" | "detailed";
  title: string;
  subtitle?: string;
  members: TeamMember[];
}

export interface BlogPreviewSection {
  type: "blog-preview";
  variant: "cards" | "list" | "featured-hero";
  title: string;
  subtitle?: string;
  posts: BlogPost[];
}

export interface ContactSection {
  type: "contact";
  variant: "form-only" | "split-with-info" | "minimal";
  title: string;
  subtitle?: string;
  fields?: string[];
}

export interface FaqSection {
  type: "faq";
  variant: "accordion" | "two-column" | "simple";
  title: string;
  subtitle?: string;
  items: FaqItem[];
}

export interface AboutSection {
  type: "about";
  variant: "text-image" | "timeline" | "values-grid";
  title: string;
  subtitle?: string;
  content: string;
  imageDescription?: string;
  values?: { title: string; description: string; icon?: string }[];
  timeline?: { year: string; title: string; description: string }[];
}

export interface LogoCloudItem {
  name: string;
}

export interface LogoCloudSection {
  type: "logo-cloud";
  variant: "scroll" | "grid" | "simple";
  title?: string;
  subtitle?: string;
  items: LogoCloudItem[];
}

export interface NewsletterSection {
  type: "newsletter";
  variant: "centered" | "split" | "banner";
  title: string;
  subtitle?: string;
  benefits?: string[];
}

export interface ProcessStep {
  title: string;
  description: string;
  icon?: string;
}

export interface ProcessSection {
  type: "process";
  variant: "numbered" | "timeline" | "cards";
  title?: string;
  subtitle?: string;
  steps: ProcessStep[];
}

export interface CustomSection {
  type: "custom";
  variant: "custom";
  componentName: string;  // PascalCase, e.g. "RevenueChart"
  code: string;           // Full React component source (imports + default export)
}

export type ConfigSection =
  | FeatureGridSection
  | MenuSection
  | ProductGridSection
  | TestimonialsSection
  | PricingSection
  | GallerySection
  | StatsSection
  | CtaBannerSection
  | TeamSection
  | BlogPreviewSection
  | ContactSection
  | FaqSection
  | AboutSection
  | LogoCloudSection
  | NewsletterSection
  | ProcessSection
  | CustomSection;

// ── Footer ───────────────────────────────────────────────────────

export type FooterVariant = "simple" | "multi-column" | "minimal";

export interface FooterConfig {
  variant: FooterVariant;
  columns?: FooterColumn[];
  copyright: string;
  socialLinks?: SocialLink[];
}

// ── Pages ────────────────────────────────────────────────────────

export interface PageConfig {
  path: string;       // e.g. "/about", "/menu", "/products"
  title: string;
  sections: ConfigSection[];
}

// ── Uploaded image ───────────────────────────────────────────────

export interface UploadedImage {
  name: string;
  type: string;
  dataUrl: string;
  downloadUrl?: string;
}

// ── Compiler output ──────────────────────────────────────────────

export interface GeneratedFile {
  path: string;
  content: string;
}

export interface CompiledProject {
  files: GeneratedFile[];
  dependencies: Record<string, string>;
  config: WebsiteConfig;
}
