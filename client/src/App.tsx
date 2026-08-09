import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { useState } from "react";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import Intro from "./components/Intro";
import OnboardingTour from "./components/OnboardingTour";
import Admin from "./pages/Admin";
import { shouldShowIntro } from "./lib/intro";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Watch from "./pages/Watch";
import Browse from "./pages/Browse";
import History from "./pages/History";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/watch/:id" component={Watch} />
      <Route path="/trending">{() => <Browse variant="trending" />}</Route>
      <Route path="/search">{() => <Browse variant="search" />}</Route>
      <Route path="/schedule">{() => <Browse variant="schedule" />}</Route>
      <Route path="/watchlist">{() => <Browse variant="watchlist" />}</Route>
      <Route path="/history" component={History} />
        <Route path="/admin" component={Admin} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // Brand intro overlays the app on first visit of a session (configurable in
  // lib/intro.ts). The router keeps loading behind it, so the site is ready
  // the moment the intro finishes — no extra wait for the user.
  const [introVisible, setIntroVisible] = useState(() => shouldShowIntro());
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
          {introVisible && <Intro onDone={() => setIntroVisible(false)} />}
          {!introVisible && <OnboardingTour />}
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
