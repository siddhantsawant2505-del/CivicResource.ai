import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Navigation, MapPin, AlertCircle, Clock, 
  CheckCircle, Shield, Truck, Zap, Phone,
   ArrowRight, Activity, Radio, Signal, Info, Search, AlertTriangle
} from "lucide-react";
import { cn } from "@/lib/utils";
import api from "@/lib/api";
import { toast } from "sonner";
import { MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip } from "react-leaflet";
import { divIcon } from "leaflet";
import type { DivIcon, LatLngExpression } from "leaflet";

const haversineKm = (aLat: number, aLng: number, bLat: number, bLng: number) => {
   const toRad = (v: number) => (Math.PI / 180) * v;
   const R = 6371;
   const dLat = toRad(bLat - aLat);
   const dLng = toRad(bLng - aLng);
   const aa =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
   return 2 * R * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
};

const formatCountdown = (seconds: number) => {
   if (!Number.isFinite(seconds)) return '--:--';
   const total = Math.max(0, Math.round(seconds));
   const minutes = Math.floor(total / 60).toString().padStart(2, '0');
   const remaining = (total % 60).toString().padStart(2, '0');
   return `${minutes}:${remaining}`;
};

const vehicleEmojiByType: Record<string, string> = {
   police: "🚓",
   fire: "🚒",
   medical: "🚑",
   utility: "🚐",
   sanitation: "🚛",
   public_works: "🚚",
   drone: "🚁",
};

