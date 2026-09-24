import { useEffect, useMemo, useState } from "react";
import { Activity, Flame, MapPin, Truck, ZoomIn, ZoomOut } from "lucide-react";
import { Circle, MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import { divIcon } from "leaflet";
import type { DivIcon, LatLngBoundsExpression, LatLngExpression } from "leaflet";
import { cn } from "@/lib/utils";

const MUMBAI_CENTER: LatLngExpression = [19.076, 72.8777];
const MUMBAI_BOUNDS: LatLngBoundsExpression = [
  [18.79, 72.72],
  [19.34, 73.09],
];

const heatColor: Record<string, string> = {
  critical: "#ff4f00",
  high: "#f59e0b",
  medium: "#4f46e5",
  low: "#10b981",
};

const resourceColor: Record<string, string> = {
  police: "#1d4ed8",
  fire: "#dc2626",
  medical: "#059669",
  public_works: "#ea580c",
  drone: "#7c3aed",
  utility: "#0ea5e9",
  sanitation: "#10b981",
};

const vehicleEmojiByType: Record<string, string> = {
  police: "🚓",
  fire: "🚒",
  medical: "🚑",
  utility: "🚐",
  sanitation: "🚛",
  public_works: "🚚",
  drone: "🚁",
  pending: "⏳",
};

const makeBadgeIcon = (symbol: string, bg: string, fg = "#ffffff"): DivIcon =>
  divIcon({
    className: "",
    html: `<div style="width:30px;height:30px;border-radius:9999px;background:${bg};color:${fg};display:flex;align-items:center;justify-content:center;border:2px solid #ffffff;box-shadow:0 6px 16px rgba(0,0,0,0.25);font-weight:900;font-size:14px;line-height:1;">${symbol}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -16],
  });

const incidentIcon = (severity: string, selected: boolean) =>
  makeBadgeIcon("C", selected ? "#111827" : heatColor[severity] || "#4f46e5");

const unitIcon = (type: string) =>
  makeBadgeIcon(vehicleEmojiByType[String(type || "").toLowerCase()] || "🚚", resourceColor[type] || "#0f172a", "#ffffff");

const formatCountdown = (seconds: number) => {
  if (!Number.isFinite(seconds)) return "--:--";
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const remaining = (total % 60).toString().padStart(2, "0");
  return `${minutes}:${remaining}`;
};

type AnimatedUnit = {
  _id: string;
  label: string;
  type: string;
  status: string;
  lat: number;
  lng: number;
  targetLat: number;
  targetLng: number;
};

function MapZoomController({ zoom }: { zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setZoom(zoom, { animate: true });
  }, [map, zoom]);
  return null;
}

function FocusIncidentController({
  incidents,
  focusIncidentId,
}: {
  incidents: any[];
  focusIncidentId?: string | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (!focusIncidentId) return;
    const incident = incidents.find((i: any) => i._id === focusIncidentId);
    if (!incident?.location?.lat || !incident?.location?.lng) return;

    map.flyTo([Number(incident.location.lat), Number(incident.location.lng)], Math.max(map.getZoom(), 13), {
      animate: true,
      duration: 0.9,
    });
  }, [focusIncidentId, incidents, map]);

  return null;
}

export default function CityMap({
  incidents,
  resources = [],
  personnel = [],
  selectedIncidentId,
  onIncidentSelect,
}: {
  incidents: any[];
  resources?: any[];
  personnel?: any[];
  selectedIncidentId?: string | null;
  onIncidentSelect?: (id: string) => void;
}) {
  const [zoom, setZoom] = useState(11);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showPins, setShowPins] = useState(true);
  const [showResources, setShowResources] = useState(true);
  const [heatGain, setHeatGain] = useState(1.15);
  const [animatedUnits, setAnimatedUnits] = useState<AnimatedUnit[]>([]);

  const validIncidents = useMemo(
    () => incidents.filter((inc: any) => inc?.location?.lat != null && inc?.location?.lng != null),
    [incidents]
  );
  const activePersonnel = useMemo(
    () =>
      personnel.filter(
        (person: any) =>
          (person?.status === "busy" || Boolean(person?.currentIncident)) &&
          person?.location?.lat != null &&
          person?.location?.lng != null
      ),
    [personnel]
  );

  useEffect(() => {
    const units = resources
      .filter((r: any) => r?.location?.lat != null && r?.location?.lng != null)
      .map((r: any) => {
        const target = r.currentIncident?.location || r.location;
        return {
          _id: String(r._id),
          label: r.name,
          type: r.type,
          status: r.status,
          lat: Number(r.location.lat),
          lng: Number(r.location.lng),
          targetLat: Number(target.lat),
          targetLng: Number(target.lng),
        };
      });

    setAnimatedUnits((prev) => {
      if (!prev.length) return units;
      const prevMap = new Map(prev.map((u) => [u._id, u]));
      return units.map((u) => {
        const old = prevMap.get(u._id);
        return old ? { ...u, lat: old.lat, lng: old.lng } : u;
      });
    });
  }, [resources]);

  useEffect(() => {
    const timer = setInterval(() => {
      setAnimatedUnits((prev) =>
        prev.map((u, idx) => {
          const patrolLat = u.status === "patrol" ? Math.sin(Date.now() / 1000 + idx) * 0.00012 : 0;
          const patrolLng = u.status === "patrol" ? Math.cos(Date.now() / 1000 + idx) * 0.00012 : 0;
          return {
            ...u,
            lat: u.lat + (u.targetLat - u.lat) * 0.08 + patrolLat,
            lng: u.lng + (u.targetLng - u.lng) * 0.08 + patrolLng,
          };
        })
      );
    }, 160);

    return () => clearInterval(timer);
  }, []);

  const livePersonnel = activePersonnel.map((person: any, idx: number) => {
    const liveLocation = person?.currentIncident?.tracking?.currentLocation;
    const currentLat = Number.isFinite(Number(liveLocation?.lat)) ? Number(liveLocation.lat) : Number(person.location.lat);
    const currentLng = Number.isFinite(Number(liveLocation?.lng)) ? Number(liveLocation.lng) : Number(person.location.lng);
    const targetLocation = person?.currentIncident?.location || person.location;
    const path = Array.isArray(person?.currentIncident?.tracking?.path) ? person.currentIncident.tracking.path : [];
    const etaSeconds = Number.isFinite(Number(liveLocation?.etaSeconds))
      ? Number(liveLocation.etaSeconds)
      : Number.isFinite(Number(liveLocation?.etaMinutes))
        ? Number(liveLocation.etaMinutes) * 60
        : Number.NaN;

    return {
      _id: String(person._id),
      label: person.contact?.unitId || person.name || `Responder ${idx + 1}`,
      type: person.type,
      status: person.status,
      lat: currentLat,
      lng: currentLng,
      targetLat: Number(targetLocation?.lat ?? currentLat),
      targetLng: Number(targetLocation?.lng ?? currentLng),
      trackingPath: path,
      trackingPhase: String(liveLocation?.phase || person?.currentIncident?.dispatchStatus || person.status || "").toLowerCase(),
      trackingEta: Number(liveLocation?.etaMinutes),
      trackingEtaSeconds: etaSeconds,
    };
  });

  return (
    <div className="w-full h-full relative overflow-hidden">
      <MapContainer
        center={MUMBAI_CENTER}
        zoom={zoom}
        minZoom={10}
        maxZoom={16}
        maxBounds={MUMBAI_BOUNDS}
        className="h-full w-full"
        zoomControl={false}
        scrollWheelZoom
      >
        <MapZoomController zoom={zoom} />
        <FocusIncidentController incidents={validIncidents} focusIncidentId={selectedIncidentId} />
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {showHeatmap &&
          validIncidents.map((inc: any) => {
            const radius = (inc.severity === "critical" ? 1700 : inc.severity === "high" ? 1200 : inc.severity === "medium" ? 850 : 600) * heatGain;
            return (
              <Circle
                key={`heat-${inc._id}`}
                center={[Number(inc.location.lat), Number(inc.location.lng)]}
                radius={radius}
                pathOptions={{
                  color: heatColor[inc.severity] || "#4f46e5",
                  fillColor: heatColor[inc.severity] || "#4f46e5",
                  fillOpacity: 0.22,
                  weight: 1,
                }}
              />
            );
          })}

        {showPins &&
          validIncidents.map((inc: any) => (
            <Marker
              key={`pin-${inc._id}`}
              position={[Number(inc.location.lat), Number(inc.location.lng)]}
              icon={incidentIcon(inc.severity, selectedIncidentId === inc._id)}
              eventHandlers={{
                click: () => onIncidentSelect?.(inc._id),
              }}
            >
              <Tooltip direction="top" offset={[0, -8]}>
                <div className="text-[11px] font-bold">{inc.title}</div>
                <div className="text-[10px] uppercase">{inc.severity} • {inc.type}</div>
              </Tooltip>
              <Popup>
                <div className="min-w-[220px]">
                  <div className="text-[12px] font-bold mb-1">{inc.title}</div>
                  <div className="text-[11px] uppercase text-slate-600 mb-1">{inc.type} • {inc.severity}</div>
                  <div className="text-[11px] text-slate-500">{inc.location?.address || "No address"}</div>
                </div>
              </Popup>
            </Marker>
          ))}

        {showResources &&
          animatedUnits.map((u) => (
            <div key={`res-wrap-${u._id}`}>
              <Polyline
                key={`route-${u._id}`}
                positions={[
                  [u.lat, u.lng],
                  [u.targetLat, u.targetLng],
                ]}
                pathOptions={{
                  color: resourceColor[u.type] || "#0f172a",
                  weight: 2,
                  opacity: 0.45,
                  dashArray: "6 6",
                }}
              />
              <Marker
                key={`res-${u._id}`}
                position={[u.lat, u.lng]}
                icon={unitIcon(u.type)}
              >
                <Tooltip direction="top" offset={[0, -8]}>
                  <div className="text-[11px] font-bold">{u.label}</div>
                  <div className="text-[10px] uppercase">{u.type.replace("_", " ")} • {u.status}</div>
                </Tooltip>
                <Popup>
                  <div className="min-w-[200px]">
                    <div className="text-[12px] font-bold mb-1">{u.label}</div>
                    <div className="text-[11px] uppercase text-slate-600 mb-1">{u.type.replace("_", " ")} • {u.status}</div>
                    <div className="text-[11px] text-slate-500">Current: {u.lat.toFixed(4)}, {u.lng.toFixed(4)}</div>
                    <div className="text-[11px] text-slate-500">Target: {u.targetLat.toFixed(4)}, {u.targetLng.toFixed(4)}</div>
                  </div>
                </Popup>
              </Marker>
            </div>
          ))}

        {livePersonnel.map((person) => {
          const path = Array.isArray(person.trackingPath) && person.trackingPath.length >= 2
            ? person.trackingPath
                .filter((p: any) => Number.isFinite(Number(p?.lat)) && Number.isFinite(Number(p?.lng)))
                .map((p: any) => [Number(p.lat), Number(p.lng)] as LatLngExpression)
            : [
                [person.lat, person.lng] as LatLngExpression,
                [person.targetLat, person.targetLng] as LatLngExpression,
              ];

          return (
            <div key={`person-wrap-${person._id}`}>
              <Polyline
                key={`person-route-${person._id}`}
                positions={path}
                pathOptions={{
                  color: resourceColor[person.type] || "#0f172a",
                  weight: 3,
                  opacity: 0.8,
                  dashArray: "8 8",
                }}
              />
              <Marker
                key={`person-${person._id}`}
                position={[person.lat, person.lng]}
                icon={unitIcon(person.type)}
              >
                <Tooltip direction="top" offset={[0, -8]}>
                  <div className="text-[11px] font-bold">{person.label}</div>
                  <div className="text-[10px] uppercase">{person.type.replace("_", " ")} • {person.status}</div>
                </Tooltip>
                <Popup>
                  <div className="min-w-[220px]">
                    <div className="text-[12px] font-bold mb-1">{person.label}</div>
                    <div className="text-[11px] uppercase text-slate-600 mb-1">{person.type.replace("_", " ")} • {person.status}</div>
                    <div className="text-[11px] text-slate-500">Current: {person.lat.toFixed(5)}, {person.lng.toFixed(5)}</div>
                    <div className="text-[11px] text-slate-500">Target: {person.targetLat.toFixed(5)}, {person.targetLng.toFixed(5)}</div>
                    <div className="text-[11px] text-slate-500">Phase: {person.trackingPhase || "en-route"}</div>
                    {Number.isFinite(person.trackingEtaSeconds) && <div className="text-[11px] text-slate-500">ETA: {formatCountdown(person.trackingEtaSeconds)}</div>}
                  </div>
                </Popup>
              </Marker>
            </div>
          );
        })}
      </MapContainer>

      <div className="absolute top-4 left-4 z-[1000] bg-white/95 backdrop-blur-md p-3 rounded-xl border border-border/40 shadow-plinth space-y-2 w-[300px]">
        <div className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-900">Mumbai Map Controls</div>

        <div className="flex items-center gap-2">
          <button onClick={() => setShowHeatmap((v) => !v)} className={cn("px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest", showHeatmap ? "bg-primary text-white" : "bg-slate-100 text-slate-500")}>
            <Flame className="w-3.5 h-3.5 inline mr-1" /> Heat
          </button>
          <button onClick={() => setShowPins((v) => !v)} className={cn("px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest", showPins ? "bg-primary text-white" : "bg-slate-100 text-slate-500")}>
            <MapPin className="w-3.5 h-3.5 inline mr-1" /> Pins
          </button>
          <button onClick={() => setShowResources((v) => !v)} className={cn("px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest", showResources ? "bg-primary text-white" : "bg-slate-100 text-slate-500")}>
            <Truck className="w-3.5 h-3.5 inline mr-1" /> Units
          </button>
        </div>

        <div>
          <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Heat Intensity</label>
          <input
            type="range"
            min={0.7}
            max={2}
            step={0.1}
            value={heatGain}
            onChange={(e) => setHeatGain(Number(e.target.value))}
            className="w-full mt-2"
          />
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={() => setZoom((z) => Math.max(10, z - 1))}
            className="w-10 h-10 rounded-lg border border-border/40 bg-white text-slate-600 hover:text-slate-900"
          >
            <ZoomOut className="w-4 h-4 mx-auto" />
          </button>
          <button
            onClick={() => setZoom((z) => Math.min(16, z + 1))}
            className="w-10 h-10 rounded-lg border border-border/40 bg-white text-slate-600 hover:text-slate-900"
          >
            <ZoomIn className="w-4 h-4 mx-auto" />
          </button>
          <button
            onClick={() => setZoom(11)}
            className="px-3 py-2 rounded-lg border border-border/40 bg-white text-[9px] font-black uppercase tracking-widest text-slate-600 hover:text-slate-900"
          >
            Reset Zoom
          </button>
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-auto">z{zoom}</span>
        </div>
      </div>

      <div className="absolute bottom-5 right-5 z-[1000] bg-slate-900 px-5 py-4 rounded-2xl text-white shadow-plinth">
        <div className="flex items-center gap-3">
          <Activity className="w-4 h-4 text-primary" />
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/60">Live Units</p>
            <p className="text-xl font-black tracking-tight">{animatedUnits.length}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
