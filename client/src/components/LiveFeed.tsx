import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Zap, TrafficCone, Wrench, ShieldCheck, Activity, Clock, ShieldAlert, MapPin, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const categoryIcon: Record<string, any> = {
  medical: AlertTriangle,
  fire: Zap,
  traffic: TrafficCone,
  infrastructure: Wrench,
  safety: ShieldCheck,
  crime: ShieldAlert
};

const priorityStyles = {
  critical: "border-primary bg-primary/5",
  high: "border-amber-500 bg-amber-500/5",
  medium: "border-secondary bg-secondary/5",
  low: "border-emerald-500 bg-emerald-500/5",
};

function IncidentItem({
  incident,
  isSelected,
  onSelect,
}: {
  incident: any;
  isSelected: boolean;
  onSelect: (id: string) => void;
}) {
  const Icon = categoryIcon[incident.type] || AlertTriangle;
  
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ x: 6 }}
      onClick={() => onSelect(incident._id)}
      className={cn(
        "p-6 border-l-[6px] rounded-2xl mb-4 cursor-pointer transition-all bg-white shadow-tactile border group active:scale-[0.98]",
        isSelected ? "border-primary ring-2 ring-primary/20" : "border-border/40",
        priorityStyles[incident.severity as keyof typeof priorityStyles] || priorityStyles.medium
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0">
          <div className="w-12 h-12 rounded-xl bg-slate-50 border border-border/40 flex items-center justify-center shrink-0 group-hover:bg-primary/5 group-hover:border-primary/20 transition-all">
            <Icon className="w-5 h-5 text-slate-400 group-hover:text-primary transition-colors" />
          </div>
          <div className="min-w-0">
            <p className="text-base font-black text-slate-900 uppercase tracking-tight leading-none mb-2 decoration-primary decoration-2 group-hover:underline">{incident.title}</p>
            <div className="flex items-center gap-3">
               <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em] bg-primary/5 px-2 py-0.5 rounded-lg border border-primary/10">#{incident._id.slice(-6)}</span>
               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> {incident.location?.address || 'Node 07'}
               </span>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
           <div className="flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">
              <Clock className="w-3.5 h-3.5" />
              {new Date(incident.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
           </div>
           <ChevronRight className="w-4 h-4 text-slate-200 group-hover:text-primary transition-all group-hover:translate-x-1" />
        </div>
      </div>
      
      {incident.aiPredictionConfidence > 80 && (
        <div className="flex items-center gap-2.5 mt-5 pt-4 border-t border-slate-50">
          <div className="w-2 h-2 rounded-full bg-primary shadow-lg shadow-primary" />
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.25em]">AI Logic Core Confirmed: <span className="text-primary italic">RELAY_{incident.aiPredictionConfidence}%</span></p>
        </div>
      )}
    </motion.div>
  );
}

export default function LiveFeed({
  incidents,
  selectedIncidentId,
  onSelectIncident,
  maxItems,
}: {
  incidents: any[];
  selectedIncidentId?: string | null;
  onSelectIncident?: (id: string) => void;
  maxItems?: number;
}) {
  const displayedIncidents = typeof maxItems === "number" ? incidents.slice(0, maxItems) : incidents.slice(0, 15);

  return (
    <div className="w-full h-full flex flex-col bg-white overflow-hidden p-8">
      <div className="flex-1 overflow-y-auto space-y-2 -mx-2 px-2 custom-scrollbar pr-4">
        <AnimatePresence mode="popLayout">
          {displayedIncidents.length > 0 ? (
            displayedIncidents.map((incident) => (
              <IncidentItem
                key={incident._id}
                incident={incident}
                isSelected={selectedIncidentId === incident._id}
                onSelect={onSelectIncident || (() => {})}
              />
            ))
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-20 opacity-40">
              <div className="w-20 h-20 rounded-3xl bg-slate-50 flex items-center justify-center mb-10 shadow-inner">
                <Activity className="w-10 h-10 text-slate-200 animate-pulse" />
              </div>
              <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight">Signal Relay Pending</h4>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mt-4">Awaiting operational flow induction from local nodes.</p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
