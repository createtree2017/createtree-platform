import React, { useState } from "react";
import { useModal } from "@/hooks/useModal";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getQueryFn } from "@/lib/queryClient";
import { InsertConceptCategory } from "@shared/schema";

import { Card } from "@/components/ui/card";
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
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { Edit, PlusCircle, Trash2 } from "lucide-react";

// Zod schema for concept category validation
export const conceptCategorySchema = z.object({
    categoryId: z.string().min(1, "ID is required"),
    name: z.string().min(1, "Name is required"),
    description: z.string().min(1, "Description is required"),
    systemPrompt: z.string().optional(),
    order: z.number().int().default(0),
    isActive: z.boolean().default(true),
});

// ConceptCategoryManager component
export default function ConceptCategoryManager() {
    const modal = useModal();
    const queryClient = useQueryClient();

    // Fetch concept categories
    const { data: categoriesData, isLoading, error } = useQuery({
        queryKey: ["/api/admin/concept-categories"],
        queryFn: getQueryFn()
    });
    const categories = (categoriesData || []) as any[];

    // Handler for editing a category
    const handleEditCategory = (category: InsertConceptCategory) => {
        modal.open('conceptCategory', { initialData: category });
    };

    // Delete concept category mutation
    const deleteCategoryMutation = useMutation({
        mutationFn: (categoryId: string) => apiRequest(`/api/admin/concept-categories/${categoryId}`, {
            method: "DELETE"
        }),
        onSuccess: () => {
            toast({
                title: "Category deleted",
                description: "The image concept category has been deleted successfully",
            });
            queryClient.invalidateQueries({ queryKey: ["/api/admin/concept-categories"] });
        },
        onError: (error) => {
            toast({
                title: "Error",
                description: "Failed to delete category. Please try again.",
                variant: "destructive",
            });
            console.error("Error deleting concept category:", error);
        },
    });

    // Handler for deleting a category
    const handleDeleteCategory = (categoryId: string) => {
        if (window.confirm("Are you sure you want to delete this category? This action cannot be undone and may affect associated concepts.")) {
            deleteCategoryMutation.mutate(categoryId);
        }
    };

    // Toggle active status mutation
    const toggleActiveMutation = useMutation({
        mutationFn: ({ categoryId, isActive }: { categoryId: string; isActive: boolean }) => {
            const category = categories.find((c: any) => c.categoryId === categoryId);
            return apiRequest(`/api/admin/concept-categories/${categoryId}`, {
                method: "PUT",
                body: JSON.stringify({
                    ...category,
                    isActive,
                }),
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/admin/concept-categories"] });
        },
        onError: (error) => {
            toast({
                title: "Error",
                description: "Failed to update category status. Please try again.",
                variant: "destructive",
            });
            console.error("Error toggling category status:", error);
        },
    });

    if (isLoading) {
        return <div className="text-center py-10">Loading concept categories...</div>;
    }

    if (error) {
        return <div className="text-center py-10 text-red-500">Error loading concept categories. Please refresh the page.</div>;
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">Image Generation Categories</h2>
                <Button onClick={() => modal.open('conceptCategory', {})}>
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Add New Category
                </Button>
            </div>

            {categories && categories.length > 0 ? (
                <Card className="w-full">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>Order</TableHead>
                                <TableHead>Active</TableHead>
                                <TableHead>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {categories.map((category: any) => (
                                <TableRow key={category.categoryId}>
                                    <TableCell className="font-medium">
                                        {category.name}
                                    </TableCell>
                                    <TableCell className="max-w-xs truncate">
                                        {category.description}
                                    </TableCell>
                                    <TableCell>{category.order}</TableCell>
                                    <TableCell>
                                        <Switch
                                            checked={category.isActive}
                                            onCheckedChange={(checked) =>
                                                toggleActiveMutation.mutate({ categoryId: category.categoryId, isActive: checked })
                                            }
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center space-x-2">
                                            <Button variant="ghost" size="sm" onClick={() => handleEditCategory(category)}>
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={() => handleDeleteCategory(category.categoryId)}>
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
                    <p className="text-gray-500">No concept categories found. Create your first category!</p>
                </div>
            )}
        </div>
    );
}

// Form component for creating/editing concept categories
interface ConceptCategoryFormProps {
    initialData?: InsertConceptCategory;
    onSuccess: () => void;
}

export function ConceptCategoryForm({ initialData, onSuccess }: ConceptCategoryFormProps) {
    const queryClient = useQueryClient();

    // Set up form
    const form = useForm<z.infer<typeof conceptCategorySchema>>({
        resolver: zodResolver(conceptCategorySchema),
        defaultValues: {
            categoryId: initialData?.categoryId || "",
            name: initialData?.name || "",
            description: initialData?.description || "",
            systemPrompt: initialData?.systemPrompt || "",
            order: initialData?.order ?? 0,
            isActive: initialData?.isActive ?? true,
        },
    });

    // Create/update mutation
    const submitMutation = useMutation({
        mutationFn: (values: z.infer<typeof conceptCategorySchema>) => {
            if (initialData) {
                return apiRequest(`/api/admin/concept-categories/${initialData.categoryId}`, {
                    method: "PUT",
                    body: JSON.stringify(values),
                });
            } else {
                return apiRequest("/api/admin/concept-categories", {
                    method: "POST",
                    body: JSON.stringify(values),
                });
            }
        },
        onSuccess: () => {
            toast({
                title: initialData ? "Category updated" : "Category created",
                description: initialData ?
                    "The concept category has been updated successfully" :
                    "The concept category has been created successfully",
            });
            queryClient.invalidateQueries({ queryKey: ["/api/admin/concept-categories"] });
            onSuccess();
        },
        onError: (error) => {
            toast({
                title: "Error",
                description: `Failed to ${initialData ? 'update' : 'create'} concept category. Please try again.`,
                variant: "destructive",
            });
            console.error(`Error ${initialData ? 'updating' : 'creating'} concept category:`, error);
        },
    });

    function onSubmit(values: z.infer<typeof conceptCategorySchema>) {
        submitMutation.mutate(values);
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                        control={form.control}
                        name="categoryId"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Category ID</FormLabel>
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
                                    <Input placeholder="Category name" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="order"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Display Order</FormLabel>
                                <FormControl>
                                    <Input type="number" value={field.value ?? 0} onChange={e => field.onChange(parseInt(e.target.value))} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="isActive"
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                                <FormControl>
                                    <Checkbox
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                    />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                    <FormLabel>Active</FormLabel>
                                    <p className="text-sm text-gray-500">
                                        Enable or disable this category
                                    </p>
                                </div>
                            </FormItem>
                        )}
                    />
                </div>

                <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                                <Textarea placeholder="Describe this concept category" {...field} value={field.value ?? ""} />
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
                            <FormLabel>GPT-4o 이미지 분석 지침</FormLabel>
                            <FormControl>
                                <Textarea
                                    placeholder="GPT-4o에게 이미지 분석 시 어떤 지침을 제공할지 입력하세요. 예: '이미지 속 인물의 얼굴, 포즈, 배경을 자세히 분석하고 인물의 특징을 유지하세요.'"
                                    className="min-h-[150px]"
                                    {...field}
                                    value={field.value ?? ""}
                                />
                            </FormControl>
                            <FormDescription>
                                이 지침은 이미지를 분석할 때 GPT-4o가 이미지의 어떤 부분을 우선적으로 분석할지, 어떤 특징을 유지할지 결정합니다.
                            </FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <div className="flex gap-2 justify-end">
                    <Button type="submit" disabled={submitMutation.isPending}>
                        {submitMutation.isPending ? (
                            <>
                                <span className="animate-spin mr-2">⏳</span>
                                {initialData ? "Updating..." : "Creating..."}
                            </>
                        ) : (
                            <>{initialData ? "Update" : "Create"} Category</>
                        )}
                    </Button>
                </div>
            </form>
        </Form>
    );
}
