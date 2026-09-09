-- 035_widen_contract_quote_id.sql
-- Widens contracts.quote_id from UUID to TEXT.
--
-- Why: quotes.id is TEXT (001_initial_schema.sql), because quotes created on a
-- phone get ids like "quote_1788797883416_37nhbrz". contracts.quote_id was
-- declared UUID in 007, so those ids never fit. invoices got this right in 003
-- with `quote_id TEXT -- not FK because quotes can be deleted`.
--
-- To dodge the type error, lib/contracts.ts only wrote quote_id when the id
-- happened to be a UUID, which silently orphaned every contract created from
-- the app. That NULL broke four things: the "this quote already has a contract"
-- guard on the Contracts tab, the dashboard's double-count guard, and the quote
-- lineage carried onto invoices billed from a contract on both mobile and the
-- portal.
--
-- Safe: every existing contracts.quote_id is NULL, so nothing is converted.
-- Deliberately not a foreign key, matching invoices, because quotes can be
-- deleted while the contract they produced must survive.

ALTER TABLE contracts ALTER COLUMN quote_id TYPE TEXT USING quote_id::text;
