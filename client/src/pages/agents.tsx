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
import { Plus, Save, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { Agent, InsertAgent } from "@shared/schema";
import { Redirect } from "wouter";
import { Loader2 } from "lucide-react";

const GPT_MODELS = [
  { id: "gpt-4o", name: "GPT-4 Omega (Latest)" },
  { id: "gpt-4-turbo", name: "GPT-4 Turbo" },
  { id: "gpt-4", name: "GPT-4" },
  { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo" },
];

export default function AgentsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState<number | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);

  const { data: agents = [], isLoading } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
    enabled: !!user?.businessId,
  });

  // Get business data
  const { data: business, isLoading: isBusinessLoading } = useQuery({
    queryKey: ["/api/business", user?.businessId],
    enabled: !!user?.businessId,
  });

  if (isLoading || isBusinessLoading) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardShell>
    );
  }

  // Redirect to business profile if no business is associated
  if (!isLoading && !user?.businessId) {
    return <Redirect to="/business" />;
  }

  const addMutation = useMutation({
    mutationFn: async (data: InsertAgent) => {
      await apiRequest("POST", "/api/agents", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      setShowAddDialog(false);
      toast({
        title: "Agent added",
        description: "New agent has been created successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to add agent",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: InsertAgent }) => {
      await apiRequest("PATCH", `/api/agents/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      setIsEditing(null);
      toast({
        title: "Agent updated",
        description: "Agent has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update agent",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent, id?: number) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);

    const data: InsertAgent = {
      name: formData.get("name") as string,
      model: formData.get("model") as string,
      systemPrompt: formData.get("systemPrompt") as string,
      isActive: formData.get("isActive") === "true",
      functions: JSON.parse(formData.get("functions") as string || "[]"),
    };

    if (id) {
      updateMutation.mutate({ id, data });
    } else {
      addMutation.mutate(data);
    }
  };

  const AgentForm = ({ agent }: { agent?: Agent }) => {
    return (
      <form onSubmit={(e) => handleSubmit(e, agent?.id)} className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="name">Agent Name</Label>
          <Input id="name" name="name" defaultValue={agent?.name} required />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="model">Model</Label>
          <Select name="model" defaultValue={agent?.model || "gpt-4o"}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GPT_MODELS.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  {model.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="systemPrompt">System Prompt</Label>
          <Textarea
            id="systemPrompt"
            name="systemPrompt"
            defaultValue={agent?.systemPrompt}
            required
            rows={4}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="functions">Functions (JSON Array)</Label>
          <Textarea
            id="functions"
            name="functions"
            defaultValue={JSON.stringify(agent?.functions || [], null, 2)}
            rows={6}
          />
          <p className="text-sm text-muted-foreground">
            Define functions that this agent can use in JSON format
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            name="isActive"
            id="isActive"
            defaultChecked={agent?.isActive ?? true}
          />
          <Label htmlFor="isActive">Active</Label>
        </div>

        <div className="flex justify-end space-x-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (agent) {
                setIsEditing(null);
              } else {
                setShowAddDialog(false);
              }
            }}
          >
            Cancel
          </Button>
          <Button type="submit">
            {agent ? "Save Changes" : "Create Agent"}
          </Button>
        </div>
      </form>
    );
  };

  return (
    <DashboardShell>
      <PageHeader
        title="AI Agents"
        description="Manage your ChatGPT agents and their capabilities"
      />

      <div className="flex justify-end mt-8">
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Agent
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Create New Agent</DialogTitle>
            </DialogHeader>
            <AgentForm />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 mt-4">
        {agents.map((agent) => (
          <Card key={agent.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{agent.name}</CardTitle>
                <div className="flex items-center space-x-2">
                  <div className="text-sm text-muted-foreground">
                    {format(new Date(agent.updatedAt), "MMM d, yyyy HH:mm")}
                  </div>
                  {agent.isActive ? (
                    <div className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                      Active
                    </div>
                  ) : (
                    <div className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded">
                      Inactive
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isEditing === agent.id ? (
                <AgentForm agent={agent} />
              ) : (
                <div className="space-y-4">
                  <div>
                    <span className="font-medium">Model:</span> {agent.model}
                  </div>
                  <div>
                    <span className="font-medium">System Prompt:</span>
                    <div className="mt-2 whitespace-pre-wrap">
                      {agent.systemPrompt}
                    </div>
                  </div>
                  <div>
                    <span className="font-medium">Functions:</span>
                    <pre className="mt-2 p-4 bg-gray-50 rounded-md overflow-x-auto">
                      {JSON.stringify(agent.functions || [], null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </CardContent>
            {isEditing !== agent.id && (
              <CardFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsEditing(agent.id)}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Edit
                </Button>
              </CardFooter>
            )}
          </Card>
        ))}
      </div>
    </DashboardShell>
  );
}
