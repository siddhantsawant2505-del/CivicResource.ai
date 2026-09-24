import { motion } from "framer-motion";
import { ArrowRight, Globe2, Search, FileText, UserPlus } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/BrandMark";
import { PublicLocale, usePublicLocale } from "@/lib/publicLocale";

type Locale = PublicLocale;

const copy = {
  english: {
    badge: "Mumbai civic help desk",
    title: "Report a problem without login.",
    subtitle: "File a complaint in English, Hindi, or Marathi. Anonymous by default, with mobile number optional for duplicate protection.",
    primary: "File Complaint",
    secondary: "Public Archive",
    tertiary: "Track Complaint",
    staff: "Staff Login",
    signup: "Staff Signup",
  },
  hindi: {
    badge: "मुंबई नागरिक सहायता",
    title: "बिना लॉगिन शिकायत दर्ज करें।",
    subtitle: "अंग्रेज़ी, हिंदी या मराठी में शिकायत करें। शिकायत गोपनीय रहेगी, मोबाइल नंबर वैकल्पिक है।",
    primary: "शिकायत दर्ज करें",
    secondary: "सार्वजनिक रिकॉर्ड",
    tertiary: "शिकायत ट्रैक करें",
    staff: "स्टाफ लॉगिन",
    signup: "स्टाफ साइनअप",
  },
  marathi: {
    badge: "मुंबई नागरी मदत",
    title: "लॉगिनशिवाय तक्रार नोंदवा.",
    subtitle: "इंग्रजी, हिंदी किंवा मराठीत तक्रार करा. तक्रार गोपनीय राहते, मोबाइल नंबर ऐच्छिक आहे.",
    primary: "तक्रार नोंदवा",
    secondary: "सार्वजनिक नोंद",
    tertiary: "तक्रार तपासा",
    staff: "स्टाफ लॉगिन",
    signup: "स्टाफ साइनअप",
  },
} as const;

const localeLabels: Record<Locale, string> = {
  english: "English",
  hindi: "हिंदी",
  marathi: "मराठी",
};

export default function Landing() {
  const { locale, setLocale, isIndic } = usePublicLocale();
  const text = copy[locale];

  return (
    <div className={cn("min-h-screen bg-slate-50 font-inter selection:bg-primary/20", isIndic && "[&_p]:text-[1.06em]") }>
      <header className="sticky top-0 z-50 border-b border-border/40 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BrandMark className="w-10 h-10 shadow-lg" letterClassName="text-lg" />
            <div>
              <div className="text-lg font-black tracking-tight text-slate-900">CivicResource.ai Mumbai</div>
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">{text.badge}</div>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-2xl bg-slate-100 p-1">
            {(["english", "hindi", "marathi"] as Locale[]).map((lang) => (
              <button
                key={lang}
                onClick={() => setLocale(lang)}
                className={cn(
                  "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.25em] transition-all",
                  locale === lang ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                )}
              >
                {localeLabels[lang]}
              </button>
            ))}
          </div>

          <Link to="/login" className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 hover:text-slate-900 transition-colors">
            {text.staff}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12 md:py-16">
        <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="rounded-[2rem] bg-white border border-border/40 p-8 md:p-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-50 border border-border/40 text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-6">
            <Globe2 className="w-4 h-4" /> {text.badge}
          </div>

          <h1 className="text-4xl md:text-6xl font-black tracking-tight text-slate-900 leading-none mb-5">{text.title}</h1>

          <p className="text-base text-slate-600 leading-relaxed max-w-3xl mb-8">{text.subtitle}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            <Link to="/complaint" className="px-6 py-4 rounded-2xl bg-primary text-white text-[10px] font-black uppercase tracking-[0.3em] shadow-lg shadow-primary/20 flex items-center justify-center gap-2">
              {text.primary} <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to="/archive" className="px-6 py-4 rounded-2xl bg-white border border-border/40 text-slate-800 text-[10px] font-black uppercase tracking-[0.3em] flex items-center justify-center gap-2">
              <FileText className="w-4 h-4" /> {text.secondary}
            </Link>
            <Link to="/track" className="px-6 py-4 rounded-2xl bg-white border border-border/40 text-slate-800 text-[10px] font-black uppercase tracking-[0.3em] flex items-center justify-center gap-2">
              <Search className="w-4 h-4" /> {text.tertiary}
            </Link>
          </div>

          <div className="pt-6 border-t border-border/40 flex flex-wrap items-center gap-4">
            <Link to="/login" className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-600 hover:text-slate-900 transition-colors">
              {text.staff}
            </Link>
            <Link to="/signup" className="text-[10px] font-black uppercase tracking-[0.3em] text-primary hover:text-slate-900 transition-colors flex items-center gap-2">
              <UserPlus className="w-4 h-4" /> {text.signup}
            </Link>
          </div>
        </motion.section>
      </main>
    </div>
  );
}