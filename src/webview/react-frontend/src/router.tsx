import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';

// Import route components
import HomePage from './pages/HomePage.tsx';
import ServerPage from './pages/ServerPage.tsx';
import FilesPage from './pages/FilesPage.tsx';
import FileViewerPage from './pages/FileViewerPage.tsx';
import GitPage from './pages/GitPage.tsx';
import TerminalPage from './pages/TerminalPage.tsx';
import ChatTerminalPage from './pages/ChatTerminalPage.tsx';
import ChatPage from './pages/ChatPage.tsx';
import SettingsPage from './pages/SettingsPage.tsx';
import { TunnelManagerPage } from './pages/TunnelManagerPage.tsx';
import ACPPage from './pages/ACPPage.tsx';

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
  component: TerminalPage,
});

const chatTerminalRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/chat-terminal',
  component: ChatTerminalPage,
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

const acpRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/acp',
  component: ACPPage,
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
  chatTerminalRoute,
  chatRoute,
  settingsRoute,
  acpRoute,
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
