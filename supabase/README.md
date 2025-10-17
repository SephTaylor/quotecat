# Supabase Database Setup

## Running Migrations

You can run the SQL migrations manually in the Supabase Dashboard or use the Supabase CLI.

### Option 1: Supabase Dashboard (Recommended for now)

1. Go to your Supabase project: https://supabase.com/dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `migrations/001_create_products_table.sql`
4. Click **Run**

### Option 2: Supabase CLI (Future)

```bash
# Install Supabase CLI
npm install -g supabase

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Run migrations
supabase db push
```

## Database Schema

### `products` Table

- `id` (TEXT, PK) - Product ID/SKU
- `category_id` (TEXT) - Category reference
- `name` (TEXT) - Product name
- `unit` (TEXT) - Unit of measure (ea, sheet, box, etc.)
- `unit_price` (DECIMAL) - Price per unit
- `sku` (TEXT) - Optional supplier SKU
- `supplier_id` (TEXT) - Optional supplier reference
- `created_at` (TIMESTAMPTZ) - Creation timestamp
- `updated_at` (TIMESTAMPTZ) - Last update timestamp

### `categories` Table

- `id` (TEXT, PK) - Category ID
- `name` (TEXT) - Display name
- `created_at` (TIMESTAMPTZ) - Creation timestamp

## Security

Row Level Security (RLS) is enabled:

- **Read**: Public (anyone can view products)
- **Write**: Authenticated users only (for now)

Future: Add supplier role with write access to their own products.

## Seed Data

The migration includes seed data from `modules/catalog/seed.ts`:

- 2 Framing products
- 2 Drywall products
- 2 Electrical products
- 2 Plumbing products
- 4 Categories

## Next Steps

After running the migration:

1. Verify products are visible in Supabase Dashboard
2. Test querying products via the app
3. Add more products as needed
4. Set up supplier price update workflows
