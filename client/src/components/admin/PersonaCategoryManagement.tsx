import React from "react";
import { useModal } from "@/hooks/useModal";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
    InsertPersonaCategory,
} from "@shared/schema";

import {
    Card,
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
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import {
    Edit, PlusCircle, Trash2,
} from "lucide-react";

// Define form validation schema for category
export const categoryFormSchema = z.object({
    categoryId: z.string().min(1, "ID is required"),
    name: z.string().min(1, "Name is required"),
    description: z.string().min(1, "Description is required"),
    emoji: z.string().min(1, "Emoji is required"),
    order: z.number().int().default(0),
    isActive: z.boolean().default(true),
});

// CategoryManager component for managing persona categories
export default function PersonaCategoryManager() {
    const modal = useModal();
    const queryClient = useQueryClient();

    // Fetch categories
    const { data: categories, isLoading, error } = useQuery({
        queryKey: ["/api/admin/categories"],
    });

    // Handler for editing a category
    const handleEditCategory = (category: InsertPersonaCategory) => {
        modal.open('personaCategory', { initialData: category });
    };

    // Delete category mutation
    const deleteCategoryMutation = useMutation({
        mutationFn: (categoryId: string) => apiRequest(`/api/admin/categories/${categoryId}`, {
            method: "DELETE",
        }),
        onSuccess: () => {
            toast({
                title: "Category deleted",
                description: "The category has been deleted successfully",
            });
            queryClient.invalidateQueries({ queryKey: ["/api/admin/categories"] });
        },
        onError: (error) => {
            toast({
                title: "Error",
                description: "Failed to delete category. Please try again.",
                variant: "destructive",
            });
            console.error("Error deleting category:", error);
        },
    });

    // Handler for deleting a category
    const handleDeleteCategory = (categoryId: string) => {
        if (window.confirm("Are you sure you want to delete this category? This may affect characters assigned to it.")) {
            deleteCategoryMutation.mutate(categoryId);
        }
    };

    // Toggle category active status mutation
    const toggleActiveMutation = useMutation({
        mutationFn: ({ categoryId, isActive }: { categoryId: string; isActive: boolean }) => {
            const category = categories.find(c => c.categoryId === categoryId);
            return apiRequest(`/api/admin/categories/${categoryId}`, {
                method: "PUT",
                body: JSON.stringify({
                    ...category,
                    isActive,
                }),
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/admin/categories"] });
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
        return <div className="text-center py-10">Loading categories...</div>;
    }

    if (error) {
        return <div className="text-center py-10 text-red-500">Error loading categories. Please refresh the page.</div>;
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">Categories</h2>
                <Button onClick={() => modal.open('personaCategory', {})}>
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Add New Category
                </Button>
            </div>

            {categories && categories.length > 0 ? (
                <Card className="w-full">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Category</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>Order</TableHead>
                                <TableHead>Active</TableHead>
                                <TableHead>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {categories.map((category) => (
                                <TableRow key={category.categoryId}>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center space-x-2">
                                            <span className="text-2xl">{category.emoji}</span>
                                            <div>{category.name}</div>
                                        </div>
                                    </TableCell>
                                    <TableCell>{category.description}</TableCell>
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
                    <p className="text-gray-500">No categories found. Create your first category!</p>
                </div>
            )}
        </div>
    );
}

// Form component for creating/editing persona categories
interface CategoryFormProps {
    initialData?: InsertPersonaCategory;
    onSuccess: () => void;
}

export function PersonaCategoryForm({ initialData, onSuccess }: CategoryFormProps) {
    const queryClient = useQueryClient();

    // Set up form
    const form = useForm<z.infer<typeof categoryFormSchema>>({
        resolver: zodResolver(categoryFormSchema),
        defaultValues: initialData || {
            categoryId: "",
            name: "",
            description: "",
            emoji: "✨",
            order: 0,
            isActive: true,
        },
    });

    // Create/update category mutation
    const mutation = useMutation({
        mutationFn: (values: z.infer<typeof categoryFormSchema>) => {
            if (initialData) {
                // Update existing category
                return apiRequest(`/api/admin/categories/${initialData.categoryId}`, {
                    method: "PUT",
                    body: JSON.stringify(values),
                });
            } else {
                // Create new category
                return apiRequest("/api/admin/categories", {
                    method: "POST",
                    body: JSON.stringify(values),
                });
            }
        },
        onSuccess: () => {
            toast({
                title: initialData ? "Category updated" : "Category created",
                description: initialData
                    ? "The category has been updated successfully."
                    : "The new category has been created successfully.",
            });
            queryClient.invalidateQueries({ queryKey: ["/api/admin/categories"] });
            onSuccess();
        },
        onError: (error) => {
            toast({
                title: "Error",
                description: initialData
                    ? "Failed to update category. Please try again."
                    : "Failed to create category. Please try again.",
                variant: "destructive",
            });
            console.error("Error saving category:", error);
        },
    });

    // Submit handler
    function onSubmit(values: z.infer<typeof categoryFormSchema>) {
        mutation.mutate(values);
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                    control={form.control}
                    name="categoryId"
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
                                <Input placeholder="Category name" {...field} />
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
                                <Input placeholder="Short description" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="emoji"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Emoji</FormLabel>
                            <FormControl>
                                <Input placeholder="Category emoji" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <div className="grid grid-cols-2 gap-4">
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
                </div>

                <DialogFooter>
                    <Button type="submit" disabled={mutation.isPending}>
                        {mutation.isPending ? (
                            "Saving..."
                        ) : initialData ? (
                            "Update Category"
                        ) : (
                            "Create Category"
                        )}
                    </Button>
                </DialogFooter>
            </form>
        </Form>
    );
}
