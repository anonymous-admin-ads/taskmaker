import React, { useState, useEffect } from 'react';
import {
  Shield, Users, Key, Sliders, Play, PauseCircle, Ban, History,
  Database, RefreshCw, AlertTriangle, CheckCircle2, Lock, Unlock, Plus, Trash2, GitBranch,
  Terminal, Eye, RotateCcw, Check, X, Layers, FolderPlus, ToggleLeft, ToggleRight, LogOut,
  Rocket, Edit3, Code, Zap, HardDrive, Laptop, Search, ArrowUpRight
} from 'lucide-react';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { useUiControls } from '../../context/UiControlsContext';

interface DeveloperConsoleViewProps {
  onSignOut?: () => void;
  onLaunchAppSuite?: () => void;
}

export const DeveloperConsoleView: React.FC<DeveloperConsoleViewProps> = ({
  onSignOut,
  onLaunchAppSuite,
}) => {
  const { success, error } = useToast();
  const { controls: uiControlsList, controlsMap, toggleControl, resetAllControls, bulkSetControls, refreshControls } = useUiControls();

  const [activeSection, setActiveSection] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [permsSubTab, setPermsSubTab] = useState<'marked_controls' | 'all_ui' | 'role_matrix'>('marked_controls');
  const [uiSearch, setUiSearch] = useState('');
  const [uiCategoryFilter, setUiCategoryFilter] = useState<'all' | 'topnav' | 'sidebar' | 'backlog' | 'kanban' | 'dashboard' | 'actions'>('all');

  // Data states for console sections
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [featureFlags, setFeatureFlags] = useState<any[]>([]);
  const [workflowConfig, setWorkflowConfig] = useState<any>(null);
  const [workflowRules, setWorkflowRules] = useState<any[]>([]);
  const [ruleExecutions, setRuleExecutions] = useState<any[]>([]);
  const [securityEvents, setSecurityEvents] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [backupHealth, setBackupHealth] = useState<any>(null);
  const [backupHistory, setBackupHistory] = useState<any[]>([]);
  const [restoreLogs, setRestoreLogs] = useState<any[]>([]);

  // Working Tools States
  // 1. User Management Modals
  const [userToDelete, setUserToDelete] = useState<any | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [userToEdit, setUserToEdit] = useState<any | null>(null);
  const [editUserName, setEditUserName] = useState('');
  const [editUserRole, setEditUserRole] = useState('');
  const [editUserStatus, setEditUserStatus] = useState('');
  const [isUpdatingUser, setIsUpdatingUser] = useState(false);

  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState('developer');
  const [newUserId, setNewUserId] = useState('');
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  const [userToResetPass, setUserToResetPass] = useState<any | null>(null);
  const [newPassVal, setNewPassVal] = useState('');
  const [isResettingPass, setIsResettingPass] = useState(false);

  // 2. Active Sessions
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  // 3. SQL Inspector Terminal
  const [sqlQuery, setSqlQuery] = useState('SELECT id, user_id, name, email, role, status FROM users LIMIT 10;');
  const [sqlResult, setSqlResult] = useState<any>(null);
  const [sqlLoading, setSqlLoading] = useState(false);
  const [sqlError, setSqlError] = useState('');

  // 4. Database Diagnostics & Optimize
  const [dbDiag, setDbDiag] = useState<any>(null);
  const [diagLoading, setDiagLoading] = useState(false);
  const [vacuumLoading, setVacuumLoading] = useState(false);

  // Trigger backup & verify states
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [verifyingBackupId, setVerifyingBackupId] = useState<string | null>(null);

  // New Rule Modal
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [ruleName, setRuleName] = useState('');
  const [ruleTrigger, setRuleTrigger] = useState('on_status_change');
  const [ruleCondition, setRuleCondition] = useState('missing_info');
  const [ruleTargetStatus, setRuleTargetStatus] = useState('Hold Box');
  const [rulePriority, setRulePriority] = useState(1);
  const [ruleDesc, setRuleDesc] = useState('');

  const loadSectionData = async (section: number) => {
    try {
      setLoading(true);
      if (section === 1) {
        const res = await api.getAdminUsers();
        setUsers(res.users || []);
      } else if (section === 2) {
        await refreshControls();
        const res = await api.getRoles();
        setRoles(res.roles || []);
        setPermissions(res.permissions || []);
      } else if (section === 3) {
        // Active Sessions Manager
        setSessionsLoading(true);
        const res = await api.getAdminSessions();
        setActiveSessions(res.sessions || []);
        setSessionsLoading(false);
      } else if (section === 4) {
        await refreshControls();
        const res = await api.getFeatureFlags();
        setFeatureFlags(res.flags || []);
      } else if (section === 5) {
        const res = await api.getWorkflowConfig();
        setWorkflowConfig(res.config);
      } else if (section === 6) {
        const [rulesRes, execRes] = await Promise.all([
          api.getWorkflowRules(),
          api.getWorkflowExecutions(),
        ]);
        setWorkflowRules(rulesRes.rules || []);
        setRuleExecutions(execRes.executions || []);
      } else if (section === 7) {
        const res = await api.getSecurityEvents();
        setSecurityEvents(res.events || []);
      } else if (section === 8) {
        const res = await api.getAuditLogs();
        setAuditLogs(res.logs || []);
      } else if (section === 9) {
        const res = await api.getBackupHealth();
        setBackupHealth(res);
        runDiagnostics();
      } else if (section === 10) {
        const res = await api.getBackupHistory();
        setBackupHistory(res.backups || []);
      } else if (section === 11) {
        const res = await api.getRestoreLogs();
        setRestoreLogs(res.logs || []);
      } else if (section === 12) {
        // SQL Inspector initial check
        if (!sqlResult) {
          executeSqlQuery();
        }
      }
    } catch (e: any) {
      error('Failed to load administrative section', e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSectionData(activeSection);

    const handleSync = () => {
      loadSectionData(activeSection);
    };
    window.addEventListener('taskflow:sync', handleSync);
    return () => window.removeEventListener('taskflow:sync', handleSync);
  }, [activeSection]);

  const handleRevokeSession = async (userId: number) => {
    try {
      await api.revokeUserSessions(userId);
      success('Sessions Revoked', 'All active tokens invalidated server-side');
      loadSectionData(1);
    } catch (err: any) {
      error('Session Revocation Failed', err.message);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      setIsDeletingUser(true);
      await api.deleteAdminUser(userToDelete.id);
      success('User Deleted', `Account ${userToDelete.name} (${userToDelete.user_id}) permanently removed`);
      setUserToDelete(null);
      loadSectionData(1);
    } catch (err: any) {
      error('User Deletion Failed', err.message);
    } finally {
      setIsDeletingUser(false);
    }
  };

  const handleOpenEditUser = (u: any) => {
    setUserToEdit(u);
    setEditUserName(u.name);
    setEditUserRole(u.role);
    setEditUserStatus(u.status);
  };

  const handleSaveUserEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userToEdit) return;
    try {
      setIsUpdatingUser(true);
      await api.updateAdminUser(userToEdit.id, {
        name: editUserName.trim(),
        role: editUserRole,
        status: editUserStatus,
      });
      success('User Updated', `Changes saved for ${editUserName}`);
      setUserToEdit(null);
      loadSectionData(1);
    } catch (err: any) {
      error('Update Failed', err.message);
    } finally {
      setIsUpdatingUser(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsCreatingUser(true);
      await api.createAdminUser({
        name: newUserName.trim(),
        email: newUserEmail.trim(),
        password: newUserPassword,
        role: newUserRole,
        userId: newUserId.trim() || undefined,
      });
      success('User Created', `Created account for ${newUserName}`);
      setShowCreateUserModal(false);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserId('');
      loadSectionData(1);
    } catch (err: any) {
      error('User Creation Failed', err.message);
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userToResetPass) return;
    try {
      setIsResettingPass(true);
      await api.resetUserPassword(userToResetPass.id, newPassVal);
      success('Password Reset', `Password successfully updated for ${userToResetPass.name}`);
      setUserToResetPass(null);
      setNewPassVal('');
    } catch (err: any) {
      error('Password Reset Failed', err.message);
    } finally {
      setIsResettingPass(false);
    }
  };

  const handleTerminateSession = async (sessionId: string) => {
    try {
      await api.terminateSession(sessionId);
      success('Session Terminated', 'Selected session token was revoked');
      loadSectionData(3);
    } catch (err: any) {
      error('Failed to terminate session', err.message);
    }
  };

  const executeSqlQuery = async () => {
    if (!sqlQuery.trim()) return;
    try {
      setSqlLoading(true);
      setSqlError('');
      const res = await api.runSqlInspector(sqlQuery.trim());
      setSqlResult(res);
    } catch (err: any) {
      setSqlError(err.message || 'Query execution error');
      setSqlResult(null);
    } finally {
      setSqlLoading(false);
    }
  };

  const runDiagnostics = async () => {
    try {
      setDiagLoading(true);
      const res = await api.getDatabaseDiagnostics();
      setDbDiag(res);
    } catch (err: any) {
      error('Diagnostics Failed', err.message);
    } finally {
      setDiagLoading(false);
    }
  };

  const handleVacuumDatabase = async () => {
    try {
      setVacuumLoading(true);
      const res = await api.vacuumDatabase();
      success('Database Optimized', res.message);
      runDiagnostics();
    } catch (err: any) {
      error('Optimization Failed', err.message);
    } finally {
      setVacuumLoading(false);
    }
  };

  const handleTriggerManualBackup = async () => {
    try {
      setCreatingBackup(true);
      const res = await api.triggerBackup('FULL');
      success('Automated Production Backup Generated', `File: ${res.backup.filename} (${(res.backup.fileSizeBytes / 1024).toFixed(1)} KB)`);
      loadSectionData(activeSection);
    } catch (err: any) {
      error('Backup Generation Failed', err.message);
    } finally {
      setCreatingBackup(false);
    }
  };

  const handleVerifyRestore = async (backupId: string) => {
    try {
      setVerifyingBackupId(backupId);
      const res = await api.verifyBackupRestore(backupId);
      success('Restore Verification Passed', `Schema & records validated in ${res.verification.durationMs}ms`);
      loadSectionData(activeSection);
    } catch (err: any) {
      error('Verification Failed', err.message);
    } finally {
      setVerifyingBackupId(null);
    }
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createWorkflowRule({
        name: ruleName.trim(),
        triggerEvent: ruleTrigger,
        conditionType: ruleCondition,
        targetStatus: ruleTargetStatus,
        priority: rulePriority,
        description: ruleDesc.trim(),
      });
      success('Workflow Rule Configured');
      setShowRuleModal(false);
      setRuleName('');
      loadSectionData(6);
    } catch (err: any) {
      error('Failed to create rule', err.message);
    }
  };

  const sections = [
    { id: 1, name: '1. User Management & Deletion' },
    { id: 2, name: '2. UI Authority & Marked Controls' },
    { id: 3, name: '3. Live Sessions Manager' },
    { id: 12, name: '4. SQL Inspector & Query Terminal' },
    { id: 9, name: '5. DB Diagnostics & Optimization' },
    { id: 5, name: '6. Workflow Configuration' },
    { id: 6, name: '7. Hold & Blocked Rules Engine' },
    { id: 7, name: '8. Security Events' },
    { id: 8, name: '9. Audit Logs' },
    { id: 10, name: '10. Backup History' },
    { id: 11, name: '11. Restore Verification' },
  ];

  // Complete detailing options catalog across the entire website
  const markedControlsTopNav = [
    { id: 'btn_nav_projects_dropdown', name: 'Projects Dropdown Menu', desc: 'Projects switcher and list in top bar', target: 'TopNav Bar' },
    { id: 'btn_nav_your_work', name: 'Your Work Dropdown Menu', desc: 'Assigned issues and open tickets dropdown', target: 'TopNav Bar' },
    { id: 'btn_nav_dashboards', name: 'Dashboards Direct Link', desc: 'Dashboard button in top navigation bar', target: 'TopNav Bar' },
    { id: 'btn_nav_teams', name: 'Teams Direct Link', desc: 'Teams button in top navigation bar', target: 'TopNav Bar' },
    { id: 'btn_filter_controls', name: 'Global Search Bar', desc: 'Header global search input (⌘K) and filter bar', target: 'TopNav Bar' },
    { id: 'btn_theme_toggle', name: 'Theme Switcher Button', desc: 'Allows users to switch themes between Midnight Cyan, Ocean Blue, Arctic Light', target: 'TopNav Bar' },
    { id: 'btn_notifications', name: 'Notifications Bell', desc: 'Notifications bell and live notification center dropdown', target: 'TopNav Bar' },
    { id: 'btn_user_profile', name: 'User Profile Avatar Menu', desc: 'User avatar and profile options dropdown menu', target: 'TopNav Bar' },
  ];

  const markedControlsSidebar = [
    { id: 'page_dashboard', name: 'Dashboard View', desc: 'Main personalized dashboard button in sidebar', target: 'Sidebar' },
    { id: 'page_my_work', name: 'My Work Hub', desc: 'My Work button in sidebar', target: 'Sidebar' },
    { id: 'page_board', name: 'Kanban Board View', desc: 'Interactive Kanban board button in sidebar', target: 'Sidebar' },
    { id: 'page_backlog', name: 'Backlog Planning View', desc: 'Sprint planning and backlog button in sidebar', target: 'Sidebar' },
    { id: 'page_list_view', name: 'List View', desc: 'Tabular work items view button in sidebar', target: 'Sidebar' },
    { id: 'page_timeline', name: 'Timeline & Roadmap View', desc: 'Sprint gantt timeline button in sidebar', target: 'Sidebar' },
    { id: 'page_calendar', name: 'Calendar Schedule View', desc: 'Calendar view of sprint deadlines and tasks', target: 'Sidebar' },
    { id: 'page_reports', name: 'Reports & Analytics View', desc: 'Analytics & velocity metrics button in sidebar', target: 'Sidebar' },
    { id: 'page_sprints', name: 'Sprints Management View', desc: 'Sprint lifecycle and burndown management view', target: 'Sidebar' },
    { id: 'page_projects', name: 'Projects Directory View', desc: 'Directory of workspace projects and team repositories', target: 'Sidebar' },
    { id: 'page_teams', name: 'Teams & Organization View', desc: 'Teams list and departmental organization view', target: 'Sidebar' },
    { id: 'page_settings', name: 'Settings & Preferences View', desc: 'System settings, user preferences and profile view', target: 'Sidebar' },
  ];

  const markedControlsBacklog = [
    { id: 'btn_backlog_create_issue', name: '+ Create Issue Button', desc: 'Primary create issue button in backlog header', target: 'Backlog View' },
    { id: 'backlog_search', name: 'Backlog Search Field', desc: 'Search and filter backlog issues by keyword or key', target: 'Backlog View' },
    { id: 'backlog_type_filter', name: 'Backlog Type Filter Pills', desc: 'All, Task, Bug, Feature, and Story filter pills', target: 'Backlog View' },
    { id: 'backlog_active_sprint_section', name: 'Active Sprint Section Container', desc: 'Active sprint container card with sprint issues list', target: 'Backlog View' },
    { id: 'btn_complete_sprint', name: 'Complete Sprint Button', desc: 'Action button to finalize and close active sprint', target: 'Backlog View' },
    { id: 'backlog_product_backlog_section', name: 'Product Backlog Section Container', desc: 'Product backlog container for unassigned backlog tickets', target: 'Backlog View' },
    { id: 'btn_create_sprint', name: 'Create Sprint Button', desc: 'Action button to spin up a new planning sprint', target: 'Backlog View' },
    { id: 'backlog_story_points', name: 'Story Points & Estimates', desc: 'Story points and estimation bubbles displayed on backlog items', target: 'Backlog View' },
    { id: 'backlog_status_badges', name: 'Issue Status Badges', desc: 'Status pills (In Progress, Done, Hold Box, Blocked Box) on backlog rows', target: 'Backlog View' },
  ];

  const markedControlsKanban = [
    { id: 'col_todo', name: 'Kanban Column: To Do', desc: 'To Do column container and card list on Kanban board', target: 'Kanban Board' },
    { id: 'col_in_progress', name: 'Kanban Column: In Progress', desc: 'In Progress column container and card list on Kanban board', target: 'Kanban Board' },
    { id: 'col_dev_review', name: 'Kanban Column: Dev Review', desc: 'Dev Review column container and card list on Kanban board', target: 'Kanban Board' },
    { id: 'col_ready_to_test', name: 'Kanban Column: Ready to Test', desc: 'Ready to Test column container and card list on Kanban board', target: 'Kanban Board' },
    { id: 'col_hold_box', name: 'Kanban Column: Hold Box', desc: 'Hold Box column container and card list on Kanban board', target: 'Kanban Board' },
    { id: 'col_pending_qa', name: 'Kanban Column: Pending QA', desc: 'Pending QA column container and card list on Kanban board', target: 'Kanban Board' },
    { id: 'col_qa_testing', name: 'Kanban Column: QA Testing', desc: 'QA Testing column container and card list on Kanban board', target: 'Kanban Board' },
    { id: 'col_qa_review', name: 'Kanban Column: QA Review', desc: 'QA Review column container and card list on Kanban board', target: 'Kanban Board' },
    { id: 'col_done', name: 'Kanban Column: Done', desc: 'Done column container and completed card list on Kanban board', target: 'Kanban Board' },
    { id: 'col_blocked_box', name: 'Kanban Column: Blocked Box', desc: 'Blocked Box column container and blocker card list on Kanban board', target: 'Kanban Board' },
    { id: 'btn_create_project', name: '+ Project Button', desc: 'Button to create a new project on board & top navigation', target: 'Kanban Board' },
    { id: 'btn_create_ticket', name: '+ Add Ticket Button', desc: 'Create ticket button on Kanban board header and column headers', target: 'Kanban Board' },
    { id: 'board_search', name: 'Kanban Search Bar', desc: 'Keyword search input on Kanban board header', target: 'Kanban Board' },
    { id: 'board_type_filter', name: 'Kanban Type Filter', desc: 'Issue type dropdown filter on Kanban board', target: 'Kanban Board' },
    { id: 'board_priority_filter', name: 'Kanban Priority Filter', desc: 'Priority level dropdown filter on Kanban board', target: 'Kanban Board' },
    { id: 'board_assignee_filter', name: 'Kanban Assignee Filter', desc: 'Assignee member dropdown filter on Kanban board', target: 'Kanban Board' },
    { id: 'icon_hold_badge', name: 'Hold Box Column & Badges', desc: 'Hold Box Kanban column and card warning indicators', target: 'Kanban Board' },
    { id: 'icon_blocked_badge', name: 'Blocked Box Column & Badges', desc: 'Blocked Box Kanban column and blocker indicators', target: 'Kanban Board' },
    { id: 'icon_assignee_avatar', name: 'Assignee Avatar Bubbles', desc: 'User profile avatar circles displayed across tickets and cards', target: 'Kanban & Backlog' },
    { id: 'icon_priority_badges', name: 'Priority Indicators', desc: 'Critical, High, Medium, and Low visual color badges', target: 'Kanban & Backlog' },
    { id: 'icon_due_date', name: 'Due Date Calendar Badges', desc: 'Due date icons and countdown timestamps on task cards', target: 'Kanban Board' },
  ];

  const markedControlsDashboard = [
    { id: 'widget_stats_cards', name: 'Metric Summary Stat Cards', desc: 'Summary metrics cards (Total, In Progress, On Hold, Blocked)', target: 'Dashboard View' },
    { id: 'widget_recent_activity', name: 'Recent Activity Feed Widget', desc: 'Recent audit activity logs feed widget on dashboard', target: 'Dashboard View' },
    { id: 'widget_burndown_chart', name: 'Sprint Burndown Chart Widget', desc: 'Sprint burndown and velocity graphical trajectory', target: 'Dashboard View' },
    { id: 'btn_dashboard_quick_actions', name: 'Dashboard Quick Action Buttons', desc: 'Create Ticket and New Project quick action shortcuts', target: 'Dashboard View' },
    { id: 'btn_export_reports', name: 'Export Reports Buttons', desc: 'Buttons permitting users to download reports and data', target: 'Reports View' },
  ];

  const markedControlsActions = [
    { id: 'btn_role_enforcement', name: 'Role-Based Access Enforcement', desc: 'When turned OFF, all users can use the entire system freely without any role restrictions', target: 'Security & Permission Engine' },
    { id: 'opt_workspace_role', name: 'Workspace Role Display & Field', desc: 'Display and filling options for workspace role in settings and team provisioning', target: 'Settings & Profile' },
    { id: 'btn_project_add_member', name: '+ Add Member to Project', desc: 'Action button to assign workspace users as project members', target: 'Project Detail View' },
    { id: 'btn_project_manage_members', name: 'Manage Member Roles & Removal', desc: 'Allows modifying member roles and removing members from projects', target: 'Project Detail View' },
    { id: 'btn_edit_project', name: 'Allow Project Editing', desc: 'Permits project managers and users to edit name, key, target dates', target: 'Projects Table & Details' },
    { id: 'btn_delete_project', name: 'Allow Project Deletion', desc: 'Permits project managers and users to archive or delete projects', target: 'Projects Table & Details' },
    { id: 'btn_override_task', name: 'Allow Task Override Action', desc: 'Task override action button in modal details', target: 'Ticket Detail Modal' },
    { id: 'btn_add_repository', name: '+ Add Repository Button', desc: 'Action button to link external Git/HTTPS repositories to project', target: 'Project Detail View' },
    { id: 'btn_open_board', name: 'Open Kanban Board Link', desc: 'Shortcut button to navigate from project details to board', target: 'Project Detail View' },
    { id: 'btn_put_on_hold', name: 'Ticket Put On Hold Action', desc: 'Action button to place ticket onto Hold Box workflow stage', target: 'Ticket Detail Modal' },
    { id: 'btn_mark_blocked', name: 'Ticket Mark Blocked Action', desc: 'Action button to mark ticket as Blocked Box with blocker details', target: 'Ticket Detail Modal' },
    { id: 'btn_release_hold', name: 'Ticket Release Hold Action', desc: 'Action button to release ticket from Hold Box with notes', target: 'Ticket Detail Modal' },
    { id: 'btn_resolve_blocker', name: 'Ticket Resolve Blocker Action', desc: 'Action button to resolve blockers and resume ticket workflow', target: 'Ticket Detail Modal' },
    { id: 'btn_add_comment', name: 'Ticket Add Comment Section', desc: 'Comment input and submit action inside ticket detail modal', target: 'Ticket Detail Modal' },
    { id: 'btn_create_team', name: '+ Create Team Button', desc: 'Action button to create a new team workspace', target: 'Teams View' },
    { id: 'btn_invite_member', name: 'Invite Team Member Button', desc: 'Action button to add and invite team members', target: 'Teams View' },
  ];

  return (
    <div className="flex-1 p-6 overflow-y-auto space-y-6 bg-theme-bg">
      {/* Console Top Shell */}
      <div className="flex items-center justify-between border-b border-theme-border/80 pb-4 flex-wrap gap-4 -mx-6 -mt-6 p-6 bg-theme-surface/80 backdrop-blur-md sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 via-amber-500 to-cyan-400 flex items-center justify-center text-slate-950 shadow-md shadow-amber-500/20">
            <Terminal className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-theme-text tracking-tight">TaskFlow Developer Console</h1>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                System Root Authority
              </span>
            </div>
            <p className="text-[11px] text-theme-muted mt-0.5">
              Isolated Authority & Working Tools • UI Controls, User Deletion, SQL Inspector & Full Developer App Suite
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>⚡ Real-Time Autosave Active • Immediate SQLite Persistence & Multi-User Live Sync</span>
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* DEDICATED BUTTON TO USE ALL PAGES AS DEVELOPER */}
          {onLaunchAppSuite && (
            <button
              onClick={onLaunchAppSuite}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-400 via-teal-400 to-blue-500 hover:brightness-110 active:scale-95 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 transition cursor-pointer"
              title="Launch full application (Board, Backlog, List, Timeline, Reports, Projects) with Developer Root privileges"
            >
              <Rocket className="w-4 h-4 stroke-[2.5]" />
              <span>Use All Pages (Developer Suite)</span>
            </button>
          )}

          <button
            onClick={handleTriggerManualBackup}
            disabled={creatingBackup}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md transition disabled:opacity-50 cursor-pointer"
            title="Create instant encrypted database backup"
          >
            <Database className="w-3.5 h-3.5" />
            <span>{creatingBackup ? 'Encrypting...' : 'Trigger Backup'}</span>
          </button>

          {onSignOut && (
            <button
              onClick={onSignOut}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-bold transition cursor-pointer"
              title="Sign out of Developer Console"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          )}
        </div>
      </div>

      {/* Navigation Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        {sections.map(s => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-semibold transition shrink-0 cursor-pointer ${
              activeSection === s.id
                ? 'bg-theme-primary text-slate-950 shadow-sm'
                : 'bg-theme-surface border border-theme-border text-theme-muted hover:text-theme-text'
            }`}
          >
            {s.name}
          </button>
        ))}
      </div>

      {/* SECTION CONTENT DISPLAY */}
      <div className="rounded-2xl border border-theme-border bg-theme-surface p-6 shadow-sm min-h-[440px]">
        {loading ? (
          <div className="py-16 text-center text-xs text-theme-muted animate-pulse">
            Loading administrative section data...
          </div>
        ) : (
          <>
            {/* 1. USER MANAGEMENT & DELETION */}
            {activeSection === 1 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-4 pb-3 border-b border-theme-border">
                  <div>
                    <h3 className="font-bold text-sm text-theme-text">User Accounts, Roles & Operations</h3>
                    <p className="text-xs text-theme-muted mt-0.5">
                      Full control to add new users, edit permissions, reset passwords, revoke sessions, and permanently delete accounts.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-theme-muted">{users.length} registered accounts</span>
                    <button
                      onClick={() => setShowCreateUserModal(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-theme-primary text-slate-950 font-bold text-xs shadow-md hover:brightness-110 transition cursor-pointer"
                    >
                      <Plus className="w-4 h-4 stroke-[2.5]" />
                      <span>+ Add User</span>
                    </button>
                  </div>
                </div>

                {/* MASTER ROLE-BASED ACCESS CONTROL TOGGLE (Developer Console Authority) */}
                {(() => {
                  const isRoleEnforcementActive = controlsMap['btn_role_enforcement'] !== false;
                  return (
                    <div className={`p-4 rounded-2xl border transition-all duration-300 shadow-lg ${
                      isRoleEnforcementActive
                        ? 'bg-gradient-to-r from-blue-950/40 via-slate-900 to-slate-950 border-blue-500/40 shadow-blue-500/5'
                        : 'bg-gradient-to-r from-amber-950/50 via-slate-900 to-slate-950 border-amber-500/50 shadow-amber-500/10'
                    }`}>
                      <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="space-y-1.5 max-w-2xl">
                          <div className="flex items-center gap-2">
                            <span className={`w-2.5 h-2.5 rounded-full animate-pulse ${isRoleEnforcementActive ? 'bg-blue-400' : 'bg-amber-400'}`} />
                            <h4 className="font-extrabold text-sm uppercase tracking-wider text-theme-text flex items-center gap-2">
                              <span>Role-Based Access Control (RBAC) Enforcement</span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                isRoleEnforcementActive
                                  ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                                  : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              }`}>
                                {isRoleEnforcementActive ? '🛡️ ROLES ENFORCED' : '⚡ ROLE-FREE MODE (ALL USERS UNRESTRICTED)'}
                              </span>
                            </h4>
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed">
                            {isRoleEnforcementActive ? (
                              <span>
                                <strong>Roles Enforced:</strong> Each user has strict rights per their assigned role (<em>Super Admin, Project Manager, Developer, QA Engineer, Viewer</em>). Normal role restrictions and permission boundaries are actively enforced.
                              </span>
                            ) : (
                              <span className="text-amber-200">
                                <strong>Role Restrictions Bypassed:</strong> Role button is turned <strong>OFF</strong>. All users can be used freely across the entire website <strong>without any role restrictions</strong>. Any user can create, edit, and delete projects, manage issues, and transition workflows without limitation.
                              </span>
                            )}
                          </p>
                          <div className="text-[11px] text-theme-muted flex items-center gap-3 pt-0.5">
                            <span className="font-mono text-cyan-400">ID: btn_role_enforcement</span>
                            <span>•</span>
                            <span>Persistent in SQLite until changed next time</span>
                            <span>•</span>
                            <span className="text-emerald-400">Immediate live broadcast to all users</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => toggleControl('btn_role_enforcement', !isRoleEnforcementActive)}
                            className={`px-4 py-2.5 rounded-xl font-extrabold text-xs flex items-center gap-2 transition cursor-pointer shadow-md ${
                              isRoleEnforcementActive
                                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30'
                                : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/30'
                            }`}
                            title={isRoleEnforcementActive ? 'Click to turn OFF role restrictions for all users' : 'Click to turn ON strict role enforcement'}
                          >
                            {isRoleEnforcementActive ? (
                              <>
                                <ToggleRight className="w-5 h-5 text-white stroke-[2.5]" />
                                <span>Turn OFF Role Restrictions</span>
                              </>
                            ) : (
                              <>
                                <ToggleLeft className="w-5 h-5 text-slate-950 stroke-[2.5]" />
                                <span>Turn ON Role Enforcement</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-theme-border text-theme-muted text-[11px] uppercase tracking-wider font-semibold">
                        <th className="py-2.5 px-3">User ID</th>
                        <th className="py-2.5 px-3">Name</th>
                        <th className="py-2.5 px-3">Email</th>
                        <th className="py-2.5 px-3">
                          {controlsMap['btn_role_enforcement'] !== false ? (
                            <span>Role</span>
                          ) : (
                            <span className="text-amber-300 font-extrabold flex items-center gap-1">
                              <span>Role (Turned OFF)</span>
                            </span>
                          )}
                        </th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Live Sessions</th>
                        <th className="py-2.5 px-3 text-right">Administrative Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-theme-border/50">
                      {users.map(u => {
                        const isRootConsole = u.user_id === 'DEV-CONSOLE-ROOT' || u.email === 'devconsole@system.local';
                        const isRoleOn = controlsMap['btn_role_enforcement'] !== false;
                        return (
                          <tr key={u.id} className="hover:bg-theme-surface-hover transition">
                            <td className="py-3 px-3 font-mono font-bold text-theme-primary">{u.user_id}</td>
                            <td className="py-3 px-3 font-semibold text-theme-text">{u.name}</td>
                            <td className="py-3 px-3 text-theme-muted">{u.email}</td>
                            <td className="py-3 px-3">
                              {isRootConsole ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                                  developer_console_admin
                                </span>
                              ) : isRoleOn ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">
                                  {u.role}
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1 w-fit">
                                  <span>No Role (Normal User)</span>
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  u.status === 'active'
                                    ? 'bg-emerald-500/20 text-emerald-400'
                                    : 'bg-rose-500/20 text-rose-400'
                                }`}
                              >
                                {u.status}
                              </span>
                            </td>
                            <td className="py-3 px-3 font-mono">
                              {u.active_sessions > 0 ? (
                                <span className="text-emerald-400 font-semibold">{u.active_sessions} active</span>
                              ) : (
                                <span className="text-theme-muted">None</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {/* Edit User Button */}
                                <button
                                  onClick={() => handleOpenEditUser(u)}
                                  className="p-1.5 rounded bg-theme-bg border border-theme-border text-theme-muted hover:text-theme-primary hover:border-theme-primary transition cursor-pointer"
                                  title="Edit User Role & Status"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>

                                {/* Reset Password Button */}
                                <button
                                  onClick={() => {
                                    setUserToResetPass(u);
                                    setNewPassVal('');
                                  }}
                                  className="p-1.5 rounded bg-theme-bg border border-theme-border text-theme-muted hover:text-amber-300 hover:border-amber-300 transition cursor-pointer"
                                  title="Reset Password"
                                >
                                  <Lock className="w-3.5 h-3.5" />
                                </button>

                                {/* Revoke Sessions Button */}
                                <button
                                  onClick={() => handleRevokeSession(u.id)}
                                  className="px-2 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 text-[11px] font-semibold transition cursor-pointer"
                                  title="Terminate user sessions"
                                >
                                  Revoke
                                </button>

                                {/* Delete User Button (Root cannot be deleted) */}
                                {!isRootConsole ? (
                                  <button
                                    onClick={() => setUserToDelete(u)}
                                    className="p-1.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300 hover:bg-rose-500/25 transition cursor-pointer"
                                    title="Delete User Permanently"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                ) : (
                                  <span className="text-[10px] text-theme-muted italic px-2">Protected</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 2. UI AUTHORITY & MARKED CONTROLS (DIRECT FROM SCREENSHOT) */}
            {activeSection === 2 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between flex-wrap gap-4 pb-4 border-b border-theme-border">
                  <div>
                    <div className="flex items-center gap-2">
                      <Key className="w-5 h-5 text-theme-primary" />
                      <h3 className="font-bold text-base text-theme-text">Website UI Controls & Marked Buttons Authority</h3>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        100% Precision
                      </span>
                    </div>
                    <p className="text-xs text-theme-muted mt-1 max-w-2xl">
                      Toggle every button and navigation item circled in the reference screenshot. When turned OFF, it is immediately removed from the normal website until unlocked.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={resetAllControls}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-theme-border bg-theme-surface hover:bg-theme-surface-hover text-xs font-semibold text-theme-muted hover:text-theme-text transition cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset All to Visible</span>
                    </button>
                  </div>
                </div>

                {/* MASTER ROLE-BASED ACCESS CONTROL TOGGLE (Developer Console Authority) */}
                {(() => {
                  const isRoleEnforcementActive = controlsMap['btn_role_enforcement'] !== false;
                  return (
                    <div className={`p-4 rounded-2xl border transition-all duration-300 shadow-lg ${
                      isRoleEnforcementActive
                        ? 'bg-gradient-to-r from-blue-950/40 via-slate-900 to-slate-950 border-blue-500/40 shadow-blue-500/5'
                        : 'bg-gradient-to-r from-amber-950/50 via-slate-900 to-slate-950 border-amber-500/50 shadow-amber-500/10'
                    }`}>
                      <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="space-y-1.5 max-w-2xl">
                          <div className="flex items-center gap-2">
                            <span className={`w-2.5 h-2.5 rounded-full animate-pulse ${isRoleEnforcementActive ? 'bg-blue-400' : 'bg-amber-400'}`} />
                            <h4 className="font-extrabold text-sm uppercase tracking-wider text-theme-text flex items-center gap-2">
                              <span>Role-Based Access Control (RBAC) Enforcement</span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                isRoleEnforcementActive
                                  ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                                  : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              }`}>
                                {isRoleEnforcementActive ? '🛡️ ROLES ENFORCED' : '⚡ ROLE-FREE MODE (ALL USERS UNRESTRICTED)'}
                              </span>
                            </h4>
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed">
                            {isRoleEnforcementActive ? (
                              <span>
                                <strong>Roles Enforced:</strong> Each user has strict rights per their assigned role (<em>Super Admin, Project Manager, Developer, QA Engineer, Viewer</em>). Normal role restrictions and permission boundaries are actively enforced.
                              </span>
                            ) : (
                              <span className="text-amber-200">
                                <strong>Role Restrictions Bypassed:</strong> Role button is turned <strong>OFF</strong>. All users can be used freely across the entire website <strong>without any role restrictions</strong>. Any user can create, edit, and delete projects, manage issues, and transition workflows without limitation.
                              </span>
                            )}
                          </p>
                          <div className="text-[11px] text-theme-muted flex items-center gap-3 pt-0.5">
                            <span className="font-mono text-cyan-400">ID: btn_role_enforcement</span>
                            <span>•</span>
                            <span>Persistent in SQLite until changed next time</span>
                            <span>•</span>
                            <span className="text-emerald-400">Immediate live broadcast to all users</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => toggleControl('btn_role_enforcement', !isRoleEnforcementActive)}
                            className={`px-4 py-2.5 rounded-xl font-extrabold text-xs flex items-center gap-2 transition cursor-pointer shadow-md ${
                              isRoleEnforcementActive
                                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30'
                                : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/30'
                            }`}
                            title={isRoleEnforcementActive ? 'Click to turn OFF role restrictions for all users' : 'Click to turn ON strict role enforcement'}
                          >
                            {isRoleEnforcementActive ? (
                              <>
                                <ToggleRight className="w-5 h-5 text-white stroke-[2.5]" />
                                <span>Turn OFF Role Restrictions</span>
                              </>
                            ) : (
                              <>
                                <ToggleLeft className="w-5 h-5 text-slate-950 stroke-[2.5]" />
                                <span>Turn ON Role Enforcement</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* In-App Live Right-Click Authority Tip Banner */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-cyan-950/60 via-slate-900 to-slate-950 border border-cyan-500/40 shadow-lg shadow-cyan-500/5 flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center justify-center shrink-0 shadow-md">
                      <Zap className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-extrabold text-sm text-cyan-300">Live In-App Right-Click Authority Active</h4>
                        <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-cyan-500 text-slate-950 uppercase">
                          Any Page • Any Option
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                        While testing in the live app (Developer Suite), <strong>right-click on ANY button, option, column, or filter</strong> anywhere on the entire website to open the Developer Context Menu and turn it ON exclusively for Developer Console!
                      </p>
                    </div>
                  </div>

                  {onLaunchAppSuite && (
                    <button
                      onClick={onLaunchAppSuite}
                      className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 font-extrabold text-xs shadow-md shadow-cyan-500/20 hover:brightness-110 transition active:scale-95 cursor-pointer shrink-0"
                    >
                      Open Live App & Test Right-Click →
                    </button>
                  )}
                </div>

                {/* Live Statistics & Global Batch Actions Bar */}
                {(() => {
                  const allCatalog = [
                    ...markedControlsTopNav.map(i => ({ ...i, category: 'topnav' })),
                    ...markedControlsSidebar.map(i => ({ ...i, category: 'sidebar' })),
                    ...markedControlsBacklog.map(i => ({ ...i, category: 'backlog' })),
                    ...markedControlsKanban.map(i => ({ ...i, category: 'kanban' })),
                    ...markedControlsDashboard.map(i => ({ ...i, category: 'dashboard' })),
                    ...markedControlsActions.map(i => ({ ...i, category: 'actions' })),
                  ];
                  const totalCount = allCatalog.length;
                  const enabledCount = allCatalog.filter(i => controlsMap[i.id] !== false).length;
                  const devOnlyCount = totalCount - enabledCount;

                  const filteredCatalog = allCatalog.filter(item => {
                    if (uiCategoryFilter !== 'all' && item.category !== uiCategoryFilter) return false;
                    if (uiSearch) {
                      const q = uiSearch.toLowerCase();
                      return (
                        item.name.toLowerCase().includes(q) ||
                        item.id.toLowerCase().includes(q) ||
                        item.desc.toLowerCase().includes(q) ||
                        item.target.toLowerCase().includes(q)
                      );
                    }
                    return true;
                  });

                  return (
                    <div className="space-y-4">
                      {/* Live Counter Cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="p-3.5 rounded-xl border border-theme-border bg-theme-surface flex items-center justify-between">
                          <div>
                            <div className="text-[10px] uppercase font-bold text-theme-muted">Total Website Options</div>
                            <div className="text-xl font-extrabold text-theme-text font-mono mt-0.5">{totalCount}</div>
                          </div>
                          <span className="px-2 py-1 rounded-lg text-xs font-bold bg-theme-primary/10 text-theme-primary font-mono">
                            100% Covered
                          </span>
                        </div>
                        <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 flex items-center justify-between">
                          <div>
                            <div className="text-[10px] uppercase font-bold text-emerald-400">Normal Website Visible</div>
                            <div className="text-xl font-extrabold text-emerald-400 font-mono mt-0.5">{enabledCount}</div>
                          </div>
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                        </div>
                        <div className="p-3.5 rounded-xl border border-amber-500/40 bg-amber-500/5 flex items-center justify-between">
                          <div>
                            <div className="text-[10px] uppercase font-bold text-amber-300">Developer Console ONLY</div>
                            <div className="text-xl font-extrabold text-amber-300 font-mono mt-0.5">{devOnlyCount}</div>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300">
                            Hidden from Users
                          </span>
                        </div>
                      </div>

                      {/* Search Bar & Batch Controls Toolbar */}
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        {/* Search Input */}
                        <div className="relative w-72">
                          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" />
                          <input
                            type="text"
                            placeholder="Search detailing option or ID..."
                            value={uiSearch}
                            onChange={e => setUiSearch(e.target.value)}
                            className="w-full bg-theme-surface border border-theme-border rounded-xl pl-9 pr-3 py-1.5 text-xs text-theme-text placeholder:text-theme-muted focus:outline-none focus:border-theme-primary transition"
                          />
                        </div>

                        {/* Batch Action Buttons */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() => bulkSetControls(true)}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 transition cursor-pointer flex items-center gap-1.5"
                            title="Turn ON all detailing options for the normal website"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Turn ON All for Normal Website</span>
                          </button>
                          <button
                            onClick={() => bulkSetControls(false)}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition cursor-pointer flex items-center gap-1.5"
                            title="Set all detailing options to Developer Console Only (hidden from normal website)"
                          >
                            <Zap className="w-3.5 h-3.5" />
                            <span>Set All to Dev Console ONLY</span>
                          </button>
                          <button
                            onClick={resetAllControls}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold border border-theme-border bg-theme-surface hover:bg-theme-surface-hover text-theme-muted hover:text-theme-text transition cursor-pointer flex items-center gap-1.5"
                            title="Reset all controls to enabled defaults"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Reset Defaults</span>
                          </button>
                        </div>
                      </div>

                      {/* Category Filter Pills */}
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                        {[
                          { id: 'all', label: `All Options (${totalCount})` },
                          { id: 'topnav', label: `Top Navigation (${markedControlsTopNav.length})` },
                          { id: 'sidebar', label: `Sidebar Pages (${markedControlsSidebar.length})` },
                          { id: 'backlog', label: `Backlog Planning (${markedControlsBacklog.length})` },
                          { id: 'kanban', label: `Kanban Board (${markedControlsKanban.length})` },
                          { id: 'dashboard', label: `Dashboard Widgets (${markedControlsDashboard.length})` },
                          { id: 'actions', label: `Actions & Modals (${markedControlsActions.length})` },
                        ].map(cat => (
                          <button
                            key={cat.id}
                            onClick={() => setUiCategoryFilter(cat.id as any)}
                            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
                              uiCategoryFilter === cat.id
                                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                                : 'bg-theme-surface border border-theme-border text-theme-muted hover:text-theme-text'
                            }`}
                          >
                            {cat.label}
                          </button>
                        ))}
                      </div>

                      {/* Responsive Grid of Detailing Options */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
                        {filteredCatalog.map(item => {
                          const isEnabled = controlsMap[item.id] !== false;
                          return (
                            <div
                              key={item.id}
                              className={`p-3.5 rounded-2xl border transition-all ${
                                isEnabled
                                  ? 'bg-theme-surface/70 border-theme-border hover:border-emerald-500/40'
                                  : 'bg-amber-500/5 border-amber-500/40 shadow-sm shadow-amber-500/5'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="space-y-1.5 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className={`w-2 h-2 rounded-full shrink-0 ${isEnabled ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
                                    <h5 className="font-bold text-xs text-theme-text truncate leading-tight">
                                      {item.name}
                                    </h5>
                                  </div>
                                  <p className="text-[11px] text-theme-muted line-clamp-2 leading-relaxed">
                                    {item.desc}
                                  </p>
                                  <div className="flex items-center gap-2 flex-wrap pt-1">
                                    <span className="font-mono text-[9px] text-cyan-300 bg-cyan-950/60 border border-cyan-500/30 px-1.5 py-0.5 rounded">
                                      {item.id}
                                    </span>
                                    <span className="text-[10px] text-theme-muted bg-theme-bg px-2 py-0.5 rounded border border-theme-border">
                                      {item.target}
                                    </span>
                                  </div>
                                </div>

                                <div className="shrink-0 flex flex-col items-end gap-1">
                                  <button
                                    onClick={() => toggleControl(item.id, !isEnabled)}
                                    className={`px-2.5 py-1 rounded-xl text-xs font-extrabold transition cursor-pointer shadow-sm flex items-center gap-1.5 ${
                                      isEnabled
                                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-rose-500/25 hover:text-rose-300 hover:border-rose-500/50'
                                        : 'bg-amber-500/25 text-amber-200 border border-amber-500/50 hover:bg-emerald-500/30 hover:text-emerald-200 animate-pulse'
                                    }`}
                                    title={isEnabled ? 'Click to display ONLY in Developer Console (hide from normal website)' : 'Click to display on normal website'}
                                  >
                                    {isEnabled ? (
                                      <>
                                        <Eye className="w-3.5 h-3.5 text-emerald-400" />
                                        <span>Everyone</span>
                                      </>
                                    ) : (
                                      <>
                                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                                        <span>Dev Only</span>
                                      </>
                                    )}
                                  </button>
                                  <span className="text-[9px] text-theme-muted font-medium">
                                    {isEnabled ? 'Normal Website' : 'Hidden from Users'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {filteredCatalog.length === 0 && (
                        <div className="py-12 text-center text-xs text-theme-muted border border-dashed border-theme-border rounded-2xl">
                          No detailing options match '{uiSearch}'. Try a different keyword or category.
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Subtab 2: Complete List */}
                {permsSubTab === 'all_ui' && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-theme-border text-theme-muted text-[11px] uppercase tracking-wider font-semibold">
                          <th className="py-2.5 px-3">Element ID</th>
                          <th className="py-2.5 px-3">Type</th>
                          <th className="py-2.5 px-3">Name</th>
                          <th className="py-2.5 px-3">Target Location</th>
                          <th className="py-2.5 px-3 text-right">Website Visibility</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-theme-border/50">
                        {uiControlsList.map(c => {
                          const isEnabled = controlsMap[c.element_id] !== false;
                          return (
                            <tr key={c.element_id} className="hover:bg-theme-surface-hover transition">
                              <td className="py-2.5 px-3 font-mono font-bold text-theme-primary">{c.element_id}</td>
                              <td className="py-2.5 px-3 uppercase text-[10px] text-theme-muted">{c.element_type}</td>
                              <td className="py-2.5 px-3 font-semibold text-theme-text">{c.name}</td>
                              <td className="py-2.5 px-3 text-theme-muted">{c.target_location || 'Workspace'}</td>
                              <td className="py-2.5 px-3 text-right">
                                <button
                                  onClick={() => toggleControl(c.element_id, !isEnabled)}
                                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                                    isEnabled
                                      ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                                      : 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30'
                                  }`}
                                >
                                  {isEnabled ? 'Enabled (Visible)' : 'Disabled (Hidden)'}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* 3. LIVE SESSIONS MANAGER */}
            {activeSection === 3 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-theme-border">
                  <div>
                    <h3 className="font-bold text-sm text-theme-text">Live Active User Sessions</h3>
                    <p className="text-xs text-theme-muted mt-0.5">
                      Monitor all authenticated tokens in real time and immediately terminate any active session.
                    </p>
                  </div>
                  <button
                    onClick={() => loadSectionData(3)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-theme-surface border border-theme-border text-xs font-semibold hover:text-theme-text cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Refresh</span>
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-theme-border text-theme-muted text-[11px] uppercase tracking-wider font-semibold">
                        <th className="py-2.5 px-3">Session Token</th>
                        <th className="py-2.5 px-3">User</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3">Created</th>
                        <th className="py-2.5 px-3">Expires</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-theme-border/50">
                      {activeSessions.map(s => (
                        <tr key={s.id} className="hover:bg-theme-surface-hover transition">
                          <td className="py-3 px-3 font-mono text-[11px] text-cyan-400 font-bold">
                            {s.id.substring(0, 16)}...
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-semibold text-theme-text">{s.user_name}</div>
                            <div className="text-[10px] text-theme-muted">{s.user_email}</div>
                          </td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-300">
                              {s.session_type}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-theme-muted">{new Date(s.created_at).toLocaleTimeString()}</td>
                          <td className="py-3 px-3 text-theme-muted">{new Date(s.expires_at).toLocaleDateString()}</td>
                          <td className="py-3 px-3 text-right">
                            <button
                              onClick={() => handleTerminateSession(s.id)}
                              className="px-2.5 py-1 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300 hover:bg-rose-500/20 text-[11px] font-semibold transition cursor-pointer"
                            >
                              Kill Session
                            </button>
                          </td>
                        </tr>
                      ))}
                      {activeSessions.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-xs text-theme-muted">
                            No active sessions found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 4. SQL INSPECTOR & QUERY TERMINAL */}
            {activeSection === 12 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-theme-border">
                  <div>
                    <h3 className="font-bold text-sm text-theme-text">SQL Inspector & Live Query Terminal</h3>
                    <p className="text-xs text-theme-muted mt-0.5">
                      Direct read-only developer query execution against SQLite WAL database for inspections and audits.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded border border-emerald-400/20">
                      SQLite 3 • Read Engine
                    </span>
                  </div>
                </div>

                {/* Query Input Box */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-theme-text flex items-center gap-1.5">
                      <Code className="w-3.5 h-3.5 text-cyan-400" />
                      <span>SQL Query (SELECT, PRAGMA, EXPLAIN)</span>
                    </label>
                    <div className="flex items-center gap-2">
                      {[
                        'SELECT * FROM users;',
                        'SELECT * FROM ui_element_controls;',
                        'SELECT * FROM projects;',
                        'SELECT * FROM tickets LIMIT 10;',
                      ].map((preset, idx) => (
                        <button
                          key={idx}
                          onClick={() => setSqlQuery(preset)}
                          className="text-[10px] font-mono text-theme-muted hover:text-cyan-400 bg-theme-bg px-2 py-0.5 rounded border border-theme-border transition cursor-pointer"
                        >
                          Preset {idx + 1}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="relative">
                    <textarea
                      rows={3}
                      value={sqlQuery}
                      onChange={e => setSqlQuery(e.target.value)}
                      className="w-full font-mono text-xs bg-slate-950 border border-theme-border rounded-xl p-3 text-cyan-300 focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={executeSqlQuery}
                      disabled={sqlLoading}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs shadow-md transition disabled:opacity-50 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>{sqlLoading ? 'Running...' : 'Execute Query'}</span>
                    </button>
                  </div>
                </div>

                {/* Query Error Notice */}
                {sqlError && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono">
                    Query Error: {sqlError}
                  </div>
                )}

                {/* Query Results Table */}
                {sqlResult && (
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between text-xs text-theme-muted font-mono">
                      <span>{sqlResult.totalRows} rows returned in {sqlResult.durationMs}ms</span>
                      <span>Showing first {sqlResult.rows?.length || 0} records</span>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-theme-border bg-slate-950 max-h-80">
                      <table className="w-full text-left text-xs font-mono">
                        <thead>
                          <tr className="border-b border-theme-border bg-slate-900 text-cyan-300 text-[11px]">
                            {sqlResult.columns?.map((col: string) => (
                              <th key={col} className="py-2 px-3 whitespace-nowrap">{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 text-slate-300">
                          {sqlResult.rows?.map((row: any, rIdx: number) => (
                            <tr key={rIdx} className="hover:bg-slate-900/60">
                              {sqlResult.columns?.map((col: string) => (
                                <td key={col} className="py-1.5 px-3 whitespace-nowrap text-xs">
                                  {row[col] !== null && row[col] !== undefined ? String(row[col]) : <span className="text-slate-600">NULL</span>}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 5. DB DIAGNOSTICS & OPTIMIZATION */}
            {activeSection === 9 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-3 border-b border-theme-border">
                  <div>
                    <h3 className="font-bold text-sm text-theme-text">Database Health, Integrity & Optimization</h3>
                    <p className="text-xs text-theme-muted mt-0.5">
                      Verify SQLite database integrity, check WAL performance, inspect table records, and run VACUUM optimization.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={runDiagnostics}
                      disabled={diagLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-theme-surface border border-theme-border text-xs font-semibold hover:text-theme-text cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>{diagLoading ? 'Checking...' : 'Run Diagnostics'}</span>
                    </button>
                    <button
                      onClick={handleVacuumDatabase}
                      disabled={vacuumLoading}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md cursor-pointer"
                    >
                      <Zap className="w-3.5 h-3.5 fill-current" />
                      <span>{vacuumLoading ? 'Optimizing...' : 'Optimize Database (Vacuum)'}</span>
                    </button>
                  </div>
                </div>

                {dbDiag && (
                  <div className="space-y-4">
                    {/* Integrity check status card */}
                    <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                        <div>
                          <div className="font-bold text-sm text-emerald-300">SQLite Integrity Status: Healthy</div>
                          <div className="text-xs text-emerald-400/80">
                            PRAGMA integrity_check output: {JSON.stringify(dbDiag.integrity)}
                          </div>
                        </div>
                      </div>
                      <span className="text-xs font-mono text-emerald-300">{dbDiag.timestamp}</span>
                    </div>

                    {/* Table row counters */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {Object.entries(dbDiag.counts || {}).map(([table, count]) => (
                        <div key={table} className="p-3.5 rounded-xl bg-theme-bg/60 border border-theme-border">
                          <div className="text-[11px] text-theme-muted uppercase font-mono">{table}</div>
                          <div className="text-xl font-bold text-theme-text mt-1">{String(count)}</div>
                        </div>
                      ))}
                    </div>

                    {/* Additional stats */}
                    <div className="p-4 rounded-xl bg-theme-bg border border-theme-border grid grid-cols-3 gap-4 text-xs font-mono">
                      <div>
                        <span className="text-theme-muted block">Tables Count</span>
                        <span className="font-bold text-theme-text text-sm">{dbDiag.tableCount} tables</span>
                      </div>
                      <div>
                        <span className="text-theme-muted block">Indexes Count</span>
                        <span className="font-bold text-theme-text text-sm">{dbDiag.indexCount} indexes</span>
                      </div>
                      <div>
                        <span className="text-theme-muted block">WAL Journal Mode</span>
                        <span className="font-bold text-emerald-400 text-sm">Active & Synced</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 6. WORKFLOW CONFIGURATION */}
            {activeSection === 5 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-theme-border">
                  <div>
                    <h3 className="font-bold text-sm text-theme-text">Workflow Stage Configuration</h3>
                    <p className="text-xs text-theme-muted mt-0.5">
                      Verify Hold Box and Blocked Box integration into the main enterprise workflow pipeline.
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-theme-bg border border-theme-border space-y-2">
                    <span className="text-xs font-semibold text-theme-text block">Suggested Workflow Sequence:</span>
                    <div className="flex items-center gap-2 overflow-x-auto text-xs py-2">
                      {[
                        'To Do', 'In Progress', 'Dev Review', 'Ready to Test',
                        'Hold Box', 'Pending QA', 'QA Testing', 'QA Review', 'Done', 'Blocked Box'
                      ].map((stage, i) => (
                        <React.Fragment key={stage}>
                          <span className={`px-2.5 py-1 rounded-lg font-bold shrink-0 ${
                            stage.includes('Hold') ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                            stage.includes('Blocked') ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' :
                            stage === 'Done' ? 'bg-emerald-500/20 text-emerald-400' :
                            'bg-theme-surface border border-theme-border text-theme-text'
                          }`}>
                            {stage}
                          </span>
                          {i < 9 && <span className="text-theme-muted shrink-0">→</span>}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 7. HOLD AND BLOCKED RULES ENGINE */}
            {activeSection === 6 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-theme-border">
                  <div>
                    <h3 className="font-bold text-sm text-theme-text">Hold & Blocked Box Conditional Routing Engine</h3>
                    <p className="text-xs text-theme-muted mt-0.5">
                      Active backend rules dynamically evaluating transitions into Hold Box or Blocked Box.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowRuleModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-theme-primary text-slate-950 font-bold text-xs shadow-md cursor-pointer"
                  >
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                    <span>+ Configure Rule</span>
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-theme-border text-theme-muted text-[11px] uppercase tracking-wider font-semibold">
                        <th className="py-2.5 px-3">Rule Name</th>
                        <th className="py-2.5 px-3">Trigger Event</th>
                        <th className="py-2.5 px-3">Condition Type</th>
                        <th className="py-2.5 px-3">Target Stage</th>
                        <th className="py-2.5 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-theme-border/50">
                      {workflowRules.map(r => (
                        <tr key={r.id} className="hover:bg-theme-surface-hover">
                          <td className="py-3 px-3 font-semibold text-theme-text">{r.name}</td>
                          <td className="py-3 px-3 font-mono text-[11px] text-theme-muted">{r.trigger_event}</td>
                          <td className="py-3 px-3 font-mono text-[11px] text-amber-300">{r.condition_type}</td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-theme-primary/15 text-theme-primary border border-theme-primary/30">
                              {r.target_status}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400">
                              Active
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 8. SECURITY EVENTS */}
            {activeSection === 7 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-theme-border">
                  <h3 className="font-bold text-sm text-theme-text">Real-time Security Event Audit</h3>
                  <span className="text-xs font-mono text-theme-muted">{securityEvents.length} logged events</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-theme-border text-theme-muted text-[11px] uppercase tracking-wider font-semibold">
                        <th className="py-2.5 px-3">Event Type</th>
                        <th className="py-2.5 px-3">Severity</th>
                        <th className="py-2.5 px-3">Actor</th>
                        <th className="py-2.5 px-3">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-theme-border/50">
                      {securityEvents.map(e => (
                        <tr key={e.id} className="hover:bg-theme-surface-hover">
                          <td className="py-2.5 px-3 font-mono font-bold text-theme-text">{e.event_type}</td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              e.severity === 'CRITICAL' ? 'bg-rose-500/20 text-rose-400' :
                              e.severity === 'WARN' ? 'bg-amber-500/20 text-amber-300' :
                              'bg-slate-800 text-slate-300'
                            }`}>
                              {e.severity}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-theme-muted">{e.actor_name || 'System Scheduler'}</td>
                          <td className="py-2.5 px-3 text-theme-muted font-mono">{new Date(e.created_at).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 9. AUDIT LOGS */}
            {activeSection === 8 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-theme-border">
                  <h3 className="font-bold text-sm text-theme-text">Immutable System Audit Trail</h3>
                  <span className="text-xs font-mono text-theme-muted">{auditLogs.length} audit entries</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-theme-border text-theme-muted text-[11px] uppercase tracking-wider font-semibold">
                        <th className="py-2.5 px-3">Action</th>
                        <th className="py-2.5 px-3">Resource</th>
                        <th className="py-2.5 px-3">Target ID</th>
                        <th className="py-2.5 px-3">Actor</th>
                        <th className="py-2.5 px-3">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-theme-border/50">
                      {auditLogs.map(l => (
                        <tr key={l.id} className="hover:bg-theme-surface-hover">
                          <td className="py-2.5 px-3 font-mono font-bold text-theme-primary">{l.action}</td>
                          <td className="py-2.5 px-3 text-theme-muted">{l.target_resource}</td>
                          <td className="py-2.5 px-3 font-mono text-theme-text">{l.target_id || '-'}</td>
                          <td className="py-2.5 px-3 text-theme-muted">{l.actor_name}</td>
                          <td className="py-2.5 px-3 text-theme-muted font-mono">{new Date(l.created_at).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 10. BACKUP HISTORY */}
            {activeSection === 10 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-theme-border">
                  <h3 className="font-bold text-sm text-theme-text">Encrypted Database Backup Archives</h3>
                  <span className="text-xs font-mono text-theme-muted">{backupHistory.length} backup archives</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-theme-border text-theme-muted text-[11px] uppercase tracking-wider font-semibold">
                        <th className="py-2.5 px-3">Backup ID</th>
                        <th className="py-2.5 px-3">Filename</th>
                        <th className="py-2.5 px-3">Size</th>
                        <th className="py-2.5 px-3">Created</th>
                        <th className="py-2.5 px-3 text-right">Verification</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-theme-border/50">
                      {backupHistory.map(b => (
                        <tr key={b.backup_id} className="hover:bg-theme-surface-hover">
                          <td className="py-3 px-3 font-mono text-cyan-400 font-bold">{b.backup_id}</td>
                          <td className="py-3 px-3 text-theme-text">{b.filename}</td>
                          <td className="py-3 px-3 font-mono text-theme-muted">{(b.file_size_bytes / 1024).toFixed(1)} KB</td>
                          <td className="py-3 px-3 text-theme-muted">{new Date(b.created_at).toLocaleString()}</td>
                          <td className="py-3 px-3 text-right">
                            <button
                              onClick={() => handleVerifyRestore(b.backup_id)}
                              disabled={verifyingBackupId === b.backup_id}
                              className="px-2.5 py-1 rounded bg-theme-bg border border-theme-border text-xs font-semibold text-theme-text hover:text-theme-primary hover:border-theme-primary transition cursor-pointer"
                            >
                              {verifyingBackupId === b.backup_id ? 'Verifying...' : 'Verify Restore'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 11. RESTORE VERIFICATION */}
            {activeSection === 11 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-theme-border">
                  <h3 className="font-bold text-sm text-theme-text">Automated Sandbox Restore Verification Log</h3>
                  <span className="text-xs font-mono text-theme-muted">{restoreLogs.length} verified executions</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-theme-border text-theme-muted text-[11px] uppercase tracking-wider font-semibold">
                        <th className="py-2.5 px-3">Verification ID</th>
                        <th className="py-2.5 px-3">Backup ID</th>
                        <th className="py-2.5 px-3">Duration</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Verified At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-theme-border/50">
                      {restoreLogs.map(r => (
                        <tr key={r.id} className="hover:bg-theme-surface-hover">
                          <td className="py-3 px-3 font-mono text-theme-primary">{r.id}</td>
                          <td className="py-3 px-3 font-mono text-theme-text">{r.backup_id}</td>
                          <td className="py-3 px-3 font-mono text-theme-muted">{r.restore_duration_ms} ms</td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400">
                              {r.status}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-theme-muted">{new Date(r.verified_at).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* MODAL: DELETE USER CONFIRMATION */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-rose-500/40 bg-theme-surface shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-theme-border">
              <div className="flex items-center gap-2 text-rose-400">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <h3 className="font-bold text-sm text-theme-text">Delete User Account</h3>
              </div>
              <button
                onClick={() => setUserToDelete(null)}
                className="p-1 rounded-lg text-theme-muted hover:text-theme-text"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-theme-muted leading-relaxed">
              Are you sure you want to permanently delete user{' '}
              <span className="font-bold text-theme-text">{userToDelete.name} ({userToDelete.user_id})</span>?
            </p>

            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs space-y-1">
              <div className="font-bold">Permanent Cascade Effect:</div>
              <div>• All active sessions for this user will be revoked immediately.</div>
              <div>• Ticket assignments and project memberships will be cleanly removed.</div>
              <div>• User credentials and identity record will be removed from the database.</div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-theme-border">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-theme-muted hover:text-theme-text"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingUser}
                onClick={handleDeleteUser}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-bold text-xs shadow-lg shadow-rose-600/30 transition disabled:opacity-50"
              >
                {isDeletingUser ? 'Deleting...' : 'Delete User Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDIT USER DETAILS */}
      {userToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-theme-border bg-theme-surface shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-theme-border">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-theme-primary" />
                <h3 className="font-bold text-sm text-theme-text">Edit User Profile</h3>
              </div>
              <button
                onClick={() => setUserToEdit(null)}
                className="p-1 rounded-lg text-theme-muted hover:text-theme-text"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveUserEdit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-theme-text mb-1">User ID</label>
                <input
                  type="text"
                  disabled
                  value={userToEdit.user_id}
                  className="w-full bg-theme-bg/50 border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-muted font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-theme-text mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editUserName}
                  onChange={e => setEditUserName(e.target.value)}
                  className="w-full bg-theme-bg border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text focus:outline-none focus:border-theme-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-theme-text mb-1">Role</label>
                <select
                  value={editUserRole}
                  onChange={e => setEditUserRole(e.target.value)}
                  className="w-full bg-theme-bg border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text focus:outline-none focus:border-theme-primary"
                >
                  <option value="project_manager">project_manager</option>
                  <option value="team_lead">team_lead</option>
                  <option value="developer">developer</option>
                  <option value="qa_engineer">qa_engineer</option>
                  <option value="viewer">viewer</option>
                  <option value="admin">admin</option>
                  <option value="super_admin">super_admin</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-theme-text mb-1">Status</label>
                <select
                  value={editUserStatus}
                  onChange={e => setEditUserStatus(e.target.value)}
                  className="w-full bg-theme-bg border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text focus:outline-none focus:border-theme-primary"
                >
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
                  <option value="suspended">suspended</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-theme-border">
                <button
                  type="button"
                  onClick={() => setUserToEdit(null)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-theme-muted hover:text-theme-text"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingUser}
                  className="px-4 py-2 rounded-xl bg-theme-primary text-slate-950 font-bold text-xs shadow-md transition disabled:opacity-50"
                >
                  {isUpdatingUser ? 'Saving...' : 'Save User Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE NEW USER */}
      {showCreateUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-theme-border bg-theme-surface shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-theme-border">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-theme-primary" />
                <h3 className="font-bold text-sm text-theme-text">Create New Workspace User</h3>
              </div>
              <button
                onClick={() => setShowCreateUserModal(false)}
                className="p-1 rounded-lg text-theme-muted hover:text-theme-text"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-theme-text mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={newUserName}
                  onChange={e => setNewUserName(e.target.value)}
                  className="w-full bg-theme-bg border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text focus:outline-none focus:border-theme-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-theme-text mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="john@company.com"
                  value={newUserEmail}
                  onChange={e => setNewUserEmail(e.target.value)}
                  className="w-full bg-theme-bg border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text focus:outline-none focus:border-theme-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-theme-text mb-1">Password</label>
                <input
                  type="password"
                  required
                  placeholder="Minimum 6 characters"
                  value={newUserPassword}
                  onChange={e => setNewUserPassword(e.target.value)}
                  className="w-full bg-theme-bg border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text focus:outline-none focus:border-theme-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-theme-text mb-1">Role</label>
                  <select
                    value={newUserRole}
                    onChange={e => setNewUserRole(e.target.value)}
                    className="w-full bg-theme-bg border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text focus:outline-none focus:border-theme-primary"
                  >
                    <option value="project_manager">project_manager</option>
                    <option value="team_lead">team_lead</option>
                    <option value="developer">developer</option>
                    <option value="qa_engineer">qa_engineer</option>
                    <option value="viewer">viewer</option>
                    <option value="admin">admin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-theme-text mb-1">Custom User ID (Opt)</label>
                  <input
                    type="text"
                    placeholder="e.g. USR-109"
                    value={newUserId}
                    onChange={e => setNewUserId(e.target.value.toUpperCase())}
                    className="w-full bg-theme-bg border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text font-mono uppercase focus:outline-none focus:border-theme-primary"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-theme-border">
                <button
                  type="button"
                  onClick={() => setShowCreateUserModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-theme-muted hover:text-theme-text"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingUser}
                  className="px-4 py-2 rounded-xl bg-theme-primary text-slate-950 font-bold text-xs shadow-md transition disabled:opacity-50"
                >
                  {isCreatingUser ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RESET PASSWORD */}
      {userToResetPass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-theme-border bg-theme-surface shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-theme-border">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-amber-300" />
                <h3 className="font-bold text-sm text-theme-text">Reset Password</h3>
              </div>
              <button
                onClick={() => setUserToResetPass(null)}
                className="p-1 rounded-lg text-theme-muted hover:text-theme-text"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-theme-muted">
              Enter a new password for <span className="font-bold text-theme-text">{userToResetPass.name} ({userToResetPass.email})</span>.
              All active sessions will be terminated.
            </p>

            <form onSubmit={handleResetPassword} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-theme-text mb-1">New Password</label>
                <input
                  type="password"
                  required
                  placeholder="At least 6 characters"
                  value={newPassVal}
                  onChange={e => setNewPassVal(e.target.value)}
                  className="w-full bg-theme-bg border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text focus:outline-none focus:border-theme-primary"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-theme-border">
                <button
                  type="button"
                  onClick={() => setUserToResetPass(null)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-theme-muted hover:text-theme-text"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isResettingPass}
                  className="px-4 py-2 rounded-xl bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition disabled:opacity-50"
                >
                  {isResettingPass ? 'Resetting...' : 'Reset Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CONFIGURE WORKFLOW RULE */}
      {showRuleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-theme-border bg-theme-surface shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-theme-border">
              <h3 className="font-bold text-sm text-theme-text">Configure Workflow Routing Rule</h3>
              <button onClick={() => setShowRuleModal(false)} className="p-1 rounded text-theme-muted hover:text-theme-text">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateRule} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-theme-text mb-1">Rule Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Block on Unfinished Dependency"
                  value={ruleName}
                  onChange={e => setRuleName(e.target.value)}
                  className="w-full bg-theme-bg border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text focus:outline-none focus:border-theme-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-theme-text mb-1">Condition</label>
                  <select
                    value={ruleCondition}
                    onChange={e => setRuleCondition(e.target.value)}
                    className="w-full bg-theme-bg border border-theme-border rounded-lg px-2 py-2 text-xs text-theme-text"
                  >
                    <option value="missing_info">Missing Required Info</option>
                    <option value="pending_approval">Pending Approval</option>
                    <option value="unfinished_dependency">Unfinished Dependency</option>
                    <option value="critical_defect">Critical Defect</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-theme-text mb-1">Route To</label>
                  <select
                    value={ruleTargetStatus}
                    onChange={e => setRuleTargetStatus(e.target.value)}
                    className="w-full bg-theme-bg border border-theme-border rounded-lg px-2 py-2 text-xs text-theme-text"
                  >
                    <option value="Hold Box">Hold Box</option>
                    <option value="Blocked Box">Blocked Box</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-theme-text mb-1">Description</label>
                <textarea
                  rows={2}
                  value={ruleDesc}
                  onChange={e => setRuleDesc(e.target.value)}
                  className="w-full bg-theme-bg border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-theme-border">
                <button
                  type="button"
                  onClick={() => setShowRuleModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-theme-muted hover:text-theme-text"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-theme-primary text-slate-950 font-bold text-xs shadow-md"
                >
                  Save Routing Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
