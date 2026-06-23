import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Watch from "./pages/Watch";
import Browse from "./pages/Browse";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/watch/:id" component={Watch} />
      <Route path="/trending">{() => <Browse variant="trending" />}</Route>
      <Route path="/search">{() => <Browse variant="search" />}</Route>
      <Route path="/schedule">{() => <Browse variant="schedule" />}</Route>
      <Route path="/watchlist">{() => <Browse variant="watchlist" />}</Route>
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
