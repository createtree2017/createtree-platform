import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { X, Plus } from 'lucide-react';
import { useForm } from 'react-hook-form';

interface VariableData {
  name: string;
  description: string;
  type: 'text' | 'select' | 'number' | 'boolean';
  required: boolean;
  options?: string[];
  defaultValue?: string | number | boolean;
}

interface PromptVariableModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: VariableData;
  onSave: (variable: VariableData) => void;
}

export function PromptVariableModal({ 
  isOpen, 
  onClose, 
  initialData,
  onSave 
}: PromptVariableModalProps) {
  const [variableType, setVariableType] = useState<string>(initialData?.type || "text");
  const [newOption, setNewOption] = useState("");

  const form = useForm<VariableData>({
    defaultValues: {
      name: "",
      description: "",
      type: "text",
      required: true,
      options: [],
      defaultValue: ""
    }
  });

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        form.reset({
          name: initialData.name || "",
          description: initialData.description || "",
          type: initialData.type || "text",
          required: initialData.required ?? true,
          options: initialData.options || [],
          defaultValue: initialData.defaultValue ?? ""
        });
        setVariableType(initialData.type || "text");
      } else {
        form.reset({
          name: "",
          description: "",
          type: "text",
          required: true,
          options: [],
          defaultValue: ""
        });
        setVariableType("text");
      }
    }
  }, [initialData, isOpen, form]);

  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === 'type') {
        setVariableType(value.type as string);
      }
    });
    return () => subscription.unsubscribe();
  }, [form.watch]);

  const handleSubmit = (values: VariableData) => {
    if (values.type === "select" && (!values.options || !Array.isArray(values.options))) {
      values.options = [];
    }
    onSave(values);
    onClose();
  };

  const addOption = () => {
    if (newOption.trim()) {
      const currentOptions = form.getValues("options") || [];
      form.setValue("options", [...currentOptions, newOption.trim()]);
      setNewOption("");
    }
  };

  const removeOption = (index: number) => {
    const currentOptions = form.getValues("options") || [];
    form.setValue("options", currentOptions.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) onClose();
    }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>
            {initialData ? "Edit Variable" : "Add Variable"}
          </DialogTitle>
          <DialogDescription>
            Define a variable for the prompt template.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Variable Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="variable_name" />
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
                    <Textarea {...field} placeholder="What this variable is for" rows={2} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="text">Text</SelectItem>
                      <SelectItem value="select">Select</SelectItem>
                      <SelectItem value="number">Number</SelectItem>
                      <SelectItem value="boolean">Boolean</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {variableType === "select" && (
              <div>
                <FormLabel>Options</FormLabel>
                <div className="flex gap-2 mt-2">
                  <Input
                    value={newOption}
                    onChange={(e) => setNewOption(e.target.value)}
                    placeholder="Add option"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addOption();
                      }
                    }}
                  />
                  <Button type="button" onClick={addOption} size="icon">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {(form.watch("options") || []).map((option, index) => (
                    <Badge key={index} variant="secondary" className="flex items-center gap-1">
                      {option}
                      <X 
                        className="h-3 w-3 cursor-pointer" 
                        onClick={() => removeOption(index)} 
                      />
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            
            <FormField
              control={form.control}
              name="defaultValue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Default Value</FormLabel>
                  <FormControl>
                    {variableType === "boolean" ? (
                      <Select 
                        onValueChange={(v) => field.onChange(v === "true")} 
                        defaultValue={field.value?.toString()}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select default" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="true">True</SelectItem>
                          <SelectItem value="false">False</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : variableType === "number" ? (
                      <Input 
                        type="number" 
                        {...field} 
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    ) : variableType === "select" ? (
                      <Select onValueChange={field.onChange} defaultValue={field.value?.toString()}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select default" />
                        </SelectTrigger>
                        <SelectContent>
                          {(form.watch("options") || []).map((option, index) => (
                            <SelectItem key={index} value={option}>{option}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input {...field} placeholder="Default value" value={field.value?.toString() || ''} />
                    )}
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="required"
              render={({ field }) => (
                <FormItem className="flex items-center space-x-2">
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel className="!mt-0">Required</FormLabel>
                </FormItem>
              )}
            />
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit">
                {initialData ? "Update" : "Add"} Variable
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
