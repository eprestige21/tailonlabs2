import { DashboardShell } from "@/components/ui/dashboard-shell";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import type { Agent, AgentEvaluation } from "@shared/schema";
import { format } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function AgentEvaluations() {
  const { data: agents } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const { data: evaluations } = useQuery<AgentEvaluation[]>({
    queryKey: ["/api/agent-evaluations"],
  });

  return (
    <DashboardShell>
      <PageHeader
        title="Agent Evaluations"
        description="Monitor and analyze agent performance scores"
      />

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Performance Overview</CardTitle>
              <Select>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select Agent" />
                </SelectTrigger>
                <SelectContent>
                  {agents?.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id.toString()}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Conversation ID</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Correct/Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {evaluations?.map((evaluation) => (
                  <TableRow key={evaluation.id}>
                    <TableCell>{evaluation.conversationId}</TableCell>
                    <TableCell>
                      {format(new Date(evaluation.evaluationDate), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="font-medium">
                      {Number(evaluation.score).toFixed(1)}
                    </TableCell>
                    <TableCell>
                      {evaluation.correctResponses}/{evaluation.totalQuestions}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}