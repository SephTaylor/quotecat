-- 034_quote_payment_terms.sql
-- Adds payment terms to quotes.
--
-- Why: a quote had exactly one free-text box (notes), and createContractFromQuote
-- maps notes straight into the contract's scope_of_work. A real customer typed
-- "8000 deposit / 7000 when the job is done" into notes and it became their
-- scope of work, while the contract's payment_terms sat empty.
--
-- Contractors discuss terms at quote time, so the quote is where the field
-- belongs. It carries through to contracts.payment_terms on conversion.
--
-- Nullable, no default. Existing quotes read as NULL.

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS payment_terms TEXT;
