import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import CommandCenter from "./pages/CommandCenter";
import IntelligenceHub from "./pages/IntelligenceHub";
import CitizenReport from "./pages/CitizenReport";
import DriverHUD from "./pages/DriverHUD";
import Escalation from "./pages/Escalation";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import DispatchSystem from "./pages/DispatchSystem";
import ReportsArchive from "./pages/ReportsArchive";
import PublicArchive from "./pages/PublicArchive";
import ComplaintTracker from "./pages/ComplaintTracker";
import PublicComplaintDetail from "./pages/PublicComplaintDetail";
import NotFound from "./pages/NotFound";

import { ProtectedRoute } from "./components/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Landing />} />
          <Route path="/complaint" element={<CitizenReport />} />
          <Route path="/archive" element={<PublicArchive />} />
          <Route path="/archive/:id" element={<PublicComplaintDetail />} />
          <Route path="/track" element={<ComplaintTracker />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          {/* Protected Application Routes */}
          <Route element={<ProtectedRoute allowedRoles={["worker", "admin"]} />}>
            <Route path="/app" element={<AppLayout><CommandCenter /></AppLayout>} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
            <Route path="/app/intelligence" element={<AppLayout><IntelligenceHub /></AppLayout>} />
            <Route path="/app/dispatch" element={<AppLayout><DispatchSystem /></AppLayout>} />
            <Route path="/app/archive" element={<AppLayout><ReportsArchive /></AppLayout>} />
            <Route path="/app/escalation" element={<AppLayout><Escalation /></AppLayout>} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={["worker"]} />}>
            <Route path="/app/driver" element={<AppLayout><DriverHUD /></AppLayout>} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
