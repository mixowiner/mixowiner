import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Router as WouterRouter, Route, Switch } from 'wouter';
import GamePage from './pages/game';

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL}>
        <Switch>
          <Route path="/" component={GamePage} />
          <Route>
            <div className="flex h-[100dvh] items-center justify-center bg-background text-foreground font-sans">
              <h1 className="text-2xl font-bold">404 - Not Found</h1>
            </div>
          </Route>
        </Switch>
      </WouterRouter>
    </QueryClientProvider>
  );
}
