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
import { Plus } from "lucide-react";

export default function KnowledgeBase() {
  const entries = [
    {
      title: "Customer Service Guidelines",
      type: "knowledge",
      content: "Standard operating procedures for handling customer inquiries...",
    },
    {
      title: "Process Refund",
      type: "function",
      content: "Steps to process a customer refund in the system...",
    },
  ];

  return (
    <DashboardShell>
      <PageHeader
        title="Knowledge Base"
        description="Manage ChatGPT knowledge and function definitions"
      />

      <div className="flex justify-end mt-8">
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Entry
        </Button>
      </div>

      <div className="grid gap-6 mt-4">
        {entries.map((entry) => (
          <Card key={entry.title}>
            <CardHeader>
              <CardTitle>{entry.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid gap-2">
                  <label>Title</label>
                  <Input defaultValue={entry.title} />
                </div>
                <div className="grid gap-2">
                  <label>Type</label>
                  <Select defaultValue={entry.type}>
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
                  <label>Content</label>
                  <Textarea defaultValue={entry.content} rows={4} />
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="mr-2">
                Cancel
              </Button>
              <Button>Save Changes</Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </DashboardShell>
  );
}
