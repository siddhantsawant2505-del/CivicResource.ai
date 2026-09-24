import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface StatCardProps {
  label: string;
  value: string | number;
  change?: string;
  trend?: "up" | "down";
  icon: React.ReactNode;
  accentColor?: "orange" | "indigo" | "emerald" | "red" | "slate";
}

const colorMap = {
  orange: "text-primary bg-primary/5 border-primary/10",
  indigo: "text-secondary bg-secondary/5 border-secondary/10",
  emerald: "text-emerald-500 bg-emerald-50 border-emerald-100",
  red: "text-destructive bg-destructive/5 border-destructive/10",
  slate: "text-slate-400 bg-slate-50 border-slate-100",
};

export function StatCard({ label, value, change, trend, icon, accentColor = "orange" }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="tactile-slab p-8 bg-white"
    >
      <div className="flex items-center justify-between mb-8">
        <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center border shadow-sm transition-transform hover:scale-110", colorMap[accentColor])}>
          {icon}
        </div>
        {change && (
          <div className={cn(
            "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2",
            trend === "up" ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-red-50 text-red-600 border border-red-100"
          )}>
            {trend === "up" ? "↑" : "↓"} {change}
          </div>
        )}
      </div>
      
      <div className="space-y-1">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] h-4 block leading-none">
          {label}
        </span>
        <h2 className="text-4xl font-black tracking-tighter text-slate-900 tabular-nums leading-none mt-2">
          {value}
        </h2>
      </div>
      
      <div className="mt-8 pt-8 border-t border-slate-50 flex items-center justify-between">
         <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Protocol Signal OK</span>
         <div className="flex gap-1">
            {[1,2,3].map(i => (
              <div key={i} className={cn("w-1.5 h-1.5 rounded-full bg-slate-100", i === 1 && "bg-primary/40")} />
            ))}
         </div>
      </div>
    </motion.div>
  );
}
