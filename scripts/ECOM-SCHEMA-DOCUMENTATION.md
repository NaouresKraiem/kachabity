# E-Commerce Database Schema Documentation

## Overview

This schema provides a complete, extensible e-commerce database structure with support for:
- Multi-warehouse inventory management
- Flexible product attributes system
- Multiple product images per product/variant
- Shopping cart and order management
- Soft deletes for data retention
- Row Level Security (RLS) policies

## Database Diagram

```
┌─────────────┐
│   Roles     │
└──────┬──────┘
       │
       │ 1:N
┌──────▼──────┐
│   Users     │
└──────┬──────┘
       │
       │ 1:1        1:N
┌──────▼──────┐    ┌─────────────┐
│    Cart     │    │   Orders    │
└──────┬──────┘    └──────┬──────┘
       │                   │
       │ 1:N               │ 1:N
┌──────▼──────┐    ┌──────▼──────────┐
│ Cart_Items  │    │  Order_Items    │
└──────┬──────┘    └──────┬──────────┘
       │                   │
       │ N:1               │ N:1
       └───────┬────────────┘
               │
       ┌───────▼──────────┐
       │ Product_Variants │
       └───────┬──────────┘
               │
               │ N:1
       ┌───────▼──────┐
       │   Products   │
       └───────┬──────┘
               │
               │ N:1
       ┌───────▼──────┐
       │  Categories  │◄──┐
       └───────────────┘   │
                          │ (self-reference)
                          └──────────────┐

┌──────────────┐    ┌─────────────────┐
│  Attributes  │───►│ Attribute_Values│
└──────────────┘    └────────┬────────┘
                             │
                             │ N:M
                    ┌────────▼────────────┐
                    │ Variant_Attributes  │
                    └────────┬────────────┘
                             │
                             │ N:1
                    ┌────────▼──────────┐
                    │ Product_Variants  │
                    └───────────────────┘

┌──────────────┐    ┌──────────────┐
│  Warehouses  │◄───│  Inventory   │
└──────────────┘    └──────┬───────┘
                            │
                            │ N:1
                    ┌───────▼──────────┐
                    │ Product_Variants │
                    └──────────────────┘

┌──────────────┐    ┌──────────────┐
│   Products   │◄───│Product_Images│
└──────────────┘    └──────┬───────┘
                            │
                            │ N:1 (optional)
                    ┌───────▼──────────┐
                    │ Product_Variants │
                    └──────────────────┘
```

## Table Descriptions

### 1. Roles
User roles for access control.
- **id**: Primary key (UUID)
- **name**: Unique role name (admin, customer, manager)
- **description**: Role description

### 2. Users
Application users (customers, admins).
- **id**: Primary key (UUID)
- **name**: User full name
- **email**: Unique email address
- **password**: Hashed password
- **role_id**: Foreign key to Roles
- **phone**: Contact phone number
- **deleted_at**: Soft delete timestamp

### 3. Categories
Product categories with hierarchical support.
- **id**: Primary key (UUID)
- **name**: Category name
- **slug**: URL-friendly identifier
- **parent_id**: Self-referencing for nested categories
- **is_active**: Active status
- **deleted_at**: Soft delete timestamp

### 4. Products
Main products table.
- **id**: Primary key (UUID)
- **name**: Product name
- **slug**: URL-friendly identifier
- **description**: Product description
- **category_id**: Foreign key to Categories
- **base_price**: Base price (can be overridden by variants)
- **status**: Enum (active, inactive, archived)
- **deleted_at**: Soft delete timestamp

### 5. Product_Variants
Product variants (sizes, colors, etc.).
- **id**: Primary key (UUID)
- **product_id**: Foreign key to Products
- **sku**: Stock Keeping Unit (unique)
- **price**: Variant-specific price (NULL = use base_price)
- **stock**: Available stock
- **is_available**: Availability flag
- **deleted_at**: Soft delete timestamp

### 6. Product_Images
Product images with support for multiple main images.
- **id**: Primary key (UUID)
- **product_id**: Foreign key to Products
- **variant_id**: Optional foreign key to Product_Variants
- **image_url**: Image URL
- **is_main**: Main image flag (multiple can be true)
- **position**: Display order

### 7. Attributes
Product attributes (Color, Size, Material, etc.).
- **id**: Primary key (UUID)
- **name**: Attribute name (unique)
- **display_name**: Display name
- **type**: Attribute type (text, number, color, size)
- **is_filterable**: Can be used for filtering

### 8. Attribute_Values
Possible values for attributes.
- **id**: Primary key (UUID)
- **attribute_id**: Foreign key to Attributes
- **value**: Attribute value
- **display_value**: Display name
- **extra_data**: JSONB for additional data (hex codes, etc.)

### 9. Variant_Attributes
Junction table linking variants to attribute values.
- **id**: Primary key (UUID)
- **variant_id**: Foreign key to Product_Variants
- **attribute_value_id**: Foreign key to Attribute_Values
- Unique constraint on (variant_id, attribute_value_id)

