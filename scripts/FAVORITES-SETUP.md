# Favorites/Wishlist System Setup

## Overview
Complete favorites (wishlist/saved items) system that allows users to save products for later viewing.

## Features ✅
- Save/unsave products
- View all saved items in Settings page
- Product details with images, ratings, prices
- Remove items from saved list
- Stock status display
- Direct links to product pages

## Database Setup

### Step 1: Create the Favorites Table

Run this SQL in your Supabase SQL Editor:

```sql
-- File: scripts/create-favorites-table.sql
```

This creates:
- `user_favorites` table
- Indexes for performance
- Row Level Security policies
- Helper functions

### Step 2: Verify Table Creation

```sql
SELECT * FROM user_favorites LIMIT 1;
```

Should return empty result (no errors).

## How It Works

### 1. Database Structure

```sql
user_favorites
├── id (UUID)
├── user_id (UUID) → references auth.users
├── product_id (UUID) → references products
├── created_at (timestamp)
└── UNIQUE(user_id, product_id) ← prevents duplicates
```

### 2. Frontend Integration

**Library Functions** (`lib/favorites.ts`):
- `addToFavorites(userId, productId)` - Add to favorites
- `removeFromFavorites(userId, productId)` - Remove from favorites
- `toggleFavorite(userId, productId)` - Toggle favorite status
- `getUserFavorites(userId)` - Get all user favorites with product details
- `isProductFavorited(userId, productId)` - Check if favorited

**Settings Page** (`app/[locale]/settings/page.tsx`):
- "Saved Items" tab displays all favorites
- Product cards with images, ratings, prices
- Remove button on each card
- View product button

### 3. Usage Example

#### Add to Favorites
```typescript
import { addToFavorites } from '@/lib/favorites';

const handleAddFavorite = async () => {
  const { success, error } = await addToFavorites(userId, productId);
  if (success) {
    // Update UI
  }
};
```

#### Get User Favorites
```typescript
import { getUserFavorites } from '@/lib/favorites';

const { favorites, error } = await getUserFavorites(userId);
// favorites = array of FavoriteWithProduct objects
```

#### Toggle Favorite (Recommended)
```typescript
import { toggleFavorite } from '@/lib/favorites';

const handleToggleFavorite = async () => {
  const { isFavorited, error } = await toggleFavorite(userId, productId);
  // Returns new favorite status
};
```

## Integration Points

### 1. Product Cards
Add a heart icon button to product cards:

```typescript
<button onClick={() => toggleFavorite(userId, product.id)}>
  <HeartIcon fill={isFavorited ? "red" : "none"} />
</button>
```

### 2. Product Detail Page
Add "Save to Favorites" button:

```typescript
<button onClick={() => addToFavorites(userId, productId)}>
  Save for Later
</button>
```

### 3. Settings Page
Already integrated! The "Saved Items" tab shows all favorites.

## Security

### Row Level Security (RLS)
Automatically enabled with policies:

1. **SELECT**: Users can only see their own favorites
2. **INSERT**: Users can only add their own favorites
3. **DELETE**: Users can only delete their own favorites

### Authentication Required
All operations require authenticated user. Guest users cannot save favorites.

## Testing

### 1. Create Test Data
```sql
-- Get a user ID
SELECT id FROM auth.users LIMIT 1;

-- Get a product ID
SELECT id FROM products LIMIT 1;

-- Add to favorites
INSERT INTO user_favorites (user_id, product_id)
VALUES ('user-id-here', 'product-id-here');
```

### 2. Test in UI
1. Login to your account
2. Browse products
3. Click heart/favorite icon (if integrated on product pages)
4. Go to **Settings → Saved Items**
5. View your favorites
6. Click "Remove" to remove a favorite
7. Click "View" to go to product page

### 3. Verify Data
```sql
-- Check favorites for a user
SELECT f.*, p.title, p.image_url, p.price_cents
FROM user_favorites f
JOIN products p ON f.product_id = p.id
WHERE f.user_id = 'your-user-id'
ORDER BY f.created_at DESC;
```

## What's Included

### Files Created:
1. ✅ `scripts/create-favorites-table.sql` - Database schema
2. ✅ `lib/favorites.ts` - TypeScript utilities
3. ✅ `app/[locale]/settings/page.tsx` - UI integration (updated)

### Features Implemented:
- ✅ Database table with RLS
- ✅ Add/remove/toggle operations
- ✅ Fetch favorites with product details
- ✅ Display in Settings → Saved Items
- ✅ Remove from favorites button
- ✅ Product cards with ratings, prices, stock status
- ✅ Loading states
- ✅ Empty states
- ✅ Multi-language support

## Next Steps (Optional)

### 1. Add to Product Cards
Update your product card components to include a favorite button:

```typescript
const [isFavorited, setIsFavorited] = useState(false);

const handleToggle = async () => {
  const { isFavorited: newStatus } = await toggleFavorite(userId, productId);
  setIsFavorited(newStatus);
};

<button onClick={handleToggle}>
  <svg className={isFavorited ? 'fill-red-500' : 'fill-none'}>
    {/* Heart icon */}
  </svg>
</button>
```

### 2. Add Favorites Count
Show how many users favorited a product:

```typescript
import { getProductFavoriteCount } from '@/lib/favorites';

const count = await getProductFavoriteCount(productId);
// Display: "❤️ 15 people love this"
```

### 3. Bulk Operations
Add "Add all to cart" button in Saved Items tab.

### 4. Notifications
Notify users when favorited products go on sale or back in stock.

## Troubleshooting

### Favorites not showing?
1. Check if `user_favorites` table exists
2. Verify user is authenticated
3. Check console for errors
4. Verify products table has required fields

### Can't add to favorites?
1. Check RLS policies are enabled
2. Verify user has valid auth token
3. Check product exists in products table

### Duplicates?
Should be prevented by UNIQUE constraint. If you see duplicates, rebuild the table.

---

**Status**: ✅ Complete and Ready to Use  
**Database Required**: Run `create-favorites-table.sql`  
**Frontend**: Already integrated in Settings page

