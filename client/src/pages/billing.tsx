import { DashboardShell } from "@/components/ui/dashboard-shell";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function Billing() {
  const usage = [
    {
      service: "ChatGPT API",
      usage: "1,234 requests",
      cost: "$123.40",
    },
    {
      service: "Twilio SMS",
      usage: "2,345 messages",
      cost: "$234.50",
    },
    {
      service: "Heygen Video",
      usage: "12 minutes",
      cost: "$60.00",
    },
    {
      service: "ElevenLabs Voice",
      usage: "500 characters",
      cost: "$50.00",
    },
  ];

  return (
    <DashboardShell>
      <PageHeader
        title="Billing & Usage"
        description="Manage your payment methods and view usage"
      />

      <div className="grid gap-6 mt-8">
        <Card>
          <CardHeader>
            <CardTitle>Payment Method</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="card-number">Card Number</Label>
                <Input id="card-number" placeholder="4242 4242 4242 4242" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="expiry">Expiry Date</Label>
                  <Input id="expiry" placeholder="MM/YY" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="cvc">CVC</Label>
                  <Input id="cvc" placeholder="123" />
                </div>
              </div>
              <Button>Update Payment Method</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Usage & Costs</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usage.map((item) => (
                  <TableRow key={item.service}>
                    <TableCell>{item.service}</TableCell>
                    <TableCell>{item.usage}</TableCell>
                    <TableCell>{item.cost}</TableCell>
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
