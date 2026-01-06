import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Check, Loader2 } from "lucide-react";

interface Concept {
  id: number;
  conceptId: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  categoryId?: string;
}

interface ConceptCategory {
  id: number;
  categoryId: string;
  name: string;
  isActive: boolean;
}

interface ConceptPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (concept: {
    title: string;
    imageUrl: string;
    linkUrl: string;
    conceptId: string;
  }) => void;
}

export default function ConceptPickerModal({ open, onOpenChange, onSelect }: ConceptPickerModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedConcept, setSelectedConcept] = useState<Concept | null>(null);

  const { data: concepts = [], isLoading: conceptsLoading } = useQuery<Concept[]>({
    queryKey: ["/api/concepts"],
    queryFn: async () => {
      const response = await fetch("/api/concepts");
      if (!response.ok) throw new Error("Failed to fetch concepts");
      return response.json();
    },
    enabled: open,
  });

  const { data: categories = [], isLoading: categoriesLoading } = useQuery<ConceptCategory[]>({
    queryKey: ["/api/concept-categories"],
    queryFn: async () => {
      const response = await fetch("/api/concept-categories");
      if (!response.ok) throw new Error("Failed to fetch categories");
      return response.json();
    },
    enabled: open,
  });

  const filteredConcepts = concepts.filter((concept) => {
    const matchesSearch = concept.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (concept.description?.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === "all" || concept.categoryId === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleSelect = () => {
    if (!selectedConcept) return;

    const category = categories.find(c => c.categoryId === selectedConcept.categoryId);
    let basePath = "/maternity-photo";
    
    if (category) {
      const categoryName = category.name.toLowerCase();
      if (categoryName.includes("스티커") || categoryName.includes("sticker")) {
        basePath = "/sticker-styles";
      } else if (categoryName.includes("가족") || categoryName.includes("family")) {
        basePath = "/family-styles";
      } else if (categoryName.includes("아기") || categoryName.includes("baby")) {
        basePath = "/baby-styles";
      } else if (categoryName.includes("만삭") || categoryName.includes("maternity")) {
        basePath = "/maternity-styles";
      }
    }

    onSelect({
      title: selectedConcept.title,
      imageUrl: selectedConcept.thumbnailUrl || "",
      linkUrl: `${basePath}?conceptId=${selectedConcept.conceptId}`,
      conceptId: selectedConcept.conceptId,
    });

    setSelectedConcept(null);
    setSearchQuery("");
    setSelectedCategory("all");
    onOpenChange(false);
  };

  const isLoading = conceptsLoading || categoriesLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>스타일에서 선택</DialogTitle>
        </DialogHeader>

        <div className="flex gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="스타일 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="카테고리 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 카테고리</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.categoryId} value={category.categoryId}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : filteredConcepts.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-gray-500">
              검색 결과가 없습니다
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 p-1">
              {filteredConcepts.map((concept) => {
                const isSelected = selectedConcept?.conceptId === concept.conceptId;
                return (
                  <div
                    key={concept.conceptId}
                    onClick={() => setSelectedConcept(concept)}
                    className={`
                      relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all
                      ${isSelected 
                        ? "border-purple-500 ring-2 ring-purple-500/30" 
                        : "border-transparent hover:border-gray-300"
                      }
                    `}
                  >
                    <div className="aspect-square bg-gray-100">
                      {concept.thumbnailUrl ? (
                        <img
                          src={concept.thumbnailUrl}
                          alt={concept.title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "/placeholder-image.png";
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                          No Image
                        </div>
                      )}
                    </div>
                    <div className="p-2 bg-white">
                      <p className="text-xs font-medium truncate text-gray-900">{concept.title}</p>
                      {categories.find(c => c.categoryId === concept.categoryId) && (
                        <p className="text-[10px] text-gray-500 truncate">
                          {categories.find(c => c.categoryId === concept.categoryId)?.name}
                        </p>
                      )}
                    </div>
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-between items-center pt-4 border-t mt-4">
          <p className="text-sm text-gray-500">
            {filteredConcepts.length}개의 스타일
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              취소
            </Button>
            <Button 
              onClick={handleSelect} 
              disabled={!selectedConcept}
              className="bg-purple-600 hover:bg-purple-700"
            >
              선택 완료
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
