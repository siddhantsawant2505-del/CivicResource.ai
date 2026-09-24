import { Link } from "react-router-dom";
import { ShieldAlert, ArrowLeft, Zap, Globe2 } from "lucide-react";
import { motion } from "framer-motion";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center p-10 font-inter overflow-hidden relative">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_10px_10px,#00000005_1px,transparent_0)] bg-[length:40px_40px] pointer-events-none" />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-xl w-full text-center relative z-10"
      >
        <div className="w-24 h-24 rounded-[2rem] bg-white shadow-plinth flex items-center justify-center mx-auto mb-10 border border-border/40 group overflow-hidden">
           <ShieldAlert className="w-10 h-10 text-primary group-hover:scale-125 transition-transform duration-500" />
        </div>
        
        <h1 className="text-8xl font-black uppercase tracking-tighter text-slate-900 mb-6 leading-none italic">
          Protocol <br /> <span className="text-primary not-italic">Error 404</span>
        </h1>
        
        <p className="text-xs font-black text-slate-400 uppercase tracking-[0.4em] mb-16 leading-relaxed">
           Operational node disconnected. The requested resource protocol does not exist within the current district registry.
        </p>

        <div className="flex flex-col md:flex-row gap-6 justify-center">
           <Link to="/app" className="px-10 py-6 rounded-2xl bg-slate-900 text-white text-[11px] font-black uppercase tracking-[0.4em] shadow-plinth hover:bg-black transition-all flex items-center justify-center gap-4 active:scale-95">
              <ArrowLeft className="w-4 h-4" /> Return to Hub
           </Link>
           <Link to="/" className="px-10 py-6 rounded-2xl bg-white border-2 border-border/60 text-slate-900 text-[11px] font-black uppercase tracking-[0.4em] hover:bg-slate-50 transition-all flex items-center justify-center gap-4">
              Blueprint Home <Globe2 className="w-4 h-4" />
           </Link>
        </div>

        <div className="mt-20 pt-10 border-t border-slate-50 flex items-center justify-center gap-8 opacity-30">
           <div className="flex items-center gap-4">
              <Zap className="w-4 h-4 text-primary" />
              <span className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-900">CivicResource.ai Diagnostic Mode</span>
           </div>
        </div>
      </motion.div>

      {/* Abstract Background Elements */}
      <div className="absolute top-0 right-0 p-32 opacity-[0.02] pointer-events-none">
         <Zap className="w-[600px] h-[600px]" />
      </div>
    </div>
  );
}
