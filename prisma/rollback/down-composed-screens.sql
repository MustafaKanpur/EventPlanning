-- ============================================================================
-- REVERSE MIGRATION — back to the Task model and the screen library
--
-- HONEST CAVEAT, read before relying on this:
--
--   Reversal is faithful for anything that existed when up.sql ran. It is NOT
--   lossless for what the composed tier can express and the old model cannot:
--
--   • Checklist records created after the migration come back as Task rows only
--     if their screen still has the title/done/due/owner/block/budget shape.
--     Extra fields a user added to the Tasks screen are dropped — Task has no
--     column for them.
--   • Records on any other screen type (BOARD, TIMELINE, LEDGER, CALENDAR) and
--     on user-built screens come back as library screens with ScreenFields, but
--     field types that did not exist before (CURRENCY, DATETIME, DURATION,
--     MULTI_SELECT, LINK, PERSON) have no CustomFieldType equivalent and are
--     coerced to TEXT. The values survive; the typing does not.
--   • RecordLink rows for targets other than SCHEDULE_ITEM / BUDGET_LINE /
--     TEAM_MEMBER are dropped, because Task had nowhere to put them.
--   • ScreenDefinition.position, isSystem, templateId and rollupTarget are lost.
--
--   In short: this gets you running again on the old code, it does not promise
--   a byte-identical database. Take a backup before the forward run regardless.
--
-- Run order to reverse fully:
--   1. down-restore-task.sql   (only if up-drop-task.sql was already run)
--   2. this file
-- ============================================================================

-- ─── PART 1 · put the old screen structures back ────────────────────────────
CREATE TYPE "CustomFieldType" AS ENUM ('TEXT','LONG_TEXT','NUMBER','DATE','CHECKBOX','SELECT','URL','EMAIL');
CREATE TYPE "CustomScreenView" AS ENUM ('TABLE','KANBAN');
CREATE TYPE "ScreenStatus" AS ENUM ('DRAFT','SAVED');

