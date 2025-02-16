import { DashboardShell } from "@/components/ui/dashboard-shell";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  SiOpenai,
  SiTwilio,
  SiElevenlabs,
} from "react-icons/si";

export default function ApiIntegrations() {
  const integrations = [
    {
      name: "ChatGPT",
      icon: <SiOpenai className="h-6 w-6" />,
      description: "AI-powered conversational capabilities",
      connected: true,
    },
    {
      name: "Twilio",
      icon: <SiTwilio className="h-6 w-6" />,
      description: "Phone, SMS, and chat functionality",
      connected: false,
    },
    {
      name: "Heygen",
      icon: <SiOpenai className="h-6 w-6" />,
      description: "Video generation platform",
      connected: false,
    },
    {
      name: "ElevenLabs",
      icon: <SiElevenlabs className="h-6 w-6" />,
      description: "Voice synthesis and audio processing",
      connected: true,
    },
  ];

  return (
    <DashboardShell>
      <PageHeader
        title="API Integrations"
        description="Connect and manage your third-party service integrations"
      />

      <div className="grid gap-6 mt-8">
        {integrations.map((integration) => (
          <Card key={integration.name}>
            <CardHeader>
              <div className="flex items-center space-x-4">
                {integration.icon}
                <div>
                  <CardTitle>{integration.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {integration.description}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  <Label>API Key</Label>
                  <Input type="password" value="••••••••••••••••" />
                  <Button variant="outline">Update</Button>
                </div>
                <div className="flex items-center space-x-4">
                  <Label>Enable Integration</Label>
                  <Switch checked={integration.connected} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </DashboardShell>
  );
}
