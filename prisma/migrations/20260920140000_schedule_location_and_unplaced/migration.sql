/*
  Run-of-show support:
  - `ScheduleItem.location` — the block body shows "title · location" on one line.
  - `startTime` / `endTime` become nullable so a block can exist before it has a slot.
    These are the "Not yet placed" items in the run-of-show rail. Both are widening
    changes: every existing row keeps its values and stays valid.

  Authored by hand and recorded as applied, for the same reason as the previous
  migration — Supabase's 5432 session endpoint is unreachable from this network, so
  Prisma's migration engine can't run. Verified by replaying the directory from an
  empty schema and diffing the result against schema.prisma.
*/

-- AlterTable
ALTER TABLE "ScheduleItem" ADD COLUMN     "location" TEXT;
ALTER TABLE "ScheduleItem" ALTER COLUMN "startTime" DROP NOT NULL;
ALTER TABLE "ScheduleItem" ALTER COLUMN "endTime" DROP NOT NULL;
