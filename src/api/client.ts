const BASE_URL = '/api';

export async function apiRequest<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  const config: RequestInit = {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  const res = await fetch(url, config);
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }

  return data;
}

export const api = {
  // Auth
  login: (credentials: { identifier: string; password: string; rememberMe?: boolean; portalMode?: 'workspace' | 'developer_console' }) =>
    apiRequest('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  register: (data: { name: string; email: string; password: string }) =>
    apiRequest('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  logout: () =>
    apiRequest('/auth/logout', { method: 'POST' }),
  getMe: () =>
    apiRequest('/auth/me'),
  updatePreferences: (preferences: any) =>
    apiRequest('/auth/update-preferences', { method: 'POST', body: JSON.stringify({ preferences }) }),

  // Projects
  getProjects: (status?: string) =>
    apiRequest(`/projects${status ? `?status=${status}` : ''}`),
  getProject: (id: number | string) =>
    apiRequest(`/projects/${id}`),
  createProject: (data: any) =>
    apiRequest('/projects', { method: 'POST', body: JSON.stringify(data) }),
  updateProject: (id: number | string, data: any) =>
    apiRequest(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  archiveProject: (id: number | string) =>
    apiRequest(`/projects/${id}`, { method: 'DELETE' }),
  deleteProject: (id: number | string, permanent: boolean = false) =>
    apiRequest(`/projects/${id}${permanent ? '?permanent=true' : ''}`, { method: 'DELETE' }),
  addRepository: (projectId: number | string, data: any) =>
    apiRequest(`/projects/${projectId}/repositories`, { method: 'POST', body: JSON.stringify(data) }),
  deleteRepository: (projectId: number | string, repoId: number | string) =>
    apiRequest(`/projects/${projectId}/repositories/${repoId}`, { method: 'DELETE' }),
  getProjectMembers: (projectId: number | string) =>
    apiRequest(`/projects/${projectId}/members`),
  addProjectMember: (projectId: number | string, userId: number | string, role: string = 'Member') =>
    apiRequest(`/projects/${projectId}/members`, { method: 'POST', body: JSON.stringify({ userId, role }) }),
  updateProjectMember: (projectId: number | string, userId: number | string, role: string) =>
    apiRequest(`/projects/${projectId}/members/${userId}`, { method: 'PUT', body: JSON.stringify({ role }) }),
  removeProjectMember: (projectId: number | string, userId: number | string) =>
    apiRequest(`/projects/${projectId}/members/${userId}`, { method: 'DELETE' }),

  // Tickets
  getTickets: (filters: Record<string, any> = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') params.append(k, String(v));
    });
    return apiRequest(`/tickets?${params.toString()}`);
  },
  getTicket: (id: number | string) =>
    apiRequest(`/tickets/${id}`),
  createTicket: (data: any) =>
    apiRequest('/tickets', { method: 'POST', body: JSON.stringify(data) }),
  transitionTicket: (id: number | string, data: {
    targetStatus: string;
    holdData?: any;
    blockedData?: any;
    releaseData?: any;
    expectedVersion?: number;
  }) => apiRequest(`/tickets/${id}/transition`, { method: 'POST', body: JSON.stringify(data) }),
  overrideTicket: (id: number | string, data: {
    targetStatus?: string;
    assigneeId?: number;
    priority?: string;
    overrideReason: string;
    expectedVersion?: number;
  }) => apiRequest(`/tickets/${id}/override`, { method: 'POST', body: JSON.stringify(data) }),
  addComment: (id: number | string, content: string) =>
    apiRequest(`/tickets/${id}/comments`, { method: 'POST', body: JSON.stringify({ content }) }),
  linkTickets: (id: number | string, data: { targetTicketKey: string; linkType: string }) =>
    apiRequest(`/tickets/${id}/links`, { method: 'POST', body: JSON.stringify(data) }),
  addReviewQA: (id: number | string, data: { stage: string; decision: string; comments?: string; testOutcomes?: any }) =>
    apiRequest(`/tickets/${id}/reviews`, { method: 'POST', body: JSON.stringify(data) }),

  // Workflow Config & Rules
  getWorkflowConfig: (projectId?: number) =>
    apiRequest(`/workflow/config${projectId ? `?projectId=${projectId}` : ''}`),
  updateWorkflowConfig: (data: any) =>
    apiRequest('/workflow/config', { method: 'PUT', body: JSON.stringify(data) }),
  getWorkflowRules: (projectId?: number) =>
    apiRequest(`/workflow/rules${projectId ? `?projectId=${projectId}` : ''}`),
  createWorkflowRule: (data: any) =>
    apiRequest('/workflow/rules', { method: 'POST', body: JSON.stringify(data) }),
  updateWorkflowRule: (id: number, data: any) =>
    apiRequest(`/workflow/rules/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteWorkflowRule: (id: number) =>
    apiRequest(`/workflow/rules/${id}`, { method: 'DELETE' }),
  getWorkflowExecutions: () =>
    apiRequest('/workflow/executions'),

  // Developer Console / Admin
  getAdminDashboard: () =>
    apiRequest('/admin/dashboard'),
  getAdminUsers: (filters: Record<string, any> = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v) params.append(k, String(v));
    });
    return apiRequest(`/admin/users?${params.toString()}`);
  },
  createAdminUser: (data: any) =>
    apiRequest('/admin/users', { method: 'POST', body: JSON.stringify(data) }),
  updateAdminUser: (id: number | string, data: any) =>
    apiRequest(`/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAdminUser: (id: number | string) =>
    apiRequest(`/admin/users/${id}`, { method: 'DELETE' }),
  resetUserPassword: (id: number | string, newPassword: string) =>
    apiRequest(`/admin/users/${id}/reset-password`, { method: 'POST', body: JSON.stringify({ newPassword }) }),
  revokeUserSessions: (id: number | string) =>
    apiRequest(`/admin/users/${id}/revoke-sessions`, { method: 'POST' }),
  getAdminSessions: () =>
    apiRequest('/admin/sessions'),
  terminateSession: (sessionId: string) =>
    apiRequest(`/admin/sessions/${sessionId}`, { method: 'DELETE' }),
  getDatabaseDiagnostics: () =>
    apiRequest('/admin/database/diagnostics', { method: 'POST' }),
  vacuumDatabase: () =>
    apiRequest('/admin/database/vacuum', { method: 'POST' }),
  runSqlInspector: (query: string) =>
    apiRequest('/admin/sql-inspector', { method: 'POST', body: JSON.stringify({ query }) }),
  getRoles: () =>
    apiRequest('/admin/roles'),
  updateRolePermissions: (roleId: string, permissions: Array<{ resource: string; action: string }>) =>
    apiRequest(`/admin/roles/${roleId}/permissions`, { method: 'PUT', body: JSON.stringify({ permissions }) }),
  getUserAccess: (userId: number) =>
    apiRequest(`/admin/users/${userId}/access`),
  updateUserAccess: (userId: number, data: any) =>
    apiRequest(`/admin/users/${userId}/access`, { method: 'PUT', body: JSON.stringify(data) }),
  getFeatureFlags: () =>
    apiRequest('/admin/feature-flags'),
  updateFeatureFlag: (key: string, enabled: boolean) =>
    apiRequest(`/admin/feature-flags/${key}`, { method: 'PUT', body: JSON.stringify({ enabled }) }),
  getSecurityEvents: () =>
    apiRequest('/admin/security-events'),
  getAuditLogs: () =>
    apiRequest('/admin/audit-logs'),

  // UI Element Authority (Developer Console Controls)
  getUiControls: () =>
    apiRequest('/ui-controls'),
  getAdminUiControls: () =>
    apiRequest('/ui-controls/admin'),
  updateUiControl: (elementId: string, is_enabled: boolean, meta?: { name?: string; element_type?: string; description?: string; target_location?: string }) =>
    apiRequest(`/ui-controls/${elementId}`, { method: 'PUT', body: JSON.stringify({ is_enabled, ...meta }) }),
  resetAllUiControls: () =>
    apiRequest('/ui-controls/bulk-reset', { method: 'POST' }),
  bulkSetUiControls: (is_enabled: boolean) =>
    apiRequest('/ui-controls/bulk-set', { method: 'POST', body: JSON.stringify({ is_enabled }) }),

  // Backup & Recovery
  getBackupHealth: () =>
    apiRequest('/backup/health'),
  getBackupHistory: () =>
    apiRequest('/backup/history'),
  triggerBackup: (type: 'MANUAL' | 'FULL' = 'MANUAL') =>
    apiRequest('/backup/trigger', { method: 'POST', body: JSON.stringify({ type }) }),
  verifyBackupRestore: (backupId: string) =>
    apiRequest(`/backup/verify/${backupId}`, { method: 'POST' }),
  getRestoreLogs: () =>
    apiRequest('/backup/restore-logs'),

  // Metrics & Reports
  getDashboardMetrics: () =>
    apiRequest('/metrics/dashboard'),
  getHoldBlockedMetrics: (filters: Record<string, any> = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v) params.append(k, String(v));
    });
    return apiRequest(`/metrics/hold-blocked?${params.toString()}`);
  },
  getReports: (projectId?: number) =>
    apiRequest(`/metrics/reports${projectId ? `?projectId=${projectId}` : ''}`),

  // Teams & Notifications
  getTeams: () =>
    apiRequest('/teams'),
  createTeam: (data: any) =>
    apiRequest('/teams', { method: 'POST', body: JSON.stringify(data) }),
  getNotifications: () =>
    apiRequest('/notifications'),
  markNotificationRead: (id: number) =>
    apiRequest(`/notifications/${id}/read`, { method: 'POST' }),
  markAllNotificationsRead: () =>
    apiRequest('/notifications/read-all', { method: 'POST' }),

  // Real-Time Multi-User Synchronization
  getSyncState: () =>
    apiRequest('/sync/state'),
};

