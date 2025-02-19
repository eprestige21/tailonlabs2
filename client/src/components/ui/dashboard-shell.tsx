import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { Link, useLocation, useLocation as useWouterLocation } from "wouter";
import { Button } from "./button";
import {
  LayoutDashboard,
  Building2,
  Plug2,
  CreditCard,
  LogOut,
  Volume2,
  Brain,
  BarChart3,
  Activity,
  Users,
} from "lucide-react";

interface SidebarLinkProps {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  active?: boolean;
}

function SidebarLink({ href, icon, children, active }: SidebarLinkProps) {
  return (
    <Link href={href}>
      <Button
        variant="ghost"
        className={cn(
          "w-full justify-start",
          active && "bg-accent text-accent-foreground"
        )}
      >
        {icon}
        <span className="ml-2">{children}</span>
      </Button>
    </Link>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { logoutMutation } = useAuth();
  const [, setLocation] = useWouterLocation();

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        setLocation("/auth");
      }
    });
  };

  const links = [
    { href: "/", icon: <LayoutDashboard className="h-4 w-4" />, label: "Dashboard" },
    { href: "/business", icon: <Building2 className="h-4 w-4" />, label: "Business Profile" },
    { href: "/users", icon: <Users className="h-4 w-4" />, label: "Users" },
    { href: "/integrations", icon: <Plug2 className="h-4 w-4" />, label: "API Integrations" },
    { href: "/ai-agent", icon: <Brain className="h-4 w-4" />, label: "AI Agent" },
    { href: "/analytics", icon: <BarChart3 className="h-4 w-4" />, label: "Analytics" },
    { href: "/usage-stats", icon: <Activity className="h-4 w-4" />, label: "Usage Stats" },
    { href: "/billing", icon: <CreditCard className="h-4 w-4" />, label: "Billing" },
    { href: "/voice-settings", icon: <Volume2 className="h-4 w-4" />, label: "Voice Settings" },
  ];

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 border-r px-4 py-6">
        <div className="flex flex-col h-full">
          <div className="space-y-4">
            <div className="px-3 py-2">
              <h2 className="mb-2 text-lg font-semibold">Admin Panel</h2>
            </div>
            <nav className="space-y-1">
              {links.map((link) => (
                <SidebarLink
                  key={link.href}
                  href={link.href}
                  icon={link.icon}
                  active={location === link.href}
                >
                  {link.label}
                </SidebarLink>
              ))}
            </nav>
          </div>
          <div className="mt-auto">
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}