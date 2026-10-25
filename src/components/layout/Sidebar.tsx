import React from 'react';
import {
  LayoutDashboard, UserCheck, Kanban, ListTodo, TableProperties,
  Calendar, BarChart3, Clock, Rocket, FolderKanban, Users, Sliders, Plus, Lock, Zap, Layers
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUiControls } from '../../context/UiControlsContext';
import { useDevContextMenu } from '../common/DevContextMenu';
import { useToast } from '../../context/ToastContext';
import { Project } from '../../types';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  projects: Project[];
  currentProject: Project | null;
  onSelectProject: (p: Project) => void;
  onOpenCreateProject?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  projects,
  currentProject,
  onSelectProject,
  onOpenCreateProject,
}) => {
  const { user } = useAuth();
  const { isPageEnabled, isButtonEnabled, toggleControl } = useUiControls();
  const { openContextMenu } = useDevContextMenu();
  const { success } = useToast();

  const isDevSession = Boolean(
    user && (user.isDevConsole || user.portalMode === 'developer_console' || user.sessionType === 'developer_console' || user.role === 'developer_console_admin')
  );

  const mainNavItems = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { key: 'my_work', label: 'My Work', icon: UserCheck },
    { key: 'board', label: 'Board', icon: Kanban },
    { key: 'backlog', label: 'Backlog', icon: ListTodo },
    { key: 'list_view', label: 'List View', icon: TableProperties },
    { key: 'timeline', label: 'Timeline', icon: Clock },
    { key: 'calendar', label: 'Calendar', icon: Calendar },
    { key: 'reports', label: 'Reports', icon: BarChart3 },
    { key: 'sprints', label: 'Sprints', icon: Rocket },
  ];

  // For normal users: only show enabled pages
  // For developer: show all so developer can view and control in destination place
  const navItemsToDisplay = isDevSession
    ? mainNavItems
    : mainNavItems.filter(item => isPageEnabled('page_' + item.key));

  const showProjects = isDevSession || isPageEnabled('page_projects');
  const isProjectsEnabled = isPageEnabled('page_projects');

  const showTeams = isDevSession || isPageEnabled('page_teams');
  const isTeamsEnabled = isPageEnabled('page_teams');

  const showSettings = isDevSession || isPageEnabled('page_settings');
  const isSettingsEnabled = isPageEnabled('page_settings');

  const showAddProjectBtn = isDevSession || isButtonEnabled('btn_create_project');
  const isAddProjectBtnEnabled = isButtonEnabled('btn_create_project');

  return (
    <aside className="w-60 border-r border-theme-border bg-theme-surface flex flex-col shrink-0 select-none overflow-y-auto">
      {/* Current Project Info Bar */}
      {currentProject ? (
        <div className="p-3 border-b border-theme-border/60 flex items-center justify-between">
          <div
            onClick={() => onNavigate('project_detail')}
            className="flex items-center gap-2.5 min-w-0 cursor-pointer group"
          >
            <div className="w-7 h-7 rounded-lg bg-theme-primary/15 border border-theme-primary/30 text-theme-primary font-bold text-xs flex items-center justify-center shrink-0 group-hover:border-theme-primary transition">
              {currentProject.key.substring(0, 2)}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-theme-text truncate leading-tight group-hover:text-theme-primary transition">
                {currentProject.name}
              </div>
              <div className="text-[10px] text-theme-muted font-mono">
                {currentProject.key} • Software
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-3 border-b border-theme-border/60 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-theme-muted">
            <div className="w-6 h-6 rounded-lg bg-theme-primary/10 text-theme-primary flex items-center justify-center">
              <Layers className="w-3.5 h-3.5" />
            </div>
            <span className="font-semibold text-theme-text text-[11px]">No Project Active</span>
          </div>
          {showAddProjectBtn && onOpenCreateProject && (
            <button
              onClick={onOpenCreateProject}
              className="px-2 py-1 rounded-lg bg-theme-primary/10 hover:bg-theme-primary/20 text-theme-primary text-[10px] font-bold transition cursor-pointer"
            >
              + Project
            </button>
          )}
        </div>
      )}

      {/* Main Views Navigation */}
      <div className="p-2 space-y-0.5">
        <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-theme-muted flex items-center justify-between">
          <span>Views & Planning</span>
          {isDevSession && (
            <span className="text-[9px] font-mono text-cyan-400 font-normal">Right-Click to Manage</span>
          )}
        </div>
        {navItemsToDisplay.map(item => {
          const Icon = item.icon;
          const isEnabled = isPageEnabled('page_' + item.key);
          const isActive = currentView === item.key;

          if (!isEnabled && !isDevSession) return null;

          return (
            <div
              key={item.key}
              data-dev-id={'page_' + item.key}
              data-dev-name={item.label + ' Page'}
              data-dev-type="page"
              data-dev-location="Sidebar Navigation"
              onContextMenu={(e) => {
                if (isDevSession) {
                  e.preventDefault();
                  e.stopPropagation();
                  openContextMenu({
                    x: e.clientX,
                    y: e.clientY,
                    elementId: 'page_' + item.key,
                    name: item.label + ' Page',
                    type: 'page',
                    location: 'Sidebar Navigation',
                  });
                }
              }}
              className="flex items-center group/nav-item relative"
            >
              <button
                onClick={() => onNavigate(item.key)}
                className={`flex-1 flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                  !isEnabled
                    ? 'ring-1 ring-amber-500/50 bg-amber-500/5 text-amber-200'
                    : isActive
                    ? 'bg-theme-primary/10 text-theme-primary font-semibold'
                    : 'text-theme-muted hover:text-theme-text hover:bg-theme-surface-hover'
                }`}
                title={isDevSession ? `${item.label} Page (Right-click to manage in Developer Console)` : item.label}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon className={`w-4 h-4 shrink-0 ${!isEnabled ? 'text-amber-400' : isActive ? 'text-theme-primary' : 'opacity-70'}`} />
                  <span className="truncate">{item.label}</span>
                </div>
                {!isEnabled && isDevSession && (
                  <span className="text-[8px] font-extrabold px-1 py-0.5 rounded bg-amber-500 text-slate-950 uppercase tracking-wider">
                    DEV ONLY
                  </span>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Projects Section with In-Place Authority Controls */}
      {showProjects && (
        <div
          data-dev-id="page_projects"
          data-dev-name="Projects Section"
          data-dev-type="section"
          data-dev-location="Sidebar"
          onContextMenu={(e) => {
            if (isDevSession) {
              e.preventDefault();
              e.stopPropagation();
              openContextMenu({
                x: e.clientX,
                y: e.clientY,
                elementId: 'page_projects',
                name: 'Projects Section',
                type: 'section',
                location: 'Sidebar',
              });
            }
          }}
          className="p-2 border-t border-theme-border/60 space-y-0.5"
        >
          <div className="flex items-center justify-between px-3 py-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-theme-muted">Projects</span>
              {!isProjectsEnabled && isDevSession && (
                <span className="text-[8px] font-extrabold px-1 py-0.2 rounded bg-amber-500 text-slate-950 uppercase tracking-wider">
                  DEV
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {showAddProjectBtn && onOpenCreateProject && (
                <button
                  onClick={onOpenCreateProject}
                  data-dev-id="btn_create_project"
                  data-dev-name="+ Project Button"
                  data-dev-type="button"
                  data-dev-location="Sidebar Projects"
                  onContextMenu={(e) => {
                    if (isDevSession) {
                      e.preventDefault();
                      e.stopPropagation();
                      openContextMenu({
                        x: e.clientX,
                        y: e.clientY,
                        elementId: 'btn_create_project',
                        name: '+ Project Button',
                        type: 'button',
                        location: 'Sidebar Projects',
                      });
                    }
                  }}
                  title="Create New Project (Right-click to manage)"
                  className={`p-1 rounded transition flex items-center justify-center cursor-pointer ${
                    !isAddProjectBtnEnabled
                      ? 'ring-1 ring-amber-500/60 bg-amber-500/10 text-amber-300'
                      : 'bg-theme-primary/10 hover:bg-theme-primary/20 text-theme-primary'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                </button>
              )}
              <button
                onClick={() => onNavigate('projects')}
                className="text-[10px] text-theme-muted hover:text-theme-primary transition"
              >
                All
              </button>
            </div>
          </div>

          {projects.slice(0, 6).map(p => {
            const isSelected = currentProject?.id === p.id;
            return (
              <button
                key={p.id}
                onClick={() => {
                  onSelectProject(p);
                  if (['projects', 'dashboard'].includes(currentView)) {
                    onNavigate('board');
                  }
                }}
                className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition ${
                  isSelected
                    ? 'bg-theme-surface-active text-theme-text font-medium'
                    : 'text-theme-muted hover:text-theme-text hover:bg-theme-surface-hover'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={`w-4 h-4 rounded text-[9px] font-bold flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-theme-primary text-slate-950' : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {p.key[0]}
                  </div>
                  <span className="truncate">{p.name}</span>
                </div>
                {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-theme-primary" />}
              </button>
            );
          })}

          {projects.length === 0 && (
            <div className="px-3 py-3 text-center space-y-2 border border-dashed border-theme-border/60 rounded-xl my-1 bg-theme-bg/40">
              <p className="text-[11px] text-theme-muted">No projects created yet</p>
              {showAddProjectBtn && onOpenCreateProject && (
                <button
                  onClick={onOpenCreateProject}
                  className="w-full py-1.5 px-2 rounded-lg bg-theme-primary/10 hover:bg-theme-primary/20 text-theme-primary text-[11px] font-bold flex items-center justify-center gap-1 transition cursor-pointer"
                >
                  <Plus className="w-3 h-3 stroke-[2.5]" />
                  <span>+ Create Project</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Administration & Settings (Bottom Pinned) */}
      <div className="mt-auto p-2 border-t border-theme-border/60 space-y-0.5">
        {showTeams && (
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                if (!isTeamsEnabled && isDevSession) {
                  success('Turned OFF in Developer Console', `Teams page is turned OFF for users. Click '⚡ Turn ON' to use it.`);
                  return;
                }
                onNavigate('teams');
              }}
              data-dev-id="page_teams"
              data-dev-name="Teams Page"
              data-dev-type="page"
              data-dev-location="Sidebar Navigation"
              onContextMenu={(e) => {
                if (isDevSession) {
                  e.preventDefault();
                  e.stopPropagation();
                  openContextMenu({
                    x: e.clientX,
                    y: e.clientY,
                    elementId: 'page_teams',
                    name: 'Teams Page',
                    type: 'page',
                    location: 'Sidebar Navigation',
                  });
                }
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                !isTeamsEnabled
                  ? 'ring-1 ring-amber-500/50 bg-amber-500/5 text-amber-200'
                  : currentView === 'teams'
                  ? 'bg-theme-primary/10 text-theme-primary'
                  : 'text-theme-muted hover:text-theme-text hover:bg-theme-surface-hover'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Users className="w-4 h-4 opacity-70" />
                <span>Teams</span>
              </div>
              {!isTeamsEnabled && isDevSession && (
                <span className="text-[8px] font-extrabold px-1 py-0.5 rounded bg-amber-500 text-slate-950 uppercase tracking-wider">
                  DEV ONLY
                </span>
              )}
            </button>
          </div>
        )}

        {showSettings && (
          <div className="flex items-center justify-between">
            <button
              onClick={() => onNavigate('settings')}
              data-dev-id="page_settings"
              data-dev-name="Settings Page"
              data-dev-type="page"
              data-dev-location="Sidebar Navigation"
              onContextMenu={(e) => {
                if (isDevSession) {
                  e.preventDefault();
                  e.stopPropagation();
                  openContextMenu({
                    x: e.clientX,
                    y: e.clientY,
                    elementId: 'page_settings',
                    name: 'Settings Page',
                    type: 'page',
                    location: 'Sidebar Navigation',
                  });
                }
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                !isSettingsEnabled
                  ? 'ring-1 ring-amber-500/50 bg-amber-500/5 text-amber-200'
                  : currentView === 'settings'
                  ? 'bg-theme-primary/10 text-theme-primary'
                  : 'text-theme-muted hover:text-theme-text hover:bg-theme-surface-hover'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Sliders className="w-4 h-4 opacity-70" />
                <span>Settings</span>
              </div>
              {!isSettingsEnabled && isDevSession && (
                <span className="text-[8px] font-extrabold px-1 py-0.5 rounded bg-amber-500 text-slate-950 uppercase tracking-wider">
                  DEV ONLY
                </span>
              )}
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
export default Sidebar;