const makeBadgeIcon = (symbol: string, bg: string, fg = "#ffffff"): DivIcon =>
   divIcon({
      className: "",
      html: `<div style="width:30px;height:30px;border-radius:9999px;background:${bg};color:${fg};display:flex;align-items:center;justify-content:center;border:2px solid #ffffff;box-shadow:0 6px 16px rgba(0,0,0,0.25);font-weight:900;font-size:14px;line-height:1;">${symbol}</div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
      popupAnchor: [0, -16],
   });

const complaintIcon = () => makeBadgeIcon("C", "#ff4f00", "#ffffff");
const responderIcon = (type: string) => makeBadgeIcon(vehicleEmojiByType[String(type || "").toLowerCase()] || "🚚", "#2563eb", "#ffffff");
const riskIcon = (risk: "high" | "medium" | "low") => makeBadgeIcon("⚠", risk === "high" ? "#ef4444" : risk === "medium" ? "#f59e0b" : "#10b981", "#ffffff");

type RiskMarker = {
   id: string;
   lat: number;
   lng: number;
   label: string;
   risk: "high" | "medium" | "low";
};

function TacticalWorkerMap({
   activeIncident,
   incidents,
}: {
   activeIncident: any;
   incidents: any[];
}) {
   const incidentLat = Number(activeIncident?.location?.lat);
   const incidentLng = Number(activeIncident?.location?.lng);

   if (!Number.isFinite(incidentLat) || !Number.isFinite(incidentLng)) {
      return (
         <div className="h-[340px] rounded-3xl border border-border/50 bg-slate-50 flex items-center justify-center text-slate-500 text-xs font-black uppercase tracking-wider">
            Incident coordinates unavailable
         </div>
      );
   }

   const unitLat = Number(activeIncident?.assignedPersonnel?.location?.lat ?? incidentLat - 0.012);
   const unitLng = Number(activeIncident?.assignedPersonnel?.location?.lng ?? incidentLng - 0.01);
   const incidentPoint: LatLngExpression = [incidentLat, incidentLng];
   const trackingCurrent = activeIncident?.tracking?.currentLocation;
   const currentLat = Number.isFinite(Number(trackingCurrent?.lat)) ? Number(trackingCurrent?.lat) : unitLat;
   const currentLng = Number.isFinite(Number(trackingCurrent?.lng)) ? Number(trackingCurrent?.lng) : unitLng;
   const unitPoint: LatLngExpression = [currentLat, currentLng];
   const distanceKm = haversineKm(currentLat, currentLng, incidentLat, incidentLng);

   const routeMidPoint: LatLngExpression = [
      (unitLat + incidentLat) / 2 + 0.002,
      (unitLng + incidentLng) / 2 - 0.002,
   ];

   const trackedPath: LatLngExpression[] = Array.isArray(activeIncident?.tracking?.path)
      ? activeIncident.tracking.path
           .filter((p: any) => Number.isFinite(Number(p?.lat)) && Number.isFinite(Number(p?.lng)))
           .map((p: any) => [Number(p.lat), Number(p.lng)] as LatLngExpression)
      : [];

   const routePoints: LatLngExpression[] = trackedPath.length >= 2 ? trackedPath : [unitPoint, routeMidPoint, incidentPoint];

   const nearbyFromOtherAssignments: RiskMarker[] = (incidents || [])
      .filter((inc: any) => inc?._id !== activeIncident?._id && inc?.location?.lat != null && inc?.location?.lng != null)
      .slice(0, 3)
      .map((inc: any, idx: number) => ({
         id: `nearby-${inc._id}`,
         lat: Number(inc.location.lat),
         lng: Number(inc.location.lng),
         label: inc.title || `Nearby risk ${idx + 1}`,
         risk: inc.severity === "critical" || inc.severity === "high" ? "high" : inc.severity === "medium" ? "medium" : "low",
      }));

   const generatedNearby: RiskMarker[] = [
      { id: "gen-1", lat: incidentLat + 0.005, lng: incidentLng + 0.004, label: "Crowd density spike", risk: "high" },
      { id: "gen-2", lat: incidentLat - 0.004, lng: incidentLng + 0.006, label: "Access lane blocked", risk: "medium" },
      { id: "gen-3", lat: incidentLat + 0.003, lng: incidentLng - 0.005, label: "Utility hazard zone", risk: "low" },
   ];

   const riskMarkers = nearbyFromOtherAssignments.length ? nearbyFromOtherAssignments : generatedNearby;

   const riskColor = (risk: RiskMarker["risk"]) => {
      if (risk === "high") return "#ef4444";
      if (risk === "medium") return "#f59e0b";
      return "#10b981";
   };

   return (
      <div className="h-[340px] rounded-3xl overflow-hidden border border-border/50 relative">
         <MapContainer center={incidentPoint} zoom={13} className="h-full w-full" zoomControl={false}>
            <TileLayer
               attribution='&copy; OpenStreetMap contributors'
               url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <Polyline
               positions={routePoints}
               pathOptions={{ color: "#2563eb", weight: 4, opacity: 0.9, dashArray: "10 6" }}
            />

            <Marker position={unitPoint} icon={responderIcon(activeIncident?.assignedPersonnel?.type || 'utility')}>
               <Tooltip direction="top">Responder Unit</Tooltip>
               <Popup>
                  <div className="text-[12px] font-bold">Responder Unit</div>
                  <div className="text-[11px] text-slate-500">{currentLat.toFixed(5)}, {currentLng.toFixed(5)}</div>
                  <div className="text-[11px] uppercase text-slate-500">{String(trackingCurrent?.phase || activeIncident?.dispatchStatus || 'en-route')}</div>
                  <div className="text-[11px] text-slate-500">{distanceKm.toFixed(2)} km away</div>
               </Popup>
            </Marker>

            <Marker position={incidentPoint} icon={complaintIcon()}>
               <Tooltip direction="top">Incident Target</Tooltip>
               <Popup>
                  <div className="text-[12px] font-bold">{activeIncident?.title}</div>
                  <div className="text-[11px] text-slate-500">{incidentLat.toFixed(5)}, {incidentLng.toFixed(5)}</div>
               </Popup>
            </Marker>

            {riskMarkers.map((risk) => (
               <Marker key={risk.id} position={[risk.lat, risk.lng]} icon={riskIcon(risk.risk)}>
                  <Tooltip direction="top">{risk.label}</Tooltip>
                  <Popup>
                     <div className="text-[12px] font-bold">{risk.label}</div>
                     <div className="text-[11px] uppercase text-slate-500">Risk: {risk.risk}</div>
                     <div className="text-[11px] text-slate-500">{risk.lat.toFixed(5)}, {risk.lng.toFixed(5)}</div>
                  </Popup>
               </Marker>
            ))}
         </MapContainer>

         <div className="absolute top-3 left-3 z-[500] rounded-xl bg-white/95 border border-border/60 px-3 py-2">
            <div className="text-[9px] font-black uppercase tracking-widest text-slate-700">Tactical Layer</div>
            <div className="text-[9px] font-bold text-slate-500">Blue: Unit route, Red: Incident, Risk dots: nearby hazards</div>
         </div>
      </div>
   );
}

export default function DriverHUD() {
  const [activeIncident, setActiveIncident] = useState<any>(null);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [taskQueue, setTaskQueue] = useState<any[]>([]);
  const [assignedResource, setAssignedResource] = useState<any>(null);
  const [incidentFilter, setIncidentFilter] = useState("");
  const [loading, setLoading] = useState(true);
   const [isRouting, setIsRouting] = useState(false);
   const [isCompleting, setIsCompleting] = useState(false);
   const [, setClockTick] = useState(0);
   const activeIncidentIdRef = useRef<string | null>(null);

   const selectIncident = (incident: any | null) => {
      setActiveIncident(incident);
      activeIncidentIdRef.current = incident?._id || null;
   };

   const refreshAssignments = async () => {
      let data: any[] = [];
      let personnelInfo: any = null;
      try {
         const resp = await api.get('/dispatch/my-assignments');
         data = resp.data || [];
         
         // Fetch personnel specific info for queue and resource
         const userStr = localStorage.getItem('CivicResource_user') || localStorage.getItem('CivicFlow_user');
         const user = userStr ? JSON.parse(userStr) : null;
         if (user?.unitId) {
            const pResp = await api.get(`/dispatch/assignments/${user.unitId.toUpperCase()}`);
            personnelInfo = pResp.data;
         }
      } catch (err: any) {
         const stored = localStorage.getItem('CivicResource_user') || localStorage.getItem('CivicFlow_user');
         const parsed = stored ? JSON.parse(stored) : null;
         const unitId = String(parsed?.unitId || '').trim();

         if (unitId) {
            const fallback = await api.get(`/dispatch/assignments/${unitId.toUpperCase()}`);
            data = fallback.data?.assignedIncidents || [];
            personnelInfo = fallback.data;
         } else if (err?.response?.status >= 500) {
            throw err;
         }
      }

      setIncidents(data || []);
      setTaskQueue(personnelInfo?.taskQueue || []);
      setAssignedResource(personnelInfo?.assignedResource || null);

      const sorted = [...(data || [])].sort((a: any, b: any) => {
         const score = (incident: any) => {
            if (incident.status === 'resolved' || incident.dispatchStatus === 'completed') return 0;
            if (incident.status === 'investigating' || incident.dispatchStatus === 'on-site') return 3;
            if (incident.dispatchStatus === 'dispatched' || incident.dispatchStatus === 'resolving') return 2;
            return 1;
         };
         return score(b) - score(a);
      });

      const selectedId = activeIncidentIdRef.current;
      if (!selectedId && sorted.length > 0) {
         selectIncident(sorted.find((i: any) => i.status !== 'resolved') || sorted[0]);
      } else if (selectedId) {
         const refreshedActive = sorted.find((i: any) => i._id === selectedId);
         selectIncident(refreshedActive || (sorted[0] || null));
      } else {
         selectIncident(null);
      }
   };

  useEffect(() => {
    const fetchIncidents = async () => {
      try {
        await refreshAssignments();
      } catch (err) {
        console.error("DriverHUD fetch failed", err);
            toast.error("Unable to load your assignments. Please reload once.");
      } finally {
        setLoading(false);
      }
    };
    fetchIncidents();
         const interval = setInterval(fetchIncidents, 4000);
         const clock = setInterval(() => setClockTick((value) => value + 1), 1000);
         return () => {
            clearInterval(interval);
            clearInterval(clock);
         };
  }, []);

   const handleInitializeRoute = async () => {
      if (!activeIncident) return;
      setIsRouting(true);
      try {
         const { data } = await api.post('/dispatch/start-journey-simulation', {
            incidentId: activeIncident._id,
            intervalMinutes: 1,
            timeScale: 0.1,
            speedKmph: 32,
         });
         toast.success(data?.message || "Journey simulation started");
         await refreshAssignments();
      } catch (err) {
         toast.error("Failed to initialize route");
         console.error(err);
      } finally {
         setIsRouting(false);
      }
   };

   const handleMarkResolved = async () => {
      if (!activeIncident) return;
      setIsCompleting(true);
      try {
         await api.put(`/incidents/${activeIncident._id}/status`, { status: 'resolved' });
         toast.success("Incident marked resolved. Checking for next task...");
         await refreshAssignments();
      } catch (err) {
         toast.error("Failed to mark incident resolved");
         console.error(err);
      } finally {
         setIsCompleting(false);
      }
   };

   const handleRejectQueueTask = async (incidentId: string) => {
      try {
         await api.post('/dispatch/reject-task', { incidentId, reason: "Worker requested rejection" });
         toast.success("Task rejected and returned to pool");
         await refreshAssignments();
      } catch (err) {
         toast.error("Failed to reject task");
         console.error(err);
      }
   };

   const handleControlRoomCall = async () => {
      const phone = "+91-22-4000-0100";
      try {
         await navigator.clipboard.writeText(phone);
         toast.success(`Control room number copied: ${phone}`);
      } catch {
         toast.error("Unable to copy control room number");
      }
   };

   const filteredIncidents = incidents.filter((incident) => {
      const q = incidentFilter.trim().toLowerCase();
      if (!q) return true;
      return (
         String(incident._id || "").toLowerCase().includes(q) ||
         String(incident.title || "").toLowerCase().includes(q) ||
         String(incident.location?.address || "").toLowerCase().includes(q)
      );
   });

   const trackingEta = Number(activeIncident?.tracking?.currentLocation?.etaMinutes);
   const trackingEtaSeconds = Number(activeIncident?.tracking?.currentLocation?.etaSeconds);
   const trackingPhase = String(activeIncident?.tracking?.currentLocation?.phase || activeIncident?.dispatchStatus || '').toLowerCase();
   const hasTrackingEta = Number.isFinite(trackingEtaSeconds) || Number.isFinite(trackingEta);
   const incidentLat = Number(activeIncident?.location?.lat);
   const incidentLng = Number(activeIncident?.location?.lng);
   const unitLat = Number(activeIncident?.tracking?.currentLocation?.lat ?? activeIncident?.assignedPersonnel?.location?.lat);
   const unitLng = Number(activeIncident?.tracking?.currentLocation?.lng ?? activeIncident?.assignedPersonnel?.location?.lng);
   const liveDistanceKm = Number.isFinite(unitLat) && Number.isFinite(unitLng) && Number.isFinite(incidentLat) && Number.isFinite(incidentLng)
      ? haversineKm(unitLat, unitLng, incidentLat, incidentLng)
      : null;
   const fallbackEtaMinutes =
      Number.isFinite(unitLat) && Number.isFinite(unitLng) && Number.isFinite(incidentLat) && Number.isFinite(incidentLng)
         ? Math.max(1, Math.round((haversineKm(unitLat, unitLng, incidentLat, incidentLng) / 28) * 60))
         : null;
   const isResolved = Boolean(activeIncident && (activeIncident.status === 'resolved' || activeIncident.dispatchStatus === 'completed'));
   const isEngaged = Boolean(activeIncident && (activeIncident.status === 'investigating' || activeIncident.dispatchStatus === 'on-site' || activeIncident.dispatchStatus === 'resolving'));
   const canInitialize = Boolean(activeIncident) && !isResolved && !isEngaged;
   const canResolve = Boolean(activeIncident) && !isResolved && isEngaged;
   const etaBaseMinutes = Number.isFinite(trackingEta) ? trackingEta : fallbackEtaMinutes;
   const lastEtaSampleAt = activeIncident?.tracking?.currentLocation?.at ? new Date(activeIncident.tracking.currentLocation.at).getTime() : Date.now();
   const elapsedSinceSampleMinutes = Math.max(0, (Date.now() - lastEtaSampleAt) / 60000);
   const etaBaseSeconds = Number.isFinite(trackingEtaSeconds)
      ? trackingEtaSeconds
      : Number.isFinite(etaBaseMinutes)
         ? Number(etaBaseMinutes) * 60
         : Number.isFinite(fallbackEtaMinutes) && !canInitialize
            ? Number(fallbackEtaMinutes) * 60
            : Number.NaN;
   const elapsedSinceSampleSeconds = Math.max(0, (Date.now() - lastEtaSampleAt) / 1000);
   const liveEtaSeconds = Number.isFinite(etaBaseSeconds)
      ? Math.max(0, Math.round(Number(etaBaseSeconds) - elapsedSinceSampleSeconds))
      : Number.NaN;
   const etaText = canInitialize && !hasTrackingEta
      ? 'Init Route'
      : Number.isFinite(liveEtaSeconds)
         ? formatCountdown(liveEtaSeconds)
         : 'Estimating';
   const googleMapsHref = Number.isFinite(incidentLat) && Number.isFinite(incidentLng)
      ? Number.isFinite(unitLat) && Number.isFinite(unitLng)
         ? `https://www.google.com/maps/dir/?api=1&origin=${unitLat},${unitLng}&destination=${incidentLat},${incidentLng}&travelmode=driving`
         : `https://www.google.com/maps/search/?api=1&query=${incidentLat},${incidentLng}`
      : null;

  if (loading) return (
    <div className="h-full flex items-center justify-center bg-white">
      <Activity className="w-10 h-10 text-primary animate-spin" />
    </div>
  );

  return (
    <div className="flex flex-col lg:flex-row h-full bg-slate-50/30 overflow-hidden font-inter">
      {/* ── LEFT: Operational Dispatch HUD ───────────────────────────────────── */}
      <div className="flex-1 flex flex-col p-8 gap-8 overflow-y-auto no-scrollbar">
        <header className="flex items-center justify-between">
           <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-[1.2rem] bg-slate-900 border-2 border-white shadow-2xl flex items-center justify-center">
                 <Truck className="w-6 h-6 text-white" />
              </div>
              <div>
                 <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 leading-none">
                    {assignedResource ? assignedResource.name : 'Operational HUD'}
                 </h1>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-1">
                    {assignedResource ? `${assignedResource.type} • RELAY V4.0` : 'Field Resource Relay v4.0'}
                 </p>
              </div>
           </div>
           <div className="flex items-center gap-3 px-5 py-2.5 rounded-full bg-white border border-border/60 shadow-inner">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">GPS_LOCK: 0.2ms</span>
           </div>
        </header>

        {activeIncident ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            <div className="plinth-card bg-slate-900 text-white min-h-[500px] flex flex-col group overflow-hidden">
               <div className="absolute top-0 right-0 p-10 opacity-10 group-hover:scale-150 transition-transform duration-[2s]">
                  <Shield className="w-64 h-64" />
               </div>
               
               <div className="flex-1 space-y-10 relative z-10">
                  <div className="flex items-center gap-4">
                     <div className="px-4 py-1.5 rounded-lg bg-primary text-[10px] font-black uppercase tracking-widest shadow-xl shadow-primary/20">Protocol Critical</div>
                     <span className="text-[10px] font-black opacity-40 uppercase tracking-[0.2em]">#{activeIncident._id.slice(-6)}</span>
                  </div>
                  
                  <h2 className="text-5xl font-black uppercase tracking-tighter leading-none">{activeIncident.title}</h2>
                  
                  <div className="space-y-6">
                     <div className="flex items-start gap-4 p-6 rounded-3xl bg-white/5 border border-white/5 backdrop-blur-md">
                        <MapPin className="w-6 h-6 text-primary mt-1 shrink-0" />
                        <div>
                           <p className="text-[9px] font-black uppercase tracking-[0.4em] opacity-40 mb-1">Inducted Coordinate</p>
                           <p className="text-lg font-black tracking-tight">{activeIncident.location?.address}</p>
                        </div>
                     </div>
                     <div className="flex items-start gap-4 p-6 rounded-3xl bg-white/5 border border-white/5 backdrop-blur-md">
                        <Info className="w-6 h-6 text-secondary mt-1 shrink-0" />
                        <div>
                           <p className="text-[9px] font-black uppercase tracking-[0.4em] opacity-40 mb-1">Signal Parameters</p>
                           <p className="text-[11px] font-bold opacity-80 uppercase leading-relaxed tracking-wider">{activeIncident.details || 'No additional field notes provided.'}</p>
                        </div>
                     </div>
                  </div>
               </div>

               <div className="mt-auto flex gap-4 relative z-10 pt-12">
                  <button
                    onClick={handleInitializeRoute}
                              disabled={isRouting || !canInitialize}
                              className="flex-1 py-6 rounded-2xl bg-white text-slate-900 text-[10px] font-black uppercase tracking-[0.3em] shadow-2xl transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                               <Navigation className="w-4 h-4" /> {isRouting ? 'Routing...' : 'Initialize Route'}
                  </button>
                  <button
                    onClick={handleControlRoomCall}
                    className="p-6 rounded-2xl bg-white/10 border border-white/10 text-white hover:bg-white/20 transition-all"
                  >
                     <Phone className="w-5 h-5" />
                  </button>
               </div>
            </div>

            <div className="flex flex-col gap-8">
               <div className="tactile-slab bg-white flex-1 relative overflow-hidden group p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Strategic Map</span>
                      <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight mt-1">Live Tactical View</h4>
                    </div>
                    <div className="inline-flex items-center gap-2 text-[9px] font-black uppercase tracking-wider text-amber-600 bg-amber-50 px-3 py-2 rounded-full border border-amber-200">
                      <AlertTriangle className="w-3.5 h-3.5" /> Nearby Risks
                    </div>
                  </div>
                  <TacticalWorkerMap activeIncident={activeIncident} incidents={incidents} />
                  <p className="mt-4 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Coordinates, route path, and nearby risk markers update per selected incident.</p>
                  {googleMapsHref && (
                     <a
                        href={googleMapsHref}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-primary/30 bg-primary/5 text-[9px] font-black uppercase tracking-widest text-primary hover:bg-primary hover:text-white transition-all"
                     >
                        Open Google Maps Route <ArrowRight className="w-3.5 h-3.5" />
                     </a>
                  )}
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="plinth-card bg-white p-8 flex flex-col justify-center border-none">
                     <div className="flex items-center gap-3 mb-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-secondary shadow-lg shadow-secondary" />
                        <span className="text-[10px] font-black text-secondary uppercase tracking-[0.3em]">Estimated Arrivals</span>
                     </div>
                     <div className="text-4xl font-black tracking-tighter text-slate-900">{etaText}</div>
                     <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Live from route telemetry</span>
                     {Number.isFinite(liveDistanceKm) && (
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">{liveDistanceKm.toFixed(2)} km away</span>
                     )}
                  </div>
                  <div className="plinth-card bg-white p-8 flex flex-col justify-center border-none">
                     <div className="flex items-center gap-3 mb-3 text-emerald-500">
                        <Signal className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em]">Link Status</span>
                     </div>
                     <div className="text-4xl font-black tracking-tighter text-slate-900 uppercase tracking-tight">{activeIncident.status === 'investigating' ? 'ENGAGED' : 'OPTIMAL'}</div>
                     <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Network Reliability 99.8%</span>
                  </div>
               </div>

               <div className="mt-8">
                 {isResolved ? (
                    <div className="w-full py-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-black uppercase tracking-[0.3em] text-center">
                      Incident Closed
                    </div>
                 ) : (
                    <button
                       onClick={handleMarkResolved}
                       disabled={isCompleting || !canResolve}
                       className="w-full py-4 rounded-2xl bg-emerald-600 text-white text-[10px] font-black uppercase tracking-[0.3em] shadow-xl hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                       {isCompleting ? 'Completing...' : 'Mark Incident Resolved'}
                    </button>
                 )}
               </div>
            </div>
          </div>
        ) : (
          <div className="h-[500px] flex flex-col items-center justify-center bg-white rounded-[2.5rem] p-24 text-center border-2 border-dashed border-slate-100">
             <div className="w-20 h-20 rounded-3xl bg-slate-50 flex items-center justify-center mb-8">
                <Radio className="w-10 h-10 text-slate-200" />
             </div>
             <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Listening for Signal</h3>
             <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-4">Operational status idle. District 7 relay pending induction.</p>
          </div>
        )}
      </div>

      {/* ── RIGHT: Protocol Registry ────────────────────────────────────────── */}
      <div className="w-full lg:w-[480px] bg-white border-l border-border/40 flex flex-col shadow-[-40px_0_80px_-20px_rgba(0,0,0,0.02)] z-10 transition-all duration-500">
         <div className="p-8 border-b border-border/40 bg-slate-50/50">
            <h3 className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-900 mb-6 flex items-center gap-3">
               <Activity className="w-4 h-4 text-primary" /> Active Signal Registry
            </h3>

            {taskQueue.length > 0 && (
               <div className="mb-8 space-y-4">
                  <h4 className="text-[9px] font-black uppercase tracking-[0.3em] text-amber-600 flex items-center gap-2">
                     <Clock className="w-3.5 h-3.5" /> Up Next (Queue)
                  </h4>
                  {taskQueue.map((task: any) => (
                     <div key={task._id} className="p-5 rounded-2xl bg-amber-50 border border-amber-100 relative group overflow-hidden">
                        <div className="flex items-center justify-between mb-2">
                           <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest">#{task._id.slice(-6)}</span>
                           <button 
                              onClick={() => handleRejectQueueTask(task._id)}
                              className="text-[8px] font-black text-red-500 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity hover:underline"
                           >
                              Reject Task
                           </button>
                        </div>
                        <h5 className="text-sm font-black text-slate-900 uppercase tracking-tight">{task.title}</h5>
                        <p className="text-[9px] font-bold text-slate-500 uppercase mt-1">{task.location?.address}</p>
                     </div>
                  ))}
               </div>
            )}

            <div className="relative">
               <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
               <input 
                  placeholder="Filter by Protocol ID..."
                  value={incidentFilter}
                  onChange={(e) => setIncidentFilter(e.target.value)}
                  className="w-full bg-white border-none rounded-2xl pl-16 pr-6 py-5 text-[10px] font-black uppercase tracking-widest shadow-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all"
               />
            </div>
         </div>

         <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
            {filteredIncidents.map((incident) => (
              <motion.button
                key={incident._id}
                whileHover={{ scale: 1.02, x: 5 }}
                onClick={() => selectIncident(incident)}
                className={cn(
                  "w-full p-8 rounded-3xl text-left transition-all border-2",
                  activeIncident?._id === incident._id 
                    ? "bg-white border-primary shadow-plinth" 
                    : "bg-slate-50/50 border-transparent hover:border-slate-200"
                )}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                     <div className={cn(
                        "w-2.5 h-2.5 rounded-full",
                        incident.severity === 'critical' ? 'bg-primary shadow-[0_0_10px_rgba(255,79,0,0.5)]' : 'bg-secondary'
                     )} />
                     <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">{incident._id.slice(-6)}</span>
                  </div>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{incident.status}</span>
                </div>
                <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight leading-tight mb-2">{incident.title}</h4>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{incident.location?.address}</p>
                <div className="mt-8 flex items-center gap-4 text-[9px] font-black text-slate-400 uppercase tracking-widest group">
                            Load Incident <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </motion.button>
            ))}
                  {filteredIncidents.length === 0 && (
                     <div className="rounded-2xl border border-border/40 p-8 text-center">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">No incidents match your filter.</p>
                     </div>
                  )}
         </div>

         <div className="p-8 border-t border-border/40 bg-slate-50/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
               <div className="w-4 h-4 rounded-full bg-success animate-pulse" />
               <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">All Systems Nominal</span>
            </div>
            <Shield className="w-5 h-5 text-slate-200" />
         </div>
      </div>
    </div>
  );
}
