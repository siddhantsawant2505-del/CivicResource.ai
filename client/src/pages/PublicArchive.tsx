import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Archive, Search, Clock, MapPin, Shield, ArrowRight, ArrowLeft } from "lucide-react";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

export default function PublicArchive() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "investigating" | "resolved">("all");

  useEffect(() => {
    const loadArchive = async () => {
      try {
        const { data } = await api.get("/public/incidents?limit=40");
        setIncidents(data || []);
      } catch (error) {
        console.error("Public archive load failed", error);
      }
    };

    loadArchive();
  }, []);

  const filteredIncidents = useMemo(() => {
    return incidents.filter((incident) => {
      if (filter !== "all" && incident.status !== filter) return false;
      const haystack = [incident.title, incident.type, incident.location?.address, incident.trackingId]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(search.toLowerCase());
    });
  }, [incidents, filter, search]);

  return (
    <div className="min-h-screen bg-slate-50 font-inter">
      <div className="max-w-6xl mx-auto px-6 py-10 md:py-14">
        <Link to="/" className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.25em] text-slate-500 hover:text-slate-900 mb-6">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-10">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-border/40 text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-4">
              <Archive className="w-4 h-4" /> Public Incident Archive
            </div>
            <h1 className="text-4xl md:text-6xl font-black tracking-tight text-slate-900 leading-none mb-4">
              Local complaints and status updates in one public view.
            </h1>
            <p className="text-sm md:text-base text-slate-600 max-w-2xl leading-relaxed">
              This archive is for citizens. It shows public complaint status without requiring login.
              Use the tracker if you want to check one specific complaint by mobile number or tracking ID.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/complaint" className="px-5 py-3 rounded-xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-2">
              File Complaint <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to="/track" className="px-5 py-3 rounded-xl bg-white border border-border/40 text-slate-700 text-[10px] font-black uppercase tracking-[0.3em]">
              Track Complaint
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {["all", "active", "investigating", "resolved"].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status as any)}
              className={cn(
                "px-4 py-4 rounded-2xl border text-[10px] font-black uppercase tracking-[0.3em] transition-all",
                filter === status ? "bg-primary text-white border-primary shadow-lg shadow-primary/20" : "bg-white text-slate-500 border-border/40"
              )}
            >
              {status}
            </button>
          ))}
        </div>

        <div className="relative mb-8">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by issue, area, or tracking ID"
            className="w-full bg-white border border-border/40 rounded-2xl py-4 pl-12 pr-5 text-sm outline-none focus:ring-4 focus:ring-primary/10"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filteredIncidents.map((incident, index) => (
            <motion.article
              key={incident._id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              className="bg-white rounded-[1.75rem] border border-border/40 p-6 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-2">{incident.type}</p>
                  <h2 className="text-2xl font-black text-slate-900 leading-tight">{incident.title}</h2>
                </div>
                <div className={cn(
                  "px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-[0.3em]",
                  incident.status === "resolved" ? "bg-emerald-50 text-emerald-600" : incident.status === "investigating" ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-500"
                )}>
                  {incident.status}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 mb-5">
                <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-slate-400" /> {incident.location?.address || "Location pending"}</div>
                <div className="flex items-center gap-2"><Shield className="w-4 h-4 text-slate-400" /> {incident.severity}</div>
                <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-slate-400" /> {new Date(incident.createdAt).toLocaleDateString()}</div>
              </div>

              <div className="flex items-center justify-between gap-4 border-t border-border/40 pt-4">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 mb-1">Tracking ID</p>
                  <p className="text-sm font-black text-slate-900 tracking-tight">{incident.trackingId || "Assigned after filing"}</p>
                </div>
                <Link to={`/archive/${incident._id}`} className="text-[10px] font-black uppercase tracking-[0.3em] text-primary flex items-center gap-2">
                  View Details <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </motion.article>
          ))}

          {filteredIncidents.length === 0 && (
            <div className="py-20 text-center text-slate-500 text-sm font-medium">No public records found.</div>
          )}
        </div>
      </div>
    </div>
  );
}