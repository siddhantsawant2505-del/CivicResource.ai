import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  ChevronRight,
  Clock,
  MapPin,
  MessageSquare,
  Radio,
  Share2,
  Shield,
  Sparkles,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import CityMap from "@/components/CityMap";
import LiveFeed from "@/components/LiveFeed";
import api from "@/lib/api";
import { toast } from "sonner";

export default function CommandCenter() {
  const scenarioPresets: Record<string, { label: string; weather_rain_mm: number; event_factor: number; population_density_boost: number }> = {
    normal: { label: "Normal", weather_rain_mm: 6, event_factor: 1.15, population_density_boost: 1.05 },
    flood: { label: "Flood Mode", weather_rain_mm: 28, event_factor: 1.45, population_density_boost: 1.2 },
    festival: { label: "Festival Mode", weather_rain_mm: 4, event_factor: 1.7, population_density_boost: 1.35 },
    strike: { label: "Strike Mode", weather_rain_mm: 5, event_factor: 1.35, population_density_boost: 1.1 },
    heatwave: { label: "Heatwave", weather_rain_mm: 1, event_factor: 1.25, population_density_boost: 1.05 },
  };

  const [activeTab, setActiveTab] = useState<"map" | "analysis">("map");
  const [incidents, setIncidents] = useState<any[]>([]);
  const [resources, setResources] = useState<any[]>([]);
  const [personnel, setPersonnel] = useState<any[]>([]);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisData, setAnalysisData] = useState<any | null>(null);
  const [liveInputs, setLiveInputs] = useState({
    scenario_mode: "normal",
    weather_rain_mm: 6,
    event_factor: 1.15,
    population_density_boost: 1.05,
    traffic_index: 1,
    road_condition_index: 1,
  });
  const [isSavingMode, setIsSavingMode] = useState(false);
  const [copilotQuery, setCopilotQuery] = useState("");
  const [copilotResponse, setCopilotResponse] = useState<any | null>(null);
  const [isCopilotRunning, setIsCopilotRunning] = useState(false);
  const [lastAiSyncAt, setLastAiSyncAt] = useState<string>("--:--");
  const [feedFilter, setFeedFilter] = useState<"Critical" | "High" | "Resolved" | "Recent">("Recent");
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const operationalResources = resources.filter((resource: any) => {
    const name = String(resource.name || "").toLowerCase();
    const type = String(resource.type || "").toLowerCase();
    return type === "public_works" || name.includes("garbage") || name.includes("water") || name.includes("maintenance") || name.includes("repair");
  });

  const runGlobalAnalysis = async (silent = false) => {
    if (!silent) setIsAnalyzing(true);
    try {
      const { data } = await api.post("/dispatch/ai-analyze", { liveInputs });
      setAnalysisData(data);
      setLastAiSyncAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      if (!silent) {
        setActiveTab("analysis");
        toast.success("Global analysis initialized");
      }
    } catch (err) {
      console.error("Global analysis failed", err);
      if (!silent) {
        toast.error("Failed to initialize global analysis");
      }
    } finally {
      if (!silent) setIsAnalyzing(false);
    }
  };

  const activateCrisisMode = async (mode: string) => {
    setIsSavingMode(true);
    try {
      await api.post("/dispatch/crisis-mode", { mode });
      const preset = scenarioPresets[mode] || scenarioPresets.normal;
      setLiveInputs((prev) => ({
        ...prev,
        scenario_mode: mode,
        weather_rain_mm: preset.weather_rain_mm,
        event_factor: preset.event_factor,
        population_density_boost: preset.population_density_boost,
      }));
      toast.success(`${preset.label} activated`);
    } catch (err) {
      console.error("Crisis mode update failed", err);
      toast.error("Failed to activate crisis mode");
    } finally {
      setIsSavingMode(false);
    }
  };

  const runCopilotQuery = async () => {
    const query = copilotQuery.trim();
    if (!query) {
      toast.error("Type a copilot command first");
      return;
    }
    setIsCopilotRunning(true);
    try {
      const { data } = await api.post("/dispatch/copilot", { query, liveInputs });
      setCopilotResponse(data);
      toast.success("Copilot response ready");
    } catch (err) {
      console.error("Copilot query failed", err);
      toast.error("Copilot could not process this command");
    } finally {
      setIsCopilotRunning(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [incidentsRes, resourcesRes, personnelRes] = await Promise.all([
          api.get("/incidents"),
          api.get("/resources"),
          api.get("/dispatch/personnel?all=true"),
        ]);
        setIncidents(incidentsRes.data);
        setResources(resourcesRes.data);
        setPersonnel(personnelRes.data);
      } catch (err) {
        console.error("CommandCenter fetch failed", err);
      }
    };

    const syncCrisisMode = async () => {
      try {
        const { data } = await api.get("/dispatch/crisis-mode");
        if (data?.mode && scenarioPresets[data.mode]) {
          const preset = scenarioPresets[data.mode];
          setLiveInputs((prev) => ({
            ...prev,
            scenario_mode: data.mode,
            weather_rain_mm: preset.weather_rain_mm,
            event_factor: preset.event_factor,
            population_density_boost: preset.population_density_boost,
            traffic_index: Number(data.trafficIndex || prev.traffic_index || 1),
            road_condition_index: Number(data.roadConditionIndex || prev.road_condition_index || 1),
          }));
        }
      } catch (err) {
        console.error("Crisis mode sync failed", err);
      }
    };

    fetchData();
    syncCrisisMode();
    runGlobalAnalysis(true);
    const interval = setInterval(fetchData, 4000);
    const pulseInterval = setInterval(() => runGlobalAnalysis(true), 15000);
    return () => {
      clearInterval(interval);
      clearInterval(pulseInterval);
    };
  }, [liveInputs.weather_rain_mm, liveInputs.event_factor, liveInputs.population_density_boost, liveInputs.scenario_mode]);

  const runOptimization = async () => {
    setIsOptimizing(true);
    try {
      const [{ data: latestIncidents }, { data: latestResources }, { data: latestPersonnel }] = await Promise.all([
        api.get("/incidents"),
        api.get("/resources"),
        api.get("/dispatch/personnel?all=true"),
      ]);
      setIncidents(latestIncidents);
      setResources(latestResources);
      setPersonnel(latestPersonnel);
      await runGlobalAnalysis(true);
      toast.success("Optimization cycle completed");
    } catch (err) {
      console.error("Optimization cycle failed", err);
      toast.error("Unable to execute optimization");
    } finally {
      setIsOptimizing(false);
    }
  };

  const filteredFeedIncidents = incidents.filter((incident: any) => {
    if (feedFilter === "Critical") return incident.severity === "critical";
    if (feedFilter === "High") return incident.severity === "high";
    if (feedFilter === "Resolved") return incident.status === "resolved";
    return true;
  });

  const sortedFeedIncidents = [...filteredFeedIncidents].sort((a: any, b: any) => {
    if (feedFilter !== "Recent") return 0;
    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
  });

  const activeIncidents = incidents.filter((incident: any) => incident.status !== "resolved").length;
  const avgEta = analysisData?.allocationPlan?.length
    ? `${Math.round(analysisData.allocationPlan.reduce((sum: number, row: any) => sum + Number(row.eta_minutes || 0), 0) / analysisData.allocationPlan.length)}m`
    : "--";
  const compliance = analysisData?.mitigationEfficiency || "--";
  const highRiskZones = analysisData?.demandForecast?.filter((z: any) => Number(z.urgency_score || 0) >= 18).length || 0;
  const threatIndex = highRiskZones >= 4 ? "HIGH" : highRiskZones >= 2 ? "MED" : "LOW";
  const baseline = scenarioPresets.normal;
  const loadMultiplier = (
    liveInputs.event_factor * 0.5 +
    (liveInputs.population_density_boost || 1) * 0.35 +
    (liveInputs.weather_rain_mm / Math.max(1, baseline.weather_rain_mm)) * 0.15 +
    (liveInputs.traffic_index || 1) * 0.1 +
    (liveInputs.road_condition_index || 1) * 0.1
  );
  const projectedLoad = Math.max(0.7, Number(loadMultiplier.toFixed(2)));
  const projectedExtraUnits = Math.max(0, Math.round(((analysisData?.allocationSummary?.unallocated_demand || 0) + highRiskZones) * projectedLoad));

  const stats = [
    { label: "Active Nodes", value: String(activeIncidents), icon: MapPin, color: "text-primary" },
    { label: "Avg Dispatch ETA", value: avgEta, icon: Zap, color: "text-secondary" },
    { label: "Mitigation Efficiency", value: compliance, icon: Shield, color: "text-emerald-500" },
    { label: "Threat Index", value: threatIndex, icon: AlertTriangle, color: "text-slate-400" },
  ];

  return (
    <div className="flex flex-col min-h-full bg-slate-50/30 font-inter">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border-b border-border/40 bg-white">
        {stats.map((item, i) => (
          <div
            key={item.label}
            className={cn("p-8 transition-colors hover:bg-slate-50", i !== stats.length - 1 && "border-r border-border/40")}
          >
            <div className="flex items-center gap-3 mb-2 opacity-60">
              <item.icon className={cn("w-4 h-4", item.color)} />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">{item.label}</span>
            </div>
            <div className="text-3xl font-black tracking-tighter text-slate-900 tabular-nums">{item.value}</div>
          </div>
        ))}
      </div>

      <div className="flex-1 flex flex-col xl:flex-row overflow-visible">
        <div className="flex-1 flex flex-col p-8 gap-8 overflow-visible">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center shadow-2xl">
                  <Radio className="w-5 h-5 text-white animate-pulse" />
                </div>
                <h2 className="text-3xl font-black uppercase tracking-tight text-slate-900">Operation Pulse</h2>
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-[52px]">Real-time Resource Distribution Relay</p>
            </div>

            <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-border/40 shadow-sm">
              <button
                onClick={() => setActiveTab("map")}
                className={cn(
                  "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                  activeTab === "map" ? "bg-primary text-white shadow-lg shadow-primary/20" : "text-slate-400 hover:text-slate-600"
                )}
              >
                Visual Relay
              </button>
              <button
                onClick={() => setActiveTab("analysis")}
                className={cn(
                  "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                  activeTab === "analysis" ? "bg-primary text-white shadow-lg shadow-primary/20" : "text-slate-400 hover:text-slate-600"
                )}
              >
                Logic Flow
              </button>
            </div>
          </div>

          <div className="flex-1 relative tactile-slab border-none overflow-hidden">
            {activeTab === "map" ? (
              <div className="w-full h-full">
                <div className="h-[90vh] min-h-[860px] max-h-[1200px]">
                  <CityMap
                    incidents={incidents}
                    resources={operationalResources}
                    personnel={personnel}
                    selectedIncidentId={selectedIncidentId}
                    onIncidentSelect={setSelectedIncidentId}
                  />
                </div>

                <div className="bg-white border-t border-border/40 px-6 py-4 flex flex-wrap items-center gap-4">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Map Dot Legend</span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-700 flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-[#ea580c]" /> Garbage Trucks</span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-700 flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-[#0ea5e9]" /> Water Tankers</span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-700 flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" /> Maintenance Teams</span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-700 flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-[#ff4f00]" /> Critical Incident Pins</span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6 bg-white/70 border-t border-border/40">
                  <div className="bg-white p-5 rounded-2xl border border-border/40 shadow-sm">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-2 h-2 rounded-full bg-primary animate-ping" />
                      <span className="text-[10px] font-black tracking-widest uppercase text-slate-900">Optimization Protocol Active</span>
                    </div>
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide leading-relaxed mb-5">
                      AI intelligence is evaluating zone urgency in real time and recommending public-works allocation.
                    </p>
                    <button
                      onClick={runOptimization}
                      disabled={isOptimizing}
                      className="w-full flex items-center justify-center gap-3 bg-slate-900 text-white px-6 py-4 rounded-xl text-[10px] font-black uppercase tracking-[0.25em] transition-all hover:bg-black active:scale-[0.98] disabled:opacity-50"
                    >
                      {isOptimizing ? <Activity className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                      {isOptimizing ? "Calibrating..." : "Run Live Optimization"}
                    </button>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-4">
                      <input
                        type="number"
                        step="0.5"
                        value={liveInputs.weather_rain_mm}
                        onChange={(e) => setLiveInputs((prev) => ({ ...prev, weather_rain_mm: Number(e.target.value) || 0 }))}
                        className="px-2 py-2 rounded-lg border border-border/40 text-[10px] font-black uppercase tracking-widest"
                        title="Rainfall (mm)"
                      />
                      <input
                        type="number"
                        step="0.05"
                        value={liveInputs.event_factor}
                        onChange={(e) => setLiveInputs((prev) => ({ ...prev, event_factor: Number(e.target.value) || 0 }))}
                        className="px-2 py-2 rounded-lg border border-border/40 text-[10px] font-black uppercase tracking-widest"
                        title="Event Factor"
                      />
                      <input
                        type="number"
                        step="0.05"
                        value={liveInputs.population_density_boost}
                        onChange={(e) => setLiveInputs((prev) => ({ ...prev, population_density_boost: Number(e.target.value) || 1 }))}
                        className="px-2 py-2 rounded-lg border border-border/40 text-[10px] font-black uppercase tracking-widest"
                        title="Population Boost"
                      />
                      <input
                        type="number"
                        step="0.05"
                        value={liveInputs.traffic_index}
                        onChange={(e) => setLiveInputs((prev) => ({ ...prev, traffic_index: Number(e.target.value) || 1 }))}
                        className="px-2 py-2 rounded-lg border border-border/40 text-[10px] font-black uppercase tracking-widest"
                        title="Traffic Index"
                      />
                      <input
                        type="number"
                        step="0.05"
                        value={liveInputs.road_condition_index}
                        onChange={(e) => setLiveInputs((prev) => ({ ...prev, road_condition_index: Number(e.target.value) || 1 }))}
                        className="px-2 py-2 rounded-lg border border-border/40 text-[10px] font-black uppercase tracking-widest"
                        title="Road Condition Index"
                      />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {Object.entries(scenarioPresets).map(([key, preset]) => (
                        <button
                          key={key}
                          onClick={() => activateCrisisMode(key)}
                          disabled={isSavingMode}
                          className={cn(
                            "px-3 py-2 rounded-lg border text-[9px] font-black uppercase tracking-widest transition-all",
                            liveInputs.scenario_mode === key
                              ? "border-primary text-primary bg-primary/10"
                              : "border-border/40 text-slate-500 hover:border-primary/40"
                          )}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                    <p className="mt-2 text-[9px] font-black uppercase tracking-widest text-slate-400">Dynamic inputs: rain, event, population, traffic, road conditions</p>
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-border/40 shadow-sm flex items-center justify-between gap-4">
                    <div>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1 block">Total Signals</span>
                      <span className="text-3xl font-black text-slate-900 leading-none">{incidents.length}</span>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
                      <Activity className="w-5 h-5 text-primary" />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-10 flex flex-col items-center justify-center h-full text-center max-w-2xl mx-auto">
                <div className="w-24 h-24 rounded-3xl bg-primary/5 flex items-center justify-center mb-10 shadow-inner">
                  <BarChart3 className="w-10 h-10 text-primary" />
                </div>
                <h3 className="text-4xl font-black uppercase tracking-tighter text-slate-900 mb-6 leading-none">Strategic Logic Matrix</h3>
                <p className="text-xs font-black text-slate-400 uppercase tracking-[0.25em] leading-relaxed mb-12">
                  Analyze live public-works demand and dynamic allocation trends via the Intelligence Matrix protocol.
                </p>
                <button
                  className="btn-tactile"
                  onClick={() => runGlobalAnalysis(false)}
                  disabled={isAnalyzing}
                >
                  {isAnalyzing ? "Running Analysis..." : "Run Live Analysis"}
                </button>

                <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Auto AI sync every 15s • Last sync {lastAiSyncAt}</p>

                {analysisData && (
                  <div className="mt-10 w-full bg-white border border-border/40 rounded-2xl p-6 text-left shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 mb-4">Real-Time Optimization Output</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div className="rounded-xl border border-border/40 p-4 bg-slate-50/40">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Risk Clusters</p>
                        <p className="text-2xl font-black text-slate-900">{analysisData?.clusters?.length || 0}</p>
                      </div>
                      <div className="rounded-xl border border-border/40 p-4 bg-slate-50/40">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Prone Areas</p>
                        <p className="text-2xl font-black text-slate-900">{analysisData?.proneAreas?.length || 0}</p>
                      </div>
                      <div className="rounded-xl border border-border/40 p-4 bg-slate-50/40">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Forecast Zones</p>
                        <p className="text-2xl font-black text-slate-900">{analysisData?.demandForecast?.length || 0}</p>
                      </div>
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">AI Recommendation</p>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-600 leading-relaxed">
                      {analysisData?.strategicAdvice || "No strategic recommendation generated."}
                    </p>
                    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="rounded-xl border border-border/40 p-4 bg-slate-50/40">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">What-If Projection</p>
                        <p className="text-2xl font-black text-slate-900">x{projectedLoad.toFixed(2)}</p>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-2">
                          Scenario {String(liveInputs.scenario_mode || 'normal').toUpperCase()} • Extra units projected: {projectedExtraUnits}
                        </p>
                      </div>
                      <div className="rounded-xl border border-border/40 p-4 bg-slate-50/40">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Duplicate Fusion</p>
                        <p className="text-2xl font-black text-slate-900">{analysisData?.fusionOverview?.clusters || 0}</p>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-2">
                          Active clusters • Duplicate mentions {analysisData?.fusionOverview?.duplicateMentions || 0}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="rounded-xl border border-border/40 p-4 bg-slate-50/40">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3">Citizen Trust Matrix</p>
                        {Object.entries(analysisData?.trustOverview || {}).map(([mode, count]) => (
                          <div key={mode} className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-600 py-1">
                            <span>{mode.replace('-', ' ')}</span>
                            <span>{Number(count || 0)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="rounded-xl border border-border/40 p-4 bg-slate-50/40">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3">SLA Escalation Brain</p>
                        {(analysisData?.escalationPlan || []).length === 0 ? (
                          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">No breached incidents</p>
                        ) : (
                          <div className="space-y-2 max-h-40 overflow-auto">
                            {analysisData.escalationPlan.slice(0, 4).map((row: any) => (
                              <div key={row.incidentId} className="p-2 rounded-lg border border-border/40 bg-white">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-800">{row.title}</p>
                                <p className="text-[9px] font-black uppercase tracking-widest text-rose-600">Overdue {row.overdueMinutes}m • {row.reason}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="rounded-xl border border-border/40 p-4 bg-slate-50/40">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3">Outcome Learning Loop</p>
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-700 flex items-center justify-between py-1">
                          <span>Samples</span>
                          <span>{analysisData?.outcomeLearning?.weights?.samples || 0}</span>
                        </div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-700 flex items-center justify-between py-1">
                          <span>Model Confidence</span>
                          <span>{analysisData?.outcomeLearning?.weights?.confidence || 0}%</span>
                        </div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-700 flex items-center justify-between py-1">
                          <span>Avg Rating</span>
                          <span>{analysisData?.outcomeLearning?.weights?.avgRating || 0}</span>
                        </div>
                      </div>
                      <div className="rounded-xl border border-border/40 p-4 bg-slate-50/40">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Crisis Template</p>
                        <p className="text-lg font-black text-slate-900">{analysisData?.crisisMode?.label || "Normal Operations"}</p>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-2">
                          Priority {String((analysisData?.crisisMode?.resourcePriority || []).join(" > ") || "maintenance > water > garbage").toUpperCase()}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 rounded-xl border border-border/40 p-4 bg-slate-50/40">
                      <div className="flex items-center gap-2 mb-3">
                        <MessageSquare className="w-4 h-4 text-primary" />
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">AI Operator Co-Pilot</p>
                      </div>
                      <div className="flex flex-col md:flex-row gap-2">
                        <input
                          value={copilotQuery}
                          onChange={(e) => setCopilotQuery(e.target.value)}
                          placeholder='Try: Show highest-risk sanitation zones next 2 hours'
                          className="flex-1 rounded-lg border border-border/40 px-3 py-2 text-[11px] font-semibold"
                        />
                        <button
                          onClick={runCopilotQuery}
                          disabled={isCopilotRunning}
                          className="px-4 py-2 rounded-lg bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                        >
                          {isCopilotRunning ? "Thinking..." : "Ask"}
                        </button>
                      </div>
                      {copilotResponse && (
                        <div className="mt-3 rounded-lg border border-border/40 bg-white p-3">
                          <p className="text-[11px] font-bold text-slate-700 leading-relaxed">{copilotResponse.answer}</p>
                          <div className="mt-2 space-y-2">
                            {(copilotResponse.cards || []).slice(0, 3).map((card: any, idx: number) => (
                              <div key={idx} className="rounded-lg border border-border/40 p-2 bg-slate-50/50 text-[10px] font-black uppercase tracking-wider text-slate-600">
                                {Object.entries(card || {}).map(([k, v]) => `${k}: ${String(v)}`).join(" • ")}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <p className="mt-2 text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                        <Sparkles className="w-3 h-3" /> Ask why a unit was chosen or request high-risk zone forecasts.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="w-full xl:w-[420px] bg-white border-l border-border/40 flex flex-col shadow-[-40px_0_80px_-20px_rgba(0,0,0,0.02)] xl:sticky xl:top-4 xl:h-[calc(100vh-2rem)]">
          <div className="p-8 border-b border-border/40 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Radio className="w-4 h-4 text-primary" />
              <span className="text-[11px] font-black tracking-[0.3em] uppercase text-slate-900">Live Feedback</span>
            </div>
            <Share2 className="w-4 h-4 text-slate-400 hover:text-primary transition-colors cursor-pointer" />
          </div>

          <div className="p-6 bg-slate-50/50 flex gap-2 overflow-x-auto custom-scrollbar no-scrollbar">
            {["Critical", "High", "Resolved", "Recent"].map((stat) => (
              <button
                key={stat}
                onClick={() => setFeedFilter(stat as "Critical" | "High" | "Resolved" | "Recent")}
                className={cn(
                  "px-5 py-2.5 rounded-xl border text-[9px] font-black uppercase tracking-widest whitespace-nowrap shadow-sm transition-all",
                  feedFilter === stat ? "bg-primary text-white border-primary" : "bg-white border-border/40 hover:border-primary/50"
                )}
              >
                {stat}
              </button>
            ))}
          </div>

          <div className="h-[440px] xl:h-[460px] overflow-hidden border-y border-border/30">
            <LiveFeed
              incidents={sortedFeedIncidents}
              selectedIncidentId={selectedIncidentId}
              onSelectIncident={setSelectedIncidentId}
              maxItems={6}
            />
          </div>

          <div className="p-8 border-t border-border/40 bg-slate-50/30">
            <div className="flex items-center gap-3 text-slate-400 mb-6">
              <Clock className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-[0.4em]">Signal Synchronized @ 06:42 PM</span>
            </div>
            <button
              onClick={() => runGlobalAnalysis(false)}
              disabled={isAnalyzing}
              className="w-full flex items-center justify-between px-8 py-5 rounded-2xl bg-white border-2 border-border/40 text-[10px] font-black uppercase tracking-[0.3em] hover:border-primary group transition-all disabled:opacity-50"
            >
              Initialize Field Protocol <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
