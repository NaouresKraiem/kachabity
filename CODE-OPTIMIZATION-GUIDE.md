# 🧹 Code Optimization & Cleanup Guide

## ✅ Optimizations Completed

### 1. **Created Development-Only Logger** (`lib/logger.ts`)
- Console logs now only appear in development
- Production builds are cleaner and faster
- Error logging still works in production for monitoring

**Usage:**
```typescript
import { logger, logError } from '@/lib/logger';

// Development only
logger.log('Debug info:', data);

// Always logged (for error tracking)
logError(error, 'ProductFetch');
```

### 2. **Removed Console Logs from Products Page**
- Removed 4 console.log statements
- Cleaner code
- Better performance

---

## 🎯 Remaining Optimizations Needed

### **High Priority**

#### 1. Replace All console.log with logger
**Found:** 174 console statements across 41 files

**Quick Fix Script:**
```bash
# Create a script to find all console.logs
grep -r "console\.\(log\|error\)" --include="*.tsx" --include="*.ts" landing/app/ landing/components/ landing/lib/
```

**Files with Most console.logs:**
- `app/api/products/route.ts` - 24 statements
- `app/[locale]/products/page.tsx` - 11 statements (fixed!)
- `app/admin/products/page.tsx` - 10 statements
- `app/admin/products/[id]/edit/page.tsx` - 8 statements

**Recommendation:** Replace gradually, starting with API routes.

#### 2. Add React.memo to Heavy Components
Components that re-render frequently:

```typescript
// ProductListCard.tsx
export default React.memo(function ProductListCard(props) {
    // ... component code
}, (prevProps, nextProps) => {
    // Custom comparison
    return prevProps.product.id === nextProps.product.id &&
           prevProps.isFavorite === nextProps.isFavorite;
});
```

**Files to optimize:**
- `components/products/ProductListCard.tsx`
- `components/products/ProductCard.tsx`  
- `components/products/PromoProductCard.tsx`
- `components/cart/CartItem.tsx`

#### 3. Optimize Image Loading
**Current:** Not using Next.js Image optimization everywhere

**Fix:**
```typescript
// Replace AntImage with Next.js Image
import Image from 'next/image';

<Image
    src={product.image}
    alt={product.name}
    width={300}
    height={300}
    loading="lazy"
    quality={75}
/>
```

**Files to update:**
- `app/[locale]/products/[slug]/page.tsx` - Currently uses AntImage
- All product card components

---

### **Medium Priority**

#### 4. Create Shared Utility Functions
**Repeated Code Found:**

**A. Get Product Name by Locale**
Used in multiple files:
```typescript
// Create: lib/product-utils.ts
export function getProductName(product: any, locale: string): string {
    if (locale === 'ar' && product.name_ar) return product.name_ar;
    if (locale === 'fr' && product.name_fr) return product.name_fr;
    return product.name;
}

export function getProductDescription(product: any, locale: string): string {
    if (locale === 'ar' && product.description_ar) return product.description_ar;
    if (locale === 'fr' && product.description_fr) return product.description_fr;
    return product.description || '';
}

export function getCategoryName(category: any, locale: string): string {
    if (locale === 'ar' && category.name_ar) return category.name_ar;
    if (locale === 'fr' && category.name_fr) return category.name_fr;
    return category.name;
}
```

**B. Format Price**
Repeated across components:
```typescript
// lib/format-utils.ts
export function formatPrice(price: number, currency: string = 'DZD'): string {
    return `${Math.round(price)} ${currency}`;
}

export function formatDiscount(price: number, discount: number): {
    originalPrice: number;
    discountedPrice: number;
    savings: number;
} {
    const discountedPrice = price * (1 - discount / 100);
    return {
        originalPrice: price,
        discountedPrice: Math.round(discountedPrice),
        savings: Math.round(price - discountedPrice)
    };
}
```

#### 5. Split Large Components
**Files > 500 lines:**
- `app/[locale]/products/[slug]/page.tsx` - **1353 lines!** 
- `app/admin/products/[id]/edit/page.tsx` - **829 lines**
- `app/[locale]/products/page.tsx` - **760 lines**

**Recommendation:** Split into smaller components:
```
products/[slug]/
  ├── page.tsx (main layout)
  ├── components/
  │   ├── ProductImageGallery.tsx
  │   ├── ProductInfo.tsx
  │   ├── ProductVariantSelector.tsx
  │   ├── ProductActions.tsx
  │   └── ProductReviews.tsx
```

