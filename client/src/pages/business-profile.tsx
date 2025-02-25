import { DashboardShell } from "@/components/ui/dashboard-shell";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertBusinessSchema } from "@shared/schema";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import GooglePlacesAutocomplete from 'react-google-places-autocomplete';

export default function BusinessProfile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: business } = useQuery({
    queryKey: ["/api/business", user?.businessId],
    enabled: !!user?.businessId,
  });

  const form = useForm({
    resolver: zodResolver(insertBusinessSchema),
    defaultValues: business || {
      name: "",
      description: "",
      website: "",
      address: "",
      phoneNumber: "",
    },
  });

  const businessMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log("Submitting business data:", data); // Debug log
      if (business) {
        await apiRequest("PATCH", `/api/business/${business.id}`, data);
      } else {
        await apiRequest("POST", "/api/business", data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/business"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({
        title: business ? "Business updated" : "Business created",
        description: business
          ? "Your business profile has been updated."
          : "Your business profile has been created.",
      });
      if (!business) {
        setLocation("/knowledge-base");
      }
    },
    onError: (error: Error) => {
      console.error("Business mutation error:", error); // Debug log
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: any) => {
    console.log("Form data:", data); // Debug log
    businessMutation.mutate(data);
  };

  return (
    <DashboardShell>
      <PageHeader
        title="Business Profile"
        description="Manage your business information and settings"
      />

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Business Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="website"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Website</FormLabel>
                    <FormControl>
                      <Input {...field} type="url" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <GooglePlacesAutocomplete
                        apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}
                        selectProps={{
                          value: field.value ? { label: field.value, value: field.value } : null,
                          onChange: (option: any) => {
                            field.onChange(option?.label || '');
                          },
                          placeholder: "Start typing your address...",
                          className: "w-full",
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phoneNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input {...field} type="tel" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button 
                type="submit" 
                disabled={businessMutation.isPending}
              >
                {business ? "Update Profile" : "Create Business"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </DashboardShell>
  );
}