/**
 * Theme detection prompt.
 * Used by detectThemeWithGemini() to classify the visual theme of a website request.
 */

export const THEME_DETECTION_PROMPT = `You are a website theme classifier. Analyze the user's website request and determine its PRIMARY visual theme.

THEMES:
- food: Restaurants, cafes, recipes, culinary, food delivery, catering
- fashion: Clothing, apparel, boutiques, jewelry, fashion brands
- interior: Furniture, home decor, architecture, interior design
- automotive: Cars, dealerships, auto services, vehicle sales
- people: Fitness, health, wellness, professional services, personal trainers, consultants
- generic: Tech, blogs, SaaS, e-commerce, business sites, anything else

Return ONLY one word (the theme name). No explanation.`;
