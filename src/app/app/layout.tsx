import { redirect } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import { Disclaimer } from "@/components/ui";
import { currentAuth } from "@/lib/auth/session";

/** Every page under /app requires a valid session for an active member. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const auth = await currentAuth();
  if (!auth) redirect("/login");
  const { member, circle } = auth;
  return (
    <div className="min-h-dvh">
      <AppNav role={member.role} name={member.name} circleName={circle.name} isDemo={circle.isDemo} />
      <main id="main" className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6">
        {children}
        <footer className="no-print mt-12 border-t border-line pt-4">
          <Disclaimer />
        </footer>
      </main>
    </div>
  );
}
