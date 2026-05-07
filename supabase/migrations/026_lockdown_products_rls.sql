-- Migration 026: Drop legacy permissive RLS policies on products
--
-- Migration 001 created policies that let any authenticated user INSERT/UPDATE
-- rows in the global products catalog. Migration 002 added correct
-- service-role-only policies but never dropped the old ones. RLS combines
-- policies with OR, so the legacy permissions win. This drops them.
--
-- After this migration, products can be:
--   - Read by anyone (kept: "Anyone can view products" / "Products are viewable by everyone")
--   - Written ONLY by service_role (kept: "Service role can manage products")

DROP POLICY IF EXISTS "Authenticated users can insert products" ON products;
DROP POLICY IF EXISTS "Authenticated users can update products" ON products;