CREATE TABLE "ScreenField" (
  "id"           TEXT NOT NULL,
  "definitionId" TEXT NOT NULL,
  "label"        TEXT NOT NULL,
  "type"         "CustomFieldType" NOT NULL,
  "options"      JSONB,
  "required"     BOOLEAN NOT NULL DEFAULT false,
  "position"     INTEGER NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ScreenField_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EventScreen" (
  "id"           TEXT NOT NULL,
  "eventId"      TEXT NOT NULL,
  "definitionId" TEXT NOT NULL,
  "position"     INTEGER NOT NULL DEFAULT 0,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventScreen_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ScreenDefinition"
  ADD COLUMN "status"               "ScreenStatus" NOT NULL DEFAULT 'SAVED',
  ADD COLUMN "view"                 "CustomScreenView" NOT NULL DEFAULT 'TABLE',
  ADD COLUMN "kanbanGroupByFieldId" TEXT;

UPDATE "ScreenDefinition"
SET "view" = CASE WHEN "viewType"::text = 'BOARD' THEN 'KANBAN' ELSE 'TABLE' END::"CustomScreenView";

ALTER TABLE "ScreenRecord" ADD COLUMN "eventScreenId" TEXT, ADD COLUMN "data" JSONB;

-- ─── PART 2 · restore Task rows from the checklist records ──────────────────
-- Only screens still shaped like the seeded Tasks screen can round-trip.
CREATE TEMP TABLE _restorable_screen AS
SELECT d."id" AS "screenId", d."eventId"
FROM "ScreenDefinition" d
WHERE d."viewType" = 'CHECKLIST'
  AND d."eventId" IS NOT NULL
  AND EXISTS (SELECT 1 FROM "FieldDefinition" f WHERE f."screenId" = d."id" AND f."key" = 'title')
  AND EXISTS (SELECT 1 FROM "FieldDefinition" f WHERE f."screenId" = d."id" AND f."key" = 'done');

INSERT INTO "Task"
  ("id", "title", "status", "dueDate", "notes", "eventId", "scheduleItemId", "budgetLineId",
   "assigneeId", "createdAt", "updatedAt")
SELECT
  r."id",
  COALESCE(r."values" ->> 'title', 'Untitled'),
  (CASE WHEN (r."values" ->> 'done')::boolean IS TRUE THEN 'DONE' ELSE 'TODO' END)::"TaskStatus",
  CASE WHEN r."values" ->> 'due' IS NULL THEN NULL
       ELSE (r."values" ->> 'due')::timestamp END,
  NULL,
  s."eventId",
  (SELECT l."targetId" FROM "RecordLink" l
    WHERE l."recordId" = r."id" AND l."targetType" = 'SCHEDULE_ITEM' LIMIT 1),
  (SELECT l."targetId" FROM "RecordLink" l
    WHERE l."recordId" = r."id" AND l."targetType" = 'BUDGET_LINE' LIMIT 1),
  (SELECT l."targetId" FROM "RecordLink" l
    WHERE l."recordId" = r."id" AND l."targetType" = 'TEAM_MEMBER' LIMIT 1),
  r."createdAt",
  r."updatedAt"
FROM "ScreenRecord" r
JOIN _restorable_screen s ON s."screenId" = r."screenId"
-- Only rebuild Task when it is actually empty. up.sql deliberately leaves the table
-- intact, so if the drop was never run the original rows are authoritative and these
-- checklist copies are duplicates. Evaluated against the statement snapshot, so it is
-- all-or-nothing rather than true for the first row and false for the rest.
WHERE NOT EXISTS (SELECT 1 FROM "Task");

-- Those records are now Tasks again; drop them from the screens tier.
DELETE FROM "ScreenRecord" WHERE "screenId" IN (SELECT "screenId" FROM _restorable_screen);
DELETE FROM "ScreenDefinition" WHERE "id" IN (SELECT "screenId" FROM _restorable_screen);

-- ─── PART 3 · event-scoped definitions become library + placement again ─────
INSERT INTO "EventScreen" ("id", "eventId", "definitionId", "position", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, d."eventId", d."id", d."position", d."createdAt", CURRENT_TIMESTAMP
FROM "ScreenDefinition" d
WHERE d."eventId" IS NOT NULL;

-- Fields back to ScreenField, coercing types the old enum never had.
INSERT INTO "ScreenField"
  ("id", "definitionId", "label", "type", "options", "required", "position", "createdAt", "updatedAt")
SELECT
  f."id",
  f."screenId",
  f."label",
  (CASE f."type"::text
     WHEN 'TEXT' THEN 'TEXT' WHEN 'LONG_TEXT' THEN 'LONG_TEXT' WHEN 'NUMBER' THEN 'NUMBER'
     WHEN 'DATE' THEN 'DATE' WHEN 'CHECKBOX' THEN 'CHECKBOX' WHEN 'SELECT' THEN 'SELECT'
     WHEN 'URL' THEN 'URL' WHEN 'EMAIL' THEN 'EMAIL'
     ELSE 'TEXT'                                  -- CURRENCY / DATETIME / DURATION / MULTI_SELECT / LINK / PERSON
   END)::"CustomFieldType",
  f."options",
  f."required",
  f."position",
  f."createdAt",
  CURRENT_TIMESTAMP
FROM "FieldDefinition" f;

-- Records: re-key values from field key back to field id, and repoint at the placement.
UPDATE "ScreenRecord" r
SET "eventScreenId" = es."id",
    "data" = COALESCE((
      SELECT jsonb_object_agg(f."id", r."values" -> f."key")
      FROM "FieldDefinition" f
      WHERE f."screenId" = r."screenId" AND r."values" ? f."key"
    ), '{}'::jsonb)
FROM "EventScreen" es
WHERE es."definitionId" = r."screenId";

DELETE FROM "ScreenRecord" WHERE "eventScreenId" IS NULL;

ALTER TABLE "ScreenRecord" ALTER COLUMN "eventScreenId" SET NOT NULL;
ALTER TABLE "ScreenRecord" ALTER COLUMN "data" SET NOT NULL;
ALTER TABLE "ScreenRecord" ALTER COLUMN "position" SET DATA TYPE DOUBLE PRECISION;
ALTER TABLE "ScreenRecord" ALTER COLUMN "position" DROP DEFAULT;

-- ─── PART 4 · drop the new shape ────────────────────────────────────────────
ALTER TABLE "ScreenRecord" DROP CONSTRAINT IF EXISTS "ScreenRecord_screenId_fkey";
ALTER TABLE "ScreenRecord" DROP COLUMN "screenId", DROP COLUMN "values";

ALTER TABLE "ScreenDefinition" DROP CONSTRAINT IF EXISTS "ScreenDefinition_eventId_fkey";
ALTER TABLE "ScreenDefinition"
  DROP COLUMN "eventId", DROP COLUMN "templateId", DROP COLUMN "position",
  DROP COLUMN "isSystem", DROP COLUMN "viewType";

DROP TABLE "RecordLink";
DROP TABLE "FieldDefinition";
DROP TYPE "LinkTarget";
DROP TYPE "FieldType";
DROP TYPE "ViewType";

ALTER TABLE "ScreenField" ADD CONSTRAINT "ScreenField_definitionId_fkey"
  FOREIGN KEY ("definitionId") REFERENCES "ScreenDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventScreen" ADD CONSTRAINT "EventScreen_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventScreen" ADD CONSTRAINT "EventScreen_definitionId_fkey"
  FOREIGN KEY ("definitionId") REFERENCES "ScreenDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScreenRecord" ADD CONSTRAINT "ScreenRecord_eventScreenId_fkey"
  FOREIGN KEY ("eventScreenId") REFERENCES "EventScreen"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "EventScreen_eventId_definitionId_key" ON "EventScreen"("eventId", "definitionId");
