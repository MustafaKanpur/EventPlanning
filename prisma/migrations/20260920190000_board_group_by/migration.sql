-- BOARD columns come from a chosen SELECT field; null falls back to the first one.
ALTER TABLE "ScreenDefinition" ADD COLUMN "groupByFieldKey" TEXT;
