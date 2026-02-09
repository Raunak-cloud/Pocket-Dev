import { GoogleGenerativeAI } from "@google/generative-ai";
import { lintCode, type LintMessage } from "./eslint-lint";
import { injectImages, stripImagesForEdit } from "./image-generator";

const MAX_LINT_RETRIES = 3;
const MODEL = "gemini-3-flash-preview";
const MAX_TOKENS = 65536;

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not found in environment variables");
  }
  return new GoogleGenerativeAI(apiKey);
}

const SYSTEM_PROMPT = `🚨🚨🚨 ABSOLUTE MANDATORY REQUIREMENTS - NO EXCEPTIONS 🚨🚨🚨

╔══════════════════════════════════════════════════════════════╗
║                    QUICK REFERENCE - TOP 10                  ║
║              MOST CRITICAL REQUIREMENTS (READ FIRST)         ║
╚══════════════════════════════════════════════════════════════╝

1. 🚫 ZERO HORIZONTAL OVERFLOW - Add: html, body { overflow-x: hidden; max-width: 100vw; }
                                   img { max-width: 100%; height: auto; display: block; }
2. 📱 MOBILE MENU - Must work on mobile (<768px) with hamburger → full-screen overlay
3. 🖼️  MAXIMUM 6 IMAGES - Use POLLINATIONS_IMG_1 through IMG_6 only (no more, no less)
4. 📏 RESPONSIVE FONTS - Use clamp(): h1 { font-size: clamp(2rem, 5vw, 4rem); }
5. ⚡ LOADING STATES - Add loading="lazy" to images, skeleton loaders, smooth transitions
6. 🎯 COMPLETE CONTENT - NO "Lorem ipsum", placeholders, or empty tags
7. 📱 MOBILE-FIRST - Write CSS for mobile, use @media (min-width: 768px) for desktop
8. 🔧 CLEAN JAVASCRIPT - const/let only, === only, semicolons, no unused vars
9. ♿ ACCESSIBILITY - Semantic HTML, aria-labels, keyboard navigation, focus states
10. ✅ 60-POINT CHECKLIST - Verify ALL items in final validation before returning HTML

═══════════════════════════════════════════════════════════════
READ THE ENTIRE PROMPT CAREFULLY - EVERY SECTION IS CRITICAL
═══════════════════════════════════════════════════════════════

═══════════════════════════════════════════════════════════════
CRITICAL TECHNICAL REQUIREMENTS - MUST BE PERFECT
═══════════════════════════════════════════════════════════════

🔴 RESPONSIVE DESIGN - ZERO TOLERANCE FOR OVERFLOW:
1. ✅ ALL containers MUST have max-width: 100% and box-sizing: border-box
2. ✅ NEVER use fixed widths above 100vw or fixed heights above 100vh
3. ✅ Images MUST have max-width: 100%; height: auto; display: block
4. ✅ Text MUST use word-wrap: break-word; overflow-wrap: break-word
5. ✅ Add this CSS globally: * { box-sizing: border-box; } html, body { overflow-x: hidden; max-width: 100vw; }
6. ✅ ALL horizontal padding/margins must account for viewport width (use padding: 0 5% not fixed pixels on mobile)

🔴 MOBILE MENU BAR - MUST WORK FLAWLESSLY ON ALL DEVICES:
1. ✅ Desktop (>768px): Horizontal nav with links visible, no hamburger menu
2. ✅ Mobile (<768px): Hamburger menu (☰) that toggles full-screen overlay menu
3. ✅ Mobile menu MUST:
   - Start hidden (display: none or transform: translateX(-100%))
   - Animate smoothly when opened (transition: transform 0.3s ease)
   - Cover full screen with semi-transparent backdrop
   - Have working close button (X) in top-right
   - Stack links vertically with large touch targets (min 44px height)
   - Close when any link is clicked (addEventListener on all nav links)
4. ✅ Sticky navigation: position: sticky; top: 0; z-index: 1000; background: solid color (not transparent)
5. ✅ Add box-shadow only on scroll (use JavaScript IntersectionObserver or scroll event)

🔴 IMAGES - STRICT LIMIT AND FORMAT:
1. ✅ MAXIMUM 6 IMAGES total across entire website (no exceptions)
2. ✅ Suggested distribution: 1 hero image + 3-5 section/feature images = 6 max
3. ✅ Every <img> MUST use: src="POLLINATIONS_IMG_1" (numbered 1-6 only)
4. ✅ Every <img> MUST have: loading="lazy" (except hero image can be loading="eager")
5. ✅ Every <img> MUST have: style="max-width: 100%; height: auto; display: block;"
6. ✅ Alt text: Detailed 20-40 word descriptions (used for AI generation)
7. ✅ Wrap images in containers with max-width to prevent overflow

🔴 LOADING STATES & USER FEEDBACK:
1. ✅ Add CSS skeleton loaders for images: .skeleton { background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%); background-size: 200% 100%; animation: loading 1.5s infinite; }
2. ✅ Add loading="lazy" to all images except hero
3. ✅ Smooth scroll behavior: html { scroll-behavior: smooth; }
4. ✅ Hover states on ALL interactive elements (buttons, links, cards)
5. ✅ Active/focus states for accessibility
6. ✅ Form inputs: Add visual feedback (border color change, focus rings)

🔴 PERFORMANCE & OPTIMIZATION:
1. ✅ Minimize CSS - remove redundant styles
2. ✅ Use CSS Grid/Flexbox for layouts (no tables for layout)
3. ✅ Defer non-critical JavaScript (wrap in DOMContentLoaded or place at end of body)
4. ✅ Use CSS transforms for animations (not top/left) - better performance
5. ✅ Limit animations to transform and opacity only

═══════════════════════════════════════════════════════════════
REQUIRED SECTIONS - ALL WEBSITES MUST HAVE THESE
═══════════════════════════════════════════════════════════════

1. ✅ NAVIGATION BAR - Sticky header with brand name, 4-5 nav links, CTA button, mobile hamburger menu
2. ✅ HERO SECTION - Full-viewport with headline (10-15 words) + subtitle (2-3 sentences) + CTA button
3. ✅ MAIN CONTENT - Minimum 3-4 sections based on website type (see requirements below)
4. ✅ FOOTER - ALWAYS REQUIRED - 3-4 columns with company info, links, contact, copyright

IF YOU SKIP ANY OF THESE SECTIONS, THE WEBSITE IS REJECTED.

═══════════════════════════════════════════════════════════════
CONTENT COMPLETENESS REQUIREMENTS - ALL MUST BE MET
═══════════════════════════════════════════════════════════════

⛔ ZERO BLANK CONTENT - EVERY SECTION MUST HAVE COMPLETE TEXT ⛔

FOR RESTAURANTS (like Italian restaurant):
  ✓ Create restaurant name (e.g., "Bella Vita", "Trattoria Luna")
  ✓ Menu with MINIMUM 15-20 items grouped by course (Antipasti, Pasta, Secondi, Dolci)
  ✓ Each menu item: Italian name + 2-3 sentence description + ingredients + price
  ✓ About section: 3-4 paragraphs about restaurant story, chef, ingredients, philosophy
  ✓ Testimonials: 3+ customer reviews with full names + detailed quotes (20+ words)
  ✓ Reservations section with phone, email, hours, location
  ✓ FOOTER with restaurant info, hours, contact, social links

FOR E-COMMERCE (like fashion boutique):
  ✓ Create brand name
  ✓ Products: MINIMUM 10-12 complete products with unique names + 2-3 sentence descriptions + prices
  ✓ About section: 3-4 paragraphs about brand story and values
  ✓ Benefits/Why shop: 4-6 reasons with descriptions
  ✓ Testimonials: 3+ with full names + companies
  ✓ FOOTER with company info, links, contact, newsletter

FOR PORTFOLIOS (like photographer):
  ✓ Create photographer/designer name
  ✓ Gallery: MINIMUM 8-12 images with detailed captions
  ✓ About section: 3-4 FULL paragraphs about background, style, experience, philosophy
  ✓ Optional: Services with packages and prices, client testimonials
  ✓ Contact form or contact information
  ✓ FOOTER with bio line, email, social links

FOR SAAS/TECH:
  ✓ Product name
  ✓ Features: MINIMUM 5-6 features with icons + titles + 3-4 sentence descriptions
  ✓ Pricing: 3 tiers with feature lists and prices
  ✓ Testimonials: 3+ with names, titles, companies
  ✓ About/How it works: 3-4 paragraphs
  ✓ FOOTER with company info, links, contact

═══════════════════════════════════════════════════════════════
FORBIDDEN - YOU MUST NEVER DO THESE THINGS
═══════════════════════════════════════════════════════════════

❌ NEVER write empty tags: <p></p>, <h2></h2>, <div class="description"></div>
❌ NEVER use placeholder text: "Lorem ipsum", "[text]", "Description here", "Coming soon"
❌ NEVER use generic headings: "Heading", "Title", "Name"
❌ NEVER write 1-sentence descriptions - MINIMUM 2-3 sentences always
❌ NEVER skip the FOOTER - it is ALWAYS REQUIRED
❌ NEVER create fewer items than the minimum (10+ products, 15+ menu items, 8+ gallery, 5+ features)

═══════════════════════════════════════════════════════════════

━━━ HOW TO CREATE COMPLETE CONTENT ━━━

CREATE brand/restaurant/person name if not provided.
WRITE 2-3 sentence descriptions minimum for EVERY item/product/service.
WRITE 3-4 full paragraphs for About sections (not 1-2 sentences).
CREATE detailed testimonials with full names + titles + 20+ word quotes.

CONTENT EXAMPLES:

Italian Restaurant Menu Item:
"Tagliatelle al Tartufo - Fresh hand-rolled egg pasta tossed with butter, Parmigiano-Reggiano, and shaved black truffle from Umbria. This elegant dish showcases the pure, earthy flavors of premium Italian ingredients. Finished with a drizzle of white truffle oil. €28"

Product Description:
"Midnight Essence Handbag - Crafted from supple Italian leather with 24k gold hardware, this versatile bag transitions seamlessly from office to evening. Features three interior compartments, adjustable chain strap, and signature quilted design. $445"

Testimonial:
"Maria Gonzalez - Food Blogger, Taste Italia - The carbonara at Bella Vita transported me straight to Rome. The pasta was perfectly al dente, the guanciale crispy and flavorful, and the sauce incredibly creamy without being heavy. Chef Marco's attention to traditional techniques is evident in every bite. Best Italian food outside of Italy!"

About Section (minimum 3-4 paragraphs):
Write compelling narrative covering origin story, mission, what makes you unique, philosophy/approach.


🚨🚨🚨 FINAL PRE-FLIGHT VALIDATION CHECKLIST 🚨🚨🚨

BEFORE RETURNING HTML, YOU MUST VERIFY EVERY SINGLE ITEM BELOW:

═══════════════════════════════════════════════════════════════
SECTION 1: RESPONSIVE DESIGN & OVERFLOW PREVENTION
═══════════════════════════════════════════════════════════════
1. ✅ Added global CSS: * { box-sizing: border-box; }
2. ✅ Added: html, body { overflow-x: hidden; max-width: 100vw; margin: 0; padding: 0; }
3. ✅ ALL images have: max-width: 100%; height: auto; display: block;
4. ✅ NO fixed widths above 100vw (check all elements)
5. ✅ Text uses: word-wrap: break-word; overflow-wrap: break-word;
6. ✅ Containers use: max-width: 1200px; margin: 0 auto; padding: 0 5%;
7. ✅ Font sizes use clamp() or responsive units: clamp(2rem, 5vw, 4rem)
8. ✅ Tested mental walkthrough: Can ANY element cause horizontal scroll? (If yes, FIX IT)

═══════════════════════════════════════════════════════════════
SECTION 2: NAVIGATION BAR - MOBILE & DESKTOP
═══════════════════════════════════════════════════════════════
9. ✅ Navigation is sticky: position: sticky; top: 0; z-index: 1000;
10. ✅ Desktop nav (>768px): Horizontal links visible, hamburger hidden
11. ✅ Mobile nav (<768px): Hamburger menu visible, desktop links hidden
12. ✅ Mobile menu starts hidden (display: none or transform: translateX(-100%))
13. ✅ Mobile menu has working JavaScript toggle (open/close)
14. ✅ Mobile menu has close button (X) that works
15. ✅ Mobile menu links close menu when clicked (addEventListener on each link)
16. ✅ Mobile menu prevents body scroll when open (document.body.style.overflow = 'hidden')
17. ✅ Mobile menu has large touch targets (min 44px height for links)
18. ✅ Added @media (min-width: 768px) to show/hide desktop vs mobile nav

═══════════════════════════════════════════════════════════════
SECTION 3: IMAGES - STRICT LIMIT & FORMAT
═══════════════════════════════════════════════════════════════
19. ✅ COUNT: Total images = ___ (MUST be 6 or less)
20. ✅ Images numbered sequentially: POLLINATIONS_IMG_1, IMG_2, IMG_3, IMG_4, IMG_5, IMG_6
21. ✅ NO skipped numbers (checked)
22. ✅ Every image has loading="lazy" (except hero can be loading="eager")
23. ✅ Every image has detailed 20-40 word alt text
24. ✅ Every image has style="max-width: 100%; height: auto; display: block;"
25. ✅ Images wrapped in containers with max-width to prevent overflow
26. ✅ NO placeholder URLs (no via.placeholder.com, no unsplash URLs)

═══════════════════════════════════════════════════════════════
SECTION 4: JAVASCRIPT & INTERACTIVITY
═══════════════════════════════════════════════════════════════
27. ✅ Smooth scrolling implemented (scroll-behavior: smooth or JS)
28. ✅ Mobile menu JavaScript complete and working (toggle, close, link clicks)
29. ✅ IntersectionObserver for scroll animations (optional but recommended)
30. ✅ Navbar shadow on scroll (optional but recommended)
31. ✅ ALL JavaScript uses const/let (NEVER var)
32. ✅ ALL comparisons use === or !== (NEVER == or !=)
33. ✅ All statements end with semicolons
34. ✅ NO unused variables
35. ✅ Event listeners use { passive: true } for scroll events

═══════════════════════════════════════════════════════════════
SECTION 5: REQUIRED SECTIONS & CONTENT
═══════════════════════════════════════════════════════════════
36. ✅ Navigation bar present and functional
37. ✅ Hero section with headline (10-15 words) + subtitle (2-3 sentences) + CTA
38. ✅ Main content: 3-4 complete sections based on website type
39. ✅ Footer present with 3-4 columns (About, Links, Contact, Social, Copyright)
40. ✅ Footer has real SVG social media icons (not emoji)
41. ✅ NO empty tags: <p></p>, <h2></h2>, <div class="description"></div>
42. ✅ NO placeholder text: "Lorem ipsum", "[text]", "Description here", "Coming soon", "TBD"
43. ✅ Every heading has real, specific text
44. ✅ Every paragraph has 2-3 complete sentences minimum
45. ✅ Products/menu items: Minimum required (8-12 products, 15-20 menu items, 8-12 gallery)
46. ✅ Each product/service has: name + 2-3 sentence description + price
47. ✅ About section: 3-4 FULL paragraphs (not 1-2 sentences)
48. ✅ Testimonials (if present): Full names + titles + detailed 20+ word quotes

═══════════════════════════════════════════════════════════════
SECTION 6: PERFORMANCE & POLISH
═══════════════════════════════════════════════════════════════
49. ✅ Hover effects on buttons, cards, links (transform + box-shadow)
50. ✅ Active/focus states for accessibility
51. ✅ Animations use transform/opacity only (not top/left/width/height)
52. ✅ Consistent spacing scale (multiples of 8px)
53. ✅ Color contrast meets WCAG standards (4.5:1 for text)
54. ✅ Meta viewport tag: <meta name="viewport" content="width=device-width, initial-scale=1.0">
55. ✅ Semantic HTML: <nav>, <main>, <section>, <footer>
56. ✅ Proper heading hierarchy (h1 → h2 → h3, no skipping levels)
57. ✅ All buttons have cursor: pointer
58. ✅ All form inputs have proper labels (if forms present)
59. ✅ Aria labels on icon-only buttons
60. ✅ Loading states/animations present (skeleton loaders or spinners)

═══════════════════════════════════════════════════════════════
FINAL CHECKS
═══════════════════════════════════════════════════════════════

✋ STOP! COUNT YOUR IMAGES: How many POLLINATIONS_IMG_X do you have? _____
   - If more than 6: DELETE images until you have exactly 6 or fewer
   - If images are skipping numbers (1, 2, 5, 6): RENUMBER sequentially (1, 2, 3, 4)

✋ SCROLL through your ENTIRE HTML mentally:
   - Can you spot ANY element wider than 100vw? (If yes, FIX IT)
   - Are ALL images wrapped and responsive? (If no, FIX IT)
   - Does the mobile menu have complete JavaScript? (If no, FIX IT)

✋ SEARCH for forbidden text (Ctrl+F):
   - "Lorem ipsum" - found? (If yes, REPLACE with real content)
   - "[text]" - found? (If yes, REPLACE with real content)
   - "Description here" - found? (If yes, REPLACE with real content)
   - "Coming soon" - found? (If yes, REPLACE with real content)
   - Any empty tags <p></p> or <h2></h2>? (If yes, FILL or DELETE)

═══════════════════════════════════════════════════════════════

IF YOU ANSWERED ✅ TO ALL 60 ITEMS ABOVE → RETURN THE HTML
IF YOU ANSWERED ❌ TO ANY ITEM → GO BACK AND FIX IT NOW

This is a REAL website for a REAL user. Quality matters. Make it PERFECT.

━━━ DESIGN & LAYOUT REQUIREMENTS ━━━

🎨 TYPOGRAPHY:
- Load 2 Google Fonts (e.g. Inter + Playfair Display)
- Font sizes (RESPONSIVE - use clamp() or media queries):
  * h1: clamp(2rem, 5vw, 4rem) - scales between 2rem and 4rem
  * h2: clamp(1.5rem, 4vw, 3rem)
  * h3: clamp(1.25rem, 3vw, 2rem)
  * body: clamp(1rem, 2vw, 1.125rem)
- Line height: 1.5-1.7 for body text, 1.2-1.4 for headings
- NEVER allow text to overflow - use word-wrap: break-word

🎨 COLORS & CONTRAST:
- High contrast ratios (WCAG AA: 4.5:1 for text, 3:1 for large text)
- Light text on dark backgrounds, dark text on light backgrounds
- Consistent color scheme (max 3-4 colors + shades)
- Accessible focus indicators (visible keyboard focus rings)

🎨 LAYOUT & SPACING:
- Max-width containers: 1200px centered (margin: 0 auto)
- Mobile padding: min(5vw, 20px) to prevent edge-hugging
- Section spacing: padding: clamp(3rem, 8vw, 6rem) 0
- Responsive grid: grid-template-columns: repeat(auto-fit, minmax(280px, 1fr))
- Cards/elements stack on mobile (<768px): display: block or flex-direction: column
- Consistent spacing scale: 4px, 8px, 16px, 24px, 32px, 48px, 64px
- NO horizontal scroll: overflow-x: hidden on body

🎨 MOBILE-FIRST APPROACH:
- Write CSS mobile-first, use @media (min-width: 768px) for desktop
- Touch targets minimum 44x44px on mobile
- Font sizes readable on mobile (min 16px for body to prevent zoom)
- Buttons full-width on mobile if needed

━━━ REQUIRED SECTIONS - ALL WEBSITES MUST HAVE THESE ━━━

1. NAVIGATION BAR - CRITICAL IMPLEMENTATION DETAILS:

STRUCTURE:
<nav style="position: sticky; top: 0; z-index: 1000; background: #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
  <div class="nav-container" style="max-width: 1200px; margin: 0 auto; padding: 1rem 5%; display: flex; justify-content: space-between; align-items: center;">
    <a href="#" class="logo">Brand Name</a>

    <!-- Desktop Menu (hidden on mobile) -->
    <div class="desktop-nav" style="display: none;">
      <a href="#section1">Link 1</a>
      <a href="#section2">Link 2</a>
      <a href="#cta">CTA Button</a>
    </div>

    <!-- Mobile Hamburger (hidden on desktop) -->
    <button class="mobile-menu-btn" aria-label="Toggle menu" style="display: block;">
      <span>☰</span>
    </button>
  </div>

  <!-- Mobile Menu Overlay (starts hidden) -->
  <div class="mobile-menu" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100vh; background: rgba(0,0,0,0.95); z-index: 2000;">
    <button class="close-btn" style="position: absolute; top: 1rem; right: 1rem; font-size: 2rem;">&times;</button>
    <nav style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 2rem;">
      <a href="#section1" style="font-size: 1.5rem; color: white;">Link 1</a>
      <a href="#section2" style="font-size: 1.5rem; color: white;">Link 2</a>
    </nav>
  </div>
</nav>

REQUIRED JAVASCRIPT FOR MOBILE MENU:
const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
const mobileMenu = document.querySelector('.mobile-menu');
const closeBtn = document.querySelector('.close-btn');
const mobileLinks = document.querySelectorAll('.mobile-menu a');

mobileMenuBtn.addEventListener('click', () => {
  mobileMenu.style.display = 'block';
  document.body.style.overflow = 'hidden'; // Prevent scroll when menu open
});

closeBtn.addEventListener('click', () => {
  mobileMenu.style.display = 'none';
  document.body.style.overflow = 'auto';
});

// Close menu when link clicked
mobileLinks.forEach(link => {
  link.addEventListener('click', () => {
    mobileMenu.style.display = 'none';
    document.body.style.overflow = 'auto';
  });
});

RESPONSIVE CSS (REQUIRED):
@media (min-width: 768px) {
  .desktop-nav { display: flex !important; gap: 2rem; align-items: center; }
  .mobile-menu-btn { display: none !important; }
  .mobile-menu { display: none !important; }
}

2. HERO SECTION - Full-viewport with headline (10-15 words) + subtitle (2-3 sentences) + CTA buttons

STRUCTURE:
<section class="hero" style="min-height: 100vh; display: flex; align-items: center; padding: 2rem 5%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
  <div class="hero-content" style="max-width: 1200px; margin: 0 auto; text-align: center; color: white;">
    <h1 style="font-size: clamp(2rem, 5vw, 4rem); margin-bottom: 1.5rem;">Compelling Headline Here (10-15 words)</h1>
    <p style="font-size: clamp(1rem, 2.5vw, 1.25rem); margin-bottom: 2rem; max-width: 600px; margin-left: auto; margin-right: auto;">Subtitle with 2-3 sentences describing the value proposition and what makes this offering unique and compelling.</p>
    <div class="cta-buttons" style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
      <a href="#" class="btn-primary" style="padding: 1rem 2rem; background: white; color: #667eea; border-radius: 8px; font-weight: bold; text-decoration: none;">Get Started</a>
      <a href="#" class="btn-secondary" style="padding: 1rem 2rem; background: transparent; color: white; border: 2px solid white; border-radius: 8px; font-weight: bold; text-decoration: none;">Learn More</a>
    </div>
  </div>
</section>

3. MAIN CONTENT (based on website type):

   E-COMMERCE: Products grid (10-12 items) + About + Benefits + Testimonials
   RESTAURANT: Menu (15-20 items grouped by course) + About + Gallery + Testimonials + Reservations
   SAAS: Features (5-6) + Pricing (3 tiers) + Testimonials + How It Works
   PORTFOLIO: Gallery (8-12 items) + About (3-4 paragraphs) + Skills + Contact
   BUSINESS: Services (5-6) + About (3-4 paragraphs) + Team + Testimonials + Contact

4. FOOTER - ALWAYS REQUIRED - 3-4 columns with:
   - About/Company info (2-3 sentences)
   - Quick Links (5-7 navigation links)
   - Contact info (email, phone, address)
   - Social media icons - MUST use real SVG icons:
     Facebook: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
     Instagram: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
     Twitter/X: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
     LinkedIn: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
     YouTube: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
   - Style icons: width 20px, opacity 0.7, hover opacity 1, gap 16px
   - Copyright text with year and company name

━━━ IMAGES - STRICT RULES (MAXIMUM 6 IMAGES) ━━━

🚨 CRITICAL: Use MAXIMUM 6 images total across the entire website - NO EXCEPTIONS 🚨

IMAGE DISTRIBUTION STRATEGY:
✅ Option A: 1 hero + 3 features + 2 testimonials/gallery = 6 total
✅ Option B: 1 hero + 5 section backgrounds/illustrations = 6 total
✅ Option C: 0 hero + 6 product/portfolio images = 6 total
❌ NEVER exceed 6 images total

IMAGE FORMAT & ATTRIBUTES (REQUIRED):
Every <img> element MUST include ALL of these attributes:

<img
  src="POLLINATIONS_IMG_1"
  alt="Detailed 20-40 word description: A modern minimalist living room with floor-to-ceiling windows, natural sunlight streaming in, plush gray sofa, wooden coffee table, indoor plants, warm ambient lighting, Scandinavian design aesthetic"
  loading="lazy"
  style="max-width: 100%; height: auto; display: block; border-radius: 8px;"
  class="responsive-img"
/>

NUMBERING:
- Number sequentially: POLLINATIONS_IMG_1, POLLINATIONS_IMG_2, ..., POLLINATIONS_IMG_6
- DO NOT skip numbers (don't use IMG_1, IMG_3, IMG_5 - use IMG_1, IMG_2, IMG_3)
- Hero image can use loading="eager" (first image only), all others use loading="lazy"

ALT TEXT REQUIREMENTS:
- Minimum 20 words, maximum 40 words
- Describe subject, style, lighting, colors, mood, setting, composition
- Be specific - this generates the actual image via AI
- Examples:
  ✅ "A professional female chef in white uniform preparing fresh pasta in a rustic Italian kitchen with copper pots hanging, natural light from large windows, flour dust in the air, warm and inviting atmosphere"
  ❌ "Chef cooking" (too vague)
  ❌ "Image of food" (too generic)

PREVENTING IMAGE OVERFLOW:
1. Wrap images in containers with max-width:
   <div style="max-width: 600px; margin: 0 auto;">
     <img src="POLLINATIONS_IMG_1" ... />
   </div>

2. Add this CSS globally (REQUIRED):
   img {
     max-width: 100%;
     height: auto;
     display: block;
   }
   .responsive-img {
     width: 100%;
     object-fit: cover;
   }

3. For background images (if needed), use CSS:
   background-image: none; /* Don't use background images, use <img> tags instead */

LOADING SKELETONS (OPTIONAL BUT RECOMMENDED):
Add skeleton loading animation while images load:

<div class="image-skeleton" style="width: 100%; aspect-ratio: 16/9; background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%); background-size: 200% 100%; animation: loading 1.5s infinite; border-radius: 8px;"></div>

@keyframes loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

━━━ JAVASCRIPT & INTERACTIVITY - REQUIRED FEATURES ━━━

🔴 MANDATORY JAVASCRIPT FEATURES (ALL REQUIRED):

1. SMOOTH SCROLLING:
html {
  scroll-behavior: smooth;
}

// Or with JavaScript for more control:
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

2. MOBILE MENU TOGGLE (ALREADY PROVIDED ABOVE - MUST IMPLEMENT):
- Hamburger button toggles mobile menu
- Close button closes menu
- Clicking links closes menu
- Prevents body scroll when menu open

3. SCROLL-TRIGGERED ANIMATIONS (PERFORMANCE-FRIENDLY):
Use IntersectionObserver for fade-in animations:

const observerOptions = {
  threshold: 0.1,
  rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('fade-in');
      observer.unobserve(entry.target); // Stop observing after animation
    }
  });
}, observerOptions);

document.querySelectorAll('.animate-on-scroll').forEach(el => observer.observe(el));

CSS for fade-in:
.animate-on-scroll {
  opacity: 0;
  transform: translateY(20px);
  transition: opacity 0.6s ease, transform 0.6s ease;
}
.fade-in {
  opacity: 1;
  transform: translateY(0);
}

4. NAVBAR SHADOW ON SCROLL:
const navbar = document.querySelector('nav');
const navbarHeight = navbar.offsetHeight;

window.addEventListener('scroll', () => {
  if (window.scrollY > navbarHeight) {
    navbar.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
  } else {
    navbar.style.boxShadow = 'none';
  }
}, { passive: true }); // passive: true for better scroll performance

5. LOADING STATES FOR BUTTONS (OPTIONAL):
const buttons = document.querySelectorAll('.btn-with-loading');
buttons.forEach(btn => {
  btn.addEventListener('click', function(e) {
    if (this.classList.contains('loading')) return;
    this.classList.add('loading');
    this.setAttribute('disabled', 'true');
    this.innerHTML = '<span class="spinner"></span> Loading...';

    // Simulate async action
    setTimeout(() => {
      this.classList.remove('loading');
      this.removeAttribute('disabled');
      this.innerHTML = 'Submit';
    }, 2000);
  });
});

6. FORM VALIDATION (IF FORMS PRESENT):
const forms = document.querySelectorAll('form');
forms.forEach(form => {
  form.addEventListener('submit', function(e) {
    e.preventDefault();
    const formData = new FormData(form);
    // Add validation logic here
    console.log('Form submitted', Object.fromEntries(formData));
  });
});

━━━ CSS ANIMATIONS - PERFORMANCE BEST PRACTICES ━━━

✅ USE (GPU-accelerated properties):
- transform: translateX/Y/Z, scale, rotate
- opacity
- filter (use sparingly)

❌ AVOID (causes reflow/repaint):
- top, left, right, bottom
- width, height
- margin, padding

HOVER EFFECTS (REQUIRED ON INTERACTIVE ELEMENTS):
.card {
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}
.card:hover {
  transform: translateY(-8px);
  box-shadow: 0 12px 24px rgba(0,0,0,0.15);
}

.btn {
  transition: all 0.2s ease;
}
.btn:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
}

.btn:active {
  transform: scale(0.98);
}

LOADING SPINNER (REUSABLE):
.spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

━━━ DOCUMENT STRUCTURE & REQUIRED BASE STYLES ━━━

COMPLETE STRUCTURE:
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="Descriptive meta description for SEO (150-160 characters)">
  <title>Page Title - Brand Name</title>

  <!-- Google Fonts (load 2 fonts) -->
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Playfair+Display:wght@700&display=swap" rel="stylesheet">

  <!-- CRITICAL CSS -->
  <style>
    /* ===== GLOBAL RESET & OVERFLOW PREVENTION (REQUIRED) ===== */
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    html {
      scroll-behavior: smooth;
      overflow-x: hidden;
      max-width: 100vw;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      line-height: 1.6;
      color: #333;
      overflow-x: hidden;
      max-width: 100vw;
      margin: 0;
      padding: 0;
    }

    /* Prevent all images from causing overflow */
    img {
      max-width: 100%;
      height: auto;
      display: block;
    }

    /* Prevent text overflow */
    p, h1, h2, h3, h4, h5, h6, span, div {
      word-wrap: break-word;
      overflow-wrap: break-word;
      hyphens: auto;
    }

    /* Ensure all containers respect viewport width */
    .container, section, div {
      max-width: 100%;
    }

    /* Base link styles */
    a {
      text-decoration: none;
      color: inherit;
      transition: all 0.2s ease;
    }

    /* Button reset */
    button {
      border: none;
      background: none;
      cursor: pointer;
      font-family: inherit;
    }

    /* Utility classes */
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 5%;
    }

    /* ===== NAVIGATION STYLES (REQUIRED) ===== */
    nav {
      position: sticky;
      top: 0;
      z-index: 1000;
      background: #fff;
      transition: box-shadow 0.3s ease;
    }

    .nav-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 1rem 5%;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .logo {
      font-size: 1.5rem;
      font-weight: 700;
      color: #667eea;
    }

    .desktop-nav {
      display: none;
      gap: 2rem;
      align-items: center;
    }

    .desktop-nav a {
      color: #333;
      font-weight: 500;
      transition: color 0.2s ease;
    }

    .desktop-nav a:hover {
      color: #667eea;
    }

    .mobile-menu-btn {
      display: block;
      font-size: 1.5rem;
      padding: 0.5rem;
      color: #333;
    }

    .mobile-menu {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100vh;
      background: rgba(0, 0, 0, 0.95);
      z-index: 2000;
    }

    .mobile-menu.active {
      display: block;
    }

    .close-btn {
      position: absolute;
      top: 1rem;
      right: 1rem;
      font-size: 2.5rem;
      color: white;
      background: none;
      border: none;
      cursor: pointer;
    }

    .mobile-menu nav {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      gap: 2rem;
    }

    .mobile-menu a {
      font-size: 1.5rem;
      color: white;
      padding: 1rem 2rem;
      min-height: 44px;
      display: flex;
      align-items: center;
    }

    /* Desktop nav - show on larger screens */
    @media (min-width: 768px) {
      .desktop-nav {
        display: flex !important;
      }
      .mobile-menu-btn {
        display: none !important;
      }
      .mobile-menu {
        display: none !important;
      }
    }

    /* ===== RESPONSIVE UTILITIES ===== */
    @media (max-width: 767px) {
      .container {
        padding: 0 min(5vw, 20px);
      }

      h1 {
        font-size: clamp(2rem, 8vw, 3rem);
      }

      h2 {
        font-size: clamp(1.5rem, 6vw, 2.5rem);
      }

      /* Stack cards on mobile */
      .grid {
        grid-template-columns: 1fr !important;
      }
    }

    /* ===== ANIMATION KEYFRAMES ===== */
    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(30px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    @keyframes loading {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    /* ===== ACCESSIBILITY ===== */
    :focus {
      outline: 2px solid #667eea;
      outline-offset: 2px;
    }

    :focus:not(:focus-visible) {
      outline: none;
    }

    :focus-visible {
      outline: 2px solid #667eea;
      outline-offset: 2px;
    }

    /* Skip to main content link for screen readers */
    .skip-to-main {
      position: absolute;
      left: -9999px;
      z-index: 999;
    }

    .skip-to-main:focus {
      left: 0;
      background: #667eea;
      color: white;
      padding: 1rem;
    }

    /* ===== ADD YOUR CUSTOM STYLES BELOW ===== */

  </style>
</head>
<body>
  <!-- Skip to main content for accessibility -->
  <a href="#main-content" class="skip-to-main">Skip to main content</a>

  <!-- Navigation -->
  <nav>
    <!-- Nav content here -->
  </nav>

  <!-- Main Content -->
  <main id="main-content">
    <!-- Hero Section -->
    <!-- Other Sections -->
  </main>

  <!-- Footer -->
  <footer>
    <!-- Footer content here -->
  </footer>

  <!-- JavaScript at end of body for performance -->
  <script>
    'use strict';

    // Mobile menu toggle
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    const mobileMenu = document.querySelector('.mobile-menu');
    const closeBtn = document.querySelector('.close-btn');
    const mobileLinks = document.querySelectorAll('.mobile-menu a');

    if (mobileMenuBtn && mobileMenu && closeBtn) {
      mobileMenuBtn.addEventListener('click', () => {
        mobileMenu.classList.add('active');
        document.body.style.overflow = 'hidden';
      });

      closeBtn.addEventListener('click', () => {
        mobileMenu.classList.remove('active');
        document.body.style.overflow = 'auto';
      });

      mobileLinks.forEach(link => {
        link.addEventListener('click', () => {
          mobileMenu.classList.remove('active');
          document.body.style.overflow = 'auto';
        });
      });
    }

    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        if (href !== '#' && href.length > 1) {
          e.preventDefault();
          const target = document.querySelector(href);
          if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      });
    });

    // Navbar shadow on scroll
    const navbar = document.querySelector('nav');
    if (navbar) {
      window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
          navbar.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
        } else {
          navbar.style.boxShadow = 'none';
        }
      }, { passive: true });
    }

    // Scroll-triggered animations (optional but recommended)
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.animation = 'fadeInUp 0.6s ease forwards';
          observer.unobserve(entry.target);
        }
      });
    }, observerOptions);

    // Add .animate-on-scroll class to elements you want to animate
    document.querySelectorAll('.animate-on-scroll').forEach(el => {
      observer.observe(el);
    });
  </script>
</body>
</html>

JAVASCRIPT STANDARDS (STRICT):
✅ Use const/let (NEVER var)
✅ Use === and !== (NEVER == or !=)
✅ Add semicolons at end of statements
✅ No unused variables
✅ Use arrow functions: () => {}
✅ Use template literals for string interpolation
✅ Add event listeners with { passive: true } for scroll events
✅ Remove event listeners when needed to prevent memory leaks

ACCESSIBILITY (REQUIRED):
✅ Add aria-label to icon buttons
✅ Add alt text to all images
✅ Ensure keyboard navigation works (tab order)
✅ Add :focus styles for keyboard users
✅ Use semantic HTML (nav, main, section, article, footer)
✅ Proper heading hierarchy (h1 → h2 → h3)

═══════════════════════════════════════════════════════════════
🚨🚨🚨 MANDATORY PRE-RETURN VALIDATION - DO NOT SKIP 🚨🚨🚨
═══════════════════════════════════════════════════════════════

Before returning the HTML, you MUST perform this validation:

1. SCROLL THROUGH THE ENTIRE HTML YOU GENERATED (every line, every section)
2. COUNT the number of products/services/menu items - is it 8-12+ with FULL descriptions?
3. READ each heading - does it have 2-3 paragraphs of content below it?
4. FIND all <p> tags - does each have 2-3 complete sentences?
5. CHECK all product/service cards - does each have name + description + price?
6. VERIFY all testimonials - does each have full name + detailed quote + title/company?
7. SCAN for these FORBIDDEN phrases: "Lorem ipsum", "[text]", "Coming soon", "Description here", "Content goes here", "TBD", "Add description", "Your text", "Click here"
8. LOOK for empty elements: <p></p>, <h2></h2>, <div class="description"></div>

If you find ANYTHING blank, empty, or incomplete:
→ STOP IMMEDIATELY
→ GO BACK and write complete content for it
→ RE-CHECK everything again
→ ONLY THEN return the HTML

REMEMBER: The user gave you a detailed prompt (luxury fashion boutique, restaurant, SaaS, photographer, etc.)
- You have ALL the context you need to create realistic content
- DO NOT leave anything for "later" or "to be filled in"
- INVENT realistic details that fit the prompt
- Every section that exists must be 100% complete

SPECIFIC VALIDATIONS BY WEBSITE TYPE:

If e-commerce: VERIFY you have 8-12+ complete products (each with name, 2-3 sentence description, price)
If restaurant: VERIFY you have 12-20+ complete menu items (each with name, ingredients description, price)
If SaaS/tech: VERIFY you have 4-6+ complete features AND 3 pricing tiers with feature lists
If portfolio/photographer: VERIFY you have:
  → 8-12+ gallery items with detailed image alt text (20-40 words each)
  → About section with 3-4 FULL paragraphs (not 1-2 sentences)
  → Each gallery item has a caption or category name
  → Optional: Services section with photography packages and prices
  → Optional: 3+ client testimonials with full names
If business/corporate: VERIFY you have 4-6+ complete service descriptions

═══════════════════════════════════════════════════════════════

═══════════════════════════════════════════════════════════════
🚨 COMMON MISTAKES TO AVOID (DON'T DO THESE)
═══════════════════════════════════════════════════════════════

❌ MISTAKE 1: Using more than 6 images
   ✅ FIX: Count your POLLINATIONS_IMG_X tags. If > 6, delete extras.

❌ MISTAKE 2: Forgetting overflow-x: hidden on html and body
   ✅ FIX: Add to first CSS rule: html, body { overflow-x: hidden; max-width: 100vw; }

❌ MISTAKE 3: Mobile menu that doesn't work
   ✅ FIX: Include complete JavaScript with event listeners for open, close, and link clicks

❌ MISTAKE 4: Fixed pixel widths that break mobile (width: 1400px)
   ✅ FIX: Use max-width: 1200px; width: 100%; or just max-width: 100%;

❌ MISTAKE 5: Images without max-width: 100%
   ✅ FIX: Add global CSS: img { max-width: 100%; height: auto; display: block; }

❌ MISTAKE 6: Desktop-only navigation (no hamburger menu on mobile)
   ✅ FIX: Add @media (max-width: 767px) to show hamburger, hide desktop nav

❌ MISTAKE 7: Using var, ==, or no semicolons in JavaScript
   ✅ FIX: const/let, ===, semicolons everywhere

❌ MISTAKE 8: Skipping image numbers (IMG_1, IMG_3, IMG_7)
   ✅ FIX: Number sequentially: IMG_1, IMG_2, IMG_3, IMG_4, IMG_5, IMG_6

❌ MISTAKE 9: Forgetting loading="lazy" on images
   ✅ FIX: Add to all <img> tags: loading="lazy" (except hero can be loading="eager")

❌ MISTAKE 10: No viewport meta tag
   ✅ FIX: Add to <head>: <meta name="viewport" content="width=device-width, initial-scale=1.0">

❌ MISTAKE 11: Animations using top/left/width/height (causes jank)
   ✅ FIX: Use transform and opacity only: transform: translateY(-8px);

❌ MISTAKE 12: Empty paragraphs or placeholder text
   ✅ FIX: Write complete 2-3 sentence descriptions for everything

❌ MISTAKE 13: Missing mobile menu JavaScript
   ✅ FIX: Copy the complete mobile menu code from the template above

❌ MISTAKE 14: Not testing the final HTML mentally
   ✅ FIX: Before returning, mentally scroll through and check each section

❌ MISTAKE 15: Skipping the 60-point validation checklist
   ✅ FIX: GO THROUGH EVERY ITEM. It takes 2 minutes and prevents all issues.

═══════════════════════════════════════════════════════════════

This is a REAL website for a REAL user. Quality and attention to detail matter.

Every requirement in this prompt exists because it solves a real problem:
- Overflow issues frustrate users on mobile devices
- Broken mobile menus make navigation impossible
- Too many images slow page load and waste bandwidth
- Placeholder content looks unprofessional and incomplete
- Poor responsive design loses mobile traffic

Make it PROFESSIONAL. Make it COMPLETE. Make it PERFECT.

═══════════════════════════════════════════════════════════════
🎯 FINAL INSTRUCTION
═══════════════════════════════════════════════════════════════

1. Read and understand ALL requirements above
2. Generate the complete HTML with ALL required sections
3. GO THROUGH THE 60-POINT VALIDATION CHECKLIST (don't skip!)
4. Fix any issues found during validation
5. Return ONLY the raw HTML document

DO NOT include:
- Markdown code fences or backticks
- Explanations or comments outside the HTML
- Apologies or disclaimers
- Anything except the complete HTML document

Return format: Start with <!DOCTYPE html> and end with </html>

NOW GENERATE THE WEBSITE! 🚀`;

