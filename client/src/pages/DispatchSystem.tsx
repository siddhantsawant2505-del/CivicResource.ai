import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
    MapPin, Zap, AlertTriangle, 
                ChevronRight, Radio, Send, Shield, Activity, Truck,
  CheckCircle, Clock, Filter, Search
} from "lucide-react";
import { cn } from "@/lib/utils";
import CityMap from "@/components/CityMap";
import api from "@/lib/api";
import { toast } from "sonner";

export default function DispatchSystem() {
  const [incidents, setIncidents] = useState<any[]>([]);
    const [resources, setResources] = useState<any[]>([]);
        const [personnel, setPersonnel] = useState<any[]>([]);
        const [aiPulse, setAiPulse] = useState<any | null>(null);
        const [isApplyingPlan, setIsApplyingPlan] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<any | null>(null);
  const [selectedPersonnelIds, setSelectedPersonnelIds] = useState<string[]>([]);
  const [isDispatching, setIsDispatching] = useState(false);
  const [isAddingResource, setIsAddingResource] = useState(false);
  const [newResource, setNewResource] = useState({ name: "", type: "utility", lat: 19.0760, lng: 72.8777 });
  const [incidentSearch, setIncidentSearch] = useState("");
  
  const user = JSON.parse(localStorage.getItem("CivicResource_user") || "{}");
  const isAdmin = user.role === "admin";
    const [resourceFilter, setResourceFilter] = useState<"All" | "Utility" | "Sanitation" | "Police" | "Fire" | "Medical">("All");
        const [showResourceDrawer, setShowResourceDrawer] = useState(false);
        const operationalResources = resources.filter((r) => r.status !== "offline");

    const fetchData = async () => {
        try {
                        const [incRes, resourceRes, personnelRes] = await Promise.all([
                api.get('/incidents'),
                api.get('/resources'),
                api.get('/dispatch/personnel?all=true')
            ]);
            setIncidents((incRes.data || []).filter((i: any) => i.status !== 'resolved'));
            setResources(resourceRes.data || []);
            setPersonnel(personnelRes.data || []);
        } catch (err) {
            console.error("Dispatch fetch failed", err);
            toast.error("Unable to sync dispatch data");
        }
    };

    const fetchAiPulse = async (silent = true) => {
        try {
            const { data } = await api.post('/dispatch/ai-analyze', {
                liveInputs: {
                    weather_rain_mm: 6,
                    event_factor: 1.15,
                    population_density_boost: 1.05,
                },
            });
            setAiPulse(data);
            if (!silent) {
                toast.success('Live optimization updated');
            }
        } catch (err) {
            if (!silent) {
                toast.error('Unable to refresh live optimization');
            }
            console.error(err);
        }
    };

  useEffect(() => {
    fetchData();
        fetchAiPulse(true);
    const interval = setInterval(fetchData, 4000);
        const pulseInterval = setInterval(() => fetchAiPulse(true), 15000);
        return () => {
            clearInterval(interval);
            clearInterval(pulseInterval);
        };
  }, []);

    const handleAbortProtocol = async () => {
        if (!selectedIncident) {
            toast.error("No active protocol to abort");
            return;
        }

        const abortedTitle = selectedIncident.title;
        setSelectedIncident(null);
        setShowResourceDrawer(false);
        setIsDispatching(false);
        await fetchData();
        toast.success(`Dispatch protocol aborted for: ${abortedTitle}`);
    };

    const handleDispatch = async (resourceId?: string) => {
        if (!selectedIncident?._id || selectedPersonnelIds.length === 0) {
            toast.error("Select an incident and at least one worker");
            return;
        }

        setIsDispatching(true);
        try {
            const { data } = await api.post('/dispatch/assign', { 
                incidentId: selectedIncident._id, 
                personnelIds: selectedPersonnelIds,
                resourceId 
            });
            toast.success(data.message || "Dispatch successful");
            setSelectedPersonnelIds([]);
            fetchData();
        } catch (err: any) {
            toast.error(err.response?.data?.message || "Dispatch failed");
            console.error(err);
        } finally {
            setIsDispatching(false);
        }
    };

    const expectedPersonnelTypeForIncident = (incident: any) => {
        const incidentType = String(incident?.type || '').toLowerCase();
        const text = `${incident?.type || ''} ${incident?.title || ''} ${incident?.details || ''}`.toLowerCase();

        if (incidentType === 'fire') return 'fire';
        if (incidentType === 'medical') return 'medical';
        if (incidentType === 'crime' || incidentType === 'safety' || incidentType === 'traffic') return 'police';
        if (incidentType === 'sanitation' || /(garbage|trash|waste|sanitation|litter|dump)/.test(text)) return 'sanitation';
        return 'utility';
    };

    const pickAvailablePersonnelForIncident = (incident: any) => {
        const available = personnel.filter((p: any) => String(p?.status || '').toLowerCase() === 'available');
        if (!available.length) return null;

        const preferredType = expectedPersonnelTypeForIncident(incident);
        const compatible = available.filter((p: any) => String(p?.type || '').toLowerCase() === preferredType);
        if (!compatible.length) return null;

        return compatible
            .slice()
            .sort(
                (a: any, b: any) =>
                    distanceKm(a?.assignedResource?.location || a?.location, incident?.location) -
                    distanceKm(b?.assignedResource?.location || b?.location, incident?.location)
            )[0];
    };

    const dispatchDirect = async (incident: any, resourceId?: string) => {
        if (!incident?._id) {
            toast.error("Select an incident and click Apply");
            return;
        }

        const chosenPersonnel = pickAvailablePersonnelForIncident(incident);
        if (!chosenPersonnel?._id) {
            const expectedType = expectedPersonnelTypeForIncident(incident);
            toast.error(`No available ${expectedType} worker for this complaint right now`);
            return;
        }

        setIsDispatching(true);
        try {
            const { data } = await api.post('/dispatch/assign', {
                incidentId: incident._id,
                personnelIds: [chosenPersonnel._id],
                resourceId,
            });
            setSelectedIncident(incident);
            setSelectedPersonnelIds([chosenPersonnel._id]);
            toast.success(data.message || "Dispatch successful");
            await fetchData();
        } catch (err: any) {
            toast.error(err.response?.data?.message || "Dispatch failed");
            console.error(err);
        } finally {
            setIsDispatching(false);
        }
    };

    const handleAddResource = async () => {
        if (!newResource.name) {
            toast.error("Resource name required");
            return;
        }

        try {
            await api.post('/resources', {
                name: newResource.name,
                type: newResource.type,
                location: { lat: newResource.lat, lng: newResource.lng }
            });
            toast.success(`${newResource.name} inducted into fleet`);
            setIsAddingResource(false);
            setNewResource({ name: "", type: "utility", lat: 19.0760, lng: 72.8777 });
            fetchData();
        } catch (err) {
            toast.error("Failed to induct resource");
        }
    };

    const zoneIdForIncident = (incident: any) => {
        const lat = Number(incident?.location?.lat);
        const lng = Number(incident?.location?.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return '';
        return `${Math.round(lat * 10) / 10}_${Math.round(lng * 10) / 10}`;
    };

    const incidentFamily = (incident: any) => {
        const text = `${incident?.type || ''} ${incident?.title || ''} ${incident?.details || ''}`.toLowerCase();
        if (/(water|tanker|pipe|leak|hydrant|flood|drain|sewer)/.test(text)) return 'water';
        if (/(garbage|trash|waste|sanitation|litter|dump)/.test(text)) return 'garbage';
        if (/(road|pothole|street|bridge|traffic|signal|maintenance)/.test(text)) return 'maintenance';
        if (/(fire|crime|unsafe|hazard|assault|police)/.test(text)) return 'safety';
        return 'general';
    };

    const distanceKm = (a: any, b: any) => {
        const lat1 = Number(a?.lat);
        const lng1 = Number(a?.lng);
        const lat2 = Number(b?.lat);
        const lng2 = Number(b?.lng);
        if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return Number.POSITIVE_INFINITY;

        const toRad = (v: number) => (Math.PI / 180) * v;
        const R = 6371;
        const dLat = toRad(lat2 - lat1);
        const dLng = toRad(lng2 - lng1);
        const h =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
    };

    const liveSuggestions = useMemo(() => {
        const unresolved = incidents.filter((i: any) => i.status !== 'resolved');
        if (!unresolved.length) return [];

        const incidentsByZone = unresolved.reduce((acc: Record<string, any[]>, incident: any) => {
            const key = zoneIdForIncident(incident);
            if (!key) return acc;
            acc[key] = acc[key] || [];
            acc[key].push(incident);
            return acc;
        }, {});

        const resourceById = resources.reduce((acc: Record<string, any>, resource: any) => {
            acc[String(resource._id)] = resource;
            return acc;
        }, {});

        const fallbackResources = resources.filter((resource: any) => {
            const status = String(resource?.status || '').toLowerCase();
            return status === 'available' || status === 'patrol' || status === 'dispatched';
        });

        const basePlan = aiPulse?.allocationPlan?.length ? aiPulse.allocationPlan : fallbackResources.map((resource: any, index: number) => {
            const targetIncident = [...unresolved].sort((a: any, b: any) => {
                const severityOrder: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
                const aFamily = incidentFamily(a);
                const bFamily = incidentFamily(b);
                const resourceFamily = incidentFamily({ type: resource.type, title: resource.name, details: '' });
                const aMatch = aFamily === resourceFamily ? 3 : aFamily !== 'general' ? 1 : 0;
                const bMatch = bFamily === resourceFamily ? 3 : bFamily !== 'general' ? 1 : 0;
                const aFresh = new Date(a?.createdAt || 0).getTime();
                const bFresh = new Date(b?.createdAt || 0).getTime();

                return (
                    bMatch - aMatch ||
                    (severityOrder[b?.severity] || 0) - (severityOrder[a?.severity] || 0) ||
                    bFresh - aFresh
                );
            })[0];

            return targetIncident ? {
                zone_id: zoneIdForIncident(targetIncident),
                resource_id: resource._id,
                resource_type: resource.type,
                resource_name: resource.name,
                resource_family: incidentFamily({ type: resource.type, title: resource.name, details: '' }),
                preferred_family: incidentFamily(targetIncident),
                distance_km: Number(distanceKm(resource?.location, targetIncident?.location).toFixed(2)),
                eta_minutes: Math.max(3, Math.round(distanceKm(resource?.location, targetIncident?.location) / 0.45)),
                urgency_score: Math.max(1, 30 - index),
                ranking_score: Math.max(60, 90 - index * 4),
                explainability: {
                    score: Math.max(60, 90 - index * 4),
                    why: [
                        'Live fallback generated from active incidents because the AI plan returned no allocations',
                        `Prioritized ${targetIncident.title}`,
                    ],
                    factors: {
                        urgency: 100,
                        eta: 100,
                        familyMatch: 100,
                        severity: 100,
                        learningConfidence: 0,
                    },
                },
                route_factors: {
                    trafficIndex: 1,
                    roadConditionIndex: 1,
                },
                pinned: index === 0,
            } : null;
        }).filter(Boolean);

        if (!basePlan.length) {
            const newestIncidentOnly = [...unresolved].sort((a: any, b: any) => {
                const aFresh = new Date(a?.createdAt || 0).getTime();
                const bFresh = new Date(b?.createdAt || 0).getTime();
                return bFresh - aFresh;
            })[0];

            if (newestIncidentOnly) {
                basePlan.push({
                    zone_id: zoneIdForIncident(newestIncidentOnly),
                    resource_id: `pending-${newestIncidentOnly._id}`,
                    resource_fallback: {
                        _id: `pending-${newestIncidentOnly._id}`,
                        name: 'Awaiting Available Unit',
                        type: 'pending',
                        status: 'offline',
                        location: newestIncidentOnly.location,
                    },
                    resource_type: 'pending',
                    resource_name: 'Awaiting Available Unit',
                    resource_family: 'general',
                    preferred_family: incidentFamily(newestIncidentOnly),
                    distance_km: 0,
                    eta_minutes: null,
                    urgency_score: 99,
                    ranking_score: 99,
                    explainability: {
                        score: 99,
                        why: ['Active incident is queued and visible while all units are currently unavailable'],
                        factors: { urgency: 100, eta: 0, familyMatch: 0, severity: 100, learningConfidence: 0 },
                    },
                    route_factors: { trafficIndex: 1, roadConditionIndex: 1 },
                    pinned: true,
                });
            }
        }

        const suggestions = basePlan
            .map((allocation: any) => {
                const resource = resourceById[String(allocation.resource_id)] || allocation.resource_fallback;
                const inZone = incidentsByZone[String(allocation.zone_id)] || [];
                const preferredFamily = String(allocation.preferred_family || allocation.resource_family || 'general').toLowerCase();
                const targetIncident = [...inZone]
                    .sort((a: any, b: any) => {
                        const severityOrder: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
                        const aFamily = incidentFamily(a);
                        const bFamily = incidentFamily(b);
                        const aMatch = aFamily === preferredFamily ? 3 : aFamily !== 'general' ? 1 : 0;
                        const bMatch = bFamily === preferredFamily ? 3 : bFamily !== 'general' ? 1 : 0;
                        const aFresh = new Date(a?.createdAt || 0).getTime();
                        const bFresh = new Date(b?.createdAt || 0).getTime();

                        return (
                            bMatch - aMatch ||
                            (severityOrder[b?.severity] || 0) - (severityOrder[a?.severity] || 0) ||
                            bFresh - aFresh
                        );
                    })[0] ||
                [...unresolved]
                    .sort((a: any, b: any) => {
                        const ra = distanceKm(resource?.location, a?.location);
                        const rb = distanceKm(resource?.location, b?.location);
                        return ra - rb;
                    })[0];

                if (!resource || !targetIncident) return null;
                return {
                    resource,
                    incident: targetIncident,
                    eta: allocation.eta_minutes,
                    predictedTravel: allocation.predicted_travel_time_minutes,
                    routeFactors: allocation.route_factors,
                    rankingScore: allocation.ranking_score,
                    zone: allocation.zone_id,
                    urgency: allocation.urgency_score,
                    explainability: allocation.explainability,
                    preferredFamily: allocation.preferred_family,
                    resourceFamily: allocation.resource_family,
                };
            })
            .filter(Boolean);

        const newestIncident = [...unresolved].sort((a: any, b: any) => {
            const aFresh = new Date(a?.createdAt || 0).getTime();
            const bFresh = new Date(b?.createdAt || 0).getTime();
            return bFresh - aFresh;
        })[0];

        if (newestIncident && !suggestions.some((item: any) => item.incident?._id === newestIncident._id)) {
            const topResource = resourceById[String(basePlan[0]?.resource_id)] || fallbackResources[0];
            const pendingResource = {
                _id: `pending-${newestIncident._id}`,
                name: 'Awaiting Available Unit',
                type: 'pending',
                status: 'offline',
                location: newestIncident.location,
            };

            suggestions.unshift({
                resource: topResource || pendingResource,
                incident: newestIncident,
                eta: topResource ? basePlan[0]?.eta_minutes : null,
                predictedTravel: topResource ? (basePlan[0]?.predicted_travel_time_minutes || basePlan[0]?.eta_minutes) : null,
                routeFactors: basePlan[0]?.route_factors || { trafficIndex: 1, roadConditionIndex: 1 },
                rankingScore: Math.max(100, Number(basePlan[0]?.ranking_score || 0)),
                zone: zoneIdForIncident(newestIncident),
                urgency: Number(basePlan[0]?.urgency_score || 0),
                explainability: basePlan[0]?.explainability || {
                    score: 100,
                    why: [topResource ? 'Newest active incident pinned for live response' : 'Newest incident is queued until a matching unit is available'],
                    factors: { urgency: 100, eta: topResource ? 100 : 0, familyMatch: topResource ? 100 : 0, severity: 100, learningConfidence: 0 },
                },
                preferredFamily: basePlan[0]?.preferred_family || incidentFamily(newestIncident),
                resourceFamily: basePlan[0]?.resource_family || (topResource?.type || 'pending'),
                assignment_type: topResource ? 'apply' : 'queue',
                pinned: true,
            });
        }

        const coveredIds = new Set(suggestions.map((item: any) => String(item?.incident?._id || '')));
        const toQueuedCard = (incident: any) => ({
            resource: {
                _id: `pending-${incident._id}`,
                name: 'Awaiting Available Unit',
                type: 'pending',
                status: 'offline',
                location: incident.location,
            },
            incident,
            eta: null,
            predictedTravel: null,
            routeFactors: { trafficIndex: 1, roadConditionIndex: 1 },
            rankingScore: 95,
            zone: zoneIdForIncident(incident),
            urgency: 95,
            explainability: {
                score: 95,
                why: ['Incident kept visible in scheduler while awaiting nearest available unit'],
                factors: { urgency: 100, eta: 0, familyMatch: 0, severity: 100, learningConfidence: 0 },
            },
            preferredFamily: incidentFamily(incident),
            resourceFamily: 'pending',
            assignment_type: 'queue',
            pinned: true,
        });

        const queuedVisible = [...unresolved]
            .filter((incident: any) => String(incident?.dispatchStatus || '').toLowerCase() === 'unassigned')
            .filter((incident: any) => !coveredIds.has(String(incident?._id || '')))
            .sort((a: any, b: any) => new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime())
            .slice(0, 2)
            .map((incident: any) => toQueuedCard(incident));

        const newestUnassigned = [...unresolved]
            .filter((incident: any) => String(incident?.dispatchStatus || '').toLowerCase() === 'unassigned')
            .sort((a: any, b: any) => new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime())
            .slice(0, 3);

        const newestPinned = newestUnassigned.map((incident: any) => {
            const existing = suggestions.find((item: any) => String(item?.incident?._id) === String(incident?._id));
            return existing || toQueuedCard(incident);
        });

        const pinnedIds = new Set(newestPinned.map((item: any) => String(item?.incident?._id || '')));
        const remainingSuggestions = [...suggestions, ...queuedVisible]
            .filter((item: any) => !pinnedIds.has(String(item?.incident?._id || '')));

        const finalSuggestions = [...newestPinned, ...remainingSuggestions];

        return finalSuggestions.slice(0, 6);
    }, [aiPulse, incidents, resources]);

    const applyLivePlan = async () => {
        setIsApplyingPlan(true);
        try {
            const { data } = await api.post('/dispatch/apply-plan-live', {
                liveInputs: {
                    weather_rain_mm: 6,
                    event_factor: 1.15,
                    population_density_boost: 1.05,
                },
                maxAssignments: 3,
            });
            await Promise.all([fetchData(), fetchAiPulse(true)]);
            const appliedCount = Number(data?.summary?.appliedCount || 0);
            if (appliedCount > 0) {
                toast.success(`Live plan applied to ${appliedCount} incident(s)`);
            } else {
                toast.info(data?.message || 'No suitable live allocations available');
            }
        } catch (err) {
            console.error(err);
            toast.error('Failed to apply live plan');
        } finally {
            setIsApplyingPlan(false);
        }
    };

    const filteredIncidents = incidents.filter((inc) => {
        const q = incidentSearch.trim().toLowerCase();
        if (!q) return true;
        const title = (inc.title || "").toLowerCase();
        const type = (inc.type || "").toLowerCase();
        const address = (inc.location?.address || "").toLowerCase();
        return title.includes(q) || type.includes(q) || address.includes(q);
    });

    const filteredResources = operationalResources.filter((r) => {
        if (resourceFilter === "All") return true;
        const type = String(r.type || "").toLowerCase();
        return type === resourceFilter.toLowerCase();
    });

    const typeMatchedResources = filteredResources;

    const formatCoord = (n?: number) => (typeof n === 'number' ? n.toFixed(4) : 'NA');

    const resourcePanel = (
        <>
            <div className="p-8 border-b border-slate-800">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <Truck className="w-4 h-4 text-primary" />
                        <span className="text-[11px] font-black uppercase tracking-[0.3em] text-white">Resource Matrix</span>
                    </div>
                    <div className="px-3 py-1 bg-primary/10 rounded-full border border-primary/20">
                        <span className="text-[9px] font-black text-primary uppercase tracking-widest">{resources.length} Units</span>
                    </div>
                </div>

                <div className="flex gap-2">
                    {['All', 'Utility', 'Sanitation', 'Police', 'Fire', 'Medical'].map(cat => (
                        <button
                            key={cat}
                            onClick={() => setResourceFilter(cat as any)}
                            className={cn(
                                "flex-1 py-3 items-center rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all",
                                resourceFilter === cat ? "border-primary/40 text-white bg-primary/10" : "border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"
                            )}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                <div>
                   <div className="flex items-center justify-between mb-4">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Step 1: Select Personnel</h4>
                      <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">{personnel.length} Units Online</span>
                   </div>
                   <div className="space-y-2">
                       {personnel
                        .sort((a, b) => {
                           if (a.status === 'off-duty' && b.status !== 'off-duty') return 1;
                           if (a.status !== 'off-duty' && b.status === 'off-duty') return -1;
                           return 0;
                        })
                        .map(p => {
                          const isSelected = selectedPersonnelIds.includes(p._id);
                          const isOffDuty = p.status === 'off-duty';
                          
                          return (
                             <div 
                                key={p._id}
                                onClick={() => {
                                   if (isSelected) {
                                      setSelectedPersonnelIds(prev => prev.filter(id => id !== p._id));
                                   } else {
                                      setSelectedPersonnelIds(prev => [...prev, p._id]);
                                   }
                                }}
                                className={cn(
                                   "p-4 rounded-xl border cursor-pointer transition-all relative overflow-hidden",
                                   isSelected 
                                      ? "bg-primary border-primary text-white shadow-xl shadow-primary/20" 
                                      : isOffDuty 
                                         ? "bg-slate-900/40 border-transparent opacity-50 grayscale select-none"
                                         : "bg-slate-800/40 border-slate-800 text-slate-400 hover:border-slate-700"
                                )}
                             >
                                <div className="flex items-center justify-between relative z-10">
                                   <div>
                                      <p className={cn(
                                         "text-[11px] font-black uppercase tracking-tight",
                                         isOffDuty && "text-slate-500"
                                      )}>{p.name}</p>
                                      <div className="flex items-center gap-2 mt-1">
                                         <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-white/10 text-white/60 border border-white/5">
                                            {p.type}
                                         </span>
                                         {p.taskQueue?.length > 0 && (
                                            <span className="text-[8px] font-black uppercase text-amber-400">
                                               {p.taskQueue.length} Queued
                                            </span>
                                         )}
                                      </div>
                                   </div>
                                   <div className="flex items-center gap-3">
                                      <span className={cn(
                                         "text-[7px] font-black uppercase px-1.5 py-0.5 rounded-full border",
                                         p.status === 'available' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" : 
                                         isOffDuty ? "bg-slate-700/20 border-slate-700/30 text-slate-500" :
                                         "bg-amber-500/10 border-amber-500/20 text-amber-500"
                                      )}>
                                         {p.status}
                                      </span>
                                      {isSelected && <CheckCircle className="w-3 h-3 text-white" />}
                                   </div>
                                </div>
                             </div>
                          );
                        })}
                   </div>
                </div>

                {selectedPersonnelIds.length > 0 && (
                   <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                      <div className="flex items-center justify-between mb-4">
                         <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Step 2: Select Resource</h4>
                         {isAdmin && (
                            <button 
                               onClick={() => setIsAddingResource(true)}
                               className="text-[8px] font-black text-primary uppercase tracking-[0.2em] hover:underline"
                            >
                               + Induct New Asset
                            </button>
                         )}
                      </div>
                      
                      {isAddingResource && (
                         <div className="mb-6 p-5 rounded-2xl bg-white/5 border border-white/10 space-y-4">
                            {/* ... (Keep induction inputs) ... */}
                            <div className="space-y-2">
                               <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">Asset Designation</label>
                               <input 
                                  value={newResource.name}
                                  onChange={e => setNewResource({...newResource, name: e.target.value})}
                                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-[10px] font-bold text-white uppercase tracking-widest placeholder:text-slate-700" 
                                  placeholder="e.g. RAPID_RESPONSE_01"
                               />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                               <select 
                                  value={newResource.type}
                                  onChange={e => setNewResource({...newResource, type: e.target.value})}
                                  className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-3 text-[9px] font-black text-white uppercase tracking-widest outline-none"
                               >
                                  <option value="utility">Utility</option>
                                  <option value="sanitation">Sanitation</option>
                                  <option value="medical">Medical</option>
                                  <option value="fire">Fire</option>
                                  <option value="police">Police</option>
                               </select>
                               <button 
                                  onClick={handleAddResource}
                                  className="bg-primary text-white text-[9px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-primary/20"
                               >
                                  Induct
                               </button>
                            </div>
                            <button onClick={() => setIsAddingResource(false)} className="w-full text-center text-[8px] font-black text-slate-600 uppercase tracking-widest">Cancel</button>
                         </div>
                      )}

                      <div className="space-y-3">
                          {typeMatchedResources.map((r) => (
                             <div
                                 key={r._id}
                                 className="group bg-slate-800/40 border border-slate-800 p-5 rounded-2xl hover:bg-slate-800 hover:border-slate-700 transition-all"
                             >
                                 <div className="flex items-center justify-between">
                                     <div className="flex items-center gap-4">
                                         <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center">
                                             <Truck className="w-5 h-5 text-slate-400 group-hover:text-primary transition-colors" />
                                         </div>
                                         <div>
                                             <h4 className="text-xs font-black text-white uppercase tracking-tight">{r.name}</h4>
                                             <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{r.status}</span>
                                         </div>
                                     </div>

                                     <button
                                         disabled={!selectedIncident || selectedPersonnelIds.length === 0 || isDispatching}
                                         onClick={() => handleDispatch(r._id)}
                                         className={cn(
                                             "px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all",
                                             selectedIncident && selectedPersonnelIds.length > 0
                                                 ? "bg-primary text-white shadow-xl shadow-primary/20 hover:scale-105 active:scale-95"
                                                 : "bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700"
                                         )}
                                     >
                                         Dispatch Team
                                     </button>
                                 </div>
                             </div>
                         ))}
                      </div>
                      
                      {typeMatchedResources.length === 0 && (
                         <button
                             onClick={() => handleDispatch()}
                             className="w-full mt-4 py-4 bg-slate-800 border border-slate-700 rounded-2xl text-[10px] font-black uppercase text-white tracking-widest hover:bg-slate-700"
                         >
                             Dispatch Personnel Only
                         </button>
                      )}
                   </motion.div>
                )}
            </div>

            {!selectedPersonnelIds.length && (
               <div className="mt-auto p-12 border-t border-slate-800 flex flex-col items-center justify-center text-center opacity-40">
                  <Activity className="w-12 h-12 text-slate-600 mb-4" />
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Pick workers to unlock equipment matrix</p>
               </div>
            )}

            <div className="p-8 border-t border-slate-800 bg-slate-900/50">
                <div className="flex items-center justify-between text-slate-500 uppercase font-black text-[9px] tracking-widest mb-6 px-2">
                    <span>Network Stability</span>
                    <span className="text-emerald-500">99.98%</span>
                </div>
                <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: "99.98%" }}
                        className="h-full bg-primary"
                    />
                </div>
            </div>
        </>
    );

    return (
        <div className="relative flex min-h-screen bg-slate-50/30 overflow-y-auto font-inter">
      {/* ── LEFT: Incident Triage Cluster ──────────────────────────────────── */}
    <div className="w-full max-w-[480px] bg-white border-r border-border/40 flex flex-col shadow-2xl">
         <div className="p-8 border-b border-border/40 bg-white sticky top-0 z-10">
                        <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
                    <Radio className="w-5 h-5 text-white animate-pulse" />
                </div>
                <div>
                               <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-900">Dispatch Relay</h2>
                               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Active Resource Allocation Matrix</p>
                </div>
            </div>
            
            <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                <input 
                    type="text" 
                    placeholder="Filter Incidents..." 
                    value={incidentSearch}
                    onChange={(e) => setIncidentSearch(e.target.value)}
                    className="w-full bg-slate-50 border border-border/40 rounded-2xl py-4 pl-12 pr-6 text-[11px] font-black uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all"
                />
            </div>
         </div>

         <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
            <AnimatePresence mode="popLayout">
                {filteredIncidents.map((inc) => (
                    <motion.div
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, x: -20 }}
                        key={inc._id}
                        onClick={() => setSelectedIncident(inc)}
                        className={cn(
                            "group p-6 rounded-2xl border-2 transition-all cursor-pointer relative overflow-hidden",
                            selectedIncident?._id === inc._id 
                                ? "bg-white border-primary shadow-2xl shadow-primary/10 scale-[1.02]" 
                                : "bg-white/50 border-border/40 hover:border-slate-300 hover:bg-white"
                        )}
                    >
                        <div className="flex items-start justify-between relative z-10">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <span className={cn(
                                        "px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-[0.2em] border",
                                        inc.severity === 'critical' ? "bg-red-50 text-red-600 border-red-100" : "bg-primary/5 text-primary border-primary/10"
                                    )}>
                                        {inc.severity}
                                    </span>
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{inc.type}</span>
                                </div>
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">{inc.title}</h3>
                            </div>
                            <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center group-hover:bg-primary/5 transition-colors">
                                <ChevronRight className={cn("w-4 h-4 transition-transform", selectedIncident?._id === inc._id ? "text-primary" : "text-slate-300")} />
                            </div>
                        </div>
                        
                        <div className="mt-4 flex items-center gap-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                            <div className="flex items-center gap-2">
                                <MapPin className="w-3 h-3" /> {inc.location.address?.split(',')[0] || "Unknown Vector"}
                            </div>
                            <div className="flex items-center gap-2">
                                <Clock className="w-3 h-3" /> 2m ago
                            </div>
                        </div>
                    </motion.div>
                ))}
            </AnimatePresence>
            {incidents.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-40 py-20">
                    <CheckCircle className="w-12 h-12 mb-4" />
                    <p className="text-[10px] font-black uppercase tracking-widest">All Incident Signals Cleared</p>
                </div>
            )}
            {incidents.length > 0 && filteredIncidents.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-40 py-20">
                    <Filter className="w-12 h-12 mb-4" />
                    <p className="text-[10px] font-black uppercase tracking-widest">No incidents match current filter</p>
                </div>
            )}
         </div>
      </div>

      {/* ── CENTER: Visual Relay ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
                 <div className="p-8 border-b border-border/40 bg-white">
                        <div className="h-[620px] rounded-3xl overflow-hidden border border-border/40">
                            <CityMap incidents={[...incidents, ...(selectedIncident ? [selectedIncident] : [])]} resources={operationalResources} personnel={personnel} />
                        </div>

                        <AnimatePresence>
                            {selectedIncident && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 20 }}
                                    className="mt-6 bg-white border-2 border-primary/20 rounded-3xl p-8 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.12)] flex items-center justify-between gap-6"
                                >
                                    <div className="flex items-center gap-6">
                                        <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-xl shadow-primary/20">
                                            <Send className="w-8 h-8 text-white" />
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em] block mb-2">Protocol: Unit Assignment</span>
                                            <h2 className="text-3xl font-black uppercase tracking-tight text-slate-900 leading-none mb-2">Execute Dispatch</h2>
                                            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Assign available field assets to <span className="text-slate-900">{selectedIncident.title}</span></p>
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleAbortProtocol}
                                        className="px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-200 hover:bg-slate-50 transition-all text-slate-500"
                                    >
                                        Abort Protocol
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="mt-6 bg-white border border-border/40 rounded-2xl p-6 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-900">Smart Allocation Suggestions</h3>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Auto every 15s</span>
                                    <button
                                        onClick={() => fetchAiPulse(false)}
                                        className="px-3 py-2 rounded-lg border border-border/40 text-[9px] font-black uppercase tracking-widest text-slate-700 hover:border-primary hover:text-primary transition-all"
                                    >
                                        Refresh AI
                                    </button>
                                    <button
                                        onClick={applyLivePlan}
                                        disabled={isApplyingPlan || liveSuggestions.length === 0}
                                        className="px-3 py-2 rounded-lg border border-primary/30 bg-primary/10 text-[9px] font-black uppercase tracking-widest text-primary hover:bg-primary hover:text-white transition-all disabled:opacity-50"
                                    >
                                        {isApplyingPlan ? 'Applying...' : 'Apply Live Plan'}
                                    </button>
                                </div>
                            </div>

                            {liveSuggestions.length === 0 ? (
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">No usable resources are online right now.</p>
                            ) : (
                                <div className="space-y-2">
                                    {liveSuggestions.map((s: any) => (
                                        <div key={`${s.resource._id}-${s.incident._id}`} className="p-3 rounded-xl border border-border/30 bg-slate-50/50 flex items-center justify-between gap-4">
                                            <div className="flex-1">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-900">{s.resource.name}{' -> '}{s.incident.title}</p>
                                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Zone {s.zone} • Route ETA {s.predictedTravel || s.eta}m • Urgency {Number(s.urgency || 0).toFixed(1)}</p>
                                                <div className="mt-2 flex flex-wrap gap-2">
                                                    <span className="px-2 py-1 rounded-md bg-white border border-border/40 text-[8px] font-black uppercase tracking-widest text-slate-500">
                                                        Explainability Score {s.explainability?.score ?? '--'}
                                                    </span>
                                                    <span className="px-2 py-1 rounded-md bg-white border border-border/40 text-[8px] font-black uppercase tracking-widest text-slate-500">
                                                        Rank {s.rankingScore ?? '--'}
                                                    </span>
                                                    <span className="px-2 py-1 rounded-md bg-white border border-border/40 text-[8px] font-black uppercase tracking-widest text-slate-500">
                                                        Need {s.preferredFamily || 'general'}
                                                    </span>
                                                    <span className="px-2 py-1 rounded-md bg-white border border-border/40 text-[8px] font-black uppercase tracking-widest text-slate-500">
                                                        Unit {s.resourceFamily || 'general'}
                                                    </span>
                                                </div>
                                                {Array.isArray(s.explainability?.why) && s.explainability.why.length > 0 && (
                                                    <p className="mt-2 text-[9px] font-bold text-slate-600 uppercase tracking-wide">
                                                        {s.explainability.why[0]}
                                                    </p>
                                                )}
                                                {s.routeFactors && (
                                                    <p className="mt-1 text-[9px] font-bold text-slate-500 uppercase tracking-wide">
                                                        Traffic x{Number(s.routeFactors.trafficIndex || 1).toFixed(2)} • Road x{Number(s.routeFactors.roadConditionIndex || 1).toFixed(2)}
                                                    </p>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => dispatchDirect(s.incident, s.resource?._id || s.resource_id)}
                                                disabled={String(s.resource_type || '').toLowerCase() === 'pending'}
                                                className="px-3 py-2 rounded-lg border border-border/40 text-[9px] font-black uppercase tracking-widest text-slate-700 hover:border-primary hover:text-primary transition-all"
                                            >
                                                {s.assignment_type === 'queue' ? 'Queue' : 'Apply'}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="mt-6 bg-white border border-border/40 rounded-2xl p-6 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-900">Seeded Resource Preview</h3>
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{operationalResources.length} units</span>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[760px] text-left">
                                    <thead>
                                        <tr className="border-b border-border/40">
                                            <th className="py-3 pr-4 text-[9px] font-black uppercase tracking-widest text-slate-400">Resource</th>
                                            <th className="py-3 pr-4 text-[9px] font-black uppercase tracking-widest text-slate-400">Type</th>
                                            <th className="py-3 pr-4 text-[9px] font-black uppercase tracking-widest text-slate-400">Current Position</th>
                                            <th className="py-3 pr-4 text-[9px] font-black uppercase tracking-widest text-slate-400">Destination</th>
                                            <th className="py-3 pr-4 text-[9px] font-black uppercase tracking-widest text-slate-400">Status</th>
                                            <th className="py-3 pr-4 text-[9px] font-black uppercase tracking-widest text-slate-400">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {operationalResources.map((r: any) => (
                                            <tr key={r._id} className="border-b border-border/20">
                                                <td className="py-3 pr-4 text-[11px] font-black uppercase tracking-wide text-slate-900">{r.name}</td>
                                                <td className="py-3 pr-4 text-[10px] font-black uppercase tracking-widest text-slate-500">{r.type.replace('_', ' ')}</td>
                                                <td className="py-3 pr-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                                    {formatCoord(r.location?.lat)}, {formatCoord(r.location?.lng)}
                                                </td>
                                                <td className="py-3 pr-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                                    {r.currentIncident?.location
                                                        ? `${formatCoord(r.currentIncident.location.lat)}, ${formatCoord(r.currentIncident.location.lng)}`
                                                        : 'Patrol Loop'}
                                                    {r.currentIncident?.location?.address ? ` (${r.currentIncident.location.address})` : ''}
                                                </td>
                                                <td className="py-3 pr-4 text-[9px] font-black uppercase tracking-widest">
                                                    <span className={cn(
                                                        'px-2 py-1 rounded-lg border',
                                                        r.status === 'dispatched' ? 'text-primary border-primary/20 bg-primary/5' : 'text-slate-500 border-slate-200 bg-slate-50'
                                                    )}>
                                                        {r.status}
                                                    </span>
                                                </td>
                                                <td className="py-3 pr-4">
                                                    <button
                                                        onClick={() => {
                                                            dispatchDirect(selectedIncident, r._id);
                                                        }}
                                                        disabled={!selectedIncident || isDispatching || r.status === 'dispatched'}
                                                        className="px-3 py-2 rounded-lg border border-border/40 text-[9px] font-black uppercase tracking-widest text-slate-700 hover:border-primary hover:text-primary transition-all disabled:opacity-50"
                                                    >
                                                        Send Unit
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                 </div>
      </div>

            {/* Right-edge arrow toggle */}
                <button
                onClick={() => setShowResourceDrawer((v) => !v)}
                className="fixed right-0 top-1/2 -translate-y-1/2 z-[1210] w-10 h-16 rounded-l-xl bg-slate-900 text-white text-xl font-black shadow-2xl border border-slate-700 border-r-0"
                aria-label={showResourceDrawer ? "Close resource matrix" : "Open resource matrix"}
            >
                {showResourceDrawer ? ">" : "<"}
            </button>

            <AnimatePresence>
                {showResourceDrawer && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowResourceDrawer(false)}
                            className="fixed inset-0 bg-black/40 z-[1190]"
                        />
                        <motion.div
                            initial={{ x: "100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "100%" }}
                            transition={{ type: "spring", stiffness: 280, damping: 28 }}
                            className="fixed top-0 right-0 h-full w-[min(92vw,420px)] bg-slate-900 border-l border-slate-800 z-[1200] flex flex-col shadow-2xl"
                        >
                            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white">Resource Matrix</span>
                                <button
                                    onClick={() => setShowResourceDrawer(false)}
                                    className="px-3 py-2 rounded-lg border border-slate-700 text-[9px] font-black uppercase tracking-widest text-slate-300"
                                >
                                    Close
                                </button>
                            </div>
                            {resourcePanel}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
    </div>
  );
}
