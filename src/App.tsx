import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { useTheme } from './context/ThemeContext';
import { useToast } from './context/ToastContext';
import { useUiControls } from './context/UiControlsContext';
import { api } from './api/client';
import { Project, Ticket, User } from './types';
import { Shield, AlertTriangle, ArrowRight, Home, Lock } from 'lucide-react';

// Layout
import { TopNav } from './components/layout/TopNav';
import { Sidebar } from './components/layout/Sidebar';

// Views
import { DashboardView } from './components/views/DashboardView';
import { KanbanBoard } from './components/kanban/KanbanBoard';
import { BacklogView } from './components/views/BacklogView';
import { ListView } from './components/views/ListView';
import { TimelineView } from './components/views/TimelineView';
import { CalendarView } from './components/views/CalendarView';
import { ReportsView } from './components/views/ReportsView';
import { SprintsView } from './components/views/SprintsView';
import { ProjectsView } from './components/views/ProjectsView';
import { ProjectDetailView } from './components/views/ProjectDetailView';
import { TeamsView } from './components/views/TeamsView';
import { MyWorkView } from './components/views/MyWorkView';
import { SettingsView } from './components/views/SettingsView';
import { DeveloperConsoleView } from './components/views/DeveloperConsoleView';
import { DevContextMenuProvider } from './components/common/DevContextMenu';

// Auth
import { LoginPage } from './components/auth/LoginPage';
import { SignUpPage } from './components/auth/SignUpPage';

// Modals
import { CreateTicketModal } from './components/modals/CreateTicketModal';
import { CreateProjectModal } from './components/modals/CreateProjectModal';
import { TicketDetailModal } from './components/modals/TicketDetailModal';

// Routing & URL Synchronization
import { getPathForView, getViewFromPath, updateUrl } from './utils/router';

const VIEW_TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  board: 'Kanban Board',
  backlog: 'Backlog Planning',
  list_view: 'List View',
  timeline: 'Timeline Roadmap',
  calendar: 'Calendar Schedule',
  reports: 'Reports & Analytics',
  sprints: 'Sprints Management',
  projects: 'Projects Directory',
  project_detail: 'Project Details',
  teams: 'Teams & Departments',
  my_work: 'My Work',
  settings: 'Settings & Preferences',
  developer_console: 'Developer Console (God Mode)',
  godmode: 'Developer Console (God Mode)',
  login: 'Sign In',
  signup: 'Create Account',
};

