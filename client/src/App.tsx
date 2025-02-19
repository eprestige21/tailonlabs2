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
import AIAgentPage from "@/pages/ai-agent";
import AnalyticsPage from "@/pages/analytics";
import UsageStatsPage from "@/pages/usage-stats";
import Users from "@/pages/users";
import ForgotPassword from "@/pages/forgot-password";

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
      <Route path="/forgot-password" component={ForgotPassword} />
      <ProtectedRoute path="/" component={Dashboard} />
      <ProtectedRoute path="/business" component={BusinessProfile} />
      <ProtectedRoute path="/integrations" component={ApiIntegrations} />
      <ProtectedRoute path="/billing" component={Billing} />
      <ProtectedRoute path="/voice-settings" component={VoiceSettings} />
      <ProtectedRoute path="/ai-agent" component={AIAgentPage} />
      <ProtectedRoute path="/analytics" component={AnalyticsPage} />
      <ProtectedRoute path="/usage-stats" component={UsageStatsPage} />
      <ProtectedRoute path="/users" component={Users} />
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