# Hero Section - Dual Images Guide

## 🎨 Overview

Your hero section now supports **2 separate images**:

1. **Background Image** (`background_image_url`) - Full scene with background
2. **Product Image** (`image_url`) - Person/product with transparent background (PNG)

This creates a professional layered effect! 🚀

---

## 📊 How It Works

### Image Priority:
```
Background: background_image_url → image_url → fallback
Foreground: image_url (person/product with transparent BG)
```

### Visual Structure:
```
┌─────────────────────────────────────┐
│  [Background Image - Full Scene]    │
│  ┌─────────────────────────────┐   │
│  │ Gradient Overlay            │   │
│  │ (for text readability)      │   │
│  │                             │   │
│  │  Text Content      [Person] │   │  ← PNG with no BG
│  │                      with   │   │
│  │                    no BG    │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

---

## 🚀 Setup Instructions

### Step 1: Run Database Migration

In Supabase SQL Editor:
```sql
-- Add background_image_url column
ALTER TABLE public.hero_sections 
ADD COLUMN IF NOT EXISTS background_image_url TEXT;
```

Or run the script:
```bash
scripts/add-hero-background-image.sql
```

### Step 2: Prepare Your Images

#### Background Image (Full Scene):
- ✅ **Format**: JPG or PNG
- ✅ **Size**: 1200x400px or larger
- ✅ **Content**: Full scene with background
- ✅ **Example**: Room, landscape, studio with background

#### Product Image (Transparent):
- ✅ **Format**: PNG (with transparency)
- ✅ **Size**: 500x700px or larger
- ✅ **Content**: Person or product ONLY
- ❌ **No background** - use tools to remove it

### Step 3: Remove Image Backgrounds

Use these free tools to remove backgrounds:

1. **Remove.bg** - https://remove.bg (Best quality)
2. **PhotoRoom** - https://photoroom.com
3. **Canva** - Built-in background remover
4. **Photoshop** - Remove background tool
5. **GIMP** (Free) - Manual selection

### Step 4: Upload to Supabase Storage

1. Go to Supabase Dashboard → Storage
2. Create/use bucket: `hero-images`
3. Upload both images:
   - `background-quachabia.jpg`
   - `person-quachabia.png` (transparent)

### Step 5: Update Database

```sql
-- Update carousel slide with both images
UPDATE public.hero_sections 
SET 
    background_image_url = 'https://your-supabase.co/storage/v1/object/public/hero-images/background-quachabia.jpg',
    image_url = 'https://your-supabase.co/storage/v1/object/public/hero-images/person-quachabia.png'
WHERE sort_order = 0;
```

---

## 💡 Usage Examples

### Example 1: Fashion Store (Quachabia)

```sql
UPDATE hero_sections SET
    title = 'Top Saled',
    subtitle = 'Quachabia',
    sub_subtitle = 'Handmade',
    background_image_url = 'https://[...]/traditional-room-background.jpg',
    image_url = 'https://[...]/person-wearing-quachabia.png',
    cta_label = 'Buy Now',
    cta_href = '/products/quachabia'
WHERE sort_order = 0;
```

**Result:**
- Background: Traditional Tunisian room
- Foreground: Person wearing Quachabia (no background)
- Text overlay with gradient

### Example 2: Home Decor

```sql
UPDATE hero_sections SET
    title = 'New Arrival',
    subtitle = 'Ceramic Collection',
    sub_subtitle = 'Handcrafted',
    background_image_url = 'https://[...]/workshop-background.jpg',
    image_url = 'https://[...]/ceramic-vase.png',
    cta_label = 'Shop Now',
    cta_href = '/products/ceramics'
