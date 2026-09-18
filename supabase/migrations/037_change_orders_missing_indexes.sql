-- Migration 037: create the four indexes migration 024 declared but never made.
--
-- Same partial-application as the updated_at trigger fixed in 036. Verified by
-- introspecting the live database: change_orders carries only its primary key
-- index, while 024 declares four more. Migration 027 applied cleanly against
-- the same table, so 024 landed in part.
--
-- Free to run: the table holds zero rows, so each index builds instantly. They
-- matter the moment change order creation is rebuilt, because every one of them
-- backs a query the app already makes:
--   user_id    -> every sync pull is scoped to the signed-in user
--   quote_id   -> listChangeOrdersDB, the change order list on a quote
--   status     -> active change order counts on the dashboard and quotes tabs
--   updated_at -> incremental sync, which filters on .gt('updated_at', since)

CREATE INDEX IF NOT EXISTS idx_change_orders_user_id ON change_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_change_orders_quote_id ON change_orders(quote_id);
CREATE INDEX IF NOT EXISTS idx_change_orders_status ON change_orders(status);
CREATE INDEX IF NOT EXISTS idx_change_orders_updated_at ON change_orders(updated_at DESC);
