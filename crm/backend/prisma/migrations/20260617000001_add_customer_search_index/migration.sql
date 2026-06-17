-- Enable the pg_trgm extension for trigram-based similarity search on Customer.fullName.
-- This powers the ILIKE/GiST search used by SearchCustomersUseCase.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GiST trigram index on lower(fullName) for fast case-insensitive partial-name search.
CREATE INDEX "Customer_fullName_trgm_idx" ON "Customer"
  USING GiST (lower("fullName") gist_trgm_ops);