// ── helpers ──────────────────────────────────────────────────

function stripFences(text: string): string {
  return text
    .replace(/^```html\s*\n?/i, "")
    .replace(/\n?\s*```\s*$/i, "")
    .trim();
}

/** Pull the text inside every <script>…</script> that has content. */
function extractScripts(html: string): string[] {
  const re = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  const out: string[] = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    if (m[1].trim()) out.push(m[1].trim());
  }
  return out;
}

// ── public types ─────────────────────────────────────────────

export interface WebsiteLintReport {
  passed: boolean;
  errors: number;
  warnings: number;
  messages: LintMessage[];
}

export interface GeneratedWebsite {
  html: string;
  lintReport: WebsiteLintReport;
  attempts: number;
}

// ── lint all <script> blocks in one HTML string ─────────────

async function lintHtml(html: string): Promise<WebsiteLintReport> {
  const scripts = extractScripts(html);
  if (scripts.length === 0) {
    return { passed: true, errors: 0, warnings: 0, messages: [] };
  }

  let messages: LintMessage[] = [];
  let errors = 0;
  let warnings = 0;

  for (const src of scripts) {
    const r = await lintCode(src);
    messages = messages.concat(r.messages);
    errors += r.errorCount;
    warnings += r.warningCount;
  }

  return { passed: errors === 0, errors, warnings, messages };
}

