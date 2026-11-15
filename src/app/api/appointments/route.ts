import { canSee } from "@/lib/domain/permissions";
import { fail, route } from "@/lib/http";
import { appointmentView, listAppointments, saveAppointment } from "@/lib/services/care";
import { appointmentSchema } from "@/lib/validation";

export const GET = route({ permission: "appointments:read" }, async ({ auth }) => {
  if (!canSee(auth.member, "appointments")) throw fail.forbidden("The elder has not shared appointments with you.");
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const appointments = await listAppointments(auth.circle.id, since);
  const withNotes = auth.member.role !== "FAMILY";
  return {
    appointments: appointments.map((a) => (withNotes ? appointmentView(a) : { ...appointmentView(a), notes: null })),
  };
});

export const POST = route({ permission: "appointments:write", body: appointmentSchema }, async ({ auth, body }) => ({
  appointment: appointmentView(await saveAppointment(auth.circle.id, auth.member, body)),
}));
