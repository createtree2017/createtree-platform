import { cn } from "@/lib/utils";

function hexToRgba(hex: string, alpha: number = 1): string {
    let hexValue = hex.replace("#", "");

    if (hexValue.length === 3) {
        hexValue = hexValue
            .split("")
            .map((char) => char + char)
            .join("");
    }

    const r = parseInt(hexValue.substring(0, 2), 16);
    const g = parseInt(hexValue.substring(2, 4), 16);
    const b = parseInt(hexValue.substring(4, 6), 16);

    if (isNaN(r) || isNaN(g) || isNaN(b)) {
        console.error("Invalid hex color:", hex);
        return "rgba(0, 0, 0, 1)";
    }

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function GlowingButton({
    children,
    className,
    glowColor = "#a3e635",
    icon,
    onClick,
}: {
    children: React.ReactNode;
    className?: string;
    glowColor?: string;
    icon?: React.ReactNode;
    onClick?: () => void;
}) {
    const glowColorRgba = hexToRgba(glowColor);
    const glowColorVia = hexToRgba(glowColor, 0.075);
    const glowColorTo = hexToRgba(glowColor, 0.2);

    return (
        <button
            onClick={onClick}
            style={
                {
                    "--glow-color": glowColorRgba,
                    "--glow-color-via": glowColorVia,
                    "--glow-color-to": glowColorTo,
                } as React.CSSProperties
            }
            className={cn(
                "w-full h-[56px] md:h-[64px] px-3 md:px-4 text-sm md:text-base rounded-2xl border flex items-center gap-3 relative transition-colors overflow-hidden bg-gradient-to-t duration-200 whitespace-nowrap",
                "from-background to-muted text-foreground border-border",
                "active:scale-[0.97] active:opacity-90 transition-transform",
                "after:inset-0 after:absolute after:rounded-[inherit] after:bg-gradient-to-r after:from-transparent after:from-40% after:via-[var(--glow-color-via)] after:to-[var(--glow-color-to)] after:via-70% after:shadow-[hsl(var(--foreground)/0.15)_0px_1px_0px_inset] z-20",
                "before:absolute before:w-[5px] before:h-[60%] before:bg-[var(--glow-color)] before:right-0 before:rounded-l before:shadow-[-2px_0_10px_var(--glow-color)] z-10",
                className
            )}
        >
            {icon && (
                <div className="flex items-center justify-center w-8 h-8 md:w-9 md:h-9 rounded-xl bg-muted/80 z-30 flex-shrink-0">
                    {icon}
                </div>
            )}
            <span className="font-bold text-foreground/90 truncate flex-1 text-left z-30">
                {children}
            </span>
        </button>
    );
}
