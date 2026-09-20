-- ============================================================================
-- Recreates the empty Task table so down.sql can refill it from checklist
-- records. Only needed if up-drop-task.sql was already run.
-- ============================================================================
CREATE TYPE "TaskStatus" AS ENUM ('TODO','IN_PROGRESS','BLOCKED','DONE');

CREATE TABLE "Task" (
  "id"             TEXT NOT NULL,
  "title"          TEXT NOT NULL,
  "status"         "TaskStatus" NOT NULL DEFAULT 'TODO',
  "dueDate"        TIMESTAMP(3),
  "notes"          TEXT,
  "eventId"        TEXT NOT NULL,
  "scheduleItemId" TEXT,
  "budgetLineId"   TEXT,
  "assigneeId"     TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Task" ADD CONSTRAINT "Task_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_scheduleItemId_fkey"
  FOREIGN KEY ("scheduleItemId") REFERENCES "ScheduleItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_budgetLineId_fkey"
  FOREIGN KEY ("budgetLineId") REFERENCES "BudgetLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigneeId_fkey"
  FOREIGN KEY ("assigneeId") REFERENCES "TeamMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