WHERE sort_order = 1;
```

**Result:**
- Background: Artisan workshop
- Foreground: Ceramic vase (no background)

---

## 🎨 Design Best Practices

### Background Images:
- ✅ Use lifestyle photos (rooms, workshops, outdoor scenes)
- ✅ Keep it slightly blurred or subtle
- ✅ Ensure colors match your brand
- ❌ Avoid busy patterns that compete with text
- ❌ Don't use images that are too bright on the left side

### Product Images (Transparent):
- ✅ High resolution (at least 500x700px)
- ✅ Good lighting and sharp focus
- ✅ Clean edges after background removal
- ✅ Center the subject in the image
- ❌ Avoid shadows from old background
- ❌ Don't make images too large (file size)

### Text Readability:
- The gradient overlay ensures text is always readable
- Left side: 95% opacity (solid color)
- Middle: 60% opacity (transition)
- Right side: Transparent (shows background)

---

## 🔧 Advanced Options

### Option 1: Use Same Image for Both (Backward Compatible)

If you only have one image:
```sql
UPDATE hero_sections 
SET image_url = 'your-image.jpg'
WHERE sort_order = 0;
-- background_image_url is NULL, so it uses image_url for both
```

### Option 2: No Background Image (Solid Color)

Keep `background_image_url` NULL and the overlay color will show:
```sql
UPDATE hero_sections 
SET 
    image_url = 'person.png',
    background_image_url = NULL
WHERE sort_order = 0;
-- Will show #F4D3C6 color as background
```

### Option 3: Change Overlay Color

Edit `HeroSection.tsx` line 139:
```tsx
// Change from peach to another color
<div className="absolute inset-0 bg-linear-to-r from-[#YOUR_COLOR]/95 via-[#YOUR_COLOR]/60 to-transparent"></div>
```

---

## 📦 Quick Setup Checklist

- [ ] Run database migration (add `background_image_url` column)
- [ ] Remove background from product/person images
- [ ] Save as PNG with transparency
- [ ] Upload background image (JPG)
- [ ] Upload product image (PNG)
- [ ] Get both URLs from Supabase Storage
- [ ] Update database with both URLs
- [ ] Test on your site
- [ ] Check mobile responsiveness

---

## 🖼️ Image Optimization Tips

### Compress Images:
- **Background JPG**: Use TinyPNG or ImageOptim
- **Product PNG**: Compress but keep transparency
- Target size: < 200KB per image

### Recommended Dimensions:
```
Background Image (JPG):
- Desktop: 1400x400px
- Mobile: Same image works (responsive)

Product Image (PNG):
- Height: 700px
- Width: 400-500px
- Maintain aspect ratio
```

### Tools for Optimization:
1. **TinyPNG** - https://tinypng.com
2. **Squoosh** - https://squoosh.app
3. **ImageOptim** (Mac) - Free app
4. **Photoshop** - Export for Web

---

## 🎯 Example Workflow

1. **Take/Find Photos**:
   - Background: Photoshoot location
   - Person: Same photoshoot with good lighting

2. **Edit Background Photo**:
   - Crop to 1400x400px
   - Adjust brightness/contrast
   - Save as JPG (compress to <150KB)

3. **Edit Person Photo**:
   - Remove background using Remove.bg
   - Save as PNG with transparency
   - Compress to <100KB

4. **Upload to Supabase**:
   - Create `hero-images` bucket (public)
   - Upload both images
   - Copy URLs

5. **Update Database**:
   ```sql
   UPDATE hero_sections SET
       background_image_url = 'background-url',
       image_url = 'person-url'
   WHERE sort_order = 0;
   ```

6. **Test**:
   - View on site
   - Check mobile
   - Verify text is readable
   - Test different screen sizes

---

## 🆘 Troubleshooting

### Issue: White halo around person/product

**Solution:**
- Use better background removal tool (Remove.bg)
- Manually clean edges in Photoshop/GIMP
- Use "Refine Edge" tool in Photoshop

### Issue: Image too small/stretched

**Solution:**
```sql
-- Check image dimensions
-- Product image should be at least 500x700px
```

### Issue: Text not readable

**Solution:**
- Use darker background image
- Increase overlay opacity in code:
```tsx
from-[#F4D3C6]/98 via-[#F4D3C6]/80 to-transparent
```

### Issue: Background image doesn't show

**Solution:**
- Check URL is correct and accessible
- Verify image is in public bucket
- Check browser console for errors

---

## 🎉 Result

With dual images, your hero section will look:
- ✅ More professional
- ✅ More dynamic
- ✅ Better visual separation
- ✅ Cleaner product presentation
- ✅ Like high-end e-commerce sites!

---

**Need help?** Check the code in `/components/sections/HeroSection.tsx` lines 129-175

