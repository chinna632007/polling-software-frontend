import Landing from "./pages/Landing.jsx";
import Login from "./pages/Login.jsx";
import Municipal from "./pages/Municipal.jsx";
import Panchayat from "./pages/Panchayat.jsx";
import Phase1 from "./pages/Phase1.jsx";
import Phase2 from "./pages/Phase2.jsx";
import Phase3 from "./pages/Phase3.jsx";
import Training from "./pages/Training.jsx";

function App() {
  const path = window.location.pathname;

  // Phase 1 – Excel eligible-list upload (dedicated page, shared by both types)
  if (path.startsWith("/elections/municipal/phase-1")) {
    return <Phase1 context="municipal" />;
  }
  if (path.startsWith("/elections/panchayat/phase-1")) {
    return <Phase1 context="panchayat" />;
  }

  // Phase 2 – Officer ranking & assignment (Presiding / Polling split)
  if (path.startsWith("/elections/municipal/phase-2")) {
    return <Phase2 context="municipal" />;
  }
  if (path.startsWith("/elections/panchayat/phase-2")) {
    return <Phase2 context="panchayat" />;
  }

  // Phase 3 – Ballot allocation (backend-driven)
  if (path.startsWith("/elections/municipal/phase-3")) {
    return <Phase3 context="municipal" />;
  }
  if (path.startsWith("/elections/panchayat/phase-3")) {
    return <Phase3 context="panchayat" />;
  }

  // Training – Time Scheduling (slot allocation, teams fetched from Phase 3)
  if (path.startsWith("/elections/municipal/training")) {
    return <Training context="municipal" />;
  }
  if (path.startsWith("/elections/panchayat/training")) {
    return <Training context="panchayat" />;
  }

  // Municipal elections pages
  if (path.startsWith("/elections/municipal")) {
    return <Municipal />;
  }

  // Panchayat (Gram Panchayat) elections pages
  if (path.startsWith("/elections/panchayat")) {
    return <Panchayat />;
  }

  // Public landing page, still reachable at /home
  if (path.startsWith("/home")) {
    return <Landing />;
  }

  // Default: open the login page first (also covers /login)
  return <Login />;
}

export default App;

