import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';

// Import route components
import ServerPage from './pages/ServerPage.tsx';
import FilesPage from './pages/FilesPage.tsx';
import FileViewerPage from './pages/FileViewerPage.tsx';
import GitPage from './pages/GitPage.tsx';
import TerminalPage from './pages/TerminalPage.tsx';
import ChatTerminalPage from './pages/ChatTerminalPage.tsx';
import ChatPage from './pages/ChatPage.tsx';
import HomePage from './pages/HomePage.tsx';
import SettingsPage from './pages/SettingsPage.tsx';
import { TunnelManagerPage } from './pages/TunnelManagerPage.tsx';
import { TunnelDetailsPage } from './pages/TunnelDetailsPage.tsx';
import ACPPage from './pages/ACPPage.tsx';
import TerminalCommandsPage from './pages/TerminalCommandsPage.tsx';

import RootLayout from './layouts/RootLayout.tsx';
import React from 'react';

// Create a root route
const rootRoute = createRootRoute({
  component: RootLayout,
});

// Create index route (redirect to "/claude")
const RedirectToClaude: React.FC = () => {
  React.useEffect(() => {
    try { window.history.replaceState({}, '', '/claude'); window.dispatchEvent(new PopStateEvent('popstate')); }
    catch { window.location.replace('/claude'); }
  }, []);
  return null;
};

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: RedirectToClaude,
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

const terminalCommandsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/terminal-commands',
  component: TerminalCommandsPage,
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

// Gemini route: same ACP UI, Gemini CLI defaults/preset applied in-page
const geminiRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/gemini',
  component: ChatPage,
});

// Claude alias route for clarity
const claudeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/claude',
  component: ChatPage,
});

// Standalone homepage route for testing (not linked in menu)
const homepageRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/homepage',
  component: HomePage,
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

const tunnelDetailsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tunnels/$id',
  component: TunnelDetailsPage,
});



// Create the route tree
const routeTree = rootRoute.addChildren([
  indexRoute,
  serverRoute,
  tunnelsRoute,
  tunnelDetailsRoute,
  filesRoute,
  fileViewRoute,
  gitRoute,
  terminalRoute,
  terminalCommandsRoute,
  chatTerminalRoute,
  chatRoute,
  settingsRoute,
  acpRoute,
  claudeRoute,
  geminiRoute,
  homepageRoute,
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