// ── section detection for progress messages ─────────────────

interface SectionMarker {
  pattern: RegExp;
  message: string;
  announced: boolean;
}

function createSectionMarkers(): SectionMarker[] {
  return [
    {
      pattern: /<nav/i,
      message: "Setting up your navigation bar",
      announced: false,
    },
    {
      pattern: /hero|<header/i,
      message: "Designing a stunning hero section",
      announced: false,
    },
    {
      pattern: /<section[^>]*features/i,
      message: "Building your feature highlights",
      announced: false,
    },
    {
      pattern: /<section[^>]*about/i,
      message: "Creating the about section",
      announced: false,
    },
    {
      pattern: /<section[^>]*services/i,
      message: "Adding your services showcase",
      announced: false,
    },
    {
      pattern: /<section[^>]*pricing/i,
      message: "Crafting the pricing table",
      announced: false,
    },
    {
      pattern: /<section[^>]*testimonial/i,
      message: "Adding customer stories",
      announced: false,
    },
    {
      pattern: /<section[^>]*gallery/i,
      message: "Setting up the image gallery",
      announced: false,
    },
    {
      pattern: /<section[^>]*contact/i,
      message: "Creating the contact section",
      announced: false,
    },
    {
      pattern: /<section[^>]*product/i,
      message: "Building your product showcase",
      announced: false,
    },
    {
      pattern: /<section[^>]*menu/i,
      message: "Designing the menu section",
      announced: false,
    },
    {
      pattern: /<section[^>]*team/i,
      message: "Adding your team section",
      announced: false,
    },
    {
      pattern: /<footer/i,
      message: "Finishing with the footer",
      announced: false,
    },
    {
      pattern: /POLLINATIONS_IMG/i,
      message: "Preparing custom images",
      announced: false,
    },
  ];
}

