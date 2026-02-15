-- Support fractional app token charges (e.g. 0.1 per edit)
ALTER TABLE "users"
ALTER COLUMN "appTokens" TYPE DOUBLE PRECISION
USING "appTokens"::DOUBLE PRECISION;

ALTER TABLE "token_transactions"
ALTER COLUMN "amount" TYPE DOUBLE PRECISION
USING "amount"::DOUBLE PRECISION,
ALTER COLUMN "balanceBefore" TYPE DOUBLE PRECISION
USING "balanceBefore"::DOUBLE PRECISION,
ALTER COLUMN "balanceAfter" TYPE DOUBLE PRECISION
USING "balanceAfter"::DOUBLE PRECISION;
