import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { getRegistrationForm } from "@/lib/registration-form";
import { CustomFields } from "./custom-fields";
import { registerForEvent } from "./actions";

export default async function PublicRegistrationPage({
  params,
  searchParams,
}: {
  params: { eventId: string };
  searchParams: { success?: string };
}) {
  const event = await prisma.event.findUnique({ where: { id: params.eventId } });
  if (!event) notFound();

  const submitted = searchParams.success === "1";
  const form = await getRegistrationForm(event.id);
  const register = registerForEvent.bind(null, event.id);

  return (
    <div className="flex min-h-screen items-center justify-center bg-ground px-4">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-white/10 bg-panel p-8 ">
        <div className="space-y-1 text-center">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-accent text-base text-warn">
            ✦
          </div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">You&apos;re invited to</p>
          <h1 className="text-xl font-semibold tracking-tight text-ink">{event.name}</h1>
          <p className="text-sm text-ink-muted">
            {event.eventDate.toLocaleDateString(undefined, {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>

        {event.status === "CANCELLED" ? (
          <p className="rounded-[3px] bg-panel-alt px-4 py-3 text-center text-sm text-danger">
            This event has been cancelled. Registration is closed.
          </p>
        ) : submitted ? (
          <p className="border border-rule bg-panel-alt px-4 py-3 text-center text-sm text-ink">
            You&apos;re registered.
          </p>
        ) : (
          <form action={register} className="space-y-4">
            <input
              type="text"
              name="company"
              tabIndex={-1}
              autoComplete="off"
              className="hidden"
              aria-hidden="true"
            />

            <div className="space-y-1">
              <label htmlFor="name" className="text-sm font-medium text-ink">
                Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                className="w-full rounded-[3px] border border-rule px-3 py-2 text-sm focus:border-accent focus:outline-none "
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="email" className="text-sm font-medium text-ink">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="w-full rounded-[3px] border border-rule px-3 py-2 text-sm focus:border-accent focus:outline-none "
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="amount" className="text-sm font-medium text-ink">
                Ticket / contribution amount <span className="font-normal text-ink-muted">(optional)</span>
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-muted">
                  $
                </span>
                <input
                  id="amount"
                  name="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="75"
                  className="w-full rounded-[3px] border border-rule py-2 pl-7 pr-3 text-sm focus:border-accent focus:outline-none "
                />
              </div>
            </div>

            <CustomFields fields={form?.fields ?? []} />

            <button
              type="submit"
              className="w-full rounded-[3px] bg-accent px-4 py-2 text-sm font-medium text-panel transition hover:opacity-90"
            >
              Register
            </button>

            <p className="text-center text-xs text-ink-muted">
              Payment isn&apos;t collected here yet.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
