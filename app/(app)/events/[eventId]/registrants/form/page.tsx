import Link from "next/link";

import { getCurrentTeamMember } from "@/lib/current-team-member";
import { ensureRegistrationForm, REGISTRATION_FIELD_TYPES } from "@/lib/registration-form";
import type { SelectOption } from "@/lib/screen-templates";
import { ScreenBuilder } from "@/app/(app)/builder/screen-builder";

export default async function RegistrationFormBuilderPage({
  params,
}: {
  params: { eventId: string };
}) {
  const me = await getCurrentTeamMember();
  const form = await ensureRegistrationForm(params.eventId, me?.id);

  const fields = form.fields.map((f) => ({
    key: f.key,
    id: f.id,
    label: f.label,
    type: f.type,
    options: (f.options as { choices?: SelectOption[] } | null)?.choices ?? undefined,
    required: f.required,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-[22px] font-normal leading-none text-ink">
            Registration form
          </h2>
          <p className="mt-1.5 text-[13px] text-ink-muted">
            Name and email are always collected. Drag anything else you need to ask —
            it appears on the public form and as a column on this screen.
          </p>
        </div>
        <Link
          href={`/events/${params.eventId}/registrants`}
          className="text-ui text-ink-muted transition-colors hover:text-ink"
        >
          ← Back to registration
        </Link>
      </div>

      <ScreenBuilder
        eventId={params.eventId}
        definitionId={form.id}
        mode="registration"
        allowedTypes={REGISTRATION_FIELD_TYPES}
        initialName={form.name}
        initialFields={fields}
      />
    </div>
  );
}
