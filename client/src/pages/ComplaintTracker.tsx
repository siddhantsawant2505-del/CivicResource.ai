import { useState } from "react";
import { Link } from "react-router-dom";
import { Search, MapPin, Shield, Clock, ArrowRight, Ticket, Phone, ArrowLeft } from "lucide-react";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { usePublicLocale } from "@/lib/publicLocale";

const trackerCopy = {
  english: {
    back: "Back",
    badge: "Complaint Tracker",
    title: "Check your complaint without logging in.",
    subtitle: "Enter your tracking ID or mobile number to see the latest complaint status.",
    trackingId: "Tracking ID",
    mobile: "Mobile Number",
    optional: "Optional if you have the tracking ID",
    searching: "Searching...",
    track: "Track Complaint",
    fileNew: "File a New Complaint",
    archive: "Public Archive",
    locationPending: "Location pending",
    timeline: "Public Transparency Timeline",
    pending: "Pending",
    fixedPrompt: "Was This Complaint Fixed Properly?",
    fixed: "Fixed",
    notFixed: "Not Fixed",
    save: "Saving...",
    submit: "Submit Feedback",
    qualityNotes: "Optional notes for operations quality",
    noDescription: "No additional description stored.",
    searchHelp: "Search for a complaint using a tracking ID or phone number.",
    thanks: "Thank you. Your feedback improved dispatch learning.",
    saveError: "Unable to save feedback right now",
    view: "View",
  },
  hindi: {
    back: "वापस",
    badge: "शिकायत ट्रैकर",
    title: "बिना लॉगिन अपनी शिकायत देखें।",
    subtitle: "ताज़ा स्थिति देखने के लिए ट्रैकिंग ID या मोबाइल नंबर दर्ज करें।",
    trackingId: "ट्रैकिंग ID",
    mobile: "मोबाइल नंबर",
    optional: "अगर ट्रैकिंग ID है तो मोबाइल वैकल्पिक है",
    searching: "खोज रहे हैं...",
    track: "शिकायत ट्रैक करें",
    fileNew: "नई शिकायत दर्ज करें",
    archive: "सार्वजनिक रिकॉर्ड",
    locationPending: "लोकेशन लंबित",
    timeline: "सार्वजनिक पारदर्शिता टाइमलाइन",
    pending: "लंबित",
    fixedPrompt: "क्या यह शिकायत सही से हल हुई?",
    fixed: "हल हुआ",
    notFixed: "हल नहीं हुआ",
    save: "सेव हो रहा है...",
    submit: "फीडबैक सबमिट करें",
    qualityNotes: "ऑपरेशन गुणवत्ता के लिए वैकल्पिक नोट्स",
    noDescription: "कोई अतिरिक्त विवरण उपलब्ध नहीं है।",
    searchHelp: "ट्रैकिंग ID या मोबाइल नंबर से शिकायत खोजें।",
    thanks: "धन्यवाद। आपके फीडबैक से डिस्पैच सिस्टम बेहतर होगा।",
    saveError: "फीडबैक अभी सेव नहीं हो सका",
    view: "देखें",
  },
  marathi: {
    back: "मागे",
    badge: "तक्रार ट्रॅकर",
    title: "लॉगिन न करता तुमची तक्रार पाहा.",
    subtitle: "नवीन स्थिती पाहण्यासाठी ट्रॅकिंग ID किंवा मोबाइल नंबर टाका.",
    trackingId: "ट्रॅकिंग ID",
    mobile: "मोबाइल नंबर",
    optional: "ट्रॅकिंग ID असल्यास मोबाइल वैकल्पिक",
    searching: "शोध चालू आहे...",
    track: "तक्रार ट्रॅक करा",
    fileNew: "नवीन तक्रार नोंदवा",
    archive: "सार्वजनिक नोंद",
    locationPending: "लोकेशन प्रलंबित",
    timeline: "सार्वजनिक पारदर्शक टाइमलाइन",
    pending: "प्रलंबित",
    fixedPrompt: "ही तक्रार योग्यरीत्या सोडवली का?",
    fixed: "सोडवली",
    notFixed: "सोडवली नाही",
    save: "सेव्ह करत आहे...",
    submit: "अभिप्राय सबमिट करा",
    qualityNotes: "ऑपरेशन गुणवत्तेसाठी वैकल्पिक टिपा",
    noDescription: "अतिरिक्त तपशील उपलब्ध नाहीत.",
    searchHelp: "ट्रॅकिंग ID किंवा मोबाइल नंबरने तक्रार शोधा.",
    thanks: "धन्यवाद. तुमच्या अभिप्रायाने डिस्पॅच लर्निंग सुधारते.",
    saveError: "अभिप्राय आत्ता सेव्ह होऊ शकला नाही",
    view: "पहा",
  },
} as const;

