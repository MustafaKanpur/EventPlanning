/*
  Both tables are now dead: tasks live as CHECKLIST records and files as TABLE records,
  and nothing in the app reads either model. Their data was copied into the composed
  tier by the two preceding migrations, so this drops the originals.

  Reverse: prisma/proposed/down-restore-task.sql recreates Task and down.sql refills it
  from the checklist records. Resource is not restorable from here — its rows are
  recoverable only from a backup, which is why this runs as its own step rather than
  alongside the copy.
*/
DROP TABLE "Resource";
DROP TABLE "Task";
DROP TYPE "TaskStatus";
