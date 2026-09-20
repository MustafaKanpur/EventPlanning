/*
  Warnings:

  - Dropped `CustomScreen`, `CustomField` and `CustomRecord`, replaced by the reusable
    screen library (`ScreenDefinition` / `ScreenField` / `EventScreen` / `ScreenRecord`).
    Records stored against the old tables are not migrated.
  - `BudgetLine.plannedAmount` and `BudgetLine.actualAmount` are dropped; spend now lives
    on `BudgetLineItem`, and the line carries `allocatedAmount` instead.
  - `Resource.title` is renamed to `name`, and `Resource.url` becomes optional.

  This migration was authored by hand and recorded as applied, because Supabase's session
  endpoint (5432) is unreachable from the network this was developed on and Prisma's
  migration engine cannot work through the 6543 transaction pooler. The statements below
  are the DDL that was applied to the live database by hand. Verified two ways: the live
  database matches schema.prisma column-for-column, and replaying this directory from an
  empty schema reproduces schema.prisma exactly.
*/

-- DropTable
DROP TABLE IF EXISTS "CustomRecord" CASCADE;
DROP TABLE IF EXISTS "CustomField" CASCADE;
DROP TABLE IF EXISTS "CustomScreen" CASCADE;

-- CreateEnum
CREATE TYPE "ScreenStatus" AS ENUM ('DRAFT', 'SAVED');

-- CreateTable
CREATE TABLE "ScreenDefinition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "status" "ScreenStatus" NOT NULL DEFAULT 'DRAFT',
    "view" "CustomScreenView" NOT NULL DEFAULT 'TABLE',
    "kanbanGroupByFieldId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScreenDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScreenField" (
    "id" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "CustomFieldType" NOT NULL,
    "options" JSONB,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScreenField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventScreen" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventScreen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScreenRecord" (
    "id" TEXT NOT NULL,
    "eventScreenId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "position" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScreenRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetLineItem" (
    "id" TEXT NOT NULL,
    "budgetLineId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "plannedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "actualAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EventScreen_eventId_definitionId_key" ON "EventScreen"("eventId", "definitionId");

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "tabOrder" JSONB;

-- AlterTable
ALTER TABLE "ScheduleItem" ADD COLUMN     "notes" TEXT;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "notes" TEXT;

-- AlterTable
ALTER TABLE "Registrant" ADD COLUMN     "notes" TEXT;

-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN     "notes" TEXT;

-- AlterTable
ALTER TABLE "BudgetLine" ADD COLUMN     "notes" TEXT,
ADD COLUMN     "allocatedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
DROP COLUMN "plannedAmount",
DROP COLUMN "actualAmount";

-- AlterTable
ALTER TABLE "Resource" RENAME COLUMN "title" TO "name";
ALTER TABLE "Resource" ALTER COLUMN "url" DROP NOT NULL,
ADD COLUMN     "location" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "assigneeId" TEXT;

-- AddForeignKey
ALTER TABLE "ScreenDefinition" ADD CONSTRAINT "ScreenDefinition_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "TeamMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreenField" ADD CONSTRAINT "ScreenField_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "ScreenDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventScreen" ADD CONSTRAINT "EventScreen_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventScreen" ADD CONSTRAINT "EventScreen_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "ScreenDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreenRecord" ADD CONSTRAINT "ScreenRecord_eventScreenId_fkey" FOREIGN KEY ("eventScreenId") REFERENCES "EventScreen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLineItem" ADD CONSTRAINT "BudgetLineItem_budgetLineId_fkey" FOREIGN KEY ("budgetLineId") REFERENCES "BudgetLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "TeamMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