export default function ComplaintTracker() {
  const { locale, isIndic } = usePublicLocale();
  const text = trackerCopy[locale];
  const [trackingId, setTrackingId] = useState("");
  const [phone, setPhone] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedbackDraft, setFeedbackDraft] = useState<Record<string, { citizenRating: number; success: boolean; followUpNotes: string }>>({});
  const [submittingFeedbackId, setSubmittingFeedbackId] = useState<string | null>(null);

  const handleTrack = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/public/incidents/track", {
        params: {
          trackingId: trackingId.trim(),
          phone: phone.trim(),
        },
      });
      setResults(data || []);
    } catch (error) {
      console.error("Complaint tracking failed", error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const submitFeedback = async (incident: any) => {
    const draft = feedbackDraft[incident._id] || { citizenRating: 5, success: true, followUpNotes: "" };
    setSubmittingFeedbackId(incident._id);
    try {
      const { data } = await api.post(`/public/incidents/${incident._id}/feedback`, draft);
      const updated = data?.incident;
      if (updated?._id) {
        setResults((prev) => prev.map((item) => (item._id === updated._id ? updated : item)));
      }
      toast.success(text.thanks);
    } catch (error) {
      console.error("Feedback submit failed", error);
      toast.error(text.saveError);
    } finally {
      setSubmittingFeedbackId(null);
    }
  };

  return (
    <div className={cn("min-h-screen bg-slate-50 font-inter", isIndic && "[&_p]:text-[1.05em]") }>
      <div className="max-w-5xl mx-auto px-6 py-12">
        <Link to="/" className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.25em] text-slate-500 hover:text-slate-900 mb-6">
          <ArrowLeft className="w-4 h-4" /> {text.back}
        </Link>
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-border/40 text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-4">
            <Ticket className="w-4 h-4" /> {text.badge}
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight text-slate-900 leading-none mb-4">
            {text.title}
          </h1>
          <p className="text-sm md:text-base text-slate-600 max-w-2xl leading-relaxed">
            {text.subtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-[1.5rem] border border-border/40 p-5">
            <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-3 block">{text.trackingId}</label>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={trackingId}
                onChange={(e) => setTrackingId(e.target.value)}
                placeholder="CF-..."
                className="w-full rounded-2xl border border-border/40 py-4 pl-12 pr-4 outline-none focus:ring-4 focus:ring-primary/10"
              />
            </div>
          </div>
          <div className="bg-white rounded-[1.5rem] border border-border/40 p-5">
            <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-3 block">{text.mobile}</label>
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={text.optional}
                className="w-full rounded-2xl border border-border/40 py-4 pl-12 pr-4 outline-none focus:ring-4 focus:ring-primary/10"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 mb-10">
          <button
            onClick={handleTrack}
            disabled={loading || (!trackingId.trim() && !phone.trim())}
            className="px-6 py-4 rounded-2xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.3em] disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? text.searching : text.track} <ArrowRight className="w-4 h-4" />
          </button>
          <Link to="/complaint" className="px-6 py-4 rounded-2xl bg-white border border-border/40 text-slate-700 text-[10px] font-black uppercase tracking-[0.3em]">
            {text.fileNew}
          </Link>
          <Link to="/archive" className="px-6 py-4 rounded-2xl bg-white border border-border/40 text-slate-700 text-[10px] font-black uppercase tracking-[0.3em]">
            {text.archive}
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {results.map((item) => (
            <div key={item._id} className="bg-white rounded-[1.5rem] border border-border/40 p-6 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-2">{item.type}</p>
                  <h2 className="text-2xl font-black text-slate-900 leading-tight">{item.title}</h2>
                  <p className="text-sm text-slate-600 mt-3 max-w-3xl leading-relaxed">{item.detailsEnglish || item.details || text.noDescription}</p>
                </div>
                <div className={cn(
                  "px-4 py-3 rounded-xl text-[9px] font-black uppercase tracking-[0.3em]",
                  item.status === "resolved" ? "bg-emerald-50 text-emerald-600" : item.status === "investigating" ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-600"
                )}>
                  {item.status}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
                <div className="flex items-center gap-2"><MapPin className="w-4 h-4" /> {item.location?.address || text.locationPending}</div>
                <div className="flex items-center gap-2"><Shield className="w-4 h-4" /> {item.severity}</div>
                <div className="flex items-center gap-2"><Clock className="w-4 h-4" /> {new Date(item.createdAt).toLocaleString(locale === "english" ? "en-IN" : locale === "hindi" ? "hi-IN" : "mr-IN")}</div>
              </div>

              {Array.isArray(item.timeline) && item.timeline.length > 0 && (
                <div className="mt-5 rounded-2xl border border-border/40 p-4 bg-slate-50/40">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-3">{text.timeline}</p>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                    {item.timeline.map((step: any) => (
                      <div
                        key={step.key}
                        className={cn(
                          "rounded-xl border px-3 py-2",
                          step.done ? "bg-emerald-50 border-emerald-200" : "bg-white border-border/40"
                        )}
                      >
                        <p className={cn("text-[9px] font-black uppercase tracking-widest", step.done ? "text-emerald-700" : "text-slate-500")}>{step.label}</p>
                        <p className="mt-1 text-[9px] font-bold text-slate-500 uppercase tracking-wide">{step.timestamp ? new Date(step.timestamp).toLocaleString(locale === "english" ? "en-IN" : locale === "hindi" ? "hi-IN" : "mr-IN") : text.pending}</p>
                        <p className="mt-1 text-[9px] font-bold text-slate-500">{step.explanation}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {item.status === "resolved" && !item?.outcomeLearning?.citizenRating && (
                <div className="mt-5 rounded-2xl border border-border/40 p-4 bg-white">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-3">{text.fixedPrompt}</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <select
                      value={feedbackDraft[item._id]?.citizenRating ?? 5}
                      onChange={(e) =>
                        setFeedbackDraft((prev) => ({
                          ...prev,
                          [item._id]: {
                            citizenRating: Number(e.target.value),
                            success: prev[item._id]?.success ?? true,
                            followUpNotes: prev[item._id]?.followUpNotes ?? "",
                          },
                        }))
                      }
                      className="rounded-xl border border-border/40 px-3 py-2 text-[10px] font-black uppercase tracking-widest"
                    >
                      {[5, 4, 3, 2, 1].map((rating) => (
                        <option key={rating} value={rating}>{rating} Star</option>
                      ))}
                    </select>
                    <select
                      value={(feedbackDraft[item._id]?.success ?? true) ? "yes" : "no"}
                      onChange={(e) =>
                        setFeedbackDraft((prev) => ({
                          ...prev,
                          [item._id]: {
                            citizenRating: prev[item._id]?.citizenRating ?? 5,
                            success: e.target.value === "yes",
                            followUpNotes: prev[item._id]?.followUpNotes ?? "",
                          },
                        }))
                      }
                      className="rounded-xl border border-border/40 px-3 py-2 text-[10px] font-black uppercase tracking-widest"
                    >
                      <option value="yes">{text.fixed}</option>
                      <option value="no">{text.notFixed}</option>
                    </select>
                    <button
                      onClick={() => submitFeedback(item)}
                      disabled={submittingFeedbackId === item._id}
                      className="rounded-xl bg-slate-900 text-white px-3 py-2 text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                    >
                      {submittingFeedbackId === item._id ? text.save : text.submit}
                    </button>
                  </div>
                  <textarea
                    value={feedbackDraft[item._id]?.followUpNotes ?? ""}
                    onChange={(e) =>
                      setFeedbackDraft((prev) => ({
                        ...prev,
                        [item._id]: {
                          citizenRating: prev[item._id]?.citizenRating ?? 5,
                          success: prev[item._id]?.success ?? true,
                          followUpNotes: e.target.value,
                        },
                      }))
                    }
                    placeholder={text.qualityNotes}
                    className="mt-3 w-full rounded-xl border border-border/40 p-3 text-[11px]"
                  />
                </div>
              )}

              <div className="mt-5 pt-4 border-t border-border/40 flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Tracking ID: <span className="text-slate-900">{item.trackingId || "Pending"}</span></p>
                <Link to={`/archive/${item._id}`} className="text-[10px] font-black uppercase tracking-[0.3em] text-primary hover:text-slate-900">
                  {text.view}
                </Link>
              </div>
            </div>
          ))}

          {results.length === 0 && (
            <div className="bg-white rounded-[1.5rem] border border-border/40 p-10 text-center text-slate-500">
              {text.searchHelp}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}