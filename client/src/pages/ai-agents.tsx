import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Agent } from "@shared/schema";
import { DashboardShell } from "@/components/ui/dashboard-shell";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Bot } from "lucide-react";

export default function AIAgentsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showAddDialog, setShowAddDialog] = useState(false);

  const { data: agents = [], isLoading } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
    enabled: !!user?.businessId,
  });

  if (!user?.businessId) {
    return null;
  }

  return (
    <DashboardShell>
      <PageHeader
        title="AI Agents"
        description="Create and manage your AI agents"
      />

      <div className="flex justify-end mb-6">
        <Link href="/ai-agent/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create New Agent
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-8">
          Loading agents...
        </div>
      ) : agents.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8">
          <Bot className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">No agents yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Create your first AI agent to get started
          </p>
          <Link href="/ai-agent/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create New Agent
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <Link key={agent.id} href={`/ai-agent/${agent.id}`}>
              <Card className="cursor-pointer hover:border-primary transition-colors">
                <CardHeader>
                  <div className="flex items-center space-x-2">
                    <Bot className="h-5 w-5 text-primary" />
                    <CardTitle>{agent.name}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {agent.description || "No description provided"}
                  </p>
                  {agent.isActive ? (
                    <div className="mt-2 inline-flex px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                      Active
                    </div>
                  ) : (
                    <div className="mt-2 inline-flex px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded-full">
                      Inactive
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}