-- ============================================================================
-- FORWARD MIGRATION — composed screens tier
--
-- Not yet applied. Run order:
--   1. this file            (structure + data, keeps "Task" intact)
--   2. repoint the UI       (steps 2+ of the plan)
--   3. up-drop-task.sql     (removes "Task" once nothing reads it)
--
-- Split deliberately: dropping "Task" in this file would break the run of show,
-- dashboard, day-of view and People page the moment it ran, because they still
-- query prisma.task. Everything here is additive or internal to the screens tier,
-- so the app keeps working while the UI catches up.
--
-- Reverse: down.sql. Read the caveat at the top of that file before relying on it.
-- ============================================================================

-- ─── PART 0 · new enums ─────────────────────────────────────────────────────
CREATE TYPE "ViewType" AS ENUM ('TABLE', 'BOARD', 'TIMELINE', 'CHECKLIST', 'CALENDAR', 'LEDGER');

CREATE TYPE "FieldType" AS ENUM (
  'TEXT', 'LONG_TEXT', 'NUMBER', 'CURRENCY', 'DATE', 'DATETIME', 'DURATION',
  'CHECKBOX', 'SELECT', 'MULTI_SELECT', 'LINK', 'EMAIL', 'URL', 'PERSON'
);

CREATE TYPE "LinkTarget" AS ENUM (
  'SCHEDULE_ITEM', 'BUDGET_LINE', 'VENDOR', 'TEAM_MEMBER', 'REGISTRANT', 'SCREEN_RECORD'
);

-- ─── PART 1 · new tables ────────────────────────────────────────────────────
CREATE TABLE "FieldDefinition" (
  "id"           TEXT NOT NULL,
  "screenId"     TEXT NOT NULL,
  "key"          TEXT NOT NULL,
  "label"        TEXT NOT NULL,
  "type"         "FieldType" NOT NULL,
  "position"     INTEGER NOT NULL,
  "required"     BOOLEAN NOT NULL DEFAULT false,
  "options"      JSONB,
  "rollupTarget" TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FieldDefinition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RecordLink" (
  "id"         TEXT NOT NULL,
  "recordId"   TEXT NOT NULL,
  "fieldKey"   TEXT NOT NULL,
  "targetType" "LinkTarget" NOT NULL,
  "targetId"   TEXT NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RecordLink_pkey" PRIMARY KEY ("id")
);

-- ─── PART 2 · widen the existing screen tables (nothing dropped yet) ────────
ALTER TABLE "ScreenDefinition"
  ADD COLUMN "eventId"    TEXT,
  ADD COLUMN "templateId" TEXT,
  ADD COLUMN "position"   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "isSystem"   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "viewType"   "ViewType";           -- set NOT NULL at the end of PART 6

ALTER TABLE "ScreenRecord"
  ADD COLUMN "screenId" TEXT,
  ADD COLUMN "values"   JSONB;

-- The old columns are still NOT NULL and are not dropped until PART 6, so relax them
-- now: PART 5 inserts brand-new records that have no eventScreenId or data to give.
ALTER TABLE "ScreenRecord"
  ALTER COLUMN "eventScreenId" DROP NOT NULL,
  ALTER COLUMN "data" DROP NOT NULL;

-- ─── PART 3 · carry the old library screens into the event-scoped world ─────
-- Old model: one global ScreenDefinition, placed on N events via EventScreen, with
-- records hanging off the placement. New model: a definition belongs to one event,
-- so each placement becomes its own definition. A screen shared by two events
-- becomes two definitions — that is the cost of dropping the library concept, and
-- it is what makes per-event customisation possible.

CREATE TEMP TABLE _screen_clone (
  "eventScreenId" TEXT PRIMARY KEY,
  "oldDefId"      TEXT NOT NULL,
  "newScreenId"   TEXT NOT NULL,
  "eventId"       TEXT NOT NULL
) ON COMMIT DROP;

INSERT INTO _screen_clone ("eventScreenId", "oldDefId", "newScreenId", "eventId")
SELECT es."id", es."definitionId", gen_random_uuid()::text, es."eventId"
FROM "EventScreen" es;

