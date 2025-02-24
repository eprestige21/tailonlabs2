import { DashboardShell } from "@/components/ui/dashboard-shell";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import {
  CircleDollarSign,
  MessagesSquare,
  Plug2,
  Users,
  Brain,
} from "lucide-react";

export default function Dashboard() {
  const { user } = useAuth();

  const stats = [
    {
      title: "AI Agent Score",
      value: "9.6",
      icon: <Brain className="h-4 w-4 text-muted-foreground" />,
      link: "/ai-agent",
    },
    {
      title: "Active Integrations",
      value: "4",
      icon: <Plug2 className="h-4 w-4 text-muted-foreground" />,
    },
    {
      title: "Team Members",
      value: "12",
      icon: <Users className="h-4 w-4 text-muted-foreground" />,
    },
    {
      title: "Messages Sent",
      value: "1,234",
      icon: <MessagesSquare className="h-4 w-4 text-muted-foreground" />,
    },
    {
      title: "Monthly Spending",
      value: "$2,345",
      icon: <CircleDollarSign className="h-4 w-4 text-muted-foreground" />,
    },
  ];

  return (
    <DashboardShell>
      <PageHeader
        title={`Welcome back, ${user?.username}`}
        description="Here's an overview of your business operations"
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mt-8">
        {stats.map((stat) => {
          const CardComponent = ({ children }: { children: React.ReactNode }) => {
            if (stat.link) {
              return (
                <Link href={stat.link} className="block transition-transform hover:scale-105">
                  {children}
                </Link>
              );
            }
            return <>{children}</>;
          };

          return (
            <CardComponent key={stat.title}>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {stat.title}
                  </CardTitle>
                  {stat.icon}
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                </CardContent>
              </Card>
            </CardComponent>
          );
        })}
      </div>
    </DashboardShell>
  );
}