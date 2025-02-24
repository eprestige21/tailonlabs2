import { useState } from "react";
import { DashboardShell } from "@/components/ui/dashboard-shell";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, MessageCircle, Bot, Zap } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { Agent, InsertAgent } from "@shared/schema";
import { Redirect } from "wouter";
import { Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const GPT_MODELS = [
  { id: "gpt-4o", name: "GPT-4 Omega (Latest)" },
  { id: "gpt-4", name: "GPT-4" },
  { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo" },
];

export default function Agents() {
  console.log("Rendering Agents page"); // Debug log
  const { user } = useAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState<number | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [testPrompt, setTestPrompt] = useState("");
  const [testResults, setTestResults] = useState<Record<number, string>>({});

  const { data: agents = [], isLoading } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  console.log("Agents data:", agents); // Debug log
  console.log("Loading state:", isLoading); // Debug log

  if (isLoading) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <PageHeader
        title="AI Agents"
        description="Create and manage your AI agents"
      />

      <div className="flex justify-end mt-8">
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Agent
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Create New AI Agent</DialogTitle>
            </DialogHeader>
            <div>Create agent form will go here</div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 mt-4">
        {agents.map((agent) => (
          <Card key={agent.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Bot className="h-5 w-5 text-primary" />
                  <CardTitle>{agent.name}</CardTitle>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="text-sm text-muted-foreground">
                    {format(new Date(agent.updatedAt), "MMM d, yyyy HH:mm")}
                  </div>
                  {agent.isActive ? (
                    <div className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                      Active
                    </div>
                  ) : (
                    <div className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded-full">
                      Inactive
                    </div>
                  )}
                </div>
              </div>
              <CardDescription className="mt-2">
                Using {GPT_MODELS.find(m => m.id === agent.model)?.name || agent.model}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {agent.description || "No description provided"}
              </p>
            </CardContent>
            <CardFooter>
              <Button
                variant="outline"
                onClick={() => setIsEditing(agent.id)}
              >
                Edit Agent Settings
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </DashboardShell>
  );
}