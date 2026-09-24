import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  AlertTriangle, Clock, ChevronDown, Filter, Search, 
  ShieldAlert, BarChart3, ArrowUpRight, Zap, CheckCircle, 
  Activity, Info, Printer, MapPin
} from "lucide-react";
import { cn } from "@/lib/utils";
import api from "@/lib/api";
import { toast } from "sonner";

const severityColors = {
  critical: "text-primary border-primary/20 bg-primary/5",
  high: "text-amber-500 border-amber-500/20 bg-amber-500/5",
  medium: "text-secondary border-secondary/20 bg-secondary/5",
  low: "text-slate-400 border-slate-200 bg-slate-50",
};

export default function Escalation() {
  const [filter, setFilter] = useState<"all" | "critical" | "high">("all");
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [briefingOpen, setBriefingOpen] = useState(false);

  useEffect(() => {
    const fetchIncidents = async () => {
      try {
        const { data } = await api.get('/incidents');
        setIncidents(data);
      } catch (err) {
        console.error("Escalation fetch failed", err);
      } finally {
        setLoading(false);
      }
    };
    fetchIncidents();
  }, []);

  const filtered = incidents.filter((incident) => {
    if (filter !== "all" && incident.severity !== filter) {
      return false;
    }

    const query = searchTerm.trim().toLowerCase();
    if (!query) {
      return true;
    }

    return [
      String(incident._id || ""),
      String(incident.title || ""),
      String(incident.location?.address || ""),
      String(incident.status || ""),
    ].some((field) => field.toLowerCase().includes(query));
  });

  if (loading) return (
    <div className="h-full flex flex-col items-center justify-center p-8 bg-white">
      <div className="w-16 h-16 rounded-2xl bg-primary/5 flex items-center justify-center animate-bounce mb-4">
        <ShieldAlert className="w-8 h-8 text-primary" />
      </div>
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Synchronizing Governance Matrix...</p>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-slate-50/30 p-10 gap-10 overflow-hidden font-inter">
      {/* ── HEADER: The Record ───────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
        <div>
           <div className="flex items-center gap-4 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center shadow-2xl">
              <ShieldAlert className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-4xl font-black uppercase tracking-tighter text-slate-900 leading-none">Governance Matrix</h2>
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] ml-[64px]">Official Operational Registry & SLA Protocol Audit</p>
        </div>

        <div className="flex items-center gap-4 bg-white p-2.5 rounded-3xl border border-border/40 shadow-plinth overflow-hidden">
          <div className="relative group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-primary transition-colors" />
            <input 
              placeholder="Filter protocol ID..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-13 pr-6 py-4 rounded-2xl bg-slate-50 border-none text-[10px] font-black uppercase tracking-[0.2em] outline-none w-64 focus:bg-white transition-all" 
            />
          </div>
          <div className="h-10 w-px bg-slate-100" />
          <div className="flex gap-2 p-1.5 bg-slate-50 rounded-2xl">
            {(["all", "critical", "high"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all",
                  filter === f 
                    ? "bg-white text-slate-900 shadow-xl border border-border/40" 
                    : "text-slate-400 hover:text-slate-600"
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── MAIN: The Registry Slab ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden plinth-card bg-white flex flex-col p-0">
        <div className="overflow-x-auto flex-1 custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-20">
              <tr className="bg-slate-50/80 backdrop-blur-md border-b border-border/40">
                <th className="p-8 text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Protocol ID</th>
                <th className="p-8 text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Incident Metadata</th>
                <th className="p-8 text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none text-center">Threat Lvl</th>
                <th className="p-8 text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Sync Status</th>
                <th className="p-8 text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none min-w-[240px]">SLA Efficiency Matrix</th>
                <th className="p-8 text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none text-right">Expiration</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((incident, i) => (
                <motion.tr
                  key={incident._id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="border-b border-border/20 group hover:bg-slate-50/30 transition-all cursor-pointer"
                >
                  <td className="p-8 font-black text-[11px] text-secondary uppercase tracking-widest">#{incident._id.slice(-6)}</td>
                  <td className="p-8">
                    <div className="flex flex-col gap-1">
                      <p className="text-base font-black text-slate-900 uppercase tracking-tight group-hover:text-primary transition-colors leading-none decoration-primary decoration-2">{incident.title}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <MapPin className="w-3 h-3" /> {incident.location?.address || 'Municipal Node'}
                      </p>
                    </div>
                  </td>
                  <td className="p-8 text-center">
                    <span className={cn(
                      "text-[9px] px-3.5 py-1.5 rounded-lg font-black uppercase tracking-[0.2em] border shadow-sm",
                      severityColors[incident.severity as keyof typeof severityColors] || severityColors.low
                    )}>
                      {incident.severity}
                    </span>
                  </td>
                  <td className="p-8">
                    <div className="flex items-center gap-3">
                       <div className={cn(
                          "w-2 h-2 rounded-full",
                          incident.status === 'resolved' ? 'bg-emerald-500 shadow-[0_0_10px_#10B981]' : 'bg-amber-500 shadow-[0_0_10px_#F59E0B]'
                       )} />
                       <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{incident.status}</span>
                    </div>
                  </td>
                  <td className="p-8">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Logic Flow: {incident.slaPercent || 45}%</span>
                        {incident.slaPercent >= 90 && <span className="text-[8px] font-black text-primary uppercase decoration-primary bg-primary/5 px-2 py-1 rounded-md animate-pulse">Critical SLA</span>}
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden shadow-inner ring-1 ring-black/5">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${incident.slaPercent || 45}%` }}
                          transition={{ duration: 2, ease: [0.16, 1, 0.3, 1], delay: i * 0.1 }}
                          className={cn(
                            "h-full rounded-full transition-all",
                            (incident.slaPercent || 45) >= 90 ? "bg-primary shadow-[0_0_10px_rgba(255,79,0,0.5)]" : (incident.slaPercent || 45) >= 70 ? "bg-amber-500" : "bg-secondary"
                          )}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="p-8 text-right">
                    <div className={cn(
                      "inline-flex items-center gap-3 px-4 py-2 rounded-xl border-2 font-black transition-all",
                      (incident.slaPercent || 45) >= 90 
                        ? "bg-primary/10 border-primary/20 text-primary animate-pulse" 
                        : "bg-slate-50 border-slate-100 text-slate-400"
                    )}>
                      <Clock className="w-4 h-4" />
                      <span className="text-[10px] uppercase tracking-widest">{incident.slaDeadline || '2H 15M'}</span>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
          
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-40 text-center opacity-40">
              <div className="w-20 h-20 rounded-3xl bg-slate-50 flex items-center justify-center mb-8">
                <Info className="w-10 h-10 text-slate-200" />
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Zero matching protocols indexed</p>
            </div>
          )}
        </div>
        
        {/* Matrix Footer: The Audit Control */}
        <div className="p-10 bg-slate-50/50 border-t border-border/40 flex flex-col md:flex-row items-center justify-between gap-10">
            <div className="flex gap-12">
                <div className="flex flex-col gap-2">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Protocol Triage</span>
                    <div className="flex items-center gap-3 text-3xl font-black text-slate-900 leading-none">
                       {incidents.filter(i => i.severity === 'critical').length} <span className="text-xs text-primary font-black uppercase tracking-widest mt-2">Critical</span>
                    </div>
                </div>
                <div className="h-10 w-px bg-slate-200" />
                <div className="flex flex-col gap-2">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Efficiency Baseline</span>
                    <div className="flex items-center gap-3 text-3xl font-black text-secondary leading-none">
                       84.2% <span className="text-xs text-slate-300 font-black tracking-widest mt-2 uppercase">Δ Global</span>
                    </div>
                </div>
            </div>
            
            <div className="flex items-center gap-6">
                <button
                  onClick={() => {
                    setBriefingOpen((prev) => !prev);
                    toast.success(briefingOpen ? "Protocol briefing collapsed" : "Protocol briefing expanded");
                  }}
                  className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 hover:text-slate-900 transition-colors"
                >
                   Protocol briefing <ChevronDown className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    const payload = {
                      generatedAt: new Date().toISOString(),
                      filter,
                      searchTerm,
                      totalRecords: filtered.length,
                      incidents: filtered,
                    };
                    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `governance-broadcast-${Date.now()}.json`;
                    link.click();
                    URL.revokeObjectURL(url);
                    toast.success(`Broadcast report generated (${filtered.length} records)`);
                  }}
                  className="flex items-center gap-3 px-8 py-5 rounded-2xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.3em] hover:bg-black transition-all shadow-plinth active:scale-95"
                >
                    <Printer className="w-4 h-4" /> Broadcast Status Report <ArrowUpRight className="w-4 h-4" />
                </button>
            </div>
        </div>

        {briefingOpen && (
          <div className="px-10 pb-8 bg-slate-50/30 border-t border-border/30">
            <div className="rounded-2xl border border-border/40 bg-white p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">Protocol Briefing</p>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-600 leading-relaxed">
                Critical protocols are prioritized for immediate field response. Use filter and search to isolate cases,
                then broadcast the status report for compliance and audit review.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
