import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ShieldCheck, ShieldOff } from "lucide-react";

export function TwoFactorAuth({ user }: { user: any }) {
  const { toast } = useToast();
  const [verificationCode, setVerificationCode] = useState("");
  const [showVerification, setShowVerification] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  const enableMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/2fa/enable");
      return res.json();
    },
    onSuccess: () => {
      setShowVerification(true);
      toast({
        title: "Verification code sent",
        description: "Please check your email for the verification code.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to enable 2FA",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async (code: string) => {
      const res = await apiRequest("POST", "/api/2fa/verify", { code });
      return res.json();
    },
    onSuccess: (data) => {
      setBackupCodes(data.backupCodes);
      toast({
        title: "2FA Enabled",
        description: "Two-factor authentication has been enabled successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Verification failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const disableMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/2fa/disable");
      return res.json();
    },
    onSuccess: () => {
      setShowVerification(false);
      setBackupCodes([]);
      toast({
        title: "2FA Disabled",
        description: "Two-factor authentication has been disabled.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to disable 2FA",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (backupCodes.length > 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Backup Codes</CardTitle>
          <CardDescription>
            Save these backup codes in a secure place. You can use them to access your account if you lose access to your authenticator device.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            {backupCodes.map((code, index) => (
              <code key={index} className="bg-muted p-2 rounded text-center">
                {code}
              </code>
            ))}
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={() => setBackupCodes([])}>Done</Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Two-Factor Authentication</CardTitle>
        <CardDescription>
          Add an extra layer of security to your account by enabling two-factor authentication.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {showVerification ? (
          <div className="space-y-4">
            <Alert>
              <AlertDescription>
                Enter the verification code sent to your email.
              </AlertDescription>
            </Alert>
            <Input
              type="text"
              placeholder="Enter verification code"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
            />
          </div>
        ) : user.twoFactorEnabled ? (
          <Alert>
            <ShieldCheck className="h-4 w-4" />
            <AlertDescription>
              Two-factor authentication is enabled on your account.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <ShieldOff className="h-4 w-4" />
            <AlertDescription>
              Two-factor authentication is not enabled on your account.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
      <CardFooter>
        {showVerification ? (
          <Button
            onClick={() => verifyMutation.mutate(verificationCode)}
            disabled={verifyMutation.isPending}
          >
            {verifyMutation.isPending ? (
              <>
                Verifying... <Loader2 className="ml-2 h-4 w-4 animate-spin" />
              </>
            ) : (
              "Verify Code"
            )}
          </Button>
        ) : user.twoFactorEnabled ? (
          <Button
            variant="destructive"
            onClick={() => disableMutation.mutate()}
            disabled={disableMutation.isPending}
          >
            {disableMutation.isPending ? (
              <>
                Disabling... <Loader2 className="ml-2 h-4 w-4 animate-spin" />
              </>
            ) : (
              "Disable 2FA"
            )}
          </Button>
        ) : (
          <Button
            onClick={() => enableMutation.mutate()}
            disabled={enableMutation.isPending}
          >
            {enableMutation.isPending ? (
              <>
                Enabling... <Loader2 className="ml-2 h-4 w-4 animate-spin" />
              </>
            ) : (
              "Enable 2FA"
            )}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