#### 6. Remove Unused Imports
Run ESLint to find unused imports:
```bash
npm run lint
```

---

### **Low Priority**

#### 7. Add Error Boundaries
Wrap major sections with error boundaries:
```typescript
// components/ui/ErrorBoundary.tsx (already exists!)
// Use it more widely:

<ErrorBoundary>
    <ProductGrid />
</ErrorBoundary>
```

#### 8. Implement React Query
For better data fetching and caching:
```bash
npm install @tanstack/react-query
```

#### 9. Code Organization
**Recommendation:**
```
lib/
  ├── utils/
  │   ├── product-utils.ts    # Product helpers
  │   ├── format-utils.ts     # Formatting functions
  │   ├── image-utils.ts      # Image helpers
  │   └── api-utils.ts        # API helpers
  ├── hooks/
  │   ├── useProducts.ts      # Product fetching hook
  │   ├── useCart.ts          # Cart hook (exists)
  │   └── useFavorites.ts     # Favorites hook
  └── constants/
      ├── routes.ts           # Route constants
      └── config.ts           # App config
```

---

## 📊 Quick Wins Checklist

### Week 1: Essential Optimizations
- [x] Create logger utility
- [x] Remove console.logs from products page
- [ ] Replace console.logs in API routes
- [ ] Add React.memo to product cards
- [ ] Create shared utility functions

### Week 2: Performance Improvements  
- [ ] Optimize images (use Next.js Image)
- [ ] Add database indexes (done in performance guide!)
- [ ] Implement caching (done in performance guide!)
- [ ] Split large components

### Week 3: Code Quality
- [ ] Remove unused imports
- [ ] Add error boundaries
- [ ] Organize utility functions
- [ ] Add TypeScript strict mode

---

## 🔧 Tools to Use

### 1. **Find Console Logs**
```bash
# Find all console.logs
grep -r "console\.log" landing/app/ landing/components/ | wc -l

# Find in specific directory
grep -r "console\." landing/app/api/ --include="*.ts"
```

### 2. **Find Unused Code**
```bash
npm install -g depcheck
depcheck
```

### 3. **Bundle Analysis**
```bash
npm run build
# Check .next/build-manifest.json for bundle sizes
```

### 4. **Performance Monitoring**
```bash
npm install @vercel/speed-insights
```

---

## 📈 Expected Results

After implementing all optimizations:

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Bundle Size | ~2MB | ~1.5MB | 25% smaller |
| Initial Load | 4-6s | 2-3s | 50% faster |
| Console Noise | 174 logs | 0 logs | 100% cleaner |
| Code Reuse | Low | High | Better DRY |
| Maintainability | Hard | Easy | Much better |

---

## 💡 Best Practices Going Forward

### 1. **Before Committing Code:**
- [ ] Remove console.logs
- [ ] Check for unused imports
- [ ] Run linter
- [ ] Test on slow network

### 2. **When Creating Components:**
- [ ] Keep under 300 lines
- [ ] Extract repeated logic
- [ ] Use TypeScript properly
- [ ] Add React.memo if heavy

### 3. **When Fetching Data:**
- [ ] Use caching
- [ ] Handle errors properly
- [ ] Show loading states
- [ ] Optimize queries

---

## 🚨 Anti-Patterns to Avoid

### ❌ Don't Do This:
```typescript
// Large components
function ProductPage() {
    // 1000+ lines of code...
}

// Console logs in production
console.log('User data:', userData);

// Repeated code
function Component1() {
    const name = locale === 'ar' ? product.name_ar : product.name;
}
function Component2() {
    const name = locale === 'ar' ? product.name_ar : product.name;
}

// No loading states
setProducts(data); // What if loading?

// Poor error handling
} catch (error) {
    // Do nothing
}
```

### ✅ Do This Instead:
```typescript
// Small, focused components
function ProductInfo() { /* 50 lines */ }
function ProductImages() { /* 80 lines */ }

// Logger utility
logger.log('Debug:', data);

// Shared utilities
const name = getProductName(product, locale);

// Proper loading states
{loading ? <Spinner /> : <Products />}

// Good error handling
} catch (error) {
    logError(error, 'ProductFetch');
    showError('Failed to load products');
}
```

---

## 📞 Need Help?

If you're unsure about any optimization:
1. Start with "High Priority" items
2. Test after each change
3. Use the logger utility
4. Keep components small
5. Reuse code with utilities

Good luck cleaning up the code! 🚀

