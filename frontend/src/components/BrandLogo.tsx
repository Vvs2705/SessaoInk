import React from "react";
import { cn } from "@/lib/utils";

export interface BrandLogoProps {
  variant?: "light" | "dark";
  layout?: "icon" | "wide";
  size?: "sm" | "md" | "lg" | "xl";
  scaling?: boolean;
  className?: string;
}

export function BrandLogo({
  variant = "light", // "light" variant for dark backgrounds (default for SessãoInk)
  layout = "wide",
  size = "md",
  scaling = true,
  className,
}: BrandLogoProps) {
  const sizeMap = {
    sm: "h-6",
    md: "h-9",
    lg: "h-16",
    xl: "h-24",
  };

  const src = layout === "icon" ? "/icon-192.png" : "/logo-wide.png";

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="SessãoInk"
      className={cn(
        "w-auto object-contain transition-all duration-200",
        sizeMap[size],
        variant === "dark" && "brightness-0", // Turns white/teal logo black for light backgrounds
        scaling && "hover:scale-[1.02] active:scale-[0.98]",
        className
      )}
    />
  );
}
