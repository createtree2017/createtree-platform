import * as React from "react";
import { Drawer as DrawerPrimitive } from "vaul";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface BottomSheetProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    title?: string;
    description?: string;
    showHandle?: boolean;
    showCloseButton?: boolean;
    snapPoints?: (string | number)[];
    defaultSnapPoint?: string | number;
    className?: string;
    contentClassName?: string;
}

/**
 * BottomSheet 컴포넌트
 * 기존 모달을 바텀시트 형식으로 표시합니다.
 * vaul 라이브러리 기반으로 드래그, 스냅 포인트 등을 지원합니다.
 */
export function BottomSheet({
    isOpen,
    onClose,
    children,
    title,
    description,
    showHandle = true,
    showCloseButton = true,
    snapPoints,
    defaultSnapPoint,
    className,
    contentClassName,
}: BottomSheetProps) {
    return (
        <DrawerPrimitive.Root
            open={isOpen}
            onOpenChange={(open) => !open && onClose()}
            shouldScaleBackground={true}
            snapPoints={snapPoints}
            // @ts-expect-error vaul types may not include defaultSnapPoint
            defaultSnapPoint={defaultSnapPoint}
        >
            <DrawerPrimitive.Portal>
                <DrawerPrimitive.Overlay
                    className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
                />
                <DrawerPrimitive.Content
                    className={cn(
                        "fixed inset-x-0 bottom-0 z-50 flex h-auto max-h-[96vh] flex-col rounded-t-2xl border-t bg-background",
                        "focus:outline-none",
                        className
                    )}
                >
                    {/* Handle Bar */}
                    {showHandle && (
                        <div className="flex justify-center pt-4 pb-2">
                            <div className="h-1.5 w-12 rounded-full bg-muted-foreground/20" />
                        </div>
                    )}

                    {/* Header */}
                    {(title || showCloseButton) && (
                        <div className="flex items-center justify-between px-4 pb-2">
                            <div className="flex-1">
                                {title && (
                                    <DrawerPrimitive.Title className="text-lg font-semibold">
                                        {title}
                                    </DrawerPrimitive.Title>
                                )}
                                {description && (
                                    <DrawerPrimitive.Description className="text-sm text-muted-foreground">
                                        {description}
                                    </DrawerPrimitive.Description>
                                )}
                            </div>
                            {showCloseButton && (
                                <button
                                    onClick={onClose}
                                    className="rounded-full p-2 hover:bg-muted transition-colors"
                                    aria-label="닫기"
                                >
                                    <X className="h-5 w-5 text-muted-foreground" />
                                </button>
                            )}
                        </div>
                    )}

                    {/* Content */}
                    <div
                        className={cn(
                            "flex-1 overflow-y-auto px-4 pb-safe",
                            contentClassName
                        )}
                    >
                        {children}
                    </div>
                </DrawerPrimitive.Content>
            </DrawerPrimitive.Portal>
        </DrawerPrimitive.Root>
    );
}

/**
 * BottomSheetHeader - 바텀시트 헤더 영역
 */
export function BottomSheetHeader({
    className,
    children,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn("grid gap-1.5 px-4 py-2 text-center sm:text-left", className)}
            {...props}
        >
            {children}
        </div>
    );
}

/**
 * BottomSheetFooter - 바텀시트 푸터 영역 (버튼 등)
 */
export function BottomSheetFooter({
    className,
    children,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn(
                "mt-auto flex flex-col gap-2 p-4 border-t bg-background safe-area-bottom",
                className
            )}
            {...props}
        >
            {children}
        </div>
    );
}

/**
 * BottomSheetBody - 바텀시트 본문 영역
 */
export function BottomSheetBody({
    className,
    children,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn("flex-1 overflow-y-auto p-4", className)}
            {...props}
        >
            {children}
        </div>
    );
}

export default BottomSheet;
