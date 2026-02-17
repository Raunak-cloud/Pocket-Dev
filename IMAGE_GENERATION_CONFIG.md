# Image Generation Configuration

## Model: prunaai/z-image-turbo

**Speed**: ~2-3 seconds per image
**Quality**: SDXL-based, photorealistic
**Cost**: ~$0.002 per image

---

## Supported Resolutions

The `z-image-turbo` model supports multiple resolutions. **Currently using: 1024x1024**

### Available Options:

| Resolution | Aspect Ratio | Best For | Speed |
|------------|--------------|----------|-------|
| **768x768** | Square (1:1) | Avatars, logos, icons | Fastest |
| **1024x1024** ✅ | Square (1:1) | Product shots, portraits | Fast (current) |
| **1152x896** | Landscape (9:7) | Websites, banners | Fast |
| **896x1152** | Portrait (7:9) | Mobile screens, posters | Fast |
| **1216x832** | Wide (3:2) | Hero images, landscapes | Medium |
| **832x1216** | Tall (2:3) | Stories, vertical content | Medium |

**Currently configured**: `1024x1024` (best balance of quality & speed)

---

## How to Change Resolution

### Option 1: Edit the Code (Recommended)

**File**: `lib/server/persist-generated-images.ts`

```typescript
// Change these values:
const DEFAULT_IMAGE_WIDTH = 1024;  // Change to 1152, 1216, etc.
const DEFAULT_IMAGE_HEIGHT = 1024; // Change to 896, 832, etc.
```

### Option 2: Environment Variable

Add to `.env.local`:
```bash
# Override default resolution
IMAGE_WIDTH=1152
IMAGE_HEIGHT=896
```

Then update the code to read these values:
```typescript
const DEFAULT_IMAGE_WIDTH = parseInt(process.env.IMAGE_WIDTH || "1024");
const DEFAULT_IMAGE_HEIGHT = parseInt(process.env.IMAGE_HEIGHT || "1024");
```

---

## Alternative Models

If you want different models, set in `.env.local`:

### Higher Quality (Slower):
```bash
REPLICATE_IMAGE_MODEL=black-forest-labs/flux-1.1-pro
# Resolution: up to 1440x1440
# Speed: ~8-12 seconds per image
# Cost: ~$0.04 per image
# Quality: Best (photorealism)
```

### Faster (Lower Quality):
```bash
REPLICATE_IMAGE_MODEL=stability-ai/sdxl-turbo
# Resolution: 512x512
# Speed: ~1 second per image
# Cost: ~$0.001 per image
# Quality: Good (less detail)
```

### Specialized:
```bash
# For portraits:
REPLICATE_IMAGE_MODEL=lucataco/realvisxl-v4.0-lightning

# For products:
REPLICATE_IMAGE_MODEL=bytedance/sdxl-lightning-4step

# For food:
REPLICATE_IMAGE_MODEL=mcai/food-specialist-sdxl
```

---

## Current Configuration Summary

```yaml
Model: prunaai/z-image-turbo
Resolution: 1024x1024
Quality: High (SDXL-based)
Speed: ~2-3 seconds per image
Cost: ~$0.002 per image
Retry Logic: Yes (10 attempts with 10s delays)
Rate Limit Handling: Aggressive retries
Fallback: SVG placeholders (only if all retries fail)
```

---

## Customizing Prompts

**File**: `lib/server/persist-generated-images.ts`

### Theme-Based Prompts:

```typescript
function getThemeDefaultPrompt(theme: SiteTheme): string {
  if (theme === "food") {
    return "Professional food photography, beautifully plated dish...";
  }
  // Add your custom themes here
}
```

### Style Direction:

```typescript
function getStyleDirection(base: string, siteTheme: SiteTheme): string {
  // Controls overall aesthetic
  // Examples: "commercial product photography", "editorial portrait"
}
```

### Photography Technique:

```typescript
function getPhotographyTechnique(siteTheme: SiteTheme): string {
  // Controls camera settings and technique
  // Examples: "shot with 85mm lens, f/2.8 aperture"
}
```

---

## Testing Different Resolutions

To test various resolutions:

1. **Edit** `lib/server/persist-generated-images.ts`
2. **Change** `DEFAULT_IMAGE_WIDTH` and `DEFAULT_IMAGE_HEIGHT`
3. **Restart** your dev server
4. **Generate** a new website
5. **Compare** results

**Recommended for different use cases:**
- **Landing pages**: 1152x896 (landscape)
- **Mobile apps**: 896x1152 (portrait)
- **Product galleries**: 1024x1024 (square)
- **Hero sections**: 1216x832 (wide)

---

## Rate Limits

**Replicate Rate Limits** (as of 2026):
- Free tier: ~50 requests/minute
- Pro tier: ~500 requests/minute

**Current retry strategy:**
```typescript
Max retries: 10 attempts per image
Delay: 10 seconds between retries
Total max wait: 100 seconds per image
Behavior: Continues with other images while rate-limited ones retry
```

---

## Monitoring Image Generation

**Logs to watch:**

```bash
# Success:
[persistGeneratedImagesToStorage] ✓ Successfully generated image 3/5

# Rate limited:
[persistGeneratedImagesToStorage] Rate limited for "REPLICATE_IMG_3", will retry later

# Retrying:
[persistGeneratedImagesToStorage] Retry attempt 2/10 for "REPLICATE_IMG_3"

# Final summary:
[persistGeneratedImagesToStorage] Image generation complete: 5/5 generated (0 fallbacks)
```

---

## Performance Tips

### For Faster Generation:
1. Use smaller resolution (768x768)
2. Reduce retry attempts to 5
3. Use sdxl-turbo model instead

### For Better Quality:
1. Use larger resolution (1216x832)
2. Switch to Flux 1.1 Pro
3. Add more detailed prompts

### For Cost Savings:
1. Cache generated images (already implemented)
2. Reuse images on edits with `preserveExistingImages: true`
3. Use lower-cost models for testing

---

**Last Updated**: February 2026
**Current Model**: prunaai/z-image-turbo @ 1024x1024