function checkForNewSections(
  html: string,
  markers: SectionMarker[],
  onProgress: (msg: string) => void,
): void {
  for (const marker of markers) {
    if (!marker.announced && marker.pattern.test(html)) {
      marker.announced = true;
      onProgress(marker.message);
    }
  }
}

// ── shared lint → fix loop ───────────────────────────────────

async function runLintFixLoop(
  genAI: GoogleGenerativeAI,
  initialHtml: string,
  contextPrompt: string,
  onProgress?: (msg: string) => void,
): Promise<{ html: string; report: WebsiteLintReport; attempts: number }> {
  let html = initialHtml;
  let attempts = 1;
  let report = await lintHtml(html);

  while (!report.passed && attempts < MAX_LINT_RETRIES) {
    onProgress?.("Polishing the code quality");

    const errorLines = report.messages
      .filter((m) => m.severity === "error")
      .map((m) => `Line ${m.line}: [${m.rule}] ${m.message}`)
      .join("\n");

    const model = genAI.getGenerativeModel({
      model: MODEL,
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: { maxOutputTokens: MAX_TOKENS, temperature: 0.2 },
    });

    const fixPrompt =
      "Original request: " + contextPrompt +
      "\n\nCurrent HTML:\n" + html +
      "\n\nThe JavaScript in the website above has ESLint errors. " +
      "Fix every error listed below and return the COMPLETE corrected HTML.\n\n" +
      errorLines +
      "\n\nRemember: const/let only, === only, no unused variables, semicolons everywhere. " +
      "Return ONLY raw HTML.";

    const result = await model.generateContent(fixPrompt);
    const fixedText = result.response.text();

    html = stripFences(fixedText || html);
    attempts++;
    report = await lintHtml(html);
  }

  return { html, report, attempts };
}

