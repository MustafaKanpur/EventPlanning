"use server";

import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { readVolunteerForm, shiftBlocker } from "@/lib/volunteers";

// Public, unauthenticated actions — anyone with the link can call these. Both use the
// same honeypot as event registration.

function isBot(formData: FormData) {
  return Boolean(String(formData.get("company") ?? "").trim());
}

/** Joining the organization. New volunteers wait in the pending queue on /volunteers. */
export async function joinAsVolunteer(formData: FormData) {
  if (isBot(formData)) redirect("/volunteer?success=1");

  const data = readVolunteerForm(formData);
  if (!data.name || !data.email) throw new Error("Name and email are required.");

  // An existing email is left untouched: a public form must not let anyone overwrite
  // someone else's profile. Same success message, so it doesn't reveal who's on file.
  await prisma.volunteer.upsert({ where: { email: data.email }, update: {}, create: data });
  redirect("/volunteer?success=1");
}

/**
 * Signing up for one shift. Capacity and eligibility are checked here, inside a
 * serializable transaction, so two people can't both take the last spot.
 */
export async function signUpForShift(eventId: string, formData: FormData) {
  const done = `/volunteer/${eventId}?success=1`;
  if (isBot(formData)) redirect(done);

  const data = readVolunteerForm(formData);
  const shiftId = String(formData.get("shiftId") ?? "");
  const fail = (message: string) => redirect(`/volunteer/${eventId}?error=${encodeURIComponent(message)}`);
  if (!data.name || !data.email) fail("Name and email are required.");
  if (!shiftId) fail("Pick a shift.");

  let blocker: string | null;
  try {
    blocker = await prisma.$transaction(
      async (tx) => {
        const shift = await tx.shift.findFirst({
          where: { id: shiftId, eventId, event: { status: { not: "CANCELLED" } } },
          include: { _count: { select: { signups: true } } },
        });
        if (!shift) return "That shift isn't open for sign-ups.";

        // Existing volunteers are judged on what's on file; the form only fills gaps, for
        // the same reason joinAsVolunteer never overwrites.
        let volunteer = await tx.volunteer.findUnique({ where: { email: data.email } });
        if (!volunteer) {
          volunteer = await tx.volunteer.create({ data });
        } else {
          const gaps = {
            phone: volunteer.phone ?? data.phone,
            address: volunteer.address ?? data.address,
            birthDate: volunteer.birthDate ?? data.birthDate,
            gender: volunteer.gender ?? data.gender,
          };
          volunteer = await tx.volunteer.update({ where: { id: volunteer.id }, data: gaps });
        }

        const already = await tx.shiftSignup.findUnique({
          where: { shiftId_volunteerId: { shiftId, volunteerId: volunteer.id } },
        });
        if (already) return null;

        const hours = await tx.hoursEntry.aggregate({
          where: { volunteerId: volunteer.id, status: "APPROVED" },
          _sum: { hours: true },
        });
        const reason = shiftBlocker(shift, shift._count.signups, {
          birthDate: volunteer.birthDate,
          gender: volunteer.gender,
          approvedHours: Number(hours._sum.hours ?? 0),
        });
        if (reason) return reason;

        await tx.shiftSignup.create({ data: { shiftId, volunteerId: volunteer.id } });
        return null;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (err) {
    // P2034: another sign-up committed at the same moment. Retrying re-checks capacity.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034") {
      blocker = "Lots of people are signing up right now. Please try again.";
    } else {
      throw err;
    }
  }

  if (blocker) fail(blocker);
  redirect(done);
}
