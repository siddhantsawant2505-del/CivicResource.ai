import { cn } from "@/lib/utils";

type BrandMarkProps = {
  className?: string;
  letterClassName?: string;
};

export function BrandMark({ className, letterClassName }: BrandMarkProps) {
  return (
    <div
      className={cn(
        "rounded-2xl bg-primary flex items-center justify-center shadow-xl shadow-primary/20",
        className
      )}
      aria-label="CivicResource.ai logo"
      role="img"
    >
      <span className={cn("font-black text-white leading-none tracking-tight", letterClassName)}>
        C
      </span>
    </div>
  );
}