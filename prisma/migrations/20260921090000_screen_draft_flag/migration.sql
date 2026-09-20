-- A screen under construction: editable, but kept out of the tab bar until saved.
ALTER TABLE "ScreenDefinition" ADD COLUMN "isDraft" BOOLEAN NOT NULL DEFAULT false;
