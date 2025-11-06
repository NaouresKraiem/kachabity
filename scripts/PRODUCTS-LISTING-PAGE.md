# Products Listing Page - Documentation

## Overview

A comprehensive products listing page with advanced filtering capabilities, exactly matching your design.

## 🎯 Features Implemented

### Left Sidebar - Filters
✅ **Price Range Slider**
- Interactive slider (0-1000 TND)
- Real-time filtering
- Visual feedback

✅ **Size Filter**
- Button grid: S, M, L, XL, XXL, XXXL, 4XL
- Multiple selection
- Active state highlighting

✅ **Color Filter**
- Visual color swatches
- Circular buttons with colors
- Multiple selection support
- 4 default colors (Gold, Teal, Beige, Purple)

✅ **Category Filter**
- Checkbox list
- Scrollable for many categories
- Loads from database
- URL parameter support

✅ **Filter Button**
- Apply filters
- Automatic real-time filtering

### Right Side - Product Grid
✅ **Product Cards** (4 columns on desktop)
- Product image with hover effect
- Discount badge (top-left)
- Wishlist heart button (top-right)
- Product name
- 5-star rating + review count
- Price display (with discount)
- Quick "Add to Cart" button

✅ **Grid Features**
- Responsive: 1 col (mobile) → 4 cols (desktop)
- Hover effects and transitions
- Empty state when no results
- Results count display

✅ **Other Features**
- Multi-language support (EN, FR, AR)
- URL parameter filtering (e.g., ?category=fouta)
- Wishlist toggle functionality
- Direct link to product detail page

## 📁 File Structure

```
app/[locale]/products/
├── page.tsx              ← Products listing page
└── [slug]/
    └── page.tsx          ← Product detail page
```

## 🚀 How to Use

### Access the Page

```
http://localhost:3000/en/products
http://localhost:3000/fr/products
http://localhost:3000/ar/products
```

### Filter by Category (URL)

```
http://localhost:3000/en/products?category=fouta
http://localhost:3000/en/products?category=traditional-wear
```

## 🎨 Customization

### Change Filter Colors

Edit the `FILTER_COLORS` array in the component:

```typescript
const FILTER_COLORS = [
    { name: "Red", value: "#FF0000" },
    { name: "Blue", value: "#0000FF" },
    { name: "Green", value: "#00FF00" },
    { name: "Yellow", value: "#FFFF00" }
];
```

### Change Available Sizes

Edit the `SIZES` array:

```typescript
const SIZES = ["XS", "S", "M", "L", "XL", "2XL", "3XL"];
```

### Adjust Price Range

Change the min/max values in the price slider:

```typescript
<input
    type="range"
    min="0"
    max="2000"  // Change this
    ...
/>
```

### Change Grid Columns

Modify the grid classes:

```typescript
// Current: 1 col → 2 → 3 → 4
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">

// Example: 1 col → 2 → 3
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
```

## 🔍 Filtering Logic

### How Filters Work

All filters work together (AND logic):

```
Product must match ALL of:
- Price: within range
- Size: has at least one selected size (if any selected)
- Color: has at least one selected color (if any selected)
- Category: matches selected category (if any selected)
```

### Filter Implementation

```typescript
const filteredProducts = products.filter(product => {
    // Price filter
    if (product.price_cents < priceRange[0] || product.price_cents > priceRange[1]) {
        return false;
    }

    // Size filter (if any sizes selected)
    if (selectedSizes.size > 0) {
        if (!product.sizes || !product.sizes.some(size => selectedSizes.has(size))) {
            return false;
        }
    }

    // Color filter (if any colors selected)
    if (selectedColors.size > 0) {
        if (!product.colors || !product.colors.some(color => selectedColors.has(color))) {
            return false;
        }
    }

    // Category filter (if any categories selected)
    if (selectedCategories.size > 0) {
        if (!product.category || !selectedCategories.has(product.category)) {
            return false;
        }
    }

    return true;
});
```

## 🎭 Wishlist Feature

### How It Works

1. Click the heart icon on any product
2. Heart fills with red color
3. State saved in component (can be extended to localStorage/database)

### Extend to Persistent Storage

```typescript
// Save to localStorage
const toggleWishlist = (productId: string) => {
    setWishlist(prev => {
        const newSet = new Set(prev);
        if (newSet.has(productId)) {
            newSet.delete(productId);
        } else {
            newSet.add(productId);
        }
        
        // Save to localStorage
        localStorage.setItem('wishlist', JSON.stringify(Array.from(newSet)));
        
        return newSet;
    });
};

// Load from localStorage on mount
useEffect(() => {
    const saved = localStorage.getItem('wishlist');
    if (saved) {
        setWishlist(new Set(JSON.parse(saved)));
    }
}, []);
```

## 🔗 Integration Points

### Link from Homepage

```tsx
<Link href={`/${locale}/products`}>
    View All Products
</Link>
```

### Link from Categories

```tsx
<Link href={`/${locale}/products?category=${category.slug}`}>
    {category.name}
</Link>
```

### Link to Product Detail

```tsx
<Link href={`/${locale}/products/${product.slug}`}>
    View Details
</Link>
```

## 📊 Database Requirements

The page expects products to have these fields:

```sql
-- Required fields
id, title, slug, price_cents, currency, image_url, stock

-- Optional fields (for filtering)
colors TEXT[]       -- Array of color hex codes
sizes TEXT[]        -- Array of size strings
category TEXT       -- Category slug
discount_percent    -- Number (0-100)
rating             -- Decimal (0-5)
review_count       -- Integer
```

## 🎨 Styling

### Main Colors
- Primary: `#842E1B` (brown)
- Hover: `#6b2516` (darker brown)
- Rating: Yellow
- Wishlist Active: Red

### Border Radius
- Cards: `rounded-lg` (8px)
- Buttons: `rounded-lg` (8px)
- Color swatches: `rounded-full`

## 📱 Responsive Breakpoints

```
Mobile:    < 640px  (1 column)
Tablet:    640px+   (2 columns)
Desktop:   1024px+  (3 columns)
Large:     1280px+  (4 columns)
```

## ⚡ Performance Tips

1. **Lazy Loading Images**
   - Next.js Image component automatically optimizes
   - Images lazy-load as user scrolls

2. **Filter Performance**
   - Filters run client-side for instant feedback
   - Can be optimized with debouncing if needed

3. **Pagination** (Future Enhancement)
   ```typescript
   // Add pagination
   const ITEMS_PER_PAGE = 12;
   const [page, setPage] = useState(1);
   
   const paginatedProducts = filteredProducts.slice(
       (page - 1) * ITEMS_PER_PAGE,
       page * ITEMS_PER_PAGE
   );
   ```

## 🐛 Troubleshooting

**No products showing?**
- Check if products exist in database
- Verify products have required fields
- Check filter selections aren't too restrictive

**Categories not loading?**
- Verify categories table exists
- Check Supabase connection
- Look for console errors

**Filters not working?**
- Ensure products have color/size/category data
- Check array format in database
- Verify filter state is updating

**Images not loading?**
- Check image URLs in database
- Verify images exist in public folder or external URL

## 🚀 Next Steps

Consider adding:
- [ ] Pagination or infinite scroll
- [ ] Sort options (price, rating, newest)
- [ ] Grid/List view toggle
- [ ] Save filters to URL params
- [ ] Compare products feature
- [ ] Quick view modal
- [ ] Persistent wishlist (localStorage/database)
- [ ] Search functionality
- [ ] Recently viewed products

## 📞 Support

For issues or questions, contact: Kachabity@gmail.com