INSERT INTO "ScreenDefinition"
  ("id", "eventId", "templateId", "name", "icon", "viewType", "position", "isSystem",
   "createdById", "createdAt", "updatedAt")
SELECT
  c."newScreenId",
  c."eventId",
  NULL,
  d."name",
  d."icon",
  -- KANBAN is called BOARD now; everything else was already TABLE.
  (CASE WHEN d."view"::text = 'KANBAN' THEN 'BOARD' ELSE 'TABLE' END)::"ViewType",
  es."position",
  false,
  d."createdById",
  d."createdAt",
  CURRENT_TIMESTAMP
FROM _screen_clone c
JOIN "EventScreen" es ON es."id" = c."eventScreenId"
JOIN "ScreenDefinition" d ON d."id" = c."oldDefId";

-- Fields: ScreenField -> FieldDefinition, inventing the stable `key` the old model
-- never had. Slug from the label, de-duplicated by position so two fields labelled
-- "Notes" don't collide.
-- Keyed by (field, clone): one old field becomes one FieldDefinition *per event*
-- the screen was placed on, so the old id alone is not unique here.
CREATE TEMP TABLE _field_map (
  "oldFieldId"  TEXT NOT NULL,
  "newFieldId"  TEXT NOT NULL,
  "newScreenId" TEXT NOT NULL,
  "key"         TEXT NOT NULL,
  PRIMARY KEY ("oldFieldId", "newScreenId")
) ON COMMIT DROP;

INSERT INTO _field_map ("oldFieldId", "newFieldId", "newScreenId", "key")
SELECT
  s."id",
  gen_random_uuid()::text,
  s."newScreenId",
  s.base || CASE WHEN s.dupe > 1 THEN '_' || s.dupe::text ELSE '' END
FROM (
  -- The window has to span the whole set. Computing row_number() inside a LATERAL
  -- evaluates it per row, so every duplicate label came back as 1 and collided.
  SELECT
    sf."id",
    c."newScreenId",
    COALESCE(NULLIF(trim(both '_' FROM regexp_replace(lower(sf."label"), '[^a-z0-9]+', '_', 'g')), ''), 'field') AS base,
    row_number() OVER (
      PARTITION BY
        c."newScreenId",
        COALESCE(NULLIF(trim(both '_' FROM regexp_replace(lower(sf."label"), '[^a-z0-9]+', '_', 'g')), ''), 'field')
      ORDER BY sf."position"
    ) AS dupe
  FROM "ScreenField" sf
  JOIN _screen_clone c ON c."oldDefId" = sf."definitionId"
) s;

INSERT INTO "FieldDefinition"
  ("id", "screenId", "key", "label", "type", "position", "required", "options",
   "rollupTarget", "createdAt", "updatedAt")
SELECT
  m."newFieldId",
  m."newScreenId",
  m."key",
  sf."label",
  sf."type"::text::"FieldType",   -- every old CustomFieldType name exists in FieldType
  sf."position",
  sf."required",
  sf."options",
  NULL,
  sf."createdAt",
  CURRENT_TIMESTAMP
FROM "ScreenField" sf
JOIN _field_map m ON m."oldFieldId" = sf."id";

-- Records: repoint at the cloned screen and re-key the JSON blob from field *id*
-- to field *key*. Values whose field no longer exists are dropped rather than kept
-- under an unreadable key.
UPDATE "ScreenRecord" r
SET "screenId" = c."newScreenId",
    "values" = COALESCE((
      SELECT jsonb_object_agg(m."key", r."data" -> m."oldFieldId")
      FROM _field_map m
      WHERE m."newScreenId" = c."newScreenId"
        AND r."data" ? m."oldFieldId"
    ), '{}'::jsonb)
FROM _screen_clone c
WHERE r."eventScreenId" = c."eventScreenId";

-- Break the cascade chain FIRST. ScreenRecord -> EventScreen -> ScreenDefinition are
-- all ON DELETE CASCADE, so deleting the superseded library rows below would take the
-- records we just re-keyed with them. The column is dropped in PART 6 anyway.
ALTER TABLE "ScreenRecord" DROP CONSTRAINT IF EXISTS "ScreenRecord_eventScreenId_fkey";

