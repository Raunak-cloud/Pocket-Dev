/**
 * Website Configuration Types
 * Defines the structure for AI-generated website configurations
 */

export interface GeneratedFile {
  path: string;
  content: string;
}

export interface CustomSection {
  type: "custom";
  jsx: string;
  [key: string]: any;
}

export type ConfigSection = CustomSection | Record<string, any>;

export type TemplateId =
  | "restaurant"
  | "ecommerce"
  | "saas"
  | "portfolio"
  | "blog"
  | "fitness";

export interface UploadedImage {
  url: string;
  alt?: string;
}

export interface WebsiteConfig {
  version: number;
  templateId: TemplateId;
  business: {
    name: string;
    tagline: string;
    description: string;
    phone?: string;
    email?: string;
    address?: string;
    hours?: string;
    logoUrl?: string;
  };
  theme: {
    primary: string;
    secondary?: string;
    accent?: string;
  };
  pages: {
    home: boolean;
    about?: boolean;
    services?: boolean;
    products?: boolean;
    blog?: boolean;
    contact?: boolean;
  };
  components?: {
    hero?: Record<string, any>;
    features?: Record<string, any>;
    testimonials?: Record<string, any>;
    pricing?: Record<string, any>;
    cta?: Record<string, any>;
    footer?: Record<string, any>;
    [key: string]: Record<string, any> | undefined;
  };
  content?: {
    [key: string]: any;
  };
  images?: UploadedImage[];
}
