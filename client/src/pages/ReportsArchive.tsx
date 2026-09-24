import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
    FileText, Search,
    Download, Archive, Clock,
    Brain, Shield
} from "lucide-react";
import { cn } from "@/lib/utils";
import api from "@/lib/api";
import { toast } from "sonner";

export default function ReportsArchive() {
  const [reports, setReports] = useState<any[]>([]);
    const [personnel, setPersonnel] = useState<any[]>([]);
        const [resources, setResources] = useState<any[]>([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedReport, setSelectedReport] = useState<any | null>(null);

    const syncArchiveData = async () => {
        try {
            const [reportsRes, personnelRes, resourcesRes] = await Promise.all([
                api.get('/incidents?status=all'),
                api.get('/dispatch/personnel?all=true'),
                api.get('/resources')
            ]);
            setReports(reportsRes.data);
            setPersonnel(personnelRes.data || []);
            setResources(resourcesRes.data || []);
        } catch (err) {
            console.error("Reports fetch failed", err);
            toast.error("Unable to sync archive records");
        }
    };

  useEffect(() => {
        syncArchiveData();
  }, []);

  const filteredReports = reports.filter(r => {
    if (filter !== "all" && r.status !== filter) return false;
    if (search && !r.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

    const getAssignedDisplayNames = (report: any) => {
        const rawAssigned = [
            ...(Array.isArray(report.assignedPersonnelList) ? report.assignedPersonnelList : []),
            report.assignedPersonnel,
        ].filter(Boolean);

        if (!rawAssigned.length) return "Not assigned";

        const ids = rawAssigned.map((p: any) => (typeof p === "string" ? p : p?._id)).filter(Boolean);
        const resolvedNames = ids.map((id: string) => {
            const person = personnel.find((p: any) => p._id === id);
            return person?.name || id;
        });

        return Array.from(new Set(resolvedNames)).join(", ");
    };

    const getAssignedResourceNames = (report: any) => {
        const rawAssigned = Array.isArray(report.assignedResources) ? report.assignedResources : [];
        if (!rawAssigned.length) return "Not assigned";

        const ids = rawAssigned.map((r: any) => (typeof r === "string" ? r : r?._id)).filter(Boolean);
        const resolvedNames = ids.map((id: string) => {
            const resource = resources.find((r: any) => r._id === id);
            return resource?.name || id;
        });

        return Array.from(new Set(resolvedNames)).join(", ");
    };

  return (
    <div className="flex flex-col h-screen bg-slate-50/30 overflow-hidden font-inter">
      {/* ── TOP: Strategic Overview ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-0 border-b border-border/40 bg-white">
        {[
            { label: "Total Reports", value: reports.length, icon: FileText, color: "text-primary" },
            { label: "AI Mitigation Rate", value: "84.2%", icon: Brain, color: "text-indigo-500" },
            { label: "Avg Resolution", value: "14m 20s", icon: Clock, color: "text-emerald-500" },
            { label: "System Health", value: "99.1%", icon: Shield, color: "text-slate-900" },
        ].map((stat, i) => (
            <div key={stat.label} className={cn(
                "p-8 transition-all hover:bg-slate-50 border-r border-border/40 last:border-r-0"
            )}>
                <div className="flex items-center gap-3 mb-2 opacity-60">
                    <stat.icon className={cn("w-4 h-4", stat.color)} />
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">{stat.label}</span>
                </div>
                <div className="text-3xl font-black text-slate-900 tabular-nums tracking-tighter">
                    {stat.value}
                </div>
            </div>
        ))}
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* ── LEFT: Report Register ────────────────────────────────────────── */}
        <div className="w-[520px] bg-white border-r border-border/40 flex flex-col shadow-2xl relative z-10">
            <div className="p-8 space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-900">Reports Index</h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Archival Historical Data</p>
                    </div>
                                        <button
                                            onClick={() => {
                                                const blob = new Blob([JSON.stringify(filteredReports, null, 2)], { type: 'application/json' });
                                                const url = URL.createObjectURL(blob);
                                                const link = document.createElement('a');
                                                link.href = url;
                                                link.download = `civic-reports-${Date.now()}.json`;
                                                link.click();
                                                URL.revokeObjectURL(url);
                                                toast.success("Archive exported");
                                            }}
                                            className="p-3 bg-slate-50 rounded-xl border border-border/40 hover:text-primary transition-all shadow-sm"
                                        >
                        <Download className="w-5 h-5 text-slate-400" />
                    </button>
                </div>

                <div className="flex items-center gap-4 border-b border-border/30 pb-4">
                    <div className="relative flex-1 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                        <input 
                            type="text" 
                            placeholder="Identify Signal..." 
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-slate-50/50 border border-border/40 rounded-2xl py-4 pl-12 pr-6 text-[10px] font-black uppercase tracking-[0.2em] focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all"
                        />
                    </div>
                    <div className="flex bg-slate-50 p-1.5 rounded-2xl border border-border/40">
                        {['all', 'active', 'resolved'].map(t => (
                            <button 
                                key={t}
                                onClick={() => setFilter(t)}
                                className={cn(
                                    "px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all",
                                    filter === t ? "bg-white text-slate-900 shadow-plinth border border-border/40" : "text-slate-400 hover:text-slate-600"
                                )}
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-20 space-y-4 custom-scrollbar">
                {filteredReports.map((report) => (
                    <motion.div
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        key={report._id}
                        onClick={() => setSelectedReport(report)}
                        className={cn(
                            "p-6 rounded-2xl border-2 transition-all cursor-pointer relative overflow-hidden",
                            selectedReport?._id === report._id 
                                ? "bg-white border-primary shadow-2xl shadow-primary/10 scale-[1.01]" 
                                : "bg-white/50 border-border/40 hover:border-slate-300 hover:bg-white"
                        )}
                    >
                        <div className="flex items-start justify-between relative z-10">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <div className={cn(
                                        "w-2 h-2 rounded-full",
                                        report.status === 'resolved' ? "bg-emerald-500" : "bg-primary animate-pulse"
                                    )} />
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">{report.status}</span>
                                </div>
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">{report.title}</h3>
                            </div>
                            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">#{report._id.slice(-6)}</span>
                        </div>
                        
                        <div className="mt-6 pt-4 border-t border-border/40 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center font-black text-[10px] text-slate-400">
                                    {report.type?.[0]?.toUpperCase() || 'I'}
                                </div>
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{report.type}</span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400">
                                <Clock className="w-3 h-3" />
                                {new Date(report.createdAt).toLocaleDateString()}
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>

        {/* ── RIGHT: Analytical Deep Dive ───────────────────────────────────── */}
        <div className="flex-1 bg-slate-50/30 overflow-y-auto custom-scrollbar">
            <AnimatePresence mode="wait">
                {selectedReport ? (
                    <motion.div 
                        key={selectedReport._id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="p-12 max-w-5xl mx-auto space-y-12 pb-32"
                    >
                        <div className="flex items-start justify-between gap-12">
                            <div className="flex-1">
                                <h1 className="text-5xl font-black uppercase tracking-tighter text-slate-900 leading-none mb-6">{selectedReport.title}</h1>
                                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Incident ID: #{selectedReport._id.slice(-6)}</p>
                            </div>
                            <button
                                onClick={() => {
                                    const blob = new Blob([JSON.stringify(selectedReport, null, 2)], { type: 'application/json' });
                                    const url = URL.createObjectURL(blob);
                                    const link = document.createElement('a');
                                    link.href = url;
                                    link.download = `incident-${selectedReport._id}.json`;
                                    link.click();
                                    URL.revokeObjectURL(url);
                                }}
                                className="w-14 h-14 bg-white border border-border/40 rounded-2xl flex items-center justify-center shadow-sm hover:text-primary transition-all"
                            >
                                <Download className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="bg-white border border-border/40 rounded-2xl p-8 space-y-5">
                            <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-900">Assignment Summary</h3>
                            <p className="text-[11px] font-black uppercase tracking-widest text-slate-600">
                                Assigned: {getAssignedDisplayNames(selectedReport)}
                            </p>
                            <p className="text-[11px] font-black uppercase tracking-widest text-slate-600">
                                Assigned Resources: {getAssignedResourceNames(selectedReport)}
                            </p>
                            <p className="text-[11px] font-black uppercase tracking-widest text-slate-600">
                                Completed: {selectedReport.status === 'resolved' ? 'Yes' : 'No'}
                            </p>
                            <p className="text-[11px] font-black uppercase tracking-widest text-slate-600">
                                Reported Time: {selectedReport.createdAt ? new Date(selectedReport.createdAt).toLocaleString() : 'N/A'}
                            </p>
                            <p className="text-[11px] font-black uppercase tracking-widest text-slate-600">
                                Last Updated: {selectedReport.updatedAt ? new Date(selectedReport.updatedAt).toLocaleString() : 'N/A'}
                            </p>
                        </div>
                    </motion.div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center p-20 text-center space-y-10 group">
                        <div className="w-32 h-32 rounded-[40px] bg-white shadow-plinth flex items-center justify-center border border-border/40 group-hover:scale-110 transition-transform duration-500">
                            <Archive className="w-14 h-14 text-slate-200 animate-bounce" />
                        </div>
                        <div>
                             <h2 className="text-4xl font-black uppercase tracking-tighter text-slate-900 mb-4 opacity-20">Select Strategic Signal</h2>
                             <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em]">Navigate the index to initialize deep analysis</p>
                        </div>
                    </div>
                )}
            </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
