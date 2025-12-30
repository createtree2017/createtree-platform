import { useState, useRef, useCallback, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  Pencil, 
  Circle, 
  Square, 
  Triangle, 
  Heart, 
  Star,
  Undo2,
  X
} from "lucide-react";

export type ExtractorTool = 
  | "lasso" 
  | "clear"
  | "circle" 
  | "rectangle" 
  | "triangle" 
  | "heart" 
  | "star";

export type ExtractorCategory = "draw" | "shape";

interface ImageExtractorModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  onExtract: (extractedImageBlob: Blob) => void;
}

interface Point {
  x: number;
  y: number;
}

export default function ImageExtractorModal({
  isOpen,
  onClose,
  imageUrl,
  onExtract,
}: ImageExtractorModalProps) {
  const { toast } = useToast();
  const [category, setCategory] = useState<ExtractorCategory>("draw");
  const [selectedTool, setSelectedTool] = useState<ExtractorTool>("lasso");
  const [isDrawing, setIsDrawing] = useState(false);
  const [points, setPoints] = useState<Point[]>([]);
  const [shapeStart, setShapeStart] = useState<Point | null>(null);
  const [shapeEnd, setShapeEnd] = useState<Point | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  
  const drawTools = [
    { id: "lasso" as const, label: "영역직접그리기", icon: <Pencil className="w-5 h-5" /> },
    { id: "clear" as const, label: "선택 해제", icon: <Undo2 className="w-5 h-5" /> },
  ];
  
  const shapeTools = [
    { id: "circle" as const, icon: <Circle className="w-6 h-6" /> },
    { id: "rectangle" as const, icon: <Square className="w-6 h-6" /> },
    { id: "triangle" as const, icon: <Triangle className="w-6 h-6" /> },
    { id: "heart" as const, icon: <Heart className="w-6 h-6" /> },
    { id: "star" as const, icon: <Star className="w-6 h-6" /> },
  ];
  
  useEffect(() => {
    if (!isOpen || !imageUrl) return;
    
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imageRef.current = img;
      setImageLoaded(true);
      drawImage();
    };
    img.onerror = () => {
      console.log("Direct load failed, trying proxy...");
      const proxyImg = new Image();
      proxyImg.crossOrigin = "anonymous";
      proxyImg.onload = () => {
        imageRef.current = proxyImg;
        setImageLoaded(true);
        drawImage();
      };
      proxyImg.onerror = () => {
        console.error("Image proxy also failed");
        toast({
          title: "이미지 로드 실패",
          description: "이미지를 불러올 수 없습니다.",
          variant: "destructive",
        });
      };
      proxyImg.src = `/api/image-extractor/proxy?url=${encodeURIComponent(imageUrl)}`;
    };
    img.src = imageUrl;
    
    return () => {
      imageRef.current = null;
      setImageLoaded(false);
    };
  }, [isOpen, imageUrl]);
  
  useEffect(() => {
    if (imageLoaded) {
      drawImage();
    }
  }, [imageLoaded]);
  
  const drawImage = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    
    const reservedHeight = 280;
    const maxHeight = Math.max(200, viewportHeight - reservedHeight);
    const maxWidth = Math.max(200, viewportWidth - 32);
    
    let width = img.width;
    let height = img.height;
    
    const scaleToFitWidth = maxWidth / width;
    const scaleToFitHeight = maxHeight / height;
    const scale = Math.min(scaleToFitWidth, scaleToFitHeight, 1);
    
    width = Math.floor(width * scale);
    height = Math.floor(height * scale);
    
    canvas.width = width;
    canvas.height = height;
    
    const overlay = overlayRef.current;
    if (overlay) {
      overlay.width = width;
      overlay.height = height;
    }
    
    ctx.drawImage(img, 0, 0, width, height);
  }, []);
  
  const clearSelection = useCallback(() => {
    setPoints([]);
    setShapeStart(null);
    setShapeEnd(null);
    
    const overlay = overlayRef.current;
    if (overlay) {
      const ctx = overlay.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, overlay.width, overlay.height);
      }
    }
  }, []);
  
  const handleToolSelect = (tool: ExtractorTool) => {
    if (tool === "clear") {
      clearSelection();
      return;
    }
    setSelectedTool(tool);
    clearSelection();
  };
  
  const getCanvasPoint = (e: React.MouseEvent | React.TouchEvent): Point | null => {
    const canvas = overlayRef.current;
    if (!canvas) return null;
    
    const rect = canvas.getBoundingClientRect();
    let clientX: number, clientY: number;
    
    if ("touches" in e) {
      if (e.touches.length === 0) return null;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };
  
  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (selectedTool === "clear") return;
    
    const point = getCanvasPoint(e);
    if (!point) return;
    
    setIsDrawing(true);
    
    if (category === "draw" && selectedTool === "lasso") {
      setPoints([point]);
    } else if (category === "shape") {
      setShapeStart(point);
      setShapeEnd(point);
    }
  };
  
  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    
    const point = getCanvasPoint(e);
    if (!point) return;
    
    if (category === "draw" && selectedTool === "lasso") {
      setPoints(prev => [...prev, point]);
      drawLassoPath([...points, point]);
    } else if (category === "shape" && shapeStart) {
      setShapeEnd(point);
      drawShape(shapeStart, point);
    }
  };
  
  const handlePointerUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    
    if (category === "draw" && selectedTool === "lasso" && points.length > 2) {
      drawLassoPath(points, true);
    }
  };
  
  const drawLassoPath = (pathPoints: Point[], close = false) => {
    const overlay = overlayRef.current;
    if (!overlay || pathPoints.length < 2) return;
    
    const ctx = overlay.getContext("2d");
    if (!ctx) return;
    
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    
    ctx.beginPath();
    ctx.moveTo(pathPoints[0].x, pathPoints[0].y);
    
    for (let i = 1; i < pathPoints.length; i++) {
      ctx.lineTo(pathPoints[i].x, pathPoints[i].y);
    }
    
    if (close) {
      ctx.closePath();
    }
    
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    
    if (close) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
      ctx.fill();
    }
  };
  
  const drawShape = (start: Point, end: Point) => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    
    const ctx = overlay.getContext("2d");
    if (!ctx) return;
    
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    
    const width = end.x - start.x;
    const height = end.y - start.y;
    const centerX = start.x + width / 2;
    const centerY = start.y + height / 2;
    const radiusX = Math.abs(width / 2);
    const radiusY = Math.abs(height / 2);
    
    ctx.beginPath();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    
    switch (selectedTool) {
      case "circle":
        ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
        break;
      case "rectangle":
        ctx.rect(start.x, start.y, width, height);
        break;
      case "triangle":
        ctx.moveTo(centerX, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.lineTo(start.x, end.y);
        ctx.closePath();
        break;
      case "heart":
        drawHeartPath(ctx, centerX, centerY, radiusX, radiusY);
        break;
      case "star":
        drawStarPath(ctx, centerX, centerY, Math.min(radiusX, radiusY));
        break;
    }
    
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
    ctx.fill();
  };
  
  const drawHeartPath = (ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number) => {
    const topY = cy - h * 0.3;
    const bottomY = cy + h;
    
    ctx.moveTo(cx, bottomY);
    ctx.bezierCurveTo(cx - w * 1.5, cy, cx - w * 1.5, topY, cx, topY + h * 0.3);
    ctx.bezierCurveTo(cx + w * 1.5, topY, cx + w * 1.5, cy, cx, bottomY);
  };
  
  const drawStarPath = (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) => {
    const spikes = 5;
    const outerRadius = r;
    const innerRadius = r * 0.4;
    
    let rot = (Math.PI / 2) * 3;
    const step = Math.PI / spikes;
    
    ctx.moveTo(cx, cy - outerRadius);
    
    for (let i = 0; i < spikes; i++) {
      let x = cx + Math.cos(rot) * outerRadius;
      let y = cy + Math.sin(rot) * outerRadius;
      ctx.lineTo(x, y);
      rot += step;
      
      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      ctx.lineTo(x, y);
      rot += step;
    }
    
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
  };
  
  const hasSelection = points.length > 2 || (shapeStart && shapeEnd);
  
  const [isExtracting, setIsExtracting] = useState(false);
  
  const getBoundingBox = (): { minX: number; minY: number; maxX: number; maxY: number } | null => {
    if (category === "draw" && points.length > 2) {
      const xs = points.map(p => p.x);
      const ys = points.map(p => p.y);
      return {
        minX: Math.max(0, Math.min(...xs)),
        minY: Math.max(0, Math.min(...ys)),
        maxX: Math.max(...xs),
        maxY: Math.max(...ys)
      };
    } else if (category === "shape" && shapeStart && shapeEnd) {
      const minX = Math.min(shapeStart.x, shapeEnd.x);
      const maxX = Math.max(shapeStart.x, shapeEnd.x);
      const minY = Math.min(shapeStart.y, shapeEnd.y);
      const maxY = Math.max(shapeStart.y, shapeEnd.y);
      return { minX: Math.max(0, minX), minY: Math.max(0, minY), maxX, maxY };
    }
    return null;
  };
  
  const handleExtract = async () => {
    if (!hasSelection || isExtracting) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const bounds = getBoundingBox();
    if (!bounds) return;
    
    setIsExtracting(true);
    
    try {
      const { minX, minY, maxX, maxY } = bounds;
      const cropWidth = Math.ceil(maxX - minX);
      const cropHeight = Math.ceil(maxY - minY);
      
      if (cropWidth < 10 || cropHeight < 10) {
        toast({
          title: "선택 영역이 너무 작습니다",
          description: "더 큰 영역을 선택해주세요",
          variant: "destructive",
        });
        setIsExtracting(false);
        return;
      }
      
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = cropWidth;
      tempCanvas.height = cropHeight;
      const tempCtx = tempCanvas.getContext("2d");
      if (!tempCtx) {
        setIsExtracting(false);
        return;
      }
      
      tempCtx.beginPath();
      
      if (category === "draw" && points.length > 2) {
        tempCtx.moveTo(points[0].x - minX, points[0].y - minY);
        for (let i = 1; i < points.length; i++) {
          tempCtx.lineTo(points[i].x - minX, points[i].y - minY);
        }
        tempCtx.closePath();
      } else if (category === "shape" && shapeStart && shapeEnd) {
        const left = Math.min(shapeStart.x, shapeEnd.x) - minX;
        const top = Math.min(shapeStart.y, shapeEnd.y) - minY;
        const width = Math.abs(shapeEnd.x - shapeStart.x);
        const height = Math.abs(shapeEnd.y - shapeStart.y);
        const centerX = left + width / 2;
        const centerY = top + height / 2;
        const radiusX = width / 2;
        const radiusY = height / 2;
        
        switch (selectedTool) {
          case "circle":
            tempCtx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
            break;
          case "rectangle":
            tempCtx.rect(left, top, width, height);
            break;
          case "triangle":
            tempCtx.moveTo(centerX, top);
            tempCtx.lineTo(left + width, top + height);
            tempCtx.lineTo(left, top + height);
            tempCtx.closePath();
            break;
          case "heart":
            drawHeartPathOffset(tempCtx, centerX, centerY, radiusX, radiusY);
            tempCtx.closePath();
            break;
          case "star":
            drawStarPathOffset(tempCtx, centerX, centerY, Math.min(radiusX, radiusY));
            break;
        }
      }
      
      tempCtx.clip();
      tempCtx.drawImage(
        canvas,
        minX, minY, cropWidth, cropHeight,
        0, 0, cropWidth, cropHeight
      );
      
      const imageData = tempCtx.getImageData(0, 0, cropWidth, cropHeight);
      let hasContent = false;
      for (let i = 3; i < imageData.data.length; i += 4) {
        if (imageData.data[i] > 0) {
          hasContent = true;
          break;
        }
      }
      
      if (!hasContent) {
        toast({
          title: "추출 실패",
          description: "선택한 영역에서 이미지를 추출할 수 없습니다",
          variant: "destructive",
        });
        setIsExtracting(false);
        return;
      }
      
      tempCanvas.toBlob((blob) => {
        setIsExtracting(false);
        if (blob && blob.size > 0) {
          onExtract(blob);
        }
      }, "image/png");
    } catch (error) {
      console.error("이미지 추출 실패:", error);
      toast({
        title: "추출 실패",
        description: "이미지 추출 중 오류가 발생했습니다",
        variant: "destructive",
      });
      setIsExtracting(false);
    }
  };
  
  const drawHeartPathOffset = (ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number) => {
    const topY = cy - h;
    const bottomY = cy + h;
    ctx.moveTo(cx, bottomY);
    ctx.bezierCurveTo(cx - w * 1.5, cy, cx - w * 1.5, topY, cx, topY + h * 0.3);
    ctx.bezierCurveTo(cx + w * 1.5, topY, cx + w * 1.5, cy, cx, bottomY);
  };
  
  const drawStarPathOffset = (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) => {
    const spikes = 5;
    const outerRadius = r;
    const innerRadius = r * 0.4;
    
    let rot = (Math.PI / 2) * 3;
    const step = Math.PI / spikes;
    
    ctx.moveTo(cx, cy - outerRadius);
    
    for (let i = 0; i < spikes; i++) {
      let x = cx + Math.cos(rot) * outerRadius;
      let y = cy + Math.sin(rot) * outerRadius;
      ctx.lineTo(x, y);
      rot += step;
      
      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      ctx.lineTo(x, y);
      rot += step;
    }
    
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
  };
  
  const handleCategoryChange = (value: string) => {
    setCategory(value as ExtractorCategory);
    clearSelection();
    if (value === "draw") {
      setSelectedTool("lasso");
    } else {
      setSelectedTool("circle");
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-full w-full h-full max-h-full p-0 bg-black border-none rounded-none">
        <div ref={containerRef} className="flex flex-col h-full">
          <div className="flex items-center justify-between p-4 border-b border-gray-800">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={onClose}
              className="text-white hover:bg-gray-800"
            >
              <X className="h-6 w-6" />
            </Button>
            <span className="text-white font-medium">이미지 편집</span>
            <div className="w-10" />
          </div>
          
          <div className="flex-1 flex items-center justify-center p-4 relative overflow-hidden">
            <div className="relative">
              <canvas
                ref={canvasRef}
                className="max-w-full max-h-full"
              />
              <canvas
                ref={overlayRef}
                className="absolute top-0 left-0 cursor-crosshair"
                onMouseDown={handlePointerDown}
                onMouseMove={handlePointerMove}
                onMouseUp={handlePointerUp}
                onMouseLeave={handlePointerUp}
                onTouchStart={handlePointerDown}
                onTouchMove={handlePointerMove}
                onTouchEnd={handlePointerUp}
              />
            </div>
          </div>
          
          <div className="text-center text-gray-400 text-sm py-2">
            사진에 남겨둘 대상을 선택하거나 테두리를 따라 그리세요.
          </div>
          
          <div className="bg-gray-900 border-t border-gray-800">
            <Tabs value={category} onValueChange={handleCategoryChange} className="w-full">
              <TabsContent value="draw" className="mt-0 p-4">
                <div className="flex justify-center gap-8">
                  {drawTools.map((tool) => (
                    <button
                      key={tool.id}
                      onClick={() => handleToolSelect(tool.id)}
                      className={`flex flex-col items-center gap-2 p-2 rounded-lg transition-colors ${
                        selectedTool === tool.id 
                          ? "text-purple-400" 
                          : "text-gray-400 hover:text-white"
                      }`}
                    >
                      {tool.icon}
                      <span className="text-xs">{tool.label}</span>
                    </button>
                  ))}
                </div>
              </TabsContent>
              
              <TabsContent value="shape" className="mt-0 p-4">
                <div className="flex justify-center gap-4">
                  {shapeTools.map((tool) => (
                    <button
                      key={tool.id}
                      onClick={() => handleToolSelect(tool.id)}
                      className={`p-3 rounded-lg transition-colors ${
                        selectedTool === tool.id 
                          ? "bg-white text-black" 
                          : "text-gray-400 hover:text-white"
                      }`}
                    >
                      {tool.icon}
                    </button>
                  ))}
                </div>
              </TabsContent>
              
              <TabsList className="w-full bg-transparent border-t border-gray-800 rounded-none h-auto p-0">
                <TabsTrigger 
                  value="draw" 
                  className="flex-1 rounded-none py-3 data-[state=active]:bg-gray-800 data-[state=active]:text-white text-gray-400"
                >
                  직접 그리기
                </TabsTrigger>
                <TabsTrigger 
                  value="shape" 
                  className="flex-1 rounded-none py-3 data-[state=active]:bg-gray-800 data-[state=active]:text-white text-gray-400"
                >
                  도형 모양
                </TabsTrigger>
              </TabsList>
            </Tabs>
            
            <div className="flex border-t border-gray-800">
              <Button
                variant="ghost"
                className="flex-1 py-4 text-white hover:bg-gray-800 rounded-none"
                onClick={onClose}
              >
                취소
              </Button>
              <Button
                variant="ghost"
                className={`flex-1 py-4 rounded-none ${
                  hasSelection && !isExtracting
                    ? "text-white hover:bg-gray-800" 
                    : "text-gray-600 cursor-not-allowed"
                }`}
                disabled={!hasSelection || isExtracting}
                onClick={handleExtract}
              >
                {isExtracting ? "추출 중..." : "다음"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