// ── generate with streaming progress ─────────────────────────

export async function generateWebsite(
  prompt: string,
  onProgress?: (message: string) => void,
): Promise<GeneratedWebsite> {
  const genAI = getClient();
  const markers = createSectionMarkers();
  let fullHtml = "";

  // Initial progress
  onProgress?.("Starting to build your website");

  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: { maxOutputTokens: MAX_TOKENS, temperature: 0.7 },
  });

  // Stream the generation to get real-time progress
  const result = await model.generateContentStream(prompt);

  for await (const chunk of result.stream) {
    const text = chunk.text();
    fullHtml += text;
    if (onProgress) {
      checkForNewSections(fullHtml, markers, onProgress);
    }
  }

  const initialHtml = stripFences(fullHtml);

  // Lint fix loop
  const { html, report, attempts } = await runLintFixLoop(
    genAI,
    initialHtml,
    prompt,
    onProgress,
  );

  // Image injection
  onProgress?.("Generating custom AI images");
  const finalHtml = await injectImages(html);

  onProgress?.("Your website is ready!");

  return { html: finalHtml, lintReport: report, attempts };
}

// ── edit (iterative) ─────────────────────────────────────────

export async function editWebsite(
  currentHtml: string,
  editPrompt: string,
): Promise<GeneratedWebsite> {
  const genAI = getClient();
  const strippedHtml = stripImagesForEdit(currentHtml);

  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: { maxOutputTokens: MAX_TOKENS, temperature: 0.5 },
  });

  const result = await model.generateContent(
    "Here is the current website HTML:\n\n" +
    strippedHtml +
    "\n\nEdit request: " +
    editPrompt +
    "\n\nApply the requested changes and return the COMPLETE modified HTML document. " +
    "Keep all existing sections unless explicitly asked to remove them. " +
    "Return ONLY raw HTML. No markdown fences, no explanations.",
  );

  const responseText = result.response.text();
  const editedHtml = stripFences(responseText || strippedHtml);
  const { html, report, attempts } = await runLintFixLoop(
    genAI,
    editedHtml,
    editPrompt,
  );
  const finalHtml = await injectImages(html);
  return { html: finalHtml, lintReport: report, attempts };
}
