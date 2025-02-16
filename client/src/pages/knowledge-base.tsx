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
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Save, Trash2, PlayCircle, Book } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { KnowledgeBase, InsertKnowledgeBase } from "@shared/schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Redirect } from "wouter";
import { Loader2 } from "lucide-react";

const GPT_VERSIONS = [
  { id: "gpt-4o", name: "GPT-4 Latest" },
  { id: "gpt-4", name: "GPT-4" },
  { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo" },
];

export default function KnowledgeBasePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState<number | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [testQuery, setTestQuery] = useState("");
  const [testResults, setTestResults] = useState<Record<number, any>>({});

  const { data: entries = [], isLoading } = useQuery<KnowledgeBase[]>({
    queryKey: ["/api/knowledge-base"],
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

  // Redirect to business profile if no business is associated
  if (!user?.businessId) {
    return <Redirect to="/business" />;
  }

  const addMutation = useMutation({
    mutationFn: async (data: InsertKnowledgeBase) => {
      await apiRequest("POST", "/api/knowledge-base", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-base"] });
      setShowAddDialog(false);
      toast({
        title: "Entry added",
        description: "Knowledge base entry has been added successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to add entry",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: InsertKnowledgeBase }) => {
      await apiRequest("PATCH", `/api/knowledge-base/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-base"] });
      setIsEditing(null);
      toast({
        title: "Entry updated",
        description: "Knowledge base entry has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update entry",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const testMutation = useMutation({
    mutationFn: async ({ id, type, query }: { id: number; type: "function" | "knowledge"; query?: string }) => {
      if (type === "function") {
        const res = await apiRequest("POST", `/api/knowledge-base/${id}/execute`, {});
        return res.json();
      } else {
        const res = await apiRequest("POST", `/api/knowledge-base/${id}/query`, { query });
        return res.json();
      }
    },
    onSuccess: (result, variables) => {
      setTestResults((prev) => ({ ...prev, [variables.id]: result }));
      toast({
        title: "Test completed",
        description: "Check the results panel to see the output.",
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

    const data: InsertKnowledgeBase = {
      title: formData.get("title") as string,
      content: formData.get("content") as string,
      type: formData.get("type") as "knowledge" | "function",
      chatgptVersion: formData.get("chatgptVersion") as string,
      isActive: formData.get("isActive") === "true",
      functionParameters: formData.get("type") === "function"
        ? {
            name: formData.get("functionName") as string,
            description: formData.get("functionDescription") as string,
            parameters: {
              type: "object",
              properties: JSON.parse(formData.get("functionParameters") as string || "{}"),
              required: (formData.get("requiredParameters") as string).split(",").filter(Boolean),
            },
          }
        : null,
    };

    if (id) {
      updateMutation.mutate({ id, data });
    } else {
      addMutation.mutate(data);
    }
  };

  const EntryForm = ({ entry }: { entry?: KnowledgeBase }) => {
    const [type, setType] = useState(entry?.type || "knowledge");

    return (
      <form onSubmit={(e) => handleSubmit(e, entry?.id)} className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="title">Title</Label>
          <Input id="title" name="title" defaultValue={entry?.title} required />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="type">Type</Label>
          <Select name="type" defaultValue={type} onValueChange={setType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="knowledge">Knowledge</SelectItem>
              <SelectItem value="function">Function</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="chatgptVersion">ChatGPT Version</Label>
          <Select name="chatgptVersion" defaultValue={entry?.chatgptVersion || "gpt-4o"}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GPT_VERSIONS.map((version) => (
                <SelectItem key={version.id} value={version.id}>
                  {version.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {type === "function" ? (
          <>
            <div className="grid gap-2">
              <Label htmlFor="functionName">Function Name</Label>
              <Input
                id="functionName"
                name="functionName"
                defaultValue={entry?.functionParameters?.name}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="functionDescription">Function Description</Label>
              <Textarea
                id="functionDescription"
                name="functionDescription"
                defaultValue={entry?.functionParameters?.description}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="functionParameters">Parameters (JSON)</Label>
              <Textarea
                id="functionParameters"
                name="functionParameters"
                defaultValue={JSON.stringify(
                  entry?.functionParameters?.parameters?.properties || {},
                  null,
                  2
                )}
                required
                rows={6}
              />
              <p className="text-sm text-muted-foreground">
                Example: {`{
  "name": { "type": "string", "description": "User's name" },
  "age": { "type": "number", "description": "User's age" }
}`}
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="requiredParameters">Required Parameters</Label>
              <Input
                id="requiredParameters"
                name="requiredParameters"
                defaultValue={entry?.functionParameters?.parameters?.required?.join(",")}
                placeholder="name,age"
              />
              <p className="text-sm text-muted-foreground">
                Comma-separated list of required parameter names
              </p>
            </div>
          </>
        ) : (
          <div className="grid gap-2">
            <Label htmlFor="content">Knowledge Content</Label>
            <Textarea
              id="content"
              name="content"
              defaultValue={entry?.content}
              required
              rows={8}
              placeholder="Enter the knowledge base content here..."
            />
          </div>
        )}

        <div className="flex items-center space-x-2">
          <Switch
            name="isActive"
            id="isActive"
            defaultChecked={entry?.isActive ?? true}
          />
          <Label htmlFor="isActive">Active</Label>
        </div>

        <div className="flex justify-end space-x-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (entry) {
                setIsEditing(null);
              } else {
                setShowAddDialog(false);
              }
            }}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={addMutation.isPending || updateMutation.isPending}>
            {entry ? "Save Changes" : "Add Entry"}
            {(addMutation.isPending || updateMutation.isPending) && (
              <Loader2 className="ml-2 h-4 w-4 animate-spin" />
            )}
          </Button>
        </div>
      </form>
    );
  };

  return (
    <DashboardShell>
      <PageHeader
        title="Knowledge Base"
        description="Manage your AI knowledge base entries and custom functions"
      />

      <div className="flex justify-end mt-8">
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Entry
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Add Knowledge Base Entry</DialogTitle>
            </DialogHeader>
            <EntryForm />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 mt-4">
        {entries.map((entry) => (
          <Card key={entry.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center">
                  {entry.type === "knowledge" ? (
                    <Book className="mr-2 h-5 w-5" />
                  ) : (
                    <PlayCircle className="mr-2 h-5 w-5" />
                  )}
                  {entry.title}
                </CardTitle>
                <div className="flex items-center space-x-2">
                  <div className="text-sm text-muted-foreground">
                    {format(new Date(entry.updatedAt), "MMM d, yyyy HH:mm")}
                  </div>
                  {entry.isActive ? (
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
              {isEditing === entry.id ? (
                <EntryForm entry={entry} />
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center space-x-4">
                    <div>
                      <span className="font-medium">Type:</span>{" "}
                      <span className="capitalize">{entry.type}</span>
                    </div>
                    <div>
                      <span className="font-medium">Model:</span>{" "}
                      {entry.chatgptVersion}
                    </div>
                  </div>

                  {entry.type === "function" ? (
                    <>
                      <div>
                        <span className="font-medium">Function Name:</span>{" "}
                        {entry.functionParameters?.name}
                      </div>
                      <div>
                        <span className="font-medium">Description:</span>{" "}
                        {entry.functionParameters?.description}
                      </div>
                      <div>
                        <span className="font-medium">Parameters:</span>
                        <pre className="mt-2 p-4 bg-slate-50 rounded-md overflow-x-auto">
                          {JSON.stringify(
                            entry.functionParameters?.parameters,
                            null,
                            2
                          )}
                        </pre>
                      </div>
                    </>
                  ) : (
                    <div>
                      <span className="font-medium">Content:</span>
                      <div className="mt-2 whitespace-pre-wrap">{entry.content}</div>
                    </div>
                  )}
                </div>
              )}

              {!isEditing && entry.isActive && (
                <div className="mt-6 pt-6 border-t">
                  <Tabs defaultValue="test">
                    <TabsList>
                      <TabsTrigger value="test">Test {entry.type === "function" ? "Function" : "Knowledge"}</TabsTrigger>
                      <TabsTrigger value="result">Last Result</TabsTrigger>
                    </TabsList>
                    <TabsContent value="test">
                      {entry.type === "knowledge" ? (
                        <div className="space-y-4">
                          <Textarea
                            value={testQuery}
                            onChange={(e) => setTestQuery(e.target.value)}
                            placeholder="Enter your question here..."
                            rows={3}
                          />
                          <Button
                            onClick={() =>
                              testMutation.mutate({
                                id: entry.id,
                                type: "knowledge",
                                query: testQuery,
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
                              "Test Knowledge"
                            )}
                          </Button>
                        </div>
                      ) : (
                        <Button
                          onClick={() =>
                            testMutation.mutate({
                              id: entry.id,
                              type: "function",
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
                            "Test Function"
                          )}
                        </Button>
                      )}
                    </TabsContent>
                    <TabsContent value="result">
                      <pre className="p-4 bg-slate-50 rounded-md overflow-x-auto">
                        {JSON.stringify(testResults[entry.id] || {}, null, 2)}
                      </pre>
                    </TabsContent>
                  </Tabs>
                </div>
              )}
            </CardContent>
            {!isEditing && (
              <CardFooter className="space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setIsEditing(entry.id)}
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