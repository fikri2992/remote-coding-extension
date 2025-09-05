import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';

// Import route components
import HomePage from './pages/HomePage.tsx';
import ServerPage from './pages/ServerPage.tsx';
import FilesPage from './pages/FilesPage.tsx';
import FileViewerPage from './pages/FileViewerPage.tsx';
import GitPage from './pages/GitPage.tsx';
import EnhancedTerminalPage from './pages/EnhancedTerminalPage.tsx';
import ChatPage from './pages/ChatPage.tsx';
import SettingsPage from './pages/SettingsPage.tsx';
import { TunnelManagerPage } from './pages/TunnelManagerPage.tsx';
import RootLayout from './layouts/RootLayout.tsx';

// Create a root route
const rootRoute = createRootRoute({
  component: RootLayout,
});

// Create index route
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
});

// Create other routes
const serverRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/server',
  component: ServerPage,
});

const filesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/files',
  component: FilesPage,
});

const gitRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/git',
  component: GitPage,
});

const terminalRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/terminal',
  component: EnhancedTerminalPage,
});

const chatRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/chat',
  component: ChatPage,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: SettingsPage,
});

// File viewer route with search param (?path=/...)
const fileViewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/files/view',
  component: FileViewerPage,
});

const tunnelsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tunnels',
  component: TunnelManagerPage,
});

// Create the route tree
const routeTree = rootRoute.addChildren([
  indexRoute,
  serverRoute,
  tunnelsRoute,
  filesRoute,
  fileViewRoute,
  gitRoute,
  terminalRoute,
  chatRoute,
  settingsRoute,
]);

// Create the router
export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
});

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