### 10. Warehouses
Warehouse locations.
- **id**: Primary key (UUID)
- **name**: Warehouse name
- **location**: Location description
- **address**: Full address
- **is_active**: Active status
- **deleted_at**: Soft delete timestamp

### 11. Inventory
Inventory levels per variant per warehouse.
- **id**: Primary key (UUID)
- **variant_id**: Foreign key to Product_Variants
- **warehouse_id**: Foreign key to Warehouses
- **quantity**: Available quantity
- **reserved_quantity**: Reserved for pending orders
- Unique constraint on (variant_id, warehouse_id)

### 12. Cart
Shopping cart (one per user).
- **id**: Primary key (UUID)
- **user_id**: Foreign key to Users (unique)
- One cart per user enforced by unique constraint

### 13. Cart_Items
Items in shopping cart.
- **id**: Primary key (UUID)
- **cart_id**: Foreign key to Cart
- **variant_id**: Foreign key to Product_Variants
- **quantity**: Item quantity
- Unique constraint on (cart_id, variant_id)

### 14. Orders
Customer orders.
- **id**: Primary key (UUID)
- **user_id**: Foreign key to Users
- **order_number**: Unique order identifier (ORD-YYYY-XXXXXX)
- **total**: Total order amount
- **subtotal**: Subtotal before tax/shipping
- **tax**: Tax amount
- **shipping**: Shipping cost
- **discount**: Discount amount
- **status**: Enum (pending, paid, shipped, delivered, cancelled)
- **payment_method**: Payment method used
- **deleted_at**: Soft delete timestamp

### 15. Order_Items
Items in each order.
- **id**: Primary key (UUID)
- **order_id**: Foreign key to Orders
- **variant_id**: Foreign key to Product_Variants
- **quantity**: Item quantity
- **price**: Price at time of order (historical)
- **product_name**: Snapshot of product name
- **variant_sku**: Snapshot of SKU

## Key Features

### 1. Multiple Main Images
The `Product_Images` table supports multiple images marked as `is_main = true` for a single product. This allows:
- Multiple hero images
- Gallery views
- Variant-specific images

### 2. Soft Deletes
All major tables include `deleted_at` timestamp:
- Products
- Product_Variants
- Categories
- Users
- Warehouses
- Orders

Query active records: `WHERE deleted_at IS NULL`

### 3. Flexible Attributes System
- Add new attributes without schema changes
- Support for different attribute types
- Extra data stored as JSONB for flexibility

### 4. Multi-Warehouse Inventory
- Track inventory per warehouse
- Reserve quantities for pending orders
- Calculate total stock across warehouses

### 5. Order History
- Order items store historical prices
- Product names and SKUs snapshotted
- Complete order audit trail

## Usage Examples

### Get Product with Variants and Images
```sql
SELECT 
    p.*,
    json_agg(DISTINCT jsonb_build_object(
        'id', pv.id,
        'sku', pv.sku,
        'price', pv.price,
        'stock', pv.stock
    )) as variants,
    json_agg(DISTINCT jsonb_build_object(
        'id', pi.id,
        'url', pi.image_url,
        'is_main', pi.is_main
    )) as images
FROM products p
LEFT JOIN product_variants pv ON p.id = pv.product_id
LEFT JOIN product_images pi ON p.id = pi.product_id
WHERE p.id = 'product-uuid'
GROUP BY p.id;
```

### Get Variant with Attributes
```sql
SELECT 
    pv.*,
    json_agg(jsonb_build_object(
        'attribute', a.name,
        'value', av.value,
        'display_value', av.display_value
    )) as attributes
FROM product_variants pv
JOIN variant_attributes va ON pv.id = va.variant_id
JOIN attribute_values av ON va.attribute_value_id = av.id
JOIN attributes a ON av.attribute_id = a.id
WHERE pv.id = 'variant-uuid'
GROUP BY pv.id;
```

### Calculate Total Stock for Variant
```sql
SELECT calculate_variant_stock('variant-uuid') as total_stock;
```

### Generate Order Number
```sql
INSERT INTO orders (user_id, order_number, total, status)
VALUES ('user-uuid', generate_order_number(), 100.00, 'pending');
```

## Indexes

All foreign keys and frequently queried columns are indexed:
- Foreign key columns
- Status/enum columns (partial indexes for active records)
- Slug columns (for URL lookups)
- Deleted_at columns (partial indexes for active records)
- Composite indexes for common query patterns

## Security

Row Level Security (RLS) is enabled on all tables with policies for:
- Public read access to active products/categories
- Users can only access their own cart/orders
- Admins have full access (based on role)

## Migration Steps

1. **Backup your database** (see SUPABASE-BACKUP-GUIDE.md)
2. **Run the migration script** in Supabase SQL Editor
3. **Verify tables created**: Check all 15 tables exist
4. **Test RLS policies**: Ensure proper access control
5. **Seed initial data**: Add roles, categories, attributes
6. **Update application code**: Use new schema structure

## Next Steps

- Set up authentication (Supabase Auth)
- Configure RLS policies for your use case
- Seed initial data (roles, categories, attributes)
- Create API endpoints for CRUD operations
- Build admin dashboard for management

