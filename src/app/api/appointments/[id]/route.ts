import { route } from "@/lib/http";
import { appointmentView, deleteAppointment, saveAppointment } from "@/lib/services/care";
import { appointmentSchema } from "@/lib/validation";

export const PUT = route(
  { permission: "appointments:write", body: appointmentSchema },
  async ({ auth, body, params }) => ({
    appointment: appointmentView(await saveAppointment(auth.circle.id, auth.member, body, params.id)),
  }),
);

export const DELETE = route({ permission: "appointments:write" }, async ({ auth, params }) => {
  await deleteAppointment(auth.circle.id, auth.member, params.id);
  return { ok: true };
});
