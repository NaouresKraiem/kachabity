# Site Settings Setup Guide

## Overview

The `site_settings` table stores dynamic configuration values that can be updated without code changes, like shipping thresholds, currency, and wallet names.

## Setup

### Step 1: Create the Table

1. Go to Supabase Dashboard → SQL Editor
2. Run the script: `create-site-settings.sql`
3. This creates the table with default values

### Step 2: Verify Installation

```sql
SELECT * FROM site_settings;
```

You should see one row with default settings:
- `free_shipping_threshold`: 500
- `currency`: 'DT'
- `wallet_name`: 'Dasun Wallet'

## Update Settings

### Change Free Shipping Threshold

```sql
UPDATE site_settings
SET free_shipping_threshold = 1000
WHERE id = (SELECT id FROM site_settings LIMIT 1);
```

### Change Currency

```sql
UPDATE site_settings
SET currency = 'TND'
WHERE id = (SELECT id FROM site_settings LIMIT 1);
```

### Change Wallet Name

```sql
UPDATE site_settings
SET wallet_name = 'My Wallet'
WHERE id = (SELECT id FROM site_settings LIMIT 1);
```

### Update Multiple Settings at Once

```sql
UPDATE site_settings
SET 
    free_shipping_threshold = 750,
    currency = 'TND',
    wallet_name = 'Kachaba Wallet',
    support_email = 'help@kachaba.com',
    support_phone = '+216 71 123 456'
WHERE id = (SELECT id FROM site_settings LIMIT 1);
```

## How It Works in the Frontend

The `ServiceHighlights` component automatically fetches these values:

```tsx
<ServiceHighlights />
```

It displays:
- **Free Shipping**: "For invoices over {threshold} {currency}"
- **Cash Back**: "via {wallet_name}"
- **24/7 Support**: Always available

### Fallback Values

If the database fetch fails, default values are used:
- Threshold: 500
- Currency: 'DT'
- Wallet: 'Dasun Wallet'

## Benefits

✅ **No Code Changes**: Update values directly in database  
✅ **Instant Updates**: Changes reflect immediately on frontend  
✅ **Centralized**: One source of truth for all settings  
✅ **Safe**: Read-only for public, admin updates only  
✅ **Automatic Timestamps**: `updated_at` tracks when settings changed

## Best Practices

1. **Keep One Row**: Only one settings row should exist
2. **Test Changes**: Verify in staging before production
3. **Document Updates**: Keep track of setting changes
4. **Use Reasonable Values**: Don't set extreme thresholds

## Future Extensions

You can add more settings to this table:
- Tax rates
- Minimum order amount
- Maximum order items
- Return policy days
- Customer service hours
- etc.

Just add columns:
```sql
ALTER TABLE site_settings 
ADD COLUMN tax_rate DECIMAL(5,2) DEFAULT 0.18;
```

