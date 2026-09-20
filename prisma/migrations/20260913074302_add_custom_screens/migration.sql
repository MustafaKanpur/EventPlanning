-- CreateEnum
CREATE TYPE "CustomFieldType" AS ENUM ('TEXT', 'LONG_TEXT', 'NUMBER', 'DATE', 'CHECKBOX', 'SELECT', 'URL', 'EMAIL');

-- CreateEnum
CREATE TYPE "CustomScreenView" AS ENUM ('TABLE', 'KANBAN');

-- CreateTable
CREATE TABLE "CustomScreen" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "view" "CustomScreenView" NOT NULL DEFAULT 'TABLE',
    "kanbanGroupByFieldId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomScreen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomField" (
    "id" TEXT NOT NULL,
    "screenId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "CustomFieldType" NOT NULL,
    "options" JSONB,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomRecord" (
    "id" TEXT NOT NULL,
    "screenId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "position" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomRecord_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CustomScreen" ADD CONSTRAINT "CustomScreen_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomField" ADD CONSTRAINT "CustomField_screenId_fkey" FOREIGN KEY ("screenId") REFERENCES "CustomScreen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomRecord" ADD CONSTRAINT "CustomRecord_screenId_fkey" FOREIGN KEY ("screenId") REFERENCES "CustomScreen"("id") ON DELETE CASCADE ON UPDATE CASCADE;