export const App: React.FC = () => {
  const { user, loading, logout } = useAuth();
  const { success, error } = useToast();
  const { isPageEnabled, refreshControls, toggleControl } = useUiControls();

  const initialRoute = getViewFromPath(window.location.pathname);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>(initialRoute.isAuth === 'signup' ? 'signup' : 'login');
  const [isGodModeLogin, setIsGodModeLogin] = useState<boolean>(Boolean(initialRoute.isGodMode));
  const [loginPortalMode, setLoginPortalMode] = useState<'workspace' | 'developer_console'>(
    initialRoute.isGodMode || initialRoute.isDevConsole ? 'developer_console' : 'workspace'
  );
  const [currentView, setCurrentView] = useState<string>(
    initialRoute.view && initialRoute.view !== 'login' && initialRoute.view !== 'signup' ? initialRoute.view : 'dashboard'
  );
  const [devMode, setDevMode] = useState<'console' | 'suite'>(
    initialRoute.isDevConsole && initialRoute.view !== 'developer_console' ? 'suite' : 'console'
  );

  const isDevConsoleSession = Boolean(
    user && (user.isDevConsole || user.portalMode === 'developer_console' || user.sessionType === 'developer_console' || user.role === 'developer_console_admin')
  );

  // Application Data States
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  // Modals state
  const [showCreateTicketModal, setShowCreateTicketModal] = useState(false);
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);

  const loadInitialData = async () => {
    if (!user) return;
    if (isDevConsoleSession && devMode !== 'suite') return;
    try {
      const [projRes, usersRes] = await Promise.all([
        api.getProjects('Active'),
        api.getAdminUsers().catch(() => ({ users: [] })),
      ]);

      const projList = projRes.projects || [];
      setProjects(projList);
      if (projList.length > 0 && !currentProject) {
        setCurrentProject(projList[0]);
      }
      setUsers(usersRes.users || []);
    } catch (e) {}
  };

  const loadTickets = async () => {
    if (!user) return;
    if (isDevConsoleSession && devMode !== 'suite') return;
    try {
      const res = await api.getTickets({
        projectId: currentProject?.id || undefined,
      });
      setTickets(res.tickets || []);
    } catch (e) {}
  };

  // Real-time Multi-User Live Synchronization (SSE + Revision Polling Fallback)
  useEffect(() => {
    let sseSource: EventSource | null = null;
    let pollInterval: any = null;
    let lastRevision = 0;

    const syncHandler = (data?: any) => {
      loadTickets();
      loadInitialData();
      refreshControls();
      window.dispatchEvent(new CustomEvent('taskflow:sync', { detail: data }));
    };

    try {
      sseSource = new EventSource('/api/sync/events');

      sseSource.addEventListener('change', (e: MessageEvent) => {
        try {
          const parsed = JSON.parse(e.data);
          if (parsed.revision && parsed.revision !== lastRevision) {
            lastRevision = parsed.revision;
            syncHandler(parsed);
          }
        } catch {
          syncHandler();
        }
      });

      sseSource.addEventListener('tickets', () => {
        loadTickets();
        window.dispatchEvent(new CustomEvent('taskflow:sync', { detail: { entity: 'tickets' } }));
      });

      sseSource.addEventListener('projects', () => {
        loadInitialData();
        window.dispatchEvent(new CustomEvent('taskflow:sync', { detail: { entity: 'projects' } }));
      });

      sseSource.addEventListener('ui_controls', () => {
        refreshControls();
        window.dispatchEvent(new CustomEvent('taskflow:sync', { detail: { entity: 'ui_controls' } }));
      });

      sseSource.addEventListener('users', () => {
        loadInitialData();
        window.dispatchEvent(new CustomEvent('taskflow:sync', { detail: { entity: 'users' } }));
      });
    } catch {
      // SSE fallback
    }

    const checkRevision = async () => {
      try {
        const res = await api.getSyncState();
        if (res && res.revision && res.revision > lastRevision) {
          const isInitial = lastRevision === 0;
          lastRevision = res.revision;
          if (!isInitial) {
            syncHandler(res);
          }
        }
      } catch {}
    };

    checkRevision();
    pollInterval = setInterval(checkRevision, 3000);

    const handleFocus = () => {
      checkRevision();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      if (sseSource) sseSource.close();
      if (pollInterval) clearInterval(pollInterval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [user, currentProject?.id]);

  useEffect(() => {
    if (user && (!isDevConsoleSession || devMode === 'suite')) {
      loadInitialData();
    }
  }, [user, isDevConsoleSession, devMode]);

  useEffect(() => {
    if (user && (!isDevConsoleSession || devMode === 'suite') && currentProject) {
      loadTickets();
    }
  }, [user, isDevConsoleSession, devMode, currentProject?.id]);

  const handleCreateTicket = async (data: any) => {
    try {
      const res = await api.createTicket(data);
      success('Ticket Created', `Created ${res.ticket.key}`);
      loadTickets();
    } catch (err: any) {
      error('Creation Failed', err.message);
      throw err;
    }
  };

  const handleCreateProject = async (data: any) => {
    try {
      const res = await api.createProject(data);
      success('Project Created', `Created ${res.project.name} (${res.project.key})`);
      loadInitialData();
    } catch (err: any) {
      error('Creation Failed', err.message);
      throw err;
    }
  };

  const handleNavigate = (view: string, replace = false) => {
    setCurrentView(view);
    const targetPath = getPathForView(view);
    updateUrl(targetPath, replace);
    document.title = `${VIEW_TITLES[view] || 'Workspace'} - TaskFlow`;
    if (isDevConsoleSession) {
      if (view === 'developer_console') {
        setDevMode('console');
      } else {
        setDevMode('suite');
      }
    }
  };

  const handleLogout = async () => {
    await logout();
    setAuthMode('login');
    setIsGodModeLogin(false);
    setLoginPortalMode('workspace');
    updateUrl('/login');
    document.title = 'Sign In - TaskFlow';
  };

  // Sync URL on initial mount and when auth loading resolves
  useEffect(() => {
    if (loading) return;

    const currentRoute = getViewFromPath(window.location.pathname);

    if (!user) {
      // Unauthenticated state
      if (currentRoute.isAuth === 'signup') {
        setAuthMode('signup');
        setIsGodModeLogin(false);
        updateUrl('/signup', true);
        document.title = 'Create Account - TaskFlow';
      } else if (currentRoute.isGodMode) {
        setAuthMode('login');
        setIsGodModeLogin(true);
        setLoginPortalMode('developer_console');
        updateUrl('/godmode', true);
        document.title = 'Developer Console (God Mode) Login - TaskFlow';
      } else {
        setAuthMode('login');
        setIsGodModeLogin(false);
        setLoginPortalMode('workspace');
        if (window.location.pathname !== '/' && window.location.pathname !== '/login') {
          sessionStorage.setItem('taskflow_redirect_path', window.location.pathname);
        }
        updateUrl('/login', true);
        document.title = 'Sign In - TaskFlow';
      }
    } else {
      // Authenticated state
      if (isDevConsoleSession) {
        if (window.location.pathname === '/godmode' || window.location.pathname === '/god-mode' || window.location.pathname === '/developer-console' || window.location.pathname === '/' || window.location.pathname === '/login') {
          setDevMode('console');
          updateUrl('/godmode', true);
          document.title = 'Developer Console (God Mode) - TaskFlow';
        } else if (currentRoute.view && currentRoute.view !== 'login' && currentRoute.view !== 'signup') {
          setDevMode('suite');
          setCurrentView(currentRoute.view);
          updateUrl(getPathForView(currentRoute.view), true);
          document.title = `${VIEW_TITLES[currentRoute.view] || 'Workspace'} - TaskFlow`;
        }
      } else {
        // Normal user
        const savedRedirect = sessionStorage.getItem('taskflow_redirect_path');
        if (savedRedirect) {
          sessionStorage.removeItem('taskflow_redirect_path');
          const target = getViewFromPath(savedRedirect);
          if (target.view && target.view !== 'login' && target.view !== 'signup' && target.view !== 'developer_console') {
            setCurrentView(target.view);
            updateUrl(getPathForView(target.view), true);
            document.title = `${VIEW_TITLES[target.view] || 'Workspace'} - TaskFlow`;
            return;
          }
        }

        if (window.location.pathname === '/' || window.location.pathname === '/login' || window.location.pathname === '/signup' || window.location.pathname === '/godmode' || window.location.pathname === '/god-mode') {
          setCurrentView('dashboard');
          updateUrl('/dashboard', true);
          document.title = 'Dashboard - TaskFlow';
        } else if (currentRoute.view === 'developer_console') {
          setCurrentView('dashboard');
          updateUrl('/dashboard', true);
          document.title = 'Dashboard - TaskFlow';
        } else if (currentRoute.view) {
          setCurrentView(currentRoute.view);
          updateUrl(getPathForView(currentRoute.view), true);
          document.title = `${VIEW_TITLES[currentRoute.view] || 'Workspace'} - TaskFlow`;
        }
      }
    }
  }, [loading, user, isDevConsoleSession]);

  // Handle browser Back / Forward (popstate) navigation
  useEffect(() => {
    const handlePopState = () => {
      const parsed = getViewFromPath(window.location.pathname);
      if (!user) {
        if (parsed.isAuth === 'signup') {
          setAuthMode('signup');
          setIsGodModeLogin(false);
          document.title = 'Create Account - TaskFlow';
        } else if (parsed.isGodMode) {
          setAuthMode('login');
          setIsGodModeLogin(true);
          setLoginPortalMode('developer_console');
          document.title = 'Developer Console (God Mode) Login - TaskFlow';
        } else {
          setAuthMode('login');
          setIsGodModeLogin(false);
          setLoginPortalMode('workspace');
          document.title = 'Sign In - TaskFlow';
        }
      } else {
        if (isDevConsoleSession) {
          if (parsed.view === 'developer_console' || parsed.isGodMode) {
            setDevMode('console');
            document.title = 'Developer Console (God Mode) - TaskFlow';
          } else if (parsed.view) {
            setDevMode('suite');
            setCurrentView(parsed.view);
            document.title = `${VIEW_TITLES[parsed.view] || 'Workspace'} - TaskFlow`;
          }
        } else {
          if (parsed.view && parsed.view !== 'login' && parsed.view !== 'signup') {
            setCurrentView(parsed.view);
            document.title = `${VIEW_TITLES[parsed.view] || 'Workspace'} - TaskFlow`;
          }
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [user, isDevConsoleSession]);

  // Splash Loading
  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#0B0D12] text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-400 to-blue-500 animate-spin flex items-center justify-center" />
          <span className="font-semibold text-xs tracking-wider text-cyan-400">Loading TaskFlow Workspace...</span>
        </div>
      </div>
    );
  }

  // Unauthenticated Flow
  if (!user) {
    return authMode === 'login' ? (
      <LoginPage
        initialPortalMode={isGodModeLogin ? 'developer_console' : 'workspace'}
        isGodModeRoute={isGodModeLogin}
        onExitGodMode={() => {
          setIsGodModeLogin(false);
          setLoginPortalMode('workspace');
          updateUrl('/login');
          document.title = 'Sign In - TaskFlow';
        }}
        onPortalModeChange={mode => {
          if (mode === 'developer_console') {
            setIsGodModeLogin(true);
            setLoginPortalMode('developer_console');
            updateUrl('/godmode');
            document.title = 'Developer Console (God Mode) Login - TaskFlow';
          } else {
            setIsGodModeLogin(false);
            setLoginPortalMode('workspace');
            updateUrl('/login');
            document.title = 'Sign In - TaskFlow';
          }
        }}
        onSwitchToSignUp={() => {
          setIsGodModeLogin(false);
          setAuthMode('signup');
          updateUrl('/signup');
          document.title = 'Create Account - TaskFlow';
        }}
      />
    ) : (
      <SignUpPage
        onSwitchToLogin={() => {
          setIsGodModeLogin(false);
          setAuthMode('login');
          updateUrl('/login');
          document.title = 'Sign In - TaskFlow';
        }}
      />
    );
  }

  // DEVELOPER CONSOLE AUTHENTICATED: ISOLATED CONSOLE PORTAL OR SUITE
  if (isDevConsoleSession && devMode === 'console') {
    return (
      <div className="h-screen w-screen flex flex-col bg-theme-bg text-theme-text overflow-hidden font-sans">
        <DeveloperConsoleView
          onSignOut={handleLogout}
          onLaunchAppSuite={() => {
            setDevMode('suite');
            handleNavigate('board');
          }}
        />
      </div>
    );
  }

  const isPageBlockedForUser =
    !isDevConsoleSession &&
    currentView !== 'developer_console' &&
    currentView !== 'project_detail' &&
    !isPageEnabled(currentView);

  return (
    <DevContextMenuProvider
      onNavigateToConsole={(elementId) => {
        setDevMode('console');
        updateUrl('/godmode');
        document.title = 'Developer Console (God Mode) - TaskFlow';
      }}
    >
      <div className="h-screen w-screen flex flex-col bg-theme-bg text-theme-text overflow-hidden font-sans">
      {/* Persistent Developer Suite Top Bar (When Developer tests/uses live application) */}
      {isDevConsoleSession && (
        <div className="h-9 bg-slate-950 border-b border-cyan-500/40 px-4 flex items-center justify-between text-xs text-cyan-300 font-medium shrink-0 z-50">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="font-bold text-cyan-200 uppercase tracking-wider text-[11px]">Developer Live App Suite (Root Privileges Active)</span>
            <span className="text-[10px] text-slate-400 border border-slate-800 px-1.5 py-0.5 rounded font-mono">devconsole@system.local</span>
          </div>
          <div className="flex items-center gap-2">
            {/* In-Place Destination Page Authority Switch */}
            {currentView !== 'developer_console' && currentView !== 'project_detail' && (
              <div className="flex items-center gap-1.5 mr-2 pl-2 border-l border-slate-800">
                <span className="text-[10px] text-slate-400 font-mono">Page '{currentView}':</span>
                {isPageEnabled(currentView) ? (
                  <button
                    onClick={() => {
                      const fullKey = currentView.startsWith('page_') ? currentView : `page_${currentView}`;
                      toggleControl(fullKey, false);
                      success('Developer UI Authority', `Turned OFF page '${currentView}'. Now hidden from normal users.`);
                    }}
                    title="Click to turn OFF this page for normal users"
                    className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-rose-500/25 hover:text-rose-300 transition cursor-pointer flex items-center gap-1"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>ON | Turn OFF Page</span>
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      const fullKey = currentView.startsWith('page_') ? currentView : `page_${currentView}`;
                      toggleControl(fullKey, true);
                      success('Developer UI Authority', `Turned ON page '${currentView}'. Now active and visible to all users.`);
                    }}
                    title="Click to turn ON this page to use it and make visible to all users"
                    className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/50 hover:bg-emerald-500/30 hover:text-emerald-200 transition cursor-pointer flex items-center gap-1 animate-pulse"
                  >
                    <Lock className="w-2.5 h-2.5 text-amber-400" />
                    <span>OFF | ⚡ Turn ON Page</span>
                  </button>
                )}
              </div>
            )}
            <button
              onClick={() => {
                setDevMode('console');
                updateUrl('/godmode');
                document.title = 'Developer Console (God Mode) - TaskFlow';
              }}
              className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 border border-cyan-500/40 text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <span>⚙️ Return to Developer Console</span>
            </button>
            <button
              onClick={handleLogout}
              className="px-2 py-1 rounded-md bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-[11px] font-semibold transition cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}

      {/* Top Global Navigation Bar */}
      <TopNav
        currentProject={currentProject}
        projects={projects}
        onSelectProject={p => setCurrentProject(p)}
        onOpenCreateTicket={() => setShowCreateTicketModal(true)}
        onOpenCreateProject={() => setShowCreateProjectModal(true)}
        onNavigate={view => handleNavigate(view)}
      />

      {/* Main Workspace Body: Sidebar + Active View */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          currentView={currentView}
          onNavigate={view => handleNavigate(view)}
          projects={projects}
          currentProject={currentProject}
          onSelectProject={p => setCurrentProject(p)}
          onOpenCreateProject={() => setShowCreateProjectModal(true)}
        />

        {/* View Switcher Container */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
          {/* Developer In-Place Notice: When viewing a page that is turned OFF for normal users */}
          {isDevConsoleSession && !isPageEnabled(currentView) && currentView !== 'developer_console' && currentView !== 'project_detail' && (
            <div className="bg-amber-950/60 border-b border-amber-500/30 px-6 py-2 flex items-center justify-between text-xs text-amber-200 shrink-0 z-20">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  <strong>Destination Page Authority:</strong> The <code className="bg-black/30 px-1 py-0.5 rounded text-amber-300 font-bold">{currentView}</code> page is turned OFF in Developer Console. Normal users cannot view or find it.
                </span>
              </div>
              <button
                onClick={() => {
                  const fullKey = currentView.startsWith('page_') ? currentView : `page_${currentView}`;
                  toggleControl(fullKey, true);
                  success('Developer Authority', `Turned ON page '${currentView}'. Now active and visible to all users.`);
                }}
                className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition cursor-pointer shadow-md flex items-center gap-1.5 shrink-0"
              >
                <span>⚡ Turn ON Page to Activate</span>
              </button>
            </div>
          )}

          {/* Developer Console UI Authority Guard: if page disabled by Developer Console for normal users */}
          {isPageBlockedForUser ? (
            <div className="flex-1 p-12 flex flex-col items-center justify-center text-center space-y-4 bg-theme-bg">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shadow-lg">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-theme-text">Page Disabled in Developer Console</h2>
                <p className="text-xs text-theme-muted max-w-md">
                  The <span className="font-mono text-amber-300 font-bold">{currentView}</span> page has been hidden from the workspace by system administrators using Developer Console UI Authority.
                </p>
              </div>
              <button
                onClick={() => handleNavigate('dashboard')}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-theme-primary text-slate-950 font-bold text-xs shadow-md hover:brightness-110 transition cursor-pointer"
              >
                <Home className="w-4 h-4" />
                <span>Return to Dashboard</span>
              </button>
            </div>
          ) : (
            <>
              {currentView === 'dashboard' && (
                <DashboardView
                  onNavigate={view => handleNavigate(view)}
                  onTicketClick={id => setSelectedTicketId(id)}
                  onOpenCreateProject={() => setShowCreateProjectModal(true)}
                  onOpenCreateTicket={() => setShowCreateTicketModal(true)}
                />
              )}

              {currentView === 'board' && (
                <KanbanBoard
                  project={currentProject}
                  tickets={tickets}
                  users={users}
                  onTicketClick={t => setSelectedTicketId(t.id)}
                  onOpenCreateTicket={() => setShowCreateTicketModal(true)}
                  onOpenCreateProject={() => setShowCreateProjectModal(true)}
                  onRefreshTickets={loadTickets}
                />
              )}

              {currentView === 'backlog' && (
                <BacklogView
                  project={currentProject}
                  tickets={tickets}
                  users={users}
                  onTicketClick={id => setSelectedTicketId(id)}
                  onOpenCreateTicket={() => setShowCreateTicketModal(true)}
                />
              )}

              {currentView === 'list_view' && (
                <ListView
                  tickets={tickets}
                  projects={projects}
                  users={users}
                  onTicketClick={id => setSelectedTicketId(id)}
                  onOpenCreateTicket={() => setShowCreateTicketModal(true)}
                />
              )}

              {currentView === 'timeline' && (
                <TimelineView
                  project={currentProject}
                  tickets={tickets}
                  users={users}
                  onTicketClick={id => setSelectedTicketId(id)}
                  onOpenCreateTicket={() => setShowCreateTicketModal(true)}
                />
              )}

              {currentView === 'calendar' && (
                <CalendarView
                  tickets={tickets}
                  onTicketClick={id => setSelectedTicketId(id)}
                />
              )}

              {currentView === 'reports' && (
                <ReportsView projects={projects} />
              )}

              {currentView === 'sprints' && (
                <SprintsView
                  project={currentProject}
                  tickets={tickets}
                  users={users}
                  onTicketClick={id => setSelectedTicketId(id)}
                  onOpenCreateTicket={() => setShowCreateTicketModal(true)}
                />
              )}

              {currentView === 'projects' && (
                <ProjectsView
                  projects={projects}
                  onSelectProject={p => {
                    setCurrentProject(p);
                    handleNavigate('board');
                  }}
                  onOpenCreateProject={() => setShowCreateProjectModal(true)}
                  onNavigate={view => handleNavigate(view)}
                  onRefreshProjects={loadInitialData}
                />
              )}

              {currentView === 'project_detail' && (
                <ProjectDetailView
                  project={currentProject}
                  onNavigate={view => handleNavigate(view)}
                  onRefreshProjects={loadInitialData}
                />
              )}

              {currentView === 'teams' && (
                <TeamsView />
              )}

              {currentView === 'my_work' && (
                <MyWorkView
                  tickets={tickets}
                  onTicketClick={id => setSelectedTicketId(id)}
                />
              )}

              {currentView === 'settings' && (
                <SettingsView />
              )}

              {currentView === 'developer_console' && !isDevConsoleSession && (
                <div className="flex-1 p-12 flex flex-col items-center justify-center text-center space-y-4 bg-theme-bg">
                  <div className="w-14 h-14 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center shadow-lg">
                    <Shield className="w-7 h-7" />
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-lg font-bold text-theme-text">Developer Console Restricted</h2>
                    <p className="text-xs text-theme-muted max-w-md">
                      The Developer Console is restricted exclusively to system administrators. Normal user accounts cannot access this portal.
                    </p>
                  </div>
                  <button
                    onClick={() => handleNavigate('dashboard')}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-theme-primary text-slate-950 font-bold text-xs shadow-md hover:brightness-110 transition cursor-pointer"
                  >
                    <Home className="w-4 h-4" />
                    <span>Return to Dashboard</span>
                  </button>
                </div>
              )}


            </>
          )}
        </main>
      </div>

      {/* Global Modals */}
      {showCreateTicketModal && (
        <CreateTicketModal
          projects={projects}
          users={users}
          defaultProjectId={currentProject?.id}
          projectTickets={tickets}
          onConfirm={handleCreateTicket}
          onClose={() => setShowCreateTicketModal(false)}
        />
      )}

      {showCreateProjectModal && (
        <CreateProjectModal
          onConfirm={handleCreateProject}
          onClose={() => setShowCreateProjectModal(false)}
        />
      )}

      {selectedTicketId !== null && (
        <TicketDetailModal
          ticketId={selectedTicketId}
          users={users}
          projectTickets={tickets}
          onClose={() => setSelectedTicketId(null)}
          onTicketUpdated={loadTickets}
        />
      )}
      </div>
    </DevContextMenuProvider>
  );
};

export default App;

