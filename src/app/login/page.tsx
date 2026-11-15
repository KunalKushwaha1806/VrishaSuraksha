import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/AuthShell";
import { LoginForm } from "@/components/AuthForms";
import { LoadingState } from "@/components/ui";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <AuthShell title="Sign in" subtitle="Use your circle code, email and personal passcode.">
      <Suspense fallback={<LoadingState />}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
