# Admin Product Management

## Overview
A comprehensive admin interface for managing products without writing SQL queries or using Supabase directly.

## Features
✅ **Easy Product Creation** - Simple form-based interface  
✅ **Multi-language Support** - Add titles and descriptions in English, Arabic, and French  
✅ **Image Management** - Main image and multiple additional images  
✅ **Pricing & Discounts** - Set prices, currencies, and discount percentages  
✅ **Inventory Management** - Track stock levels  
✅ **Product Variants** - Select sizes and colors  
✅ **Categories** - Assign products to categories  
✅ **Featured & Promo** - Mark products as featured or promotional  
✅ **Product Details** - Add shipping info, seller info, and product details  
✅ **Edit & Delete** - Full CRUD operations  

## Access
Navigate to: `/{locale}/admin/products`

Example: 
- `http://localhost:3000/en/admin/products`
- `http://localhost:3000/ar/admin/products`

## How to Use

### 1. Creating a New Product

1. Click the **"+ Add New Product"** button
2. Fill in the form using the tabs:

#### **Basic Info Tab**
- **Title (English)*** - Required field
- **Title (Arabic)** - Optional, for Arabic locale
- **Title (French)** - Optional, for French locale
- **Description** - Product description in English
- **Category** - Select from available categories

#### **Pricing & Stock Tab**
- **Price*** - Required, product price
- **Currency** - TND, USD, or EUR
- **Discount Percentage** - Optional, 0-100%
- **Stock*** - Required, available quantity
- **Weight** - Optional, in grams

#### **Media Tab**
- **Main Image URL*** - Required, primary product image
- **Additional Images** - Optional, one URL per line for gallery

#### **Variants Tab**
- **Sizes** - Click to select available sizes (S, M, L, XL, etc.)
- **Colors** - Click color swatches to select available colors

#### **Additional Info Tab**
- **Product Details** - Bullet points, one per line
- **Shipping Information** - Delivery details
- **Seller Information** - Seller/brand name
- **Featured Product** - Toggle to feature on homepage
- **Promotional Product** - Toggle for promo section
- **Promo End Date** - Set when promo expires

3. Click **"Create Product"** to save

### 2. Editing a Product

1. Find the product in the table
2. Click **"Edit"** in the Actions column
3. Modify the fields in the form
4. Click **"Update Product"** to save changes

### 3. Deleting a Product

1. Find the product in the table
2. Click **"Delete"** in the Actions column
3. Confirm the deletion in the popup

## API Endpoints

The system uses these API endpoints (no need to interact with them directly):

- **GET** `/api/admin/products` - Fetch all products
- **POST** `/api/admin/products` - Create a new product
- **PUT** `/api/admin/products` - Update an existing product
- **DELETE** `/api/admin/products?id={id}` - Delete a product
- **GET** `/api/admin/categories` - Fetch categories for dropdown

## Auto-Generated Fields

The system automatically handles:
- **Slug** - Generated from the product title (can be overridden)
- **Created At** - Timestamp when product was created
- **Default Rating** - Set to 4.5 if not specified
- **Review Count** - Set to 0 for new products
- **Sold Count** - Set to 0 for new products

## Tips

1. **Image URLs**: Use full URLs from your CDN or image hosting service
2. **Slugs**: Automatically generated from title but you can customize them
3. **Multi-language**: Add Arabic/French titles for better localization
4. **Categories**: Make sure categories are created in Supabase first
5. **Sizes/Colors**: Select only what's actually available
6. **Product Details**: Use one line per detail point for better formatting

## Examples

### Example Product Data

```
Title: Traditional Ceramic Bowl
Price: 45 TND
Stock: 20
Category: Ceramics
Main Image: https://example.com/bowl.jpg
Sizes: M, L
Colors: #D4AF37 (Gold), #DEB887 (Beige)
Product Details:
- 100% handmade
- Traditional Tunisian craftsmanship
- Dishwasher safe
```

## Troubleshooting

**Problem**: Categories dropdown is empty  
**Solution**: Make sure categories exist in the database

**Problem**: Form not submitting  
**Solution**: Check that all required fields (marked with *) are filled

**Problem**: Image not displaying  
**Solution**: Verify the image URL is publicly accessible

## Security Note

⚠️ This admin panel should be protected with authentication in production. Consider adding middleware to restrict access to authorized users only.


