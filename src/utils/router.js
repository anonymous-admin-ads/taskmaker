export const VIEW_TO_PATH = {
  dashboard: '/dashboard',
  board: '/board',
  backlog: '/backlog',
  list_view: '/list',
  timeline: '/timeline',
  calendar: '/calendar',
  reports: '/reports',
  sprints: '/sprints',
  projects: '/projects',
  project_detail: '/project-detail',
  teams: '/teams',
  my_work: '/my-work',
  settings: '/settings',
  developer_console: '/godmode',
  godmode: '/godmode',
  login: '/login',
  signup: '/signup',
};

export const PATH_TO_VIEW = {
  '/': 'dashboard',
  '/dashboard': 'dashboard',
  '/board': 'board',
  '/backlog': 'backlog',
  '/list': 'list_view',
  '/list_view': 'list_view',
  '/list-view': 'list_view',
  '/timeline': 'timeline',
  '/calendar': 'calendar',
  '/reports': 'reports',
  '/sprints': 'sprints',
  '/projects': 'projects',
  '/project-detail': 'project_detail',
  '/project_detail': 'project_detail',
  '/teams': 'teams',
  '/my-work': 'my_work',
  '/my_work': 'my_work',
  '/settings': 'settings',
  '/godmode': 'developer_console',
  '/god-mode': 'developer_console',
  '/developer-console': 'developer_console',
  '/developer_console': 'developer_console',
  '/dev-console': 'developer_console',
  '/login': 'login',
  '/signup': 'signup',
};

export function getPathForView(view) {
  if (VIEW_TO_PATH[view]) return VIEW_TO_PATH[view];
  return `/${view.replace(/_/g, '-')}`;
}

export function getViewFromPath(pathname) {
  const clean = (pathname || '/').replace(/\/+$/, '') || '/';

  if (clean === '/signup') {
    return { view: 'signup', isAuth: 'signup' };
  }
  if (clean === '/login') {
    return { view: 'login', isAuth: 'login' };
  }
  if (clean === '/godmode' || clean === '/god-mode' || clean === '/developer-console' || clean === '/dev-console' || clean === '/developer_console') {
    return { view: 'developer_console', isDevConsole: true, isGodMode: true };
  }

  const mapped = PATH_TO_VIEW[clean];
  if (mapped) {
    return { view: mapped };
  }

  const stripped = clean.replace(/^\//, '').replace(/-/g, '_');
  return { view: stripped || 'dashboard' };
}

export function updateUrl(pathOrView, replace = false) {
  if (typeof window === 'undefined') return;
  const targetPath = pathOrView.startsWith('/') ? pathOrView : getPathForView(pathOrView);
  if (window.location.pathname !== targetPath) {
    if (replace) {
      window.history.replaceState({ path: targetPath }, '', targetPath);
    } else {
      window.history.pushState({ path: targetPath }, '', targetPath);
    }
  }
}

