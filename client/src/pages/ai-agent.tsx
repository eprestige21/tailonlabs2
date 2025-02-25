import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Agent, InsertAgent, insertAgentSchema } from "@shared/schema";
import { DashboardShell } from "@/components/ui/dashboard-shell";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Save, Upload, Download, Globe, FileText, File } from "lucide-react";
import * as z from 'zod';
import { AgentFunction, KnowledgeBase, InsertAgentFunction, InsertKnowledgeBase } from "@shared/schema";
import { format } from "date-fns";


const PERSONALITY_TYPES = [
  { value: "friendly", label: "Friendly" },
  { value: "professional", label: "Professional" },
  { value: "humorous", label: "Humorous" },
];

const RESPONSE_TONES = [
  { value: "casual", label: "Casual" },
  { value: "formal", label: "Formal" },
  { value: "enthusiastic", label: "Enthusiastic" },
];

const AI_MODELS = [
  { value: "gpt-4", label: "GPT-4" },
  { value: "gpt-3.5", label: "GPT-3.5" },
  { value: "claude", label: "Claude" },
];

export default function AIAgentPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [temperatureValue, setTemperatureValue] = useState(0.7);

  const form = useForm({
    resolver: zodResolver(insertAgentSchema.extend({
      personality: z.string(),
      tone: z.string(),
      temperature: z.number().min(0).max(1),
      webhook: z.string().url().optional(),
    })),
    defaultValues: {
      name: "",
      description: "",
      personality: "professional",
      tone: "formal",
      model: "gpt-4",
      temperature: 0.7,
      systemPrompt: "",
      webhook: "",
    },
  });

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
      toast({
        title: "Agent created",
        description: "The AI agent has been created successfully.",
      });
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create agent",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = form.handleSubmit((data) => {
    if (!user?.businessId) {
      toast({
        title: "Error",
        description: "No business associated with your account. Please create a business profile first.",
        variant: "destructive",
      });
      return;
    }

    const agentData = {
      name: data.name,
      description: data.description,
      model: data.model,
      personality: data.personality,
      tone: data.tone,
      temperature: data.temperature,
      systemPrompt: `Personality: ${data.personality}\nTone: ${data.tone}\n\n${data.systemPrompt}`,
      isActive: true,
      businessId: user.businessId
    };
    console.log("Submitting agent data:", agentData); // Debug log
    addAgentMutation.mutate(agentData);
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


  const KnowledgeBaseSection = ({ agentId }: { agentId: number }) => {
    const { data: knowledge = [] } = useQuery<KnowledgeBase[]>({
      queryKey: [`/api/agents/${agentId}/knowledge`],
      enabled: !!agentId,
    });

    const handleBatchFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;

      for (const file of files) {
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
      }
    };

    const handleExport = async () => {
      try {
        const res = await apiRequest(
          "GET",
          `/api/agents/${agentId}/knowledge/export`
        );
        if (!res.ok) {
          throw new Error("Failed to export knowledge base");
        }

        const data = await res.blob();
        const url = window.URL.createObjectURL(data);
        const a = document.createElement('a');
        a.href = url;
        a.download = `knowledge-base-${agentId}-${new Date().toISOString()}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } catch (error) {
        toast({
          title: "Export failed",
          description: error instanceof Error ? error.message : "Failed to export knowledge base",
          variant: "destructive",
        });
      }
    };

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
            multiple
            className="hidden"
            id="batch-file-upload"
            onChange={handleBatchFileUpload}
          />
          <Button
            variant="outline"
            onClick={() => document.getElementById("batch-file-upload")?.click()}
          >
            <Upload className="mr-2 h-4 w-4" />
            Import Files
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export All
          </Button>
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
        title="Create AI Agent"
        description="Configure and deploy your custom AI agent"
      />

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Agent Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={onSubmit} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Agent Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter agent name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Describe your AI agent" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="personality"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Personality Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select personality" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PERSONALITY_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="tone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Response Tone</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select tone" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {RESPONSE_TONES.map((tone) => (
                            <SelectItem key={tone.value} value={tone.value}>
                              {tone.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="model"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>AI Model</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select AI model" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {AI_MODELS.map((model) => (
                          <SelectItem key={model.value} value={model.value}>
                            {model.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="temperature"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Temperature (Creativity Level)</FormLabel>
                    <FormControl>
                      <Input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={temperatureValue}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value);
                          setTemperatureValue(value);
                          field.onChange(value);
                        }}
                      />
                    </FormControl>
                    <div className="text-sm text-muted-foreground mt-1">
                      Current value: {temperatureValue}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="systemPrompt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>System Prompt</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        rows={4}
                        placeholder="Enter the system prompt for your agent..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="webhook"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Integration (Webhook URL)</FormLabel>
                    <FormControl>
                      <Input {...field} type="url" placeholder="https://your-webhook.com/endpoint" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full"
                disabled={addAgentMutation.isPending}
              >
                {addAgentMutation.isPending ? "Creating..." : "Create AI Agent"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {agents.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Your AI Agents</h2>
          <div className="grid gap-6">
            {agents.map((agent) => (
              <Card key={agent.id}>
                <CardHeader>
                  <CardTitle>{agent.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div>
                      <span className="font-medium">Model:</span> {agent.model}
                    </div>
                    <div>
                      <span className="font-medium">Status:</span>{" "}
                      <span className={agent.isActive ? "text-green-500" : "text-red-500"}>
                        {agent.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium">System Prompt:</span>
                      <Textarea
                        value={agent.systemPrompt}
                        readOnly
                        rows={3}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <span className="font-medium">Functions:</span>
                      <FunctionSection agentId={agent.id} />
                    </div>
                    <div>
                      <span className="font-medium">Knowledge Base:</span>
                      <KnowledgeBaseSection agentId={agent.id} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </DashboardShell>
  );
}