-- The original library rows have been superseded by their per-event clones.
DELETE FROM "ScreenDefinition"
WHERE "eventId" IS NULL
  AND "id" IN (SELECT DISTINCT "oldDefId" FROM _screen_clone);

-- ─── PART 4 · seed a "Tasks" CHECKLIST screen for every existing event ──────
-- The app's own task list is now built from the same primitives a user gets.
CREATE TEMP TABLE _tasks_screen (
  "eventId"  TEXT PRIMARY KEY,
  "screenId" TEXT NOT NULL
) ON COMMIT DROP;

INSERT INTO _tasks_screen ("eventId", "screenId")
SELECT e."id", gen_random_uuid()::text FROM "Event" e;

INSERT INTO "ScreenDefinition"
  ("id", "eventId", "templateId", "name", "icon", "viewType", "position", "isSystem",
   "createdById", "createdAt", "updatedAt")
SELECT
  t."screenId", t."eventId", NULL, 'Tasks', NULL, 'CHECKLIST'::"ViewType",
  -- after any screens the event already had
  COALESCE((SELECT MAX(d."position") + 1 FROM "ScreenDefinition" d WHERE d."eventId" = t."eventId"), 0),
  true, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM _tasks_screen t;

INSERT INTO "FieldDefinition"
  ("id", "screenId", "key", "label", "type", "position", "required", "options", "rollupTarget",
   "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text, t."screenId", f.key, f.label, f.type::"FieldType", f.pos, f.required,
  f.options::jsonb, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM _tasks_screen t
CROSS JOIN (VALUES
  ('title',  'Title',       'TEXT',     0, true,  NULL),
  ('done',   'Done',        'CHECKBOX', 1, false, NULL),
  ('due',    'Due',         'DATE',     2, false, NULL),
  ('owner',  'Owner',       'PERSON',   3, false, '{"targetType":"TEAM_MEMBER","allowMultiple":false}'),
  ('block',  'Block',       'LINK',     4, false, '{"targetType":"SCHEDULE_ITEM","allowMultiple":false}'),
  ('budget', 'Budget line', 'LINK',     5, false, '{"targetType":"BUDGET_LINE","allowMultiple":false}')
) AS f(key, label, type, pos, required, options);

-- ─── PART 5 · move every Task row onto its event's Tasks screen ─────────────
CREATE TEMP TABLE _task_record (
  "taskId"   TEXT PRIMARY KEY,
  "recordId" TEXT NOT NULL
) ON COMMIT DROP;

INSERT INTO _task_record ("taskId", "recordId")
SELECT t."id", gen_random_uuid()::text FROM "Task" t;

INSERT INTO "ScreenRecord" ("id", "screenId", "values", "position", "createdAt", "updatedAt")
SELECT
  tr."recordId",
  ts."screenId",
  jsonb_strip_nulls(jsonb_build_object(
    'title',  to_jsonb(t."title"),
    'done',   to_jsonb(t."status"::text = 'DONE'),
    'due',    CASE WHEN t."dueDate" IS NULL THEN NULL
                   ELSE to_jsonb(to_char(t."dueDate", 'YYYY-MM-DD')) END,
    'owner',  CASE WHEN t."assigneeId" IS NULL THEN NULL ELSE to_jsonb(t."assigneeId") END,
    'block',  CASE WHEN t."scheduleItemId" IS NULL THEN NULL ELSE to_jsonb(t."scheduleItemId") END,
    'budget', CASE WHEN t."budgetLineId" IS NULL THEN NULL ELSE to_jsonb(t."budgetLineId") END
  )),
  row_number() OVER (PARTITION BY t."eventId" ORDER BY t."createdAt")::int,
  t."createdAt",
  t."updatedAt"
FROM "Task" t
JOIN _task_record tr ON tr."taskId" = t."id"
JOIN _tasks_screen ts ON ts."eventId" = t."eventId";

-- Relationships are materialised, never read back out of the JSON.
INSERT INTO "RecordLink" ("id", "recordId", "fieldKey", "targetType", "targetId", "createdAt")
SELECT gen_random_uuid()::text, tr."recordId", 'block', 'SCHEDULE_ITEM', t."scheduleItemId", CURRENT_TIMESTAMP
FROM "Task" t JOIN _task_record tr ON tr."taskId" = t."id"
WHERE t."scheduleItemId" IS NOT NULL;

INSERT INTO "RecordLink" ("id", "recordId", "fieldKey", "targetType", "targetId", "createdAt")
SELECT gen_random_uuid()::text, tr."recordId", 'budget', 'BUDGET_LINE', t."budgetLineId", CURRENT_TIMESTAMP
FROM "Task" t JOIN _task_record tr ON tr."taskId" = t."id"
WHERE t."budgetLineId" IS NOT NULL;

-- PERSON is materialised too, though the brief only listed the two LINK fields:
-- without it, "what does Priya own" has to scan JSON, which is the thing we said
-- we would not do. Remove these three lines if you would rather keep PERSON
-- values-only for now.
INSERT INTO "RecordLink" ("id", "recordId", "fieldKey", "targetType", "targetId", "createdAt")
SELECT gen_random_uuid()::text, tr."recordId", 'owner', 'TEAM_MEMBER', t."assigneeId", CURRENT_TIMESTAMP
FROM "Task" t JOIN _task_record tr ON tr."taskId" = t."id"
WHERE t."assigneeId" IS NOT NULL;

-- ─── PART 6 · tighten up, retire the old screen structures ──────────────────
DELETE FROM "ScreenRecord" WHERE "screenId" IS NULL;   -- orphan rows, none expected

ALTER TABLE "ScreenRecord"
  ALTER COLUMN "screenId" SET NOT NULL,
  ALTER COLUMN "values" SET NOT NULL,
  ALTER COLUMN "values" SET DEFAULT '{}'::jsonb;

ALTER TABLE "ScreenRecord" DROP CONSTRAINT IF EXISTS "ScreenRecord_eventScreenId_fkey";
ALTER TABLE "ScreenRecord" DROP COLUMN "eventScreenId", DROP COLUMN "data";
ALTER TABLE "ScreenRecord" ALTER COLUMN "position" SET DATA TYPE INTEGER USING round("position")::int;
ALTER TABLE "ScreenRecord" ALTER COLUMN "position" SET DEFAULT 0;

UPDATE "ScreenDefinition" SET "viewType" = 'TABLE'::"ViewType" WHERE "viewType" IS NULL;
ALTER TABLE "ScreenDefinition" ALTER COLUMN "viewType" SET NOT NULL;
ALTER TABLE "ScreenDefinition" DROP COLUMN "status", DROP COLUMN "view", DROP COLUMN "kanbanGroupByFieldId";

DROP TABLE "ScreenField";
DROP TABLE "EventScreen";
DROP TYPE "CustomFieldType";
DROP TYPE "CustomScreenView";
DROP TYPE "ScreenStatus";

-- ─── constraints and indexes on the new shape ───────────────────────────────
CREATE UNIQUE INDEX "FieldDefinition_screenId_key_key" ON "FieldDefinition"("screenId", "key");
CREATE INDEX "RecordLink_targetType_targetId_idx" ON "RecordLink"("targetType", "targetId");
CREATE UNIQUE INDEX "RecordLink_recordId_fieldKey_targetId_key" ON "RecordLink"("recordId", "fieldKey", "targetId");
CREATE INDEX "ScreenDefinition_eventId_position_idx" ON "ScreenDefinition"("eventId", "position");
CREATE INDEX "ScreenRecord_screenId_position_idx" ON "ScreenRecord"("screenId", "position");

ALTER TABLE "ScreenDefinition" ADD CONSTRAINT "ScreenDefinition_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FieldDefinition" ADD CONSTRAINT "FieldDefinition_screenId_fkey"
  FOREIGN KEY ("screenId") REFERENCES "ScreenDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScreenRecord" ADD CONSTRAINT "ScreenRecord_screenId_fkey"
  FOREIGN KEY ("screenId") REFERENCES "ScreenDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecordLink" ADD CONSTRAINT "RecordLink_recordId_fkey"
  FOREIGN KEY ("recordId") REFERENCES "ScreenRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
