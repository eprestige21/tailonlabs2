import { useState, useEffect } from "react";
import { DashboardShell } from "@/components/ui/dashboard-shell";
import { PageHeader } from "@/components/ui/page-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
import { useLocation } from "wouter";

export default function BusinessProfile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: business, refetch: refetchBusiness } = useQuery({
    queryKey: ["/api/business", user?.businessId],
    enabled: !!user?.businessId,
  });

  const form = useForm<InsertBusiness>({
    resolver: zodResolver(insertBusinessSchema),
    defaultValues: {
      name: "",
      description: "",
      website: "",
      address: "",
      phoneNumber: "",
    }
  });

  // Update form when business data is fetched
  useEffect(() => {
    if (business) {
      form.reset(business);
    }
  }, [business, form]);

  const businessMutation = useMutation({
    mutationFn: async (data: InsertBusiness) => {
      if (user?.businessId) {
        const res = await apiRequest("PATCH", `/api/business/${user.businessId}`, data);
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
    onSuccess: async (data) => {
      // Invalidate both queries to trigger a refetch
      queryClient.invalidateQueries({ queryKey: ["/api/business"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });

      // Wait for the queries to refetch
      await Promise.all([
        refetchBusiness(),
        queryClient.refetchQueries({ queryKey: ["/api/user"] })
      ]);

      toast({
        title: user?.businessId ? "Business updated" : "Business created",
        description: user?.businessId
          ? "Your business profile has been updated."
          : "Your business profile has been created.",
      });

      // If this was a new business creation, redirect to dashboard
      if (!user?.businessId) {
        setLocation("/");
      }
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
    businessMutation.mutate(data);
  };

  return (
    <DashboardShell>
      <PageHeader
        title="Business Profile"
        description={user?.businessId ? "Manage your business information" : "Create your business profile"}
      />

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>{user?.businessId ? "Business Information" : "Create Business Profile"}</CardTitle>
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
                {user?.businessId ? "Save Changes" : "Create Business"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </DashboardShell>
  );
}