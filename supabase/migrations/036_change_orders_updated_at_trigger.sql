-- Migration 036: apply the updated_at trigger migration 024 declared but never created.
--
-- Verified 2026-09-17 by introspecting the live database: change_orders has zero
-- triggers, while migration 024 declares set_change_orders_updated_at. Migration 027
-- applied cleanly against the same table, so 024 was applied only in part.
--
-- Why this matters. Change order sync is last-write-wins comparing updated_at, and
-- today only the device ever writes, setting that column itself. As soon as the portal
-- writes server side (a customer signing a change order on the web), nothing would move
-- updated_at, downloadChangeOrders() filters on .gt("updated_at", since), and no device
-- would ever see the change.
--
-- Safe against the existing sync because update_updated_at() is conditional:
--   IF NEW.updated_at = OLD.updated_at OR NEW.updated_at IS NULL THEN NEW.updated_at = NOW()
-- A device upload supplies its own updated_at, so the trigger leaves it alone and rows do
-- not round-trip. Only a writer that ignores the column gets stamped. Do not swap this for
-- an unconditional trigger (the one on contracts) — contracts are cloud-only and never
-- sync to the device, so they can afford it and change orders cannot.

DROP TRIGGER IF EXISTS set_change_orders_updated_at ON change_orders;

CREATE TRIGGER set_change_orders_updated_at
  BEFORE UPDATE ON change_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
