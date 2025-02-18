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

export default function AgentsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState<number | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [testPrompt, setTestPrompt] = useState("");
  const [testResults, setTestResults] = useState<Record<number, string>>({});

  const { data: agents = [], isLoading } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
    enabled: !!user?.businessId,
  });

  if (isLoading) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardShell>
    );
  }

  if (!user?.businessId) {
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
        title: "Agent created",
        description: "New AI agent has been created successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create agent",
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
        description: "AI agent has been updated successfully.",
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

  const testMutation = useMutation({
    mutationFn: async ({ id, prompt }: { id: number; prompt: string }) => {
      const res = await apiRequest("POST", `/api/agents/${id}/test`, { prompt });
      const data = await res.json();
      return data.response;
    },
    onSuccess: (response, variables) => {
      setTestResults((prev) => ({ ...prev, [variables.id]: response }));
      toast({
        title: "Test completed",
        description: "Check the response in the results panel.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Test failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent, id?: number) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);

    const data: InsertAgent = {
      name: formData.get("name") as string,
      description: formData.get("description") as string,
      model: formData.get("model") as string,
      systemPrompt: formData.get("systemPrompt") as string,
      isActive: formData.get("isActive") === "true",
      personality: "professional",
      tone: "formal",
      temperature: 0.7,
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
          <Input 
            id="name" 
            name="name" 
            defaultValue={agent?.name} 
            placeholder="Customer Support Agent"
            required 
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" name="description" defaultValue={agent?.description} placeholder="Enter a brief description for your agent" rows={3} />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="model">Language Model</Label>
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
          <p className="text-sm text-muted-foreground">
            Select the GPT model that best suits your agent's needs.
          </p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="systemPrompt">System Prompt</Label>
          <Textarea
            id="systemPrompt"
            name="systemPrompt"
            defaultValue={agent?.systemPrompt}
            placeholder="You are a helpful customer support agent..."
            required
            rows={6}
          />
          <p className="text-sm text-muted-foreground">
            Define the agent's personality, role, and behavior through this prompt.
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
          <Button type="submit" disabled={addMutation.isPending || updateMutation.isPending}>
            {agent ? (
              <>
                Update Agent
                {updateMutation.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
              </>
            ) : (
              <>
                Create Agent
                {addMutation.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
              </>
            )}
          </Button>
        </div>
      </form>
    );
  };

  return (
    <DashboardShell>
      <PageHeader
        title="AI Agents"
        description="Create and manage AI agents with different personalities and capabilities"
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
            <AgentForm />
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
              {isEditing === agent.id ? (
                <AgentForm agent={agent} />
              ) : (
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm">System Prompt</Label>
                    <div className="mt-1 p-4 bg-slate-50 rounded-lg whitespace-pre-wrap">
                      {agent.systemPrompt}
                    </div>
                  </div>

                  {agent.isActive && (
                    <div className="mt-6 pt-6 border-t">
                      <Tabs defaultValue="test">
                        <TabsList>
                          <TabsTrigger value="test">Test Chat</TabsTrigger>
                          <TabsTrigger value="result">Last Response</TabsTrigger>
                        </TabsList>
                        <TabsContent value="test">
                          <div className="space-y-4">
                            <Textarea
                              value={testPrompt}
                              onChange={(e) => setTestPrompt(e.target.value)}
                              placeholder="Enter your message to test the agent..."
                              rows={3}
                            />
                            <Button
                              onClick={() =>
                                testMutation.mutate({
                                  id: agent.id,
                                  prompt: testPrompt,
                                })
                              }
                              disabled={testMutation.isPending}
                            >
                              {testMutation.isPending ? (
                                <>
                                  Testing...
                                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                                </>
                              ) : (
                                <>
                                  <MessageCircle className="mr-2 h-4 w-4" />
                                  Send Message
                                </>
                              )}
                            </Button>
                          </div>
                        </TabsContent>
                        <TabsContent value="result">
                          <div className="p-4 bg-slate-50 rounded-lg whitespace-pre-wrap">
                            {testResults[agent.id] || "No response yet"}
                          </div>
                        </TabsContent>
                      </Tabs>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
            {!isEditing && (
              <CardFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsEditing(agent.id)}
                >
                  Edit Agent Settings
                </Button>
              </CardFooter>
            )}
          </Card>
        ))}
      </div>
    </DashboardShell>
  );
}