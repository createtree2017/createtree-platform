import { useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';

const formSchema = z.object({
  categoryId: z.string().min(1, "ID is required"),
  name: z.string().min(1, "Name is required"),
  description: z.string().min(1, "Description is required"),
  emoji: z.string().min(1, "Emoji is required"),
  order: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

type FormValues = z.infer<typeof formSchema>;

interface PersonaCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: any;
  onSuccess?: () => void;
}

export function PersonaCategoryModal({ 
  isOpen, 
  onClose, 
  initialData,
  onSuccess 
}: PersonaCategoryModalProps) {
  const queryClient = useQueryClient();
  const isEditing = !!initialData;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      categoryId: "",
      name: "",
      description: "",
      emoji: "✨",
      order: 0,
      isActive: true,
    },
  });

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        form.reset({
          categoryId: initialData.categoryId || "",
          name: initialData.name || "",
          description: initialData.description || "",
          emoji: initialData.emoji || "✨",
          order: initialData.order || 0,
          isActive: initialData.isActive ?? true,
        });
      } else {
        form.reset({
          categoryId: "",
          name: "",
          description: "",
          emoji: "✨",
          order: 0,
          isActive: true,
        });
      }
    }
  }, [initialData, isOpen, form]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const url = isEditing 
        ? `/api/admin/categories/${initialData.categoryId}`
        : '/api/admin/categories';
      return apiRequest(url, {
        method: isEditing ? "PUT" : "POST",
        body: JSON.stringify(values),
      });
    },
    onSuccess: () => {
      toast({
        title: isEditing ? "Category updated" : "Category created",
        description: isEditing 
          ? "The category has been updated successfully." 
          : "New category has been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/categories"] });
      onSuccess?.();
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to ${isEditing ? "update" : "create"} category.`,
        variant: "destructive",
      });
      console.error("Error saving category:", error);
    },
  });

  const handleSubmit = (data: FormValues) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit Category' : 'Create New Category'}
          </DialogTitle>
          <DialogDescription>
            {isEditing 
              ? "Modify this category's details."
              : 'Add a new category for organizing chat characters.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category ID</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="unique_category_id" disabled={isEditing} />
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
                    <Input {...field} placeholder="Category name" />
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
                    <Input {...field} placeholder="✨" />
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
                    <Textarea {...field} placeholder="Category description" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex items-center space-x-4">
              <FormField
                control={form.control}
                name="order"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>Order</FormLabel>
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
                  <FormItem className="flex items-center space-x-2 pt-6">
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="!mt-0">Active</FormLabel>
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isEditing ? "Update Category" : "Create Category"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
