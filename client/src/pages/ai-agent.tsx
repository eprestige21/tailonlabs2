import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Agent, AgentFunction, KnowledgeBase, InsertAgent, InsertAgentFunction, InsertKnowledgeBase } from "@shared/schema";
import { DashboardShell } from "@/components/ui/dashboard-shell";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Save, Upload, Globe, FileText, File } from "lucide-react";
import { format } from "date-fns";

const LLM_MODELS = [
  { id: "gpt-4", name: "GPT-4" },
  { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo" },
];

export default function AIAgentPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedAgent, setSelectedAgent] = useState<number | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);

  const { data: agents = [], isLoading } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
    enabled: !!user?.businessId,
  });

  const addAgentMutation = useMutation({
    mutationFn: async (data: InsertAgent) => {
      const res = await apiRequest("POST", "/api/agents", data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create agent");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      setShowAddDialog(false);
      toast({
        title: "Agent created",
        description: "The AI agent has been created successfully.",
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

  const addFunctionMutation = useMutation({
    mutationFn: async ({ agentId, data }: { agentId: number; data: InsertAgentFunction }) => {
      const res = await apiRequest("POST", `/api/agents/${agentId}/functions`, data);
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [`/api/agents/${variables.agentId}/functions`] });
      toast({
        title: "Function added",
        description: "The function has been added to the agent.",
      });
    },
  });

  const addKnowledgeMutation = useMutation({
    mutationFn: async ({ agentId, data }: { agentId: number; data: InsertKnowledgeBase }) => {
      const res = await apiRequest("POST", `/api/agents/${agentId}/knowledge`, data);
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [`/api/agents/${variables.agentId}/knowledge`] });
      toast({
        title: "Knowledge added",
        description: "The knowledge base entry has been added.",
      });
    },
  });

  const updateKnowledgeMutation = useMutation({
    mutationFn: async ({ agentId, id, data }: { agentId: number; id: number; data: Partial<InsertKnowledgeBase> }) => {
      const res = await apiRequest("PATCH", `/api/agents/${agentId}/knowledge/${id}`, data);
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [`/api/agents/${variables.agentId}/knowledge`] });
      toast({
        title: "Knowledge updated",
        description: "The knowledge base entry has been updated.",
      });
    },
  });

  const AgentForm = () => {
    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const formData = new FormData(e.target as HTMLFormElement);
      const data: InsertAgent = {
        name: formData.get("name") as string,
        model: formData.get("model") as string,
        systemPrompt: formData.get("systemPrompt") as string,
        isActive: true,
      };

      addAgentMutation.mutate(data);
    };

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="name">Agent Name</Label>
          <Input id="name" name="name" required />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="model">LLM Model</Label>
          <Select name="model" defaultValue="gpt-4">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LLM_MODELS.map((model) => (
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
            required
            rows={4}
            placeholder="Enter the system prompt for the agent..."
          />
        </div>

        <div className="flex justify-end space-x-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowAddDialog(false)}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={addAgentMutation.isPending}>
            Create Agent
          </Button>
        </div>
      </form>
    );
  };

  const KnowledgeBaseSection = ({ agentId }: { agentId: number }) => {
    const { data: knowledge = [] } = useQuery<KnowledgeBase[]>({
      queryKey: [`/api/agents/${agentId}/knowledge`],
      enabled: !!agentId,
    });

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        const content = event.target?.result as string;
        const type = file.type.includes("xml")
          ? "xml"
          : file.type.includes("pdf")
          ? "pdf"
          : "text";

        const data: InsertKnowledgeBase = {
          title: file.name,
          type,
          content,
          metadata: {
            mimeType: file.type,
            fileSize: file.size,
          },
        };

        addKnowledgeMutation.mutate({ agentId, data });
      };
      reader.readAsText(file);
    };

    const handleUrlSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      const formData = new FormData(e.target as HTMLFormElement);

      const data: InsertKnowledgeBase = {
        title: formData.get("title") as string,
        type: "url",
        content: formData.get("content") as string,
        metadata: {
          sourceUrl: formData.get("url") as string,
        },
      };

      addKnowledgeMutation.mutate({ agentId, data });
    };

    return (
      <div className="space-y-4">
        <div className="flex gap-4">
          <input
            type="file"
            accept=".txt,.pdf,.xml"
            className="hidden"
            id="file-upload"
            onChange={handleFileUpload}
          />
          <Button
            variant="outline"
            onClick={() => document.getElementById("file-upload")?.click()}
          >
            <Upload className="mr-2 h-4 w-4" />
            Upload File
          </Button>
        </div>

        <form onSubmit={handleUrlSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="url">Add URL</Label>
            <Input
              id="url"
              name="url"
              type="url"
              placeholder="https://example.com"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              name="title"
              placeholder="Enter a title for this knowledge"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="content">Content</Label>
            <Textarea
              id="content"
              name="content"
              rows={6}
              placeholder="Enter or edit the content..."
              required
            />
          </div>
          <Button type="submit" disabled={addKnowledgeMutation.isPending}>
            Add URL Content
          </Button>
        </form>

        <div className="mt-8">
          <h3 className="text-lg font-medium mb-4">Knowledge Base Entries</h3>
          <div className="space-y-4">
            {knowledge.map((entry) => (
              <Card key={entry.id}>
                <CardHeader>
                  <CardTitle className="flex items-center text-base">
                    {entry.type === "url" ? (
                      <Globe className="mr-2 h-4 w-4" />
                    ) : entry.type === "pdf" ? (
                      <File className="mr-2 h-4 w-4" />
                    ) : (
                      <FileText className="mr-2 h-4 w-4" />
                    )}
                    {entry.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground mb-2">
                    Added on {format(new Date(entry.createdAt), "PPP")}
                  </div>
                  {entry.type === "url" && (
                    <div className="text-sm text-muted-foreground mb-4">
                      Source: {entry.metadata?.sourceUrl}
                    </div>
                  )}
                  <Textarea
                    value={entry.content}
                    onChange={(e) => {
                      updateKnowledgeMutation.mutate({
                        agentId,
                        id: entry.id,
                        data: { content: e.target.value },
                      });
                    }}
                    rows={4}
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const FunctionSection = ({ agentId }: { agentId: number }) => {
    const { data: functions = [] } = useQuery<AgentFunction[]>({
      queryKey: [`/api/agents/${agentId}/functions`],
      enabled: !!agentId,
    });

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const formData = new FormData(e.target as HTMLFormElement);

      try {
        const parameters = JSON.parse(formData.get("parameters") as string);
        const data: InsertAgentFunction = {
          name: formData.get("name") as string,
          description: formData.get("description") as string,
          parameters,
        };

        addFunctionMutation.mutate({ agentId, data });
        (e.target as HTMLFormElement).reset();
      } catch (error) {
        toast({
          title: "Invalid parameters",
          description: "Please enter valid JSON for the parameters",
          variant: "destructive",
        });
      }
    };

    return (
      <div className="space-y-8">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Function Name</Label>
            <Input id="name" name="name" required />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              required
              rows={2}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="parameters">Parameters (JSON)</Label>
            <Textarea
              id="parameters"
              name="parameters"
              required
              rows={6}
              placeholder={`{
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "description": "User's name"
    }
  },
  "required": ["name"]
}`}
            />
          </div>

          <Button type="submit" disabled={addFunctionMutation.isPending}>
            Add Function
          </Button>
        </form>

        <div>
          <h3 className="text-lg font-medium mb-4">Added Functions</h3>
          <div className="space-y-4">
            {functions.map((func) => (
              <Card key={func.id}>
                <CardHeader>
                  <CardTitle className="text-base">{func.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    {func.description}
                  </p>
                  <pre className="bg-secondary p-4 rounded-md text-sm overflow-x-auto">
                    {JSON.stringify(func.parameters, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <DashboardShell>
      <PageHeader
        title="AI Agent"
        description="Create and manage your AI agents with custom functions and knowledge base"
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

      <div className="mt-8">
        {agents.map((agent) => (
          <Card key={agent.id} className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{agent.name}</span>
                <span className="text-sm font-normal text-muted-foreground">
                  {agent.model}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="prompt" className="w-full">
                <TabsList>
                  <TabsTrigger value="prompt">System Prompt</TabsTrigger>
                  <TabsTrigger value="functions">Functions</TabsTrigger>
                  <TabsTrigger value="knowledge">Knowledge Base</TabsTrigger>
                </TabsList>

                <TabsContent value="prompt">
                  <Textarea
                    value={agent.systemPrompt}
                    readOnly
                    rows={4}
                    className="w-full mt-4"
                  />
                </TabsContent>

                <TabsContent value="functions">
                  <div className="mt-4">
                    <FunctionSection agentId={agent.id} />
                  </div>
                </TabsContent>

                <TabsContent value="knowledge">
                  <div className="mt-4">
                    <KnowledgeBaseSection agentId={agent.id} />
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        ))}
      </div>
    </DashboardShell>
  );
}