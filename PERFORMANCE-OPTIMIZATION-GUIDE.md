# 🚀 Performance Optimization Guide

Your application is loading slowly. Here's how to fix it:

## 📊 Current Problems

1. **Slow product page loading** - Takes too long to view a single product
2. **No database indexes** - Every query scans entire tables
3. **No caching** - Data fetched fresh every time
4. **Unoptimized images** - Large image files
5. **Multiple database queries** - Separate calls for products, images, variants

---

## ✅ Quick Fixes (Do These First!)

### 1. **Add Database Indexes** ⚡ (5 minutes)

Run this SQL script in Supabase:

```bash
scripts/add-performance-indexes.sql
```

**Expected improvement:** 3-5x faster queries

### 2. **Enable Next.js Image Optimization** 🖼️

Update `next.config.ts`:

```typescript
const nextConfig = {
    images: {
        domains: [
            'your-supabase-url.supabase.co',
            'images.unsplash.com',
            // Add your image domains here
        ],
        formats: ['image/webp', 'image/avif'],
        deviceSizes: [640, 750, 828, 1080, 1200],
        imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    },
};
```

### 3. **Reduce Image Sizes in Supabase Storage**

When uploading images:
- **Product images:** Max 800x800px, 70-80% quality
- **Thumbnails:** Max 300x300px
- **Banners:** Max 1920x1080px
- **Use WebP format** for 30% smaller file sizes

---

## 🔧 Medium Priority Fixes

### 4. **Implement Server-Side Caching**

I've created two new files:
- `lib/cache.ts` - Simple caching system
- `lib/product-queries-optimized.ts` - Optimized product queries

**To use them:**

Update your products API route to use the optimized queries:

```typescript
// In app/api/products/route.ts
import { getProductsOptimized } from '@/lib/product-queries-optimized';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('category_id');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    const result = await getProductsOptimized({
        categoryId: categoryId || undefined,
        limit,
        offset
    });

    return NextResponse.json(result);
}
```

**Expected improvement:** 50-70% faster page loads

### 5. **Optimize Product Images Query**

Instead of fetching images separately, fetch them with the product in one query:

```typescript
// Single optimized query
const { data } = await supabase
    .from('products')
    .select(`
        *,
        product_images(image_url, is_main, position),
        variants(*)
    `)
    .eq('slug', productSlug)
    .single();
```

---

## 🎯 Advanced Optimizations

### 6. **Use Static Generation for Products**

Convert product pages to Static Site Generation (SSG):

```typescript
// In app/[locale]/products/[slug]/page.tsx
export async function generateStaticParams() {
    const { data: products } = await supabase
        .from('products')
        .select('slug');
    
    return products?.map(p => ({ slug: p.slug })) || [];
}

// Enable revalidation every 1 hour
export const revalidate = 3600;
```

### 7. **Implement React Query** (Optional)

For client-side caching:

```bash
npm install @tanstack/react-query
```

### 8. **Lazy Load Images**

For product grids:

```typescript
<Image
    src={product.image}
    alt={product.name}
    width={300}
    height={300}
    loading="lazy"
    placeholder="blur"
/>
```

### 9. **Reduce JavaScript Bundle Size**

Check your bundle size:

```bash
npm run build
```

Remove unused dependencies and use dynamic imports for heavy components.

---

## 📈 Expected Results

After implementing:

| Optimization | Time Saved | Difficulty |
|-------------|------------|-----------|
| Database Indexes | 60-80% | Easy ⭐ |
| Caching | 40-60% | Medium ⭐⭐ |
| Image Optimization | 30-50% | Easy ⭐ |
| Optimized Queries | 50-70% | Medium ⭐⭐ |
| Static Generation | 70-90% | Hard ⭐⭐⭐ |

---

## 🎯 Action Plan (Do in Order)

### Week 1 - Quick Wins
- [ ] Run `add-performance-indexes.sql` in Supabase
- [ ] Resize all product images to max 800x800px
- [ ] Update next.config.ts with image optimization
- [ ] Test product page load time

### Week 2 - Implement Caching
- [ ] Add cache.ts to your project
- [ ] Update products API to use caching
- [ ] Test and verify caching works
- [ ] Monitor performance improvements

### Week 3 - Advanced Optimizations
- [ ] Implement optimized queries
- [ ] Convert product pages to SSG
- [ ] Lazy load images in product grids
- [ ] Run final performance audit

---

## 🔍 Monitoring Performance

### Check Current Performance:

```bash
# Run Lighthouse audit
npx lighthouse http://localhost:3000/products/your-product --view

# Or use Chrome DevTools > Lighthouse
```

### Target Scores:
- **Performance:** > 90
- **First Contentful Paint:** < 1.5s
- **Largest Contentful Paint:** < 2.5s
- **Time to Interactive:** < 3.5s

---

## 💡 Quick Debug Tips

### If products still load slowly:

1. **Check image sizes:**
   ```bash
   # Images should be < 200KB
   ls -lh public/assets/images/products/
   ```

2. **Check database response time:**
   - Go to Supabase Dashboard
   - Check "Query Performance"
   - Look for slow queries

3. **Check network tab:**
   - Open DevTools > Network
   - Reload product page
   - Look for slow requests (> 1s)

4. **Enable Next.js speed insights:**
   ```bash
   npm install @vercel/speed-insights
   ```

---

## 📞 Need Help?

If performance is still slow after implementing these fixes:

1. Check your server/hosting resources (RAM, CPU)
2. Consider upgrading Supabase plan for better performance
3. Implement a CDN (Cloudflare, Vercel Edge)
4. Consider Redis for caching instead of in-memory

---

## 🎉 Success Metrics

After optimization, you should see:
- Product pages load in **< 2 seconds**
- Image loading time **< 500ms**
- Database queries complete in **< 100ms**
- Overall page load **< 3 seconds**

Good luck! 🚀

