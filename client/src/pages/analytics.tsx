import { DashboardShell } from "@/components/ui/dashboard-shell";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";

// Mock data - Replace with actual GA data
const mockData = [
  { date: "2024-02-10", pageViews: 120, sessions: 80, users: 65 },
  { date: "2024-02-11", pageViews: 150, sessions: 95, users: 78 },
  { date: "2024-02-12", pageViews: 180, sessions: 110, users: 90 },
  { date: "2024-02-13", pageViews: 165, sessions: 100, users: 85 },
  { date: "2024-02-14", pageViews: 200, sessions: 130, users: 100 },
  { date: "2024-02-15", pageViews: 190, sessions: 120, users: 95 },
  { date: "2024-02-16", pageViews: 210, sessions: 140, users: 110 },
];

const statsCards = [
  { title: "Total Users", value: "1,234", change: "+12.3%" },
  { title: "Page Views", value: "45.6K", change: "+8.7%" },
  { title: "Avg. Session Duration", value: "3m 45s", change: "+5.2%" },
  { title: "Bounce Rate", value: "42.3%", change: "-3.1%" },
];

export default function AnalyticsPage() {
  const { data: analyticsData = mockData, isLoading } = useQuery({
    queryKey: ["/api/analytics"],
    enabled: false, // Disabled until GA integration is implemented
  });

  return (
    <DashboardShell>
      <PageHeader
        title="Analytics"
        description="View detailed analytics and insights about your application usage."
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mt-6">
        {statsCards.map((stat, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className={`text-xs ${stat.change.startsWith('+') ? 'text-green-500' : 'text-red-500'}`}>
                {stat.change} from last month
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Traffic Overview</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-[400px]">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={analyticsData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(date) => format(new Date(date), "MMM d")}
                />
                <YAxis />
                <Tooltip
                  labelFormatter={(date) => format(new Date(date), "PPP")}
                />
                <Line
                  type="monotone"
                  dataKey="pageViews"
                  name="Page Views"
                  stroke="#0ea5e9"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="sessions"
                  name="Sessions"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="users"
                  name="Users"
                  stroke="#10b981"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
