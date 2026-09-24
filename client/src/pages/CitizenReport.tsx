import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  MapPin,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Crosshair,
  Send,
  Zap,
  Activity,
  Mic,
  Languages,
  Square,
  LocateFixed,
  Map,
} from "lucide-react";
import { cn } from "@/lib/utils";
import api from "@/lib/api";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { usePublicLocale } from "@/lib/publicLocale";

const types = [
  { id: "infrastructure", label: "Infrastructure", icon: Shield, color: "text-primary", bg: "bg-primary/5" },
  { id: "safety", label: "Public Safety", icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-50/50" },
  { id: "sanitation", label: "Sanitation", icon: MapPin, color: "text-secondary", bg: "bg-secondary/5" },
  { id: "utility", label: "Utility Fault", icon: Zap, color: "text-emerald-500", bg: "bg-emerald-50/50" },
  { id: "water", label: "Water Supply", icon: Shield, color: "text-blue-500", bg: "bg-blue-50" },
  { id: "roads", label: "Roads", icon: AlertTriangle, color: "text-orange-500", bg: "bg-orange-50" },
];

type ReportLanguage = "english" | "hindi" | "marathi";

const languageConfig: Record<ReportLanguage, { label: string; speech: string }> = {
  english: { label: "English", speech: "en-IN" },
  hindi: { label: "हिंदी", speech: "hi-IN" },
  marathi: { label: "मराठी", speech: "mr-IN" },
};

const copy: Record<ReportLanguage, Record<string, string>> = {
  english: {
    back: "Back",
    step1Title: "Induct Signal",
    step1Subtitle: "Select service type and reporting language. Your complaint can stay anonymous, but a mobile number helps reduce duplicate reports.",
    inputLanguage: "Input Language",
    step2Title: "Report Details",
    step2Subtitle: "Write or speak in",
    incidentHeader: "Incident Header",
    description: "Full Description",
    titlePlaceholder: "Short title for the issue",
    detailsPlaceholder: "Describe what happened and urgency",
    anonymousTitle: "Anonymous public display",
    anonymousNote: "Mobile number is required to reduce fake reports. Your complaint is still displayed as anonymous.",
    otpSoon: "OTP verification will be added soon.",
    mobilePlaceholder: "Mobile number (required)",
    revert: "Revert",
    proceedLocation: "Proceed to Location",
    step3Title: "Geospatial Target",
    textAddress: "Text Address",
    useCurrent: "Use Current",
    locating: "Locating...",
    pinMap: "Pin on Map",
    addressPlaceholder: "Area / landmark (required text location)",
    locationDetailsLabel: "Location Details (Text)",
    locationDetailsPlaceholder: "Building, street, landmark, floor, gate, or other pinpoint details",
    mapHeader: "Pinpoint on Map (click to set)",
    transmitting: "TRANSMITTING...",
    finalize: "Finalize Induction",
    step4Title: "Signal Synchronized",
    step4Subtitle: "Stored in original language and English for command center triage. Keep your tracking ID safe for later lookup.",
    trackingId: "Tracking ID",
    trackerUse: "Use this ID or your mobile number on the tracker page.",
    aiServiceFamily: "AI Service Family",
    newInduction: "Authorize New Induction",
    invalidPhone: "Please enter a valid mobile number",
    submitFailed: "Unable to submit complaint",
    geolocationUnsupported: "Geolocation is not supported in this browser",
    currentCaptured: "Current location captured",
    currentFailed: "Unable to get current location",
    pinSelected: "Map pin location selected",
    footer: "CivicResource.ai Field Protocol Registry v2.4.1",
  },
  hindi: {
    back: "वापस",
    step1Title: "शिकायत शुरू करें",
    step1Subtitle: "सेवा प्रकार और रिपोर्टिंग भाषा चुनें। आपकी शिकायत गुमनाम रह सकती है, लेकिन मोबाइल नंबर से डुप्लिकेट रिपोर्ट कम होती हैं।",
    inputLanguage: "इनपुट भाषा",
    step2Title: "शिकायत विवरण",
    step2Subtitle: "लिखें या बोलें",
    incidentHeader: "संक्षिप्त शीर्षक",
    description: "पूरा विवरण",
    titlePlaceholder: "समस्या का छोटा शीर्षक",
    detailsPlaceholder: "क्या हुआ और कितनी जल्दी समाधान चाहिए, बताएं",
    anonymousTitle: "सार्वजनिक रूप से गुमनाम",
    anonymousNote: "फर्जी शिकायत रोकने के लिए मोबाइल नंबर आवश्यक है। आपकी पहचान सार्वजनिक रूप से गुमनाम रहेगी।",
    otpSoon: "OTP सत्यापन जल्द जोड़ा जाएगा।",
    mobilePlaceholder: "मोबाइल नंबर (आवश्यक)",
    revert: "पीछे जाएं",
    proceedLocation: "लोकेशन पर जाएं",
    step3Title: "लोकेशन सेट करें",
    textAddress: "टेक्स्ट पता",
    useCurrent: "वर्तमान लोकेशन",
    locating: "लोकेशन ढूंढ रहे हैं...",
    pinMap: "मैप पर पिन",
    addressPlaceholder: "क्षेत्र / लैंडमार्क (आवश्यक)",
    locationDetailsLabel: "लोकेशन विवरण (टेक्स्ट)",
    locationDetailsPlaceholder: "बिल्डिंग, गली, लैंडमार्क, फ्लोर, गेट या अन्य जानकारी",
    mapHeader: "मैप पर सटीक जगह चुनें (क्लिक करें)",
    transmitting: "भेजा जा रहा है...",
    finalize: "शिकायत सबमिट करें",
    step4Title: "शिकायत दर्ज हो गई",
    step4Subtitle: "शिकायत मूल भाषा और अंग्रेजी दोनों में सुरक्षित है। ट्रैकिंग ID संभालकर रखें।",
    trackingId: "ट्रैकिंग ID",
    trackerUse: "इस ID या मोबाइल नंबर से ट्रैकर में स्थिति देखें।",
    aiServiceFamily: "AI सेवा श्रेणी",
    newInduction: "नई शिकायत दर्ज करें",
    invalidPhone: "कृपया सही मोबाइल नंबर दर्ज करें",
    submitFailed: "शिकायत जमा नहीं हो सकी",
    geolocationUnsupported: "इस ब्राउज़र में जियोलोकेशन समर्थित नहीं है",
    currentCaptured: "वर्तमान लोकेशन प्राप्त हुई",
    currentFailed: "वर्तमान लोकेशन प्राप्त नहीं हो सकी",
    pinSelected: "मैप पिन लोकेशन चुनी गई",
    footer: "CivicResource.ai फील्ड प्रोटोकॉल रजिस्ट्री v2.4.1",
  },
  marathi: {
    back: "मागे",
    step1Title: "तक्रार सुरू करा",
    step1Subtitle: "सेवा प्रकार आणि रिपोर्ट भाषा निवडा. तुमची तक्रार गोपनीय राहू शकते, पण मोबाइल नंबर दिल्यास डुप्लिकेट तक्रारी कमी होतात.",
    inputLanguage: "इनपुट भाषा",
    step2Title: "तक्रारीचे तपशील",
    step2Subtitle: "लिहा किंवा बोला",
    incidentHeader: "तक्रारीचे शीर्षक",
    description: "संपूर्ण तपशील",
    titlePlaceholder: "समस्येचे छोटे शीर्षक",
    detailsPlaceholder: "नेमके काय झाले आणि किती तातडी आहे ते लिहा",
    anonymousTitle: "सार्वजनिकरित्या गोपनीय",
    anonymousNote: "फेक तक्रारी कमी करण्यासाठी मोबाइल नंबर आवश्यक आहे. तक्रार सार्वजनिक ठिकाणी गोपनीयच दिसेल.",
    otpSoon: "OTP पडताळणी लवकरच जोडली जाईल.",
    mobilePlaceholder: "मोबाइल नंबर (आवश्यक)",
    revert: "मागे जा",
    proceedLocation: "लोकेशनकडे जा",
    step3Title: "लोकेशन निश्चित करा",
    textAddress: "टेक्स्ट पत्ता",
    useCurrent: "सध्याचे लोकेशन",
    locating: "लोकेशन घेत आहे...",
    pinMap: "नकाशावर पिन",
    addressPlaceholder: "परिसर / लँडमार्क (आवश्यक)",
    locationDetailsLabel: "लोकेशन तपशील (टेक्स्ट)",
    locationDetailsPlaceholder: "इमारत, रस्ता, लँडमार्क, मजला, गेट किंवा इतर तपशील",
    mapHeader: "नकाशावर अचूक जागा निवडा (क्लिक करा)",
    transmitting: "पाठवत आहे...",
    finalize: "तक्रार सबमिट करा",
    step4Title: "तक्रार नोंद झाली",
    step4Subtitle: "तक्रार मूळ भाषेत आणि इंग्रजीत साठवली आहे. ट्रॅकिंग ID जपून ठेवा.",
    trackingId: "ट्रॅकिंग ID",
    trackerUse: "ही ID किंवा मोबाइल नंबर वापरून ट्रॅकरमध्ये स्थिती पाहा.",
    aiServiceFamily: "AI सेवा प्रकार",
    newInduction: "नवीन तक्रार नोंदवा",
    invalidPhone: "कृपया वैध मोबाइल नंबर टाका",
    submitFailed: "तक्रार सबमिट करता आली नाही",
    geolocationUnsupported: "या ब्राउझरमध्ये जिओलोकेशन उपलब्ध नाही",
    currentCaptured: "सध्याचे लोकेशन मिळाले",
    currentFailed: "सध्याचे लोकेशन मिळू शकले नाही",
    pinSelected: "नकाशावरील पिन लोकेशन निवडले",
    footer: "CivicResource.ai फील्ड प्रोटोकॉल रजिस्ट्री v2.4.1",
  },
};

const typeLabels: Record<ReportLanguage, Record<string, string>> = {
  english: {
    infrastructure: "Infrastructure",
    safety: "Public Safety",
    sanitation: "Sanitation",
    utility: "Utility Fault",
    water: "Water Supply",
    roads: "Roads",
  },
  hindi: {
    infrastructure: "इन्फ्रास्ट्रक्चर",
    safety: "जन सुरक्षा",
    sanitation: "स्वच्छता",
    utility: "यूटिलिटी खराबी",
    water: "पानी आपूर्ति",
    roads: "सड़कें",
  },
  marathi: {
    infrastructure: "पायाभूत सुविधा",
    safety: "सार्वजनिक सुरक्षा",
    sanitation: "स्वच्छता",
    utility: "युटिलिटी बिघाड",
    water: "पाणी पुरवठा",
    roads: "रस्ते",
  },
};

const geocodeFromAddress = (address: string) => {
  const value = address.toLowerCase();
  if (value.includes("andheri")) return { lat: 19.1136, lng: 72.8697 };
  if (value.includes("bandra")) return { lat: 19.0544, lng: 72.8406 };
  if (value.includes("thane")) return { lat: 19.2183, lng: 72.9781 };
  if (value.includes("powai")) return { lat: 19.1176, lng: 72.906 };
  if (value.includes("pune")) return { lat: 18.5204, lng: 73.8567 };
  return { lat: 19.076, lng: 72.8777 };
};

export default function CitizenReport() {
  type LocationSource = "current" | "pin" | "text";
  const { locale, setLocale, isIndic } = usePublicLocale();
  const text = copy[locale];

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    title: "",
    details: "",
    type: "",
    sourceLanguage: locale,
    reporterPhone: "",
    isAnonymous: true,
    location: { address: "", details: "", lat: 19.076, lng: 72.8777 },
  });
  const [submittedIncident, setSubmittedIncident] = useState<any | null>(null);
  const [locationSource, setLocationSource] = useState<LocationSource>("text");
  const [isLocating, setIsLocating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [voiceTarget, setVoiceTarget] = useState<"title" | "details" | null>(null);

  const SpeechRecognition = useMemo(() => {
    const anyWindow = window as any;
    return anyWindow.SpeechRecognition || anyWindow.webkitSpeechRecognition || null;
  }, []);

  const startVoiceCapture = (target: "title" | "details") => {
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = languageConfig[formData.sourceLanguage].speech;
    recognition.interimResults = true;
    recognition.continuous = false;

    setVoiceTarget(target);
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((res: any) => res[0].transcript)
        .join(" ")
        .trim();
      setFormData((prev) => ({ ...prev, [target]: transcript }));
    };

    recognition.onerror = () => setVoiceTarget(null);
    recognition.onend = () => setVoiceTarget(null);
    recognition.start();
  };

  const handleSubmit = async () => {
    const cleanedPhone = formData.reporterPhone.replace(/\D/g, "");
    if (cleanedPhone.length < 10) {
      toast.error(text.invalidPhone);
      return;
    }

    setIsSubmitting(true);
    try {
      const hasManualCoords = typeof formData.location.lat === "number" && typeof formData.location.lng === "number";
      const coords = hasManualCoords ? { lat: formData.location.lat, lng: formData.location.lng } : geocodeFromAddress(formData.location.address);
      const mergedDetails = formData.location.details
        ? `${formData.details}\n\nLocation Notes: ${formData.location.details}`
        : formData.details;

      const { data } = await api.post("/public/incidents", {
        title: formData.title,
        details: mergedDetails,
        type: formData.type,
        sourceLanguage: formData.sourceLanguage,
        severity: "medium",
        reporterPhone: cleanedPhone,
        isAnonymous: true,
        location: {
          address: formData.location.address,
          lat: coords.lat,
          lng: coords.lng,
        },
      });
      setSubmittedIncident(data);
      setStep(4);
    } catch (err) {
      console.error("Incident report failed", err);
      const message = (err as any)?.response?.data?.message || (err as any)?.message || text.submitFailed;
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error(text.geolocationUnsupported);
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        setFormData((prev) => ({
          ...prev,
          location: {
            ...prev.location,
            lat,
            lng,
            address: prev.location.address || `Current GPS Location (${lat}, ${lng})`,
          },
        }));
        setLocationSource("current");
        setIsLocating(false);
        toast.success(text.currentCaptured);
      },
      () => {
        setIsLocating(false);
        toast.error(text.currentFailed);
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  const LocationPicker = () => {
    useMapEvents({
      click(e) {
        const lat = Number(e.latlng.lat.toFixed(6));
        const lng = Number(e.latlng.lng.toFixed(6));
        setFormData((prev) => ({
          ...prev,
          location: {
            ...prev.location,
            lat,
            lng,
            address: prev.location.address || `Pinned Location (${lat}, ${lng})`,
          },
        }));
        setLocationSource("pin");
        toast.success(text.pinSelected);
      },
    });
    return null;
  };

  return (
    <div className={cn("min-h-full flex flex-col bg-slate-50/30 font-inter", isIndic && "[&_p]:text-[1.05em]") }>
      <div className="px-6 pt-6">
        <Link to="/" className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.25em] text-slate-500 hover:text-slate-900">
          <ArrowLeft className="w-4 h-4" /> {text.back}
        </Link>
      </div>
      <div className="h-2 flex w-full">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={cn(
              "h-full flex-1 transition-all duration-700",
              step >= i ? "bg-primary shadow-[0_0_15px_rgba(255,79,0,0.4)]" : "bg-slate-200"
            )}
          />
        ))}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-3xl w-full text-center"
            >
              <div className="w-20 h-20 rounded-3xl bg-white shadow-plinth flex items-center justify-center mx-auto mb-10">
                <Shield className="w-10 h-10 text-primary" />
              </div>
              <h1 className="text-5xl font-black uppercase tracking-tighter text-slate-900 mb-6 leading-none">{text.step1Title}</h1>
              <p className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] mb-10 leading-relaxed">
                {text.step1Subtitle}
              </p>

              <div className="max-w-lg mx-auto mb-10">
                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-3 block">
                  <Languages className="w-3.5 h-3.5 inline mr-2" /> {text.inputLanguage}
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {(Object.keys(languageConfig) as ReportLanguage[]).map((lang) => (
                    <button
                      key={lang}
                      onClick={() => {
                        setLocale(lang);
                        setFormData((prev) => ({ ...prev, sourceLanguage: lang }));
                      }}
                      className={cn(
                        "py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 transition-all",
                        formData.sourceLanguage === lang
                          ? "bg-primary border-primary text-white shadow-lg shadow-primary/20"
                          : "bg-white border-slate-200 text-slate-500"
                      )}
                    >
                      {languageConfig[lang].label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                {types.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setFormData((prev) => ({ ...prev, type: t.id }));
                      setStep(2);
                    }}
                    className={cn(
                      "p-8 rounded-[2.2rem] bg-white border-2 border-transparent shadow-tactile transition-all hover:border-primary hover:scale-[1.02] flex flex-col items-center group",
                      formData.type === t.id && "border-primary shadow-plinth"
                    )}
                  >
                    <div className={cn("w-16 h-16 rounded-[1.4rem] flex items-center justify-center mb-4 group-hover:rotate-12 transition-transform", t.bg)}>
                      <t.icon className={cn("w-7 h-7", t.color)} />
                    </div>
                    <span className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-600 group-hover:text-slate-900 transition-colors">
                      {typeLabels[locale][t.id] || t.label}
                    </span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-xl w-full"
            >
              <h2 className="text-3xl font-black uppercase tracking-tight text-slate-900 mb-3 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white text-sm">02</div> {text.step2Title}
              </h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-12">
                {text.step2Subtitle} {languageConfig[formData.sourceLanguage].label}.
              </p>

              <div className="space-y-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 ml-2 italic">{text.incidentHeader}</label>
                  <div className="relative">
                    <input
                      placeholder={text.titlePlaceholder}
                      className="concierge-input w-full pr-16"
                      value={formData.title}
                      onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                    />
                    {SpeechRecognition && (
                      <button
                        type="button"
                        onClick={() => startVoiceCapture("title")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-primary/10 text-primary"
                      >
                        {voiceTarget === "title" ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 ml-2 italic">{text.description}</label>
                  <div className="relative">
                    <textarea
                      placeholder={text.detailsPlaceholder}
                      className="concierge-input w-full min-h-[160px] resize-none pr-16"
                      value={formData.details}
                      onChange={(e) => setFormData((prev) => ({ ...prev, details: e.target.value }))}
                    />
                    {SpeechRecognition && (
                      <button
                        type="button"
                        onClick={() => startVoiceCapture("details")}
                        className="absolute right-3 top-3 p-2 rounded-lg bg-primary/10 text-primary"
                      >
                        {voiceTarget === "details" ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-3 rounded-2xl border border-border/40 bg-white p-6">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">{text.anonymousTitle}</p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-2 leading-relaxed">
                      {text.anonymousNote}
                    </p>
                    <p className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] mt-2 leading-relaxed">
                      {text.otpSoon}
                    </p>
                  </div>
                  <input
                    type="tel"
                    required
                    placeholder={text.mobilePlaceholder}
                    className="concierge-input w-full"
                    value={formData.reporterPhone}
                    onChange={(e) => setFormData((prev) => ({ ...prev, reporterPhone: e.target.value }))}
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    onClick={() => setStep(1)}
                    className="flex-1 py-5 rounded-2xl bg-white border border-border/60 text-[10px] font-black uppercase tracking-[0.3em] hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                  >
                    <ArrowLeft className="w-4 h-4" /> {text.revert}
                  </button>
                  <button
                    disabled={!formData.title || !formData.details || !formData.reporterPhone.trim()}
                    onClick={() => setStep(3)}
                    className="flex-[2] py-5 rounded-2xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.3em] shadow-2xl hover:bg-black transition-all flex items-center justify-center gap-3 disabled:opacity-30 disabled:cursor-not-allowed group"
                  >
                    {text.proceedLocation} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-3xl w-full"
            >
              <h2 className="text-3xl font-black uppercase tracking-tight text-slate-900 mb-10 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white text-sm">03</div> {text.step3Title}
              </h2>

              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setLocationSource("text")}
                    className={cn(
                      "px-4 py-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all",
                      locationSource === "text" ? "bg-primary text-white border-primary" : "bg-white border-border/40 text-slate-500"
                    )}
                  >
                    {text.textAddress}
                  </button>
                  <button
                    type="button"
                    onClick={useCurrentLocation}
                    disabled={isLocating}
                    className={cn(
                      "px-4 py-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50",
                      locationSource === "current" ? "bg-primary text-white border-primary" : "bg-white border-border/40 text-slate-500"
                    )}
                  >
                    <LocateFixed className="w-3.5 h-3.5 inline mr-1" /> {isLocating ? text.locating : text.useCurrent}
                  </button>
                  <button
                    type="button"
                    onClick={() => setLocationSource("pin")}
                    className={cn(
                      "px-4 py-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all",
                      locationSource === "pin" ? "bg-primary text-white border-primary" : "bg-white border-border/40 text-slate-500"
                    )}
                  >
                    <Map className="w-3.5 h-3.5 inline mr-1" /> {text.pinMap}
                  </button>
                </div>

                <div className="relative group">
                  <MapPin className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-primary" />
                  <input
                    placeholder={text.addressPlaceholder}
                    className="concierge-input w-full pl-16 pr-24"
                    value={formData.location.address}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        location: { ...prev.location, address: e.target.value },
                      }))
                    }
                  />
                  <button
                    type="button"
                    onClick={useCurrentLocation}
                    className="absolute right-3 top-1/2 -translate-y-1/2 px-4 py-2 bg-primary/10 text-[9px] font-black text-primary uppercase rounded-xl hover:bg-primary/20 transition-all"
                  >
                    <Crosshair className="w-3.5 h-3.5 inline mr-1" /> GPS
                  </button>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 ml-2 italic">{text.locationDetailsLabel}</label>
                  <textarea
                    placeholder={text.locationDetailsPlaceholder}
                    className="concierge-input w-full min-h-[100px] resize-none"
                    value={formData.location.details}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        location: { ...prev.location, details: e.target.value },
                      }))
                    }
                  />
                </div>

                <div className="rounded-2xl border border-border/40 overflow-hidden bg-white">
                  <div className="px-4 py-3 border-b border-border/40 bg-slate-50 flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{text.mapHeader}</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-primary">
                      {formData.location.lat.toFixed(4)}, {formData.location.lng.toFixed(4)}
                    </span>
                  </div>
                  <div className="h-[300px]">
                    <MapContainer center={[formData.location.lat, formData.location.lng]} zoom={12} className="h-full w-full">
                      <TileLayer
                        attribution='&copy; OpenStreetMap contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />
                      <LocationPicker />
                      <Marker position={[formData.location.lat, formData.location.lng]} />
                    </MapContainer>
                  </div>
                </div>

                <div className="flex gap-4 pt-10">
                  <button
                    onClick={() => setStep(2)}
                    className="flex-1 py-5 rounded-2xl bg-white border border-border/60 text-[10px] font-black uppercase tracking-[0.3em] hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                  >
                    <ArrowLeft className="w-4 h-4" /> {text.revert}
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting || !formData.location.address || !formData.location.details}
                    className="flex-[2] py-5 rounded-2xl bg-primary text-white text-[10px] font-black uppercase tracking-[0.3em] shadow-2xl shadow-primary/30 hover:bg-primary/95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    {isSubmitting ? <Activity className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {isSubmitting ? text.transmitting : text.finalize}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-xl w-full text-center"
            >
              <div className="w-32 h-32 rounded-[2.5rem] bg-emerald-500 shadow-2xl shadow-emerald-500/30 flex items-center justify-center mx-auto mb-10">
                <CheckCircle className="w-14 h-14 text-white" />
              </div>
              <h2 className="text-4xl font-black uppercase tracking-tighter text-slate-900 mb-6">{text.step4Title}</h2>
              <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-12 leading-relaxed">
                {text.step4Subtitle}
              </p>

              <div className="mb-10 rounded-2xl border border-border/40 bg-white p-6 text-left">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">{text.trackingId}</p>
                <p className="text-2xl font-black text-slate-900 tracking-tight">{submittedIncident?.trackingId || "Generated on submit"}</p>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-3 leading-relaxed">
                  {text.trackerUse}
                </p>
                <div className="mt-5 grid grid-cols-1 gap-3">
                  <div className="rounded-xl border border-border/40 bg-slate-50 p-4">
                    <p className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-400">{text.aiServiceFamily}</p>
                    <p className="mt-2 text-sm font-black uppercase tracking-tight text-slate-900">{submittedIncident?.aiTriage?.resourceFamily || submittedIncident?.type || "general"}</p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  setStep(1);
                  setFormData({
                    title: "",
                    details: "",
                    type: "",
                    sourceLanguage: locale,
                    reporterPhone: "",
                    isAnonymous: true,
                    location: { address: "", details: "", lat: 19.076, lng: 72.8777 },
                  });
                  setSubmittedIncident(null);
                }}
                className="w-full py-6 rounded-2xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.3em] shadow-plinth transition-all hover:bg-black active:scale-[0.98]"
              >
                {text.newInduction}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <footer className="p-8 border-t border-border/40 text-center">
        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.5em] flex items-center justify-center gap-3">
          <Shield className="w-4 h-4 opacity-30" /> {text.footer}
        </p>
      </footer>
    </div>
  );
}
