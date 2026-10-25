export type WorkflowStatus =
  | 'To Do'
  | 'In Progress'
  | 'Dev Review'
  | 'Ready to Test'
  | 'Hold Box'
  | 'Pending QA'
  | 'QA Testing'
  | 'QA Review'
  | 'Done'
  | 'Blocked Box'
  | 'Cancelled';

export type TicketType =
  | 'Task'
  | 'Bug'
  | 'Mission Critical'
  | 'Story'
  | 'Epic'
  | 'New Feature'
  | 'Dev Task'
  | 'Sub-task'
  | 'Improvement'
  | 'Incident';

export type Priority = 'Critical' | 'High' | 'Medium' | 'Low';

export type ThemeName = 'midnight-cyan' | 'ocean-blue' | 'arctic-light';

export interface UserPreferences {
  theme: ThemeName;
  compact_mode?: boolean;
  show_avatars?: boolean;
  enable_animations?: boolean;
  language?: string;
}

export interface UiControl {
  element_id: string;
  element_type: 'page' | 'button' | 'icon';
  name: string;
  description?: string;
  target_location?: string;
  is_enabled: boolean | number;
  updated_by_name?: string;
  updated_at?: string;
}

export interface User {
  id: number;
  userId: string;
  name: string;
  email: string;
  role: string;
  status: 'active' | 'inactive' | 'suspended';
  avatar?: string;
  preferences?: UserPreferences;
  canAccessDevConsole?: boolean;
  portalMode?: 'workspace' | 'developer_console';
  isDevConsole?: boolean;
  sessionType?: string;
  effectivePermissions?: {
    isSuperAdmin?: boolean;
    allAllowed?: boolean;
    roleEnforcementDisabled?: boolean;
    rolePermissions?: Array<{ resource: string; action: string }>;
    userOverrides?: Array<{ resource: string; action: string; is_granted: number; scope_project_id?: number }>;
    pageVisibility?: Array<{ page_key: string; is_visible: number }>;
  };
}

export interface Project {
  id: number;
  name: string;
  key: string;
  description?: string;
  owner_id?: number;
  owner_name?: string;
  owner_avatar?: string;
  status: 'Active' | 'Archived';
  start_date?: string;
  target_date?: string;
  ticket_count?: number;
  member_count?: number;
  members?: Array<{ id: number; name: string; avatar?: string; role: string }>;
}

export interface Repository {
  id: number;
  project_id: number;
  name: string;
  url: string;
  description?: string;
  is_primary: number;
  created_at: string;
}

export interface HoldBoxRecord {
  id: number;
  ticket_id: number;
  hold_reason: string;
  category?: string;
  responsible_owner_id?: number;
  responsible_owner_name: string;
  expected_release_date?: string;
  notes?: string;
  attachments_meta?: string;
  entered_by_user_id?: number;
  entered_at: string;
  is_active: number;
  released_at?: string;
  released_by_user_id?: number;
  release_notes?: string;
  previous_stage?: string;
  next_stage?: string;
}

export interface BlockedBoxRecord {
  id: number;
  ticket_id: number;
  blocker_description: string;
  category: string;
  responsible_name: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  linked_ticket_id?: number;
  linked_ticket_key?: string;
  linked_ticket_title?: string;
  expected_resolution_date?: string;
  entered_by_user_id?: number;
  entered_at: string;
  is_active: number;
  resolved_at?: string;
  resolved_by_user_id?: number;
  resolution_notes?: string;
  previous_stage?: string;
  next_stage?: string;
}

export interface TicketComment {
  id: number;
  ticket_id: number;
  user_id: number;
  user_name: string;
  user_avatar?: string;
  user_role: string;
  content: string;
  created_at: string;
}

export interface TicketLink {
  id: number;
  source_ticket_id: number;
  target_ticket_id: number;
  target_key: string;
  target_title: string;
  target_status: string;
  target_priority: string;
  link_type: 'blocks' | 'is_blocked_by' | 'relates_to' | 'duplicates';
  created_at: string;
}

