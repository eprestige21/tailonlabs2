import { DashboardShell } from "@/components/ui/dashboard-shell";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
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
import { InsertVoiceSettings } from "@shared/schema";
import { Loader2, Volume2 } from "lucide-react";
import React from "react";

const AVAILABLE_VOICES = [
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel" },
  { id: "AZnzlk1XvdvUeBnXmlld", name: "Domi" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Bella" },
  { id: "ErXwobaYiN019PkySvjV", name: "Antoni" },
  { id: "MF3mGyEYCl7XYWbV9V6O", name: "Elli" },
  { id: "TxGEqnHWrfWFTfGW9XjX", name: "Josh" },
  { id: "VR6AewLTigWG4xSOukaG", name: "Arnold" },
  { id: "pNInz6obpgDQGcFmaJgB", name: "Adam" },
  { id: "yoZ06aMxZJJ28mfd3POQ", name: "Sam" },
];

const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "it", name: "Italian" },
  { code: "pt", name: "Portuguese" },
  { code: "pl", name: "Polish" },
  { code: "hi", name: "Hindi" },
];

export default function VoiceSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [previewText, setPreviewText] = React.useState(
    "Hello! This is a preview of how I will sound."
  );

  const { data: settings, isLoading } = useQuery({
    queryKey: ["/api/voice-settings"],
    enabled: !!user?.businessId,
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: InsertVoiceSettings) => {
      await apiRequest("POST", "/api/voice-settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voice-settings"] });
      toast({
        title: "Settings updated",
        description: "Your voice settings have been saved.",
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

  const previewVoiceMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await apiRequest("POST", "/api/voice-settings/preview", { text });
      // In a real implementation, this would return audio data to play
      return await res.blob();
    },
    onSuccess: (audioBlob) => {
      const url = URL.createObjectURL(audioBlob);
      const audio = new Audio(url);
      audio.play();
    },
    onError: (error: Error) => {
      toast({
        title: "Preview failed",
        description: error.message,
        variant: "destructive",
      });
    },
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    
    const data: InsertVoiceSettings = {
      voiceId: formData.get("voiceId") as string,
      name: AVAILABLE_VOICES.find(v => v.id === formData.get("voiceId"))?.name || "",
      language: formData.get("language") as string,
      stability: parseFloat(formData.get("stability") as string),
      similarityBoost: parseFloat(formData.get("similarityBoost") as string),
      style: parseFloat(formData.get("style") as string),
      speakingRate: parseFloat(formData.get("speakingRate") as string),
      pauseTime: parseFloat(formData.get("pauseTime") as string),
    };

    updateSettingsMutation.mutate(data);
  };

  return (
    <DashboardShell>
      <PageHeader
        title="Voice Settings"
        description="Configure your AI agent's voice settings powered by ElevenLabs"
      />

      <div className="grid gap-6 mt-8">
        <Card>
          <CardHeader>
            <CardTitle>Voice Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Voice Selection */}
              <div className="grid gap-2">
                <Label htmlFor="voiceId">Voice</Label>
                <Select name="voiceId" defaultValue={settings?.voiceId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a voice" />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_VOICES.map((voice) => (
                      <SelectItem key={voice.id} value={voice.id}>
                        {voice.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Language Selection */}
              <div className="grid gap-2">
                <Label htmlFor="language">Language</Label>
                <Select name="language" defaultValue={settings?.language}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a language" />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((lang) => (
                      <SelectItem key={lang.code} value={lang.code}>
                        {lang.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Voice Parameters */}
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label>Stability ({settings?.stability || "0.5"})</Label>
                  <Slider
                    name="stability"
                    defaultValue={[settings?.stability || 0.5]}
                    max={1}
                    step={0.01}
                    className="w-full"
                  />
                  <p className="text-sm text-muted-foreground">
                    Higher values will make the voice more consistent but may lose some expressiveness
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label>Similarity Boost ({settings?.similarityBoost || "0.75"})</Label>
                  <Slider
                    name="similarityBoost"
                    defaultValue={[settings?.similarityBoost || 0.75]}
                    max={1}
                    step={0.01}
                    className="w-full"
                  />
                  <p className="text-sm text-muted-foreground">
                    Increases the similarity to the original voice
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label>Style ({settings?.style || "0.0"})</Label>
                  <Slider
                    name="style"
                    defaultValue={[settings?.style || 0]}
                    max={1}
                    step={0.01}
                    className="w-full"
                  />
                  <p className="text-sm text-muted-foreground">
                    Higher values will add more expressiveness and style variations
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label>Speaking Rate ({settings?.speakingRate || "1.0"})</Label>
                  <Slider
                    name="speakingRate"
                    defaultValue={[settings?.speakingRate || 1]}
                    min={0.5}
                    max={2}
                    step={0.1}
                    className="w-full"
                  />
                </div>

                <div className="grid gap-2">
                  <Label>Pause Time ({settings?.pauseTime || "0.5"}s</Label>
                  <Slider
                    name="pauseTime"
                    defaultValue={[settings?.pauseTime || 0.5]}
                    min={0}
                    max={2}
                    step={0.1}
                    className="w-full"
                  />
                  <p className="text-sm text-muted-foreground">
                    Duration of pauses between sentences
                  </p>
                </div>
              </div>

              {/* Preview Section */}
              <div className="space-y-4">
                <Label htmlFor="previewText">Preview Text</Label>
                <div className="flex gap-4">
                  <Input
                    id="previewText"
                    value={previewText}
                    onChange={(e) => setPreviewText(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => previewVoiceMutation.mutate(previewText)}
                    disabled={previewVoiceMutation.isPending}
                  >
                    <Volume2 className="mr-2 h-4 w-4" />
                    Preview
                  </Button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={updateSettingsMutation.isPending}
              >
                Save Voice Settings
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
