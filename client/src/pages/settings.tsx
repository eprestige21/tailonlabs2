import { useAuth } from "@/hooks/use-auth";
import { DashboardShell } from "@/components/ui/dashboard-shell";
import { PageHeader } from "@/components/ui/page-header";
import { TwoFactorAuth } from "@/components/two-factor-auth";

export default function Settings() {
  const { user } = useAuth();

  return (
    <DashboardShell>
      <PageHeader
        title="Security Settings"
        description="Manage your account security settings and two-factor authentication"
      />
      <div className="mt-8 max-w-xl">
        <TwoFactorAuth user={user} />
      </div>
    </DashboardShell>
  );
}
