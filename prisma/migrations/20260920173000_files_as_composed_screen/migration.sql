/*
  Files becomes a composed screen — the first screen converted to the new tier, and the
  test of whether the engine can carry a real feature.

  Resource rows are copied into ScreenRecords; the "Resource" table is left in place but
  is no longer read by anything. It is dropped later alongside "Task", once nothing
  references either.

  Reverse: delete the seeded screens (records cascade) and the Resource rows are still
  there, untouched:
      DELETE FROM "ScreenDefinition" WHERE "name" = 'Files' AND "isSystem";
*/

CREATE TEMP TABLE _files_screen ("eventId" TEXT PRIMARY KEY, "screenId" TEXT NOT NULL) ON COMMIT DROP;

INSERT INTO _files_screen ("eventId", "screenId")
SELECT e."id", gen_random_uuid()::text FROM "Event" e;

INSERT INTO "ScreenDefinition"
  ("id","eventId","templateId","name","icon","viewType","position","isSystem","createdById","createdAt","updatedAt")
SELECT
  f."screenId", f."eventId", NULL, 'Files', NULL, 'TABLE'::"ViewType",
  COALESCE((SELECT MAX(d."position") + 1 FROM "ScreenDefinition" d WHERE d."eventId" = f."eventId"), 0),
  true, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM _files_screen f;

INSERT INTO "FieldDefinition"
  ("id","screenId","key","label","type","position","required","options","rollupTarget","createdAt","updatedAt")
SELECT
  gen_random_uuid()::text, f."screenId", d.key, d.label, d.type::"FieldType", d.pos, d.required,
  d.options::jsonb, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM _files_screen f
CROSS JOIN (VALUES
  ('name',     'Name',        'TEXT',      0, true,  NULL),
  ('location', 'Location',    'TEXT',      1, false, NULL),
  ('link',     'Link',        'URL',       2, false, NULL),
  ('notes',    'Notes',       'LONG_TEXT', 3, false, NULL),
  ('owner',    'Added for',   'PERSON',    4, false, '{"targetType":"TEAM_MEMBER","allowMultiple":false}'),
  ('block',    'Block',       'LINK',      5, false, '{"targetType":"SCHEDULE_ITEM","allowMultiple":false}'),
  ('budget',   'Budget line', 'LINK',      6, false, '{"targetType":"BUDGET_LINE","allowMultiple":false}')
) AS d(key, label, type, pos, required, options);

CREATE TEMP TABLE _file_record ("resourceId" TEXT PRIMARY KEY, "recordId" TEXT NOT NULL) ON COMMIT DROP;

INSERT INTO _file_record ("resourceId", "recordId")
SELECT r."id", gen_random_uuid()::text FROM "Resource" r;

INSERT INTO "ScreenRecord" ("id","screenId","values","position","createdAt","updatedAt")
SELECT
  fr."recordId",
  fs."screenId",
  jsonb_strip_nulls(jsonb_build_object(
    'name',     to_jsonb(r."name"),
    'location', CASE WHEN r."location" IS NULL THEN NULL ELSE to_jsonb(r."location") END,
    'link',     CASE WHEN r."url" IS NULL THEN NULL ELSE to_jsonb(r."url") END,
    'notes',    CASE WHEN r."notes" IS NULL THEN NULL ELSE to_jsonb(r."notes") END,
    'owner',    CASE WHEN r."assigneeId" IS NULL THEN NULL ELSE to_jsonb(r."assigneeId") END,
    'block',    CASE WHEN r."scheduleItemId" IS NULL THEN NULL ELSE to_jsonb(r."scheduleItemId") END,
    'budget',   CASE WHEN r."budgetLineId" IS NULL THEN NULL ELSE to_jsonb(r."budgetLineId") END
  )),
  row_number() OVER (PARTITION BY r."eventId" ORDER BY r."createdAt")::int,
  r."createdAt",
  r."updatedAt"
FROM "Resource" r
JOIN _file_record fr ON fr."resourceId" = r."id"
JOIN _files_screen fs ON fs."eventId" = r."eventId";

INSERT INTO "RecordLink" ("id","recordId","fieldKey","targetType","targetId","createdAt")
SELECT gen_random_uuid()::text, fr."recordId", 'owner', 'TEAM_MEMBER', r."assigneeId", CURRENT_TIMESTAMP
FROM "Resource" r JOIN _file_record fr ON fr."resourceId" = r."id" WHERE r."assigneeId" IS NOT NULL;

INSERT INTO "RecordLink" ("id","recordId","fieldKey","targetType","targetId","createdAt")
SELECT gen_random_uuid()::text, fr."recordId", 'block', 'SCHEDULE_ITEM', r."scheduleItemId", CURRENT_TIMESTAMP
FROM "Resource" r JOIN _file_record fr ON fr."resourceId" = r."id" WHERE r."scheduleItemId" IS NOT NULL;

INSERT INTO "RecordLink" ("id","recordId","fieldKey","targetType","targetId","createdAt")
SELECT gen_random_uuid()::text, fr."recordId", 'budget', 'BUDGET_LINE', r."budgetLineId", CURRENT_TIMESTAMP
FROM "Resource" r JOIN _file_record fr ON fr."resourceId" = r."id" WHERE r."budgetLineId" IS NOT NULL;
