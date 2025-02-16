import { Switch, Route } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "./lib/protected-route";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import Dashboard from "@/pages/dashboard";
import BusinessProfile from "@/pages/business-profile";
import ApiIntegrations from "@/pages/api-integrations";
import Billing from "@/pages/billing";
import VoiceSettings from "@/pages/voice-settings";
import AgentsPage from "@/pages/agents";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <ProtectedRoute path="/" component={Dashboard} />
      <ProtectedRoute path="/business" component={BusinessProfile} />
      <ProtectedRoute path="/integrations" component={ApiIntegrations} />
      <ProtectedRoute path="/agents" component={AgentsPage} />
      <ProtectedRoute path="/billing" component={Billing} />
      <ProtectedRoute path="/voice-settings" component={VoiceSettings} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}