export interface Ticket {
  id: number;
  key: string;
  project_id: number;
  project_name?: string;
  project_key?: string;
  sprint_id?: number;
  sprint_name?: string;
  title: string;
  description?: string;
  type: TicketType;
  priority: Priority;
  status: WorkflowStatus;
  assignee_id?: number;
  assignee_name?: string;
  assignee_avatar?: string;
  assignment_type: 'Individual' | 'Team' | 'Common Queue';
  team_id?: number;
  creator_id: number;
  creator_name?: string;
  story_points?: number;
  estimated_hours?: number;
  logged_hours?: number;
  due_date?: string;
  version: number;
  created_at: string;
  updated_at: string;

  // Active Hold / Blocker joined fields
  hold_reason?: string;
  hold_owner?: string;
  hold_release_date?: string;
  blocker_description?: string;
  blocker_category?: string;
  blocker_responsible?: string;
  blocker_severity?: string;
  blocker_resolution_date?: string;

  // Enriched detail view properties
  activeHold?: HoldBoxRecord | null;
  activeBlocker?: BlockedBoxRecord | null;
  holdHistory?: HoldBoxRecord[];
  blockerHistory?: BlockedBoxRecord[];
  comments?: TicketComment[];
  links?: TicketLink[];
  reviews?: any[];
  activity?: any[];
}

export interface WorkflowRule {
  id: number;
  project_id?: number;
  name: string;
  trigger_event: 'on_status_change' | 'on_field_update' | 'on_dependency_change' | 'on_qa_fail';
  condition_type:
    | 'missing_info'
    | 'waiting_approval'
    | 'incomplete_dependency'
    | 'critical_defect'
    | 'hold_resolved'
    | 'blockers_cleared'
    | 'qa_prereq_unmet';
  target_status: WorkflowStatus;
  priority: number;
  is_enabled: number;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface WorkflowConfig {
  holdBoxEnabled: boolean;
  blockedBoxEnabled: boolean;
  allowedTransitions: Record<string, string[]>;
  holdCategories: string[];
  blockerCategories: string[];
  permittedRolesRelease: string[];
  permittedRolesOverride: string[];
}

export interface BackupRecord {
  id: number;
  backup_id: string;
  filename: string;
  filepath: string;
  storage_location: string;
  type: 'FULL' | 'INCREMENTAL' | 'MANUAL';
  status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
  size_bytes: number;
  checksum_sha256: string;
  is_encrypted: number;
  retention_expiry?: string;
  error_message?: string;
  started_at: string;
  completed_at?: string;
  last_verified_at?: string;
  verification_status?: 'UNVERIFIED' | 'PASSED' | 'FAILED';
}

export interface RestoreVerificationLog {
  id: number;
  backup_id: string;
  verified_at: string;
  verified_by_user_id?: number;
  verified_by_name?: string;
  status: 'PASSED' | 'FAILED';
  record_counts: {
    users?: number;
    projects?: number;
    tickets?: number;
    holdBoxRecords?: number;
    blockedBoxRecords?: number;
    workflowRules?: number;
    roles?: number;
  };
  integrity_check_output: string;
  duration_ms: number;
  details?: string;
}

export interface BackupHealth {
  database: {
    dbPath: string;
    sizeBytes: number;
    walSizeBytes: number;
    journalMode: string;
    foreignKeys: string;
    isHealthy: boolean;
  };
  backups: {
    total: number;
    verified: number;
    storageLocation: string;
    retentionDays: number;
    encryption: string;
    recentSuccess?: BackupRecord | null;
    recentFailure?: BackupRecord | null;
    currentRpoHours?: number | null;
    targetRpoHours: number;
    estimatedRtoSeconds: number;
    lastRestoreVerification?: RestoreVerificationLog | null;
  };
}

