export interface Incident {
  id: string;
  title: string;
  category: string;
  priority: "critical" | "high" | "medium" | "low";
  status: "open" | "assigned" | "in-progress" | "resolved";
  location: { lat: number; lng: number; label: string };
  timestamp: string;
  slaDeadline: string;
  slaPercent: number;
  assignedTo?: string;
  clusterId?: string;
}

export interface Cluster {
  id: string;
  center: { lat: number; lng: number };
  count: number;
  radius: number;
  priorityScore: number;
  predictedDemand: number;
}

export interface Truck {
  id: string;
  name: string;
  status: "en-route" | "on-site" | "idle";
  position: { lat: number; lng: number };
  destination?: { lat: number; lng: number };
  eta?: string;
}

export interface TimeSeriesPoint {
  time: string;
  actual: number;
  predicted: number;
  optimized?: number;
}

export const incidents: Incident[] = [
  { id: "INC-001", title: "Water main burst on 5th Ave", category: "Water", priority: "critical", status: "assigned", location: { lat: 40.748, lng: -73.986, label: "5th Ave & 34th St" }, timestamp: "2 min ago", slaDeadline: "45 min", slaPercent: 85, assignedTo: "Unit Alpha-7", clusterId: "CL-1" },
  { id: "INC-002", title: "Pothole cluster on Broadway", category: "Roads", priority: "high", status: "open", location: { lat: 40.755, lng: -73.988, label: "Broadway & 42nd St" }, timestamp: "8 min ago", slaDeadline: "2 hr", slaPercent: 60, clusterId: "CL-1" },
  { id: "INC-003", title: "Traffic signal malfunction", category: "Traffic", priority: "high", status: "in-progress", location: { lat: 40.741, lng: -73.990, label: "7th Ave & 23rd St" }, timestamp: "15 min ago", slaDeadline: "1 hr", slaPercent: 40, assignedTo: "Unit Bravo-3", clusterId: "CL-2" },
  { id: "INC-004", title: "Street light outage - 3 block radius", category: "Electrical", priority: "medium", status: "open", location: { lat: 40.760, lng: -73.975, label: "Park Ave & 51st St" }, timestamp: "22 min ago", slaDeadline: "4 hr", slaPercent: 20, clusterId: "CL-3" },
  { id: "INC-005", title: "Illegal dumping reported", category: "Sanitation", priority: "low", status: "open", location: { lat: 40.735, lng: -73.995, label: "W Houston & Varick" }, timestamp: "35 min ago", slaDeadline: "8 hr", slaPercent: 10 },
  { id: "INC-006", title: "Gas leak detected", category: "Utilities", priority: "critical", status: "in-progress", location: { lat: 40.752, lng: -73.978, label: "Lexington & 45th" }, timestamp: "5 min ago", slaDeadline: "30 min", slaPercent: 92, assignedTo: "Unit Charlie-1", clusterId: "CL-2" },
  { id: "INC-007", title: "Sidewalk collapse risk", category: "Infrastructure", priority: "high", status: "assigned", location: { lat: 40.745, lng: -73.982, label: "Madison & 37th" }, timestamp: "12 min ago", slaDeadline: "1.5 hr", slaPercent: 55, assignedTo: "Unit Delta-2" },
  { id: "INC-008", title: "Flooding at subway entrance", category: "Water", priority: "critical", status: "open", location: { lat: 40.750, lng: -73.993, label: "8th Ave & 40th" }, timestamp: "1 min ago", slaDeadline: "20 min", slaPercent: 95 },
];

export const clusters: Cluster[] = [
  { id: "CL-1", center: { lat: 40.751, lng: -73.987 }, count: 5, radius: 0.008, priorityScore: 92, predictedDemand: 3 },
  { id: "CL-2", center: { lat: 40.746, lng: -73.984 }, count: 3, radius: 0.006, priorityScore: 78, predictedDemand: 2 },
  { id: "CL-3", center: { lat: 40.760, lng: -73.975 }, count: 2, radius: 0.004, priorityScore: 45, predictedDemand: 1 },
];

export const trucks: Truck[] = [
  { id: "T-1", name: "Unit Alpha-7", status: "en-route", position: { lat: 40.744, lng: -73.992 }, destination: { lat: 40.748, lng: -73.986 }, eta: "4 min" },
  { id: "T-2", name: "Unit Bravo-3", status: "on-site", position: { lat: 40.741, lng: -73.990 } },
  { id: "T-3", name: "Unit Charlie-1", status: "en-route", position: { lat: 40.757, lng: -73.972 }, destination: { lat: 40.752, lng: -73.978 }, eta: "7 min" },
  { id: "T-4", name: "Unit Delta-2", status: "idle", position: { lat: 40.738, lng: -73.998 } },
];

export const demandTimeSeries: TimeSeriesPoint[] = Array.from({ length: 24 }, (_, i) => ({
  time: `${String(i).padStart(2, "0")}:00`,
  actual: Math.floor(20 + 40 * Math.sin(((i - 6) * Math.PI) / 12) + Math.random() * 15),
  predicted: Math.floor(22 + 38 * Math.sin(((i - 6) * Math.PI) / 12) + Math.random() * 5),
  optimized: Math.floor(15 + 25 * Math.sin(((i - 6) * Math.PI) / 12) + Math.random() * 5),
}));

export const categoryBreakdown = [
  { name: "Water", value: 28, color: "hsl(207, 90%, 54%)" },
  { name: "Roads", value: 22, color: "hsl(38, 92%, 50%)" },
  { name: "Traffic", value: 18, color: "hsl(0, 84%, 60%)" },
  { name: "Electrical", value: 15, color: "hsl(160, 84%, 39%)" },
  { name: "Sanitation", value: 12, color: "hsl(270, 70%, 60%)" },
  { name: "Other", value: 5, color: "hsl(215, 20%, 55%)" },
];

export const weeklyTrend = Array.from({ length: 7 }, (_, i) => {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return { day: days[i], incidents: Math.floor(30 + Math.random() * 40), resolved: Math.floor(25 + Math.random() * 35) };
});

export const priorityColor = {
  critical: "neon-red",
  high: "neon-amber",
  medium: "neon-blue",
  low: "neon-emerald",
} as const;

export const statusColor = {
  open: "neon-amber",
  assigned: "neon-blue",
  "in-progress": "neon-blue",
  resolved: "neon-emerald",
} as const;
