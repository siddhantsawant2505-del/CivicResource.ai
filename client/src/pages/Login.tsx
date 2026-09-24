import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
   ArrowRight, Mail, Lock, 
   ShieldCheck, Activity, Globe2, ChevronLeft, Users, Eye, EyeOff
} from "lucide-react";
import { motion } from "framer-motion";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import { normalizeRole } from "@/lib/session";
import { BrandMark } from "@/components/BrandMark";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
   const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { data } = await api.post("/auth/login", { email, password });
      const normalizedRole = normalizeRole(data.role) || "worker";
      localStorage.setItem("CivicResource_token", data.token);
         localStorage.setItem("CivicResource_user", JSON.stringify({
            _id: data._id,
            name: data.name,
            email: data.email,
            organization: data.organization,
            role: normalizedRole,
            unitId: data.unitId || null,
         }));
      navigate(normalizedRole === "admin" ? "/app" : "/app/driver");
    } catch (err: any) {
      setError(err.response?.data?.message || "Protocol rejection: Invalid credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#F8F9FA] font-inter overflow-hidden">
      {/* ── LEFT: The Induction Core ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col p-10 md:p-24 relative z-10 bg-white shadow-[80px_0_120px_-40px_rgba(0,0,0,0.03)]">
        <Link to="/" className="inline-flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 hover:text-primary transition-all mb-20 group">
          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back to Blueprint
        </Link>
        
        <div className="max-w-md w-full mx-auto flex-1 flex flex-col justify-center">
            <div className="flex items-center gap-4 mb-12">
               <BrandMark className="w-12 h-12 shadow-2xl" letterClassName="text-2xl" />
               <span className="text-3xl font-black uppercase tracking-tighter text-slate-900 leading-none">CivicResource.ai</span>
            </div>

            <h1 className="text-6xl font-black uppercase tracking-tighter text-slate-900 mb-4 leading-none italic">Staff <span className="text-primary not-italic">Login</span></h1>
            <p className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] mb-16 leading-relaxed">For workers and admins only. Citizens should use complaint and tracker pages.</p>

            <form onSubmit={handleLogin} className="space-y-8">
               <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 ml-2">Staff Identity</label>
                  <div className="relative group">
                     <Mail className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-primary transition-colors" />
                     <input 
                        type="email" 
                        required
                        placeholder="ID_MAIL_07" 
                        className="concierge-input w-full pl-16 py-5 bg-slate-50 focus:bg-white text-xs font-black uppercase tracking-widest"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                     />
                  </div>
               </div>
               <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 ml-2">Access Signature</label>
                  <div className="relative group">
                     <Lock className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-primary transition-colors" />
                     <input 
                        type={showPassword ? "text" : "password"}
                        required
                        placeholder="••••••••••••" 
                        className="concierge-input w-full pl-16 pr-16 py-5 bg-slate-50 focus:bg-white text-xs font-black uppercase tracking-widest"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                     />
                     <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-lg text-slate-400 hover:text-primary transition-colors"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                     >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                     </button>
                  </div>
               </div>

               {error && (
                 <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-5 rounded-2xl bg-red-50 border border-red-100 flex gap-4 text-red-600">
                    <ShieldCheck className="w-5 h-5 shrink-0" />
                    <span className="text-[10px] font-black uppercase tracking-widest leading-relaxed">{error}</span>
                 </motion.div>
               )}

               <button 
                type="submit" 
                disabled={loading}
                className="w-full py-7 rounded-2xl bg-primary text-white text-[11px] font-black uppercase tracking-[0.4em] shadow-plinth shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-4 disabled:opacity-50"
               >
                  {loading ? <Activity className="w-5 h-5 animate-spin" /> : <>Finalize Sync <ArrowRight className="w-5 h-5" /></>}
               </button>

               <Link
                  to="/signup"
                  className="block w-full py-5 rounded-2xl border border-border/40 bg-white text-slate-700 text-[10px] text-center font-black uppercase tracking-[0.3em] hover:border-primary hover:text-primary transition-all"
               >
                  Request Staff Signup
               </Link>
            </form>

            <div className="mt-16 pt-12 border-t border-slate-50 flex flex-col gap-6">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Need citizen services?</p>
               <div className="flex flex-wrap gap-4">
                  <Link to="/complaint" className="text-[10px] font-black text-primary uppercase tracking-[0.3em] underline decoration-2 underline-offset-4 hover:text-black transition-colors">File a Complaint</Link>
                  <Link to="/track" className="text-[10px] font-black text-primary uppercase tracking-[0.3em] underline decoration-2 underline-offset-4 hover:text-black transition-colors">Track Complaint</Link>
               </div>
            </div>
        </div>

        <div className="mt-auto flex items-center justify-between opacity-30 pt-10">
           <div className="flex gap-10">
              <span className="text-[9px] font-black uppercase tracking-[0.5em] text-slate-400 flex items-center gap-2">
                 <Globe2 className="w-3.5 h-3.5" /> SECURE_LINK_SSL
              </span>
              <span className="text-[9px] font-black uppercase tracking-[0.5em] text-slate-400 flex items-center gap-2">
                 <Users className="w-3.5 h-3.5" /> STAFF_ONLY
              </span>
           </div>
           <p className="text-[9px] font-black uppercase tracking-[0.5em] text-slate-400">© 2026 REGISTRY</p>
        </div>
      </div>

      {/* ── RIGHT: The Blueprint Panel ───────────────────────────────────────── */}
      <div className="hidden lg:flex flex-1 bg-slate-900 relative p-20 flex-col justify-end overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20px_20px,#ffffff05_1px,transparent_0)] bg-[length:40px_40px]" />
        
        <div className="relative z-10 max-w-lg">
           <div className="w-20 h-1 bg-primary mb-12 rounded-full shadow-[0_0_20px_rgba(255,79,0,0.8)]" />
           <h2 className="text-6xl font-black uppercase tracking-tighter text-white mb-8 leading-none italic">Strategic <br /> <span className="text-primary not-italic">Orchestration</span></h2>
           <p className="text-xs font-black text-white/40 uppercase tracking-[0.3em] leading-relaxed mb-16">
              Access the high-fidelity Command Center for real-time district node operational pulse.
           </p>
           
           <div className="grid grid-cols-2 gap-8">
              {[
                { l: "Signals Detected", v: "1,242" },
                { l: "Active Hubs", v: "07" },
                { l: "Flow Stability", v: "99.9%" },
                { l: "Sync v3.4", v: "Ready" }
              ].map(stat => (
                <div key={stat.l} className="p-6 rounded-3xl bg-white/5 border border-white/5 backdrop-blur-md">
                   <p className="text-[8px] font-black text-white/40 uppercase tracking-widest mb-1">{stat.l}</p>
                   <p className="text-xl font-black text-white">{stat.v}</p>
                </div>
              ))}
           </div>
        </div>
        
        {/* Abstract Blueprint Element */}
        <div className="absolute top-0 right-0 p-20 opacity-5">
           <Activity className="w-[600px] h-[600px] text-white" />
        </div>
      </div>
    </div>
  );
}
