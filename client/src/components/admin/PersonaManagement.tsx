import React, { useState } from "react";
import { useModal } from "@/hooks/useModal";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  InsertPersona,
  InsertPersonaCategory,
} from "@shared/schema";
import BatchImportDialog from "@/components/BatchImportDialog";

import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import {
  Edit, PlusCircle, Trash2, X, Download,
} from "lucide-react";

// Define form validation schemas using Zod
export const personaFormSchema = z.object({
  personaId: z.string().min(1, "ID is required"),
  name: z.string().min(1, "Name is required"),
  avatarEmoji: z.string().min(1, "Avatar emoji is required"),
  description: z.string().min(1, "Description is required"),
  welcomeMessage: z.string().min(1, "Welcome message is required"),
  systemPrompt: z.string().min(1, "System prompt is required"),
  primaryColor: z.string().min(1, "Primary color is required"),
  secondaryColor: z.string().min(1, "Secondary color is required"),
  personality: z.string().optional(),
  tone: z.string().optional(),
  usageContext: z.string().optional(),
  emotionalKeywords: z.array(z.string()).optional(),
  timeOfDay: z.enum(["morning", "afternoon", "evening", "night", "all"]),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  order: z.number().int().default(0),
  categories: z.array(z.string()).optional(),
});

// PersonaManager component for managing chat characters
export default function PersonaManager() {
  const modal = useModal();
  const queryClient = useQueryClient();

  // Fetch personas
  const { data: personas, isLoading, error } = useQuery({
    queryKey: ["/api/admin/personas"],
  });

  // Fetch categories for select dropdown
  const { data: categories } = useQuery({
    queryKey: ["/api/admin/categories"],
  });

  // Handler for editing a persona
  const handleEditPersona = (persona: InsertPersona) => {
    modal.open('persona', { initialData: persona, categories: categories || [] });
  };

  // Delete persona mutation
  const deletePersonaMutation = useMutation({
    mutationFn: (personaId: string) => apiRequest(`/api/admin/personas/${personaId}`, {
      method: "DELETE",
    }),
    onSuccess: () => {
      toast({
        title: "Character deleted",
        description: "The character has been deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/personas"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete character. Please try again.",
        variant: "destructive",
      });
      console.error("Error deleting persona:", error);
    },
  });

  // Handler for deleting a persona
  const handleDeletePersona = (personaId: string) => {
    if (window.confirm("Are you sure you want to delete this character? This action cannot be undone.")) {
      deletePersonaMutation.mutate(personaId);
    }
  };

  // Toggle persona active status mutation
  const toggleActiveMutation = useMutation({
    mutationFn: ({ personaId, isActive }: { personaId: string; isActive: boolean }) => {
      const persona = personas.find(p => p.personaId === personaId);
      return apiRequest(`/api/admin/personas/${personaId}`, {
        method: "PUT",
        body: JSON.stringify({
          ...persona,
          isActive,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/personas"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update character status. Please try again.",
        variant: "destructive",
      });
      console.error("Error toggling persona status:", error);
    },
  });

  // Toggle featured status mutation
  const toggleFeaturedMutation = useMutation({
    mutationFn: ({ personaId, isFeatured }: { personaId: string; isFeatured: boolean }) => {
      const persona = personas.find(p => p.personaId === personaId);
      return apiRequest(`/api/admin/personas/${personaId}`, {
        method: "PUT",
        body: JSON.stringify({
          ...persona,
          isFeatured,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/personas"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update featured status. Please try again.",
        variant: "destructive",
      });
      console.error("Error toggling featured status:", error);
    },
  });

  if (isLoading) {
    return <div className="text-center py-10">Loading characters...</div>;
  }

  if (error) {
    return <div className="text-center py-10 text-red-500">Error loading characters. Please refresh the page.</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">채팅 캐릭터</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => modal.open('batchImport', { categories: categories || [] })}>
            <Download className="h-4 w-4 mr-2" />
            일괄 가져오기
          </Button>
          <Button onClick={() => modal.open('persona', { categories: categories || [] })}>
            <PlusCircle className="h-4 w-4 mr-2" />
            새 캐릭터 추가
          </Button>
        </div>
      </div>

      {personas && personas.length > 0 ? (
        <Card className="w-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>캐릭터</TableHead>
                <TableHead>카테고리</TableHead>
                <TableHead>시간대</TableHead>
                <TableHead>활성화</TableHead>
                <TableHead>추천</TableHead>
                <TableHead>작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {personas.map((persona) => (
                <TableRow key={persona.personaId}>
                  <TableCell className="font-medium">
                    <div className="flex items-center space-x-2">
                      <span className="text-2xl">{persona.avatarEmoji}</span>
                      <div>
                        <div>{persona.name}</div>
                        <div className="text-xs text-gray-500">{persona.description.substring(0, 50)}...</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {persona.categories && Array.isArray(persona.categories) && persona.categories.map((categoryId) => {
                        const category = categories?.find(c => c.categoryId === categoryId);
                        return category ? (
                          <Badge key={categoryId} variant="outline" className="text-xs">
                            {category.emoji} {category.name}
                          </Badge>
                        ) : null;
                      })}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">
                      {persona.timeOfDay}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={persona.isActive}
                      onCheckedChange={(checked) =>
                        toggleActiveMutation.mutate({ personaId: persona.personaId, isActive: checked })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={persona.isFeatured}
                      onCheckedChange={(checked) =>
                        toggleFeaturedMutation.mutate({ personaId: persona.personaId, isFeatured: checked })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Button variant="ghost" size="sm" onClick={() => handleEditPersona(persona)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDeletePersona(persona.personaId)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <div className="text-center py-10 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <p className="text-gray-500">캐릭터가 없습니다. 첫 번째 캐릭터를 만들어보세요!</p>
        </div>
      )}
    </div>
  );
}

// Form component for creating/editing personas
interface PersonaFormProps {
  initialData?: InsertPersona;
  categories: InsertPersonaCategory[];
  onSuccess: () => void;
}

export function PersonaForm({ initialData, categories, onSuccess }: PersonaFormProps) {
  const queryClient = useQueryClient();
  const [emotionalKeyword, setEmotionalKeyword] = useState("");

  // Set up form
  const form = useForm<z.infer<typeof personaFormSchema>>({
    resolver: zodResolver(personaFormSchema),
    defaultValues: initialData || {
      personaId: "",
      name: "",
      avatarEmoji: "😊",
      description: "",
      welcomeMessage: "",
      systemPrompt: "",
      primaryColor: "#7c3aed",
      secondaryColor: "#ddd6fe",
      personality: "",
      tone: "",
      usageContext: "",
      emotionalKeywords: [],
      timeOfDay: "all",
      isActive: true,
      isFeatured: false,
      order: 0,
      categories: [],
    },
  });

  // Create/update persona mutation
  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof personaFormSchema>) => {
      if (initialData) {
        // Update existing persona
        return apiRequest(`/api/admin/personas/${initialData.personaId}`, {
          method: "PUT",
          body: JSON.stringify(values),
        });
      } else {
        // Create new persona
        return apiRequest("/api/admin/personas", {
          method: "POST",
          body: JSON.stringify(values),
        });
      }
    },
    onSuccess: () => {
      toast({
        title: initialData ? "Character updated" : "Character created",
        description: initialData
          ? "The character has been updated successfully."
          : "The new character has been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/personas"] });
      onSuccess();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: initialData
          ? "Failed to update character. Please try again."
          : "Failed to create character. Please try again.",
        variant: "destructive",
      });
      console.error("Error saving persona:", error);
    },
  });

  // Submit handler
  function onSubmit(values: z.infer<typeof personaFormSchema>) {
    mutation.mutate(values);
  }

  // Add emotional keyword
  const addEmotionalKeyword = () => {
    if (emotionalKeyword.trim() && !form.getValues("emotionalKeywords")?.includes(emotionalKeyword.trim())) {
      const currentKeywords = form.getValues("emotionalKeywords") || [];
      form.setValue("emotionalKeywords", [...currentKeywords, emotionalKeyword.trim()]);
      setEmotionalKeyword("");
    }
  };

  // Remove emotional keyword
  const removeEmotionalKeyword = (keyword: string) => {
    const currentKeywords = form.getValues("emotionalKeywords") || [];
    form.setValue(
      "emotionalKeywords",
      currentKeywords.filter(k => k !== keyword)
    );
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left column */}
          <div className="space-y-4">
            {/* Basic info */}
            <div className="space-y-4">
              <h3 className="text-md font-semibold">기본 정보</h3>

              <FormField
                control={form.control}
                name="personaId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ID</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="unique-id"
                        {...field}
                        disabled={!!initialData}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Character name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="avatarEmoji"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Avatar Emoji</FormLabel>
                    <FormControl>
                      <Input placeholder="Emoji" {...field} />
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
                      <Textarea
                        placeholder="Short description of this character"
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Messages & prompts */}
            <div className="space-y-4 pt-4">
              <h3 className="text-md font-semibold">Messages & Prompts</h3>

              <FormField
                control={form.control}
                name="welcomeMessage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Welcome Message</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Message shown when this character is selected"
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="systemPrompt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>System Prompt</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Instructions for AI on how to behave as this character"
                        className="resize-none h-40"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-4">
            {/* Colors */}
            <div className="space-y-4">
              <h3 className="text-md font-semibold">Theme Colors</h3>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="primaryColor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Primary Color</FormLabel>
                      <FormControl>
                        <div className="flex">
                          <Input
                            type="color"
                            className="w-12 h-10 p-1 mr-2"
                            {...field}
                          />
                          <Input
                            type="text"
                            placeholder="#000000"
                            value={field.value}
                            onChange={field.onChange}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="secondaryColor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Secondary Color</FormLabel>
                      <FormControl>
                        <div className="flex">
                          <Input
                            type="color"
                            className="w-12 h-10 p-1 mr-2"
                            {...field}
                          />
                          <Input
                            type="text"
                            placeholder="#000000"
                            value={field.value}
                            onChange={field.onChange}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Character attributes */}
            <div className="space-y-4 pt-4">
              <h3 className="text-md font-semibold">Character Attributes</h3>

              <FormField
                control={form.control}
                name="personality"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Personality</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Warm, empathetic, gentle" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tone</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Reassuring and calm" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="usageContext"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Usage Context</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., For moms struggling emotionally after birth" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="emotionalKeywords"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Emotional Keywords</FormLabel>
                    <div className="flex mb-2">
                      <Input
                        placeholder="e.g., anxious, overwhelmed"
                        value={emotionalKeyword}
                        onChange={(e) => setEmotionalKeyword(e.target.value)}
                        className="mr-2"
                      />
                      <Button
                        type="button"
                        onClick={addEmotionalKeyword}
                        variant="outline"
                        disabled={!emotionalKeyword.trim()}
                      >
                        Add
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {form.watch("emotionalKeywords")?.map((keyword) => (
                        <Badge key={keyword} variant="secondary" className="flex items-center gap-1">
                          {keyword}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-4 w-4 p-0 ml-1"
                            onClick={() => removeEmotionalKeyword(keyword)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </Badge>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="timeOfDay"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Time of Day Relevance</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a time of day" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="morning">Morning</SelectItem>
                        <SelectItem value="afternoon">Afternoon</SelectItem>
                        <SelectItem value="evening">Evening</SelectItem>
                        <SelectItem value="night">Night</SelectItem>
                        <SelectItem value="all">All Day</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Categories */}
            <div className="space-y-4 pt-4">
              <h3 className="text-md font-semibold">Categories & Admin</h3>

              <FormField
                control={form.control}
                name="categories"
                render={() => (
                  <FormItem>
                    <FormLabel>Categories</FormLabel>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {categories.map((category) => (
                        <FormField
                          key={category.categoryId}
                          control={form.control}
                          name="categories"
                          render={({ field }) => {
                            return (
                              <FormItem
                                key={category.categoryId}
                                className="flex flex-row items-start space-x-3 space-y-0"
                              >
                                <FormControl>
                                  <Checkbox
                                    checked={(field.value || []).includes(category.categoryId)}
                                    onCheckedChange={(checked) => {
                                      const currentValues = field.value || [];
                                      if (checked) {
                                        form.setValue("categories", [
                                          ...currentValues,
                                          category.categoryId,
                                        ]);
                                      } else {
                                        form.setValue(
                                          "categories",
                                          currentValues.filter(
                                            (value) => value !== category.categoryId
                                          )
                                        );
                                      }
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal cursor-pointer">
                                  {category.emoji} {category.name}
                                </FormLabel>
                              </FormItem>
                            );
                          }}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4 pt-4">
                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-0.5">
                        <FormLabel>Active</FormLabel>
                        <FormDescription className="text-xs">
                          Show in user interface
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="isFeatured"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-0.5">
                        <FormLabel>Featured</FormLabel>
                        <FormDescription className="text-xs">
                          Promote to users
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="order"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display Order</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? (
              "Saving..."
            ) : initialData ? (
              "Update Character"
            ) : (
              "Create Character"
            )}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}