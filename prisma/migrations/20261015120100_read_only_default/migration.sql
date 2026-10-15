-- Its own migration: Postgres can't use a new enum value in the transaction that adds it.
ALTER TABLE "TeamMember" ALTER COLUMN "role" SET DEFAULT 'READ_ONLY';
