import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Book } from "lucide-react";

export default function PhotobookTemplateManagement() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Book className="h-6 w-6" />
          <div>
            <CardTitle>템플릿 관리</CardTitle>
            <CardDescription>포토북 템플릿을 관리합니다</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Book className="h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-muted-foreground">Coming soon</h3>
          <p className="text-sm text-muted-foreground mt-2">
            포토북 템플릿 관리 기능이 곧 추가될 예정입니다.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
