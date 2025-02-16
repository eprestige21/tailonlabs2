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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery, useMutation } from "@tanstack/react-query";
import { UsageHistory, BillingTransaction } from "@shared/schema";
import { format } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import React from 'react';

export default function Billing() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [period, setPeriod] = React.useState("month");
  const [service, setService] = React.useState("all");

  const { data: usageHistory } = useQuery<UsageHistory[]>({
    queryKey: ["/api/usage-history", { period, service }],
  });

  const { data: transactions } = useQuery<BillingTransaction[]>({
    queryKey: ["/api/billing-transactions"],
  });

  const { data: business } = useQuery({
    queryKey: ["/api/business", user?.businessId],
    enabled: !!user?.businessId,
  });

  const updateAutoRechargeMutation = useMutation({
    mutationFn: async (data: { threshold: number; amount: number }) => {
      await apiRequest("POST", "/api/billing/auto-recharge", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/business", user?.businessId] });
      toast({
        title: "Settings updated",
        description: "Your auto-recharge settings have been saved.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update settings",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAutoRechargeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const threshold = parseFloat(form.threshold.value);
    const amount = parseFloat(form.amount.value);

    if (isNaN(threshold) || isNaN(amount)) {
      toast({
        title: "Invalid input",
        description: "Please enter valid numbers for threshold and amount",
        variant: "destructive",
      });
      return;
    }

    updateAutoRechargeMutation.mutate({ threshold, amount });
  };

  return (
    <DashboardShell>
      <PageHeader
        title="Billing & Usage"
        description="Manage your payment methods and view usage"
      />

      <div className="grid gap-6 mt-8">
        {/* Balance and Auto-recharge Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Balance & Auto-recharge Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6">
              <div className="flex items-center justify-between">
                <span className="font-medium">Current Balance</span>
                <span className="text-2xl font-bold">
                  ${business?.billingInfo?.balance?.toFixed(2) ?? "0.00"}
                </span>
              </div>

              <form onSubmit={handleAutoRechargeSubmit} className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="threshold">Auto-recharge Threshold</Label>
                  <Input
                    id="threshold"
                    name="threshold"
                    type="number"
                    defaultValue={business?.billingInfo?.autoRechargeThreshold}
                    className="max-w-xs"
                  />
                  <p className="text-sm text-muted-foreground">
                    Your account will be recharged when balance falls below this amount
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="amount">Auto-recharge Amount</Label>
                  <Input
                    id="amount"
                    name="amount"
                    type="number"
                    defaultValue={business?.billingInfo?.autoRechargeAmount}
                    className="max-w-xs"
                  />
                  <p className="text-sm text-muted-foreground">
                    Amount to add to your balance when auto-recharge is triggered
                  </p>
                </div>

                <Button 
                  type="submit" 
                  className="mt-4"
                  disabled={updateAutoRechargeMutation.isPending}
                >
                  Save Auto-recharge Settings
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>

        {/* Payment Method */}
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

        {/* Usage History */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Usage History</CardTitle>
            <div className="flex items-center gap-4">
              <Select 
                value={service} 
                onValueChange={setService}
              >
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Service" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Services</SelectItem>
                  <SelectItem value="chatgpt">ChatGPT</SelectItem>
                  <SelectItem value="twilio">Twilio</SelectItem>
                  <SelectItem value="heygen">Heygen</SelectItem>
                  <SelectItem value="elevenlabs">ElevenLabs</SelectItem>
                </SelectContent>
              </Select>
              <Select 
                value={period} 
                onValueChange={setPeriod}
              >
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Last Day</SelectItem>
                  <SelectItem value="week">Last Week</SelectItem>
                  <SelectItem value="month">Last Month</SelectItem>
                  <SelectItem value="year">Last Year</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usageHistory?.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      {format(new Date(item.timestamp), "MMM d, yyyy HH:mm")}
                    </TableCell>
                    <TableCell>{item.service}</TableCell>
                    <TableCell>{item.quantity.toString()}</TableCell>
                    <TableCell>${item.cost.toString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Transaction History */}
        <Card>
          <CardHeader>
            <CardTitle>Transaction History</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions?.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell>
                      {format(new Date(transaction.timestamp), "MMM d, yyyy HH:mm")}
                    </TableCell>
                    <TableCell>{transaction.type}</TableCell>
                    <TableCell>${transaction.amount.toString()}</TableCell>
                    <TableCell>{transaction.status}</TableCell>
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