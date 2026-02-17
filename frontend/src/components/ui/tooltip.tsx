import * as React from "react"
import { cn } from "@/lib/utils"

interface TooltipProps {
    content: string | React.ReactNode
    children: React.ReactNode
    className?: string
    side?: "top" | "bottom" | "left" | "right"
}

export function Tooltip({ content, children, className, side = "top" }: TooltipProps) {
    const sideClasses = {
        top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
        bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
        left: "right-full top-1/2 -translate-y-1/2 mr-2",
        right: "left-full top-1/2 -translate-y-1/2 ml-2"
    }

    return (
        <div className="relative group inline-block">
            {children}
            <div className={cn(
                "absolute z-50 scale-0 group-hover:scale-100 transition-all duration-200 origin-center whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-xs font-medium text-slate-50 shadow-md",
                sideClasses[side],
                className
            )}>
                {content}
                <div className={cn(
                    "absolute h-1.5 w-1.5 rotate-45 bg-slate-900",
                    side === "top" && "bottom-[-3px] left-1/2 -translate-x-1/2",
                    side === "bottom" && "top-[-3px] left-1/2 -translate-x-1/2",
                    side === "left" && "right-[-3px] top-1/2 -translate-y-1/2",
                    side === "right" && "left-[-3px] top-1/2 -translate-y-1/2"
                )} />
            </div>
        </div>
    )
}
