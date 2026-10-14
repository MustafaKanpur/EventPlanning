-- CreateEnum
CREATE TYPE "Ability" AS ENUM ('BUILDER', 'VOLUNTEER_ADMIN');

-- CreateTable
CREATE TABLE "TeamMemberAbility" (
    "id" TEXT NOT NULL,
    "teamMemberId" TEXT NOT NULL,
    "ability" "Ability" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMemberAbility_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeamMemberAbility_teamMemberId_ability_key" ON "TeamMemberAbility"("teamMemberId", "ability");

-- AddForeignKey
ALTER TABLE "TeamMemberAbility" ADD CONSTRAINT "TeamMemberAbility_teamMemberId_fkey" FOREIGN KEY ("teamMemberId") REFERENCES "TeamMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- A screen only renders once its view has what it needs; the builder now refuses to
-- publish one that doesn't. Screens published before that rule go back to draft, using
-- the same requirements as VIEW_REQUIREMENTS in lib/screen-views.ts at this point.
UPDATE "ScreenDefinition" s
SET "isDraft" = true
WHERE s."isDraft" = false
  AND s."isRegistrationForm" = false
  AND (
    (s."viewType" = 'BOARD' AND NOT EXISTS (
      SELECT 1 FROM "FieldDefinition" f WHERE f."screenId" = s."id" AND f."type" = 'SELECT'))
    OR (s."viewType" IN ('TIMELINE', 'CALENDAR') AND NOT EXISTS (
      SELECT 1 FROM "FieldDefinition" f WHERE f."screenId" = s."id" AND f."type" IN ('DATE', 'DATETIME')))
    OR (s."viewType" = 'CHECKLIST' AND NOT EXISTS (
      SELECT 1 FROM "FieldDefinition" f WHERE f."screenId" = s."id" AND f."type" = 'CHECKBOX'))
    OR (s."viewType" = 'LEDGER' AND NOT EXISTS (
      SELECT 1 FROM "FieldDefinition" f WHERE f."screenId" = s."id" AND f."type" = 'CURRENCY'))
  );
