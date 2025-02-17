import React from "react";
import { DashboardShell } from "@/components/ui/dashboard-shell";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react";
import { useState } from "react";

const TIME_PERIODS = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "week", label: "Last Week" },
  { value: "month", label: "Last Month" },
  { value: "custom", label: "Custom Range" },
];

const SERVICES = [
  { name: "ChatGPT", metric: "tokens", icon: "💬" },
  { name: "ElevenLabs", metric: "minutes", icon: "🔊" },
  { name: "HeyGen", metric: "minutes", icon: "🎥" },
  { name: "Twilio", metric: "minutes", icon: "📞" },
];

const UsageStatsPage = () => {
  const [period, setPeriod] = useState("today");
  const [dateRange, setDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: new Date(),
    to: new Date(),
  });
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const { data: usageData, isLoading } = useQuery({
    queryKey: ["/api/usage-history", period, dateRange.from?.toISOString(), dateRange.to?.toISOString()],
    queryFn: async () => {
      const params = new URLSearchParams({
        period,
        ...(period === "custom" && dateRange.from && dateRange.to && {
          from: dateRange.from.toISOString(),
          to: dateRange.to.toISOString(),
        }),
      });
      const response = await fetch(`/api/usage-history?${params}`);
      if (!response.ok) {
        throw new Error("Failed to fetch usage data");
      }
      return response.json();
    },
  });

  return (
    <DashboardShell>
      <PageHeader
        title="Usage Statistics"
        description="Monitor your AI services consumption"
      />

      <div className="flex items-center gap-4 mt-6">
        <Select
          value={period}
          onValueChange={(value) => {
            setPeriod(value);
            if (value !== "custom") {
              setIsCalendarOpen(false);
            }
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select time period" />
          </SelectTrigger>
          <SelectContent>
            {TIME_PERIODS.map((period) => (
              <SelectItem key={period.value} value={period.value}>
                {period.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {period === "custom" && (
          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-[300px] justify-start text-left font-normal",
                  !dateRange.from && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, "LLL dd, y")} -{" "}
                      {format(dateRange.to, "LLL dd, y")}
                    </>
                  ) : (
                    format(dateRange.from, "LLL dd, y")
                  )
                ) : (
                  "Pick a date range"
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange.from}
                selected={{
                  from: dateRange.from,
                  to: dateRange.to,
                }}
                onSelect={(range) => {
                  if (range) {
                    setDateRange(range);
                    if (range.from && range.to) {
                      setIsCalendarOpen(false);
                    }
                  }
                }}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mt-6">
        {isLoading ? (
          <div className="col-span-full flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          SERVICES.map((service) => {
            const usage = usageData?.[service.name.toLowerCase()] || 0;
            return (
              <Card key={service.name}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {service.icon} {service.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {usage.toLocaleString()} {service.metric}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Usage for selected period
                  </p>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </DashboardShell>
  );
};

export default UsageStatsPage;