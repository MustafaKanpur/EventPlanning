-- The event's public registration form is a ScreenDefinition whose fields are the
-- questions; answers live on the registrant, keyed by field key.
ALTER TABLE "ScreenDefinition" ADD COLUMN "isRegistrationForm" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Registrant" ADD COLUMN "answers" JSONB;
