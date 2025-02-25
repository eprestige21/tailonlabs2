import { DashboardShell } from "@/components/ui/dashboard-shell";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertBusinessSchema, type InsertBusiness } from "@shared/schema";
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
import GooglePlacesAutocomplete from 'react-google-places-autocomplete';

export default function BusinessProfile() {
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: business } = useQuery({
    queryKey: ["/api/business", user?.businessId],
    enabled: !!user?.businessId,
  });

  const form = useForm<InsertBusiness>({
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
    mutationFn: async (data: InsertBusiness) => {
      console.log("Submitting business data:", data);
      if (business) {
        const res = await apiRequest("PATCH", `/api/business/${business.id}`, data);
        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.message || "Failed to update business");
        }
        return res.json();
      } else {
        const res = await apiRequest("POST", "/api/business", data);
        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.message || "Failed to create business");
        }
        return res.json();
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/business"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({
        title: business ? "Business updated" : "Business created",
        description: business
          ? "Your business profile has been updated."
          : "Your business profile has been created.",
      });
      // Reset form with new data
      form.reset(data);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertBusiness) => {
    console.log("Form data:", data);
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
                            // Extract full address including ZIP code
                            const place = option?.value?.place;
                            if (place?.address_components) {
                              const components = place.address_components;
                              const streetNumber = components.find((c: any) => c.types.includes('street_number'))?.long_name || '';
                              const route = components.find((c: any) => c.types.includes('route'))?.long_name || '';
                              const city = components.find((c: any) => c.types.includes('locality'))?.long_name || '';
                              const state = components.find((c: any) => c.types.includes('administrative_area_level_1'))?.short_name || '';
                              const zipCode = components.find((c: any) => c.types.includes('postal_code'))?.long_name || '';
                              const fullAddress = `${streetNumber} ${route}, ${city}, ${state} ${zipCode}`.trim();
                              field.onChange(fullAddress);
                            } else {
                              // Fallback to the label if we can't get structured data
                              field.onChange(option?.label || '');
                            }
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