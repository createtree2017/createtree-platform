import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

export default function PhotobookIconManagement() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="h-6 w-6" />
          <div>
            <CardTitle>아이콘 관리</CardTitle>
            <CardDescription>포토북 아이콘을 관리합니다</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Sparkles className="h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-muted-foreground">Coming soon</h3>
          <p className="text-sm text-muted-foreground mt-2">
            포토북 아이콘 관리 기능이 곧 추가될 예정입니다.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
