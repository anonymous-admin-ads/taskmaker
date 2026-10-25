import { getDatabase } from './database.js';
import crypto from 'node:crypto';

export function runMigrations() {
  const db = getDatabase();

  // Create migrations tracking table
  db.exec(`
    CREATE TABLE IF NOT EXISTS _schema_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const applied = new Set(
    db.prepare('SELECT version FROM _schema_migrations').all().map(r => r.version)
  );

  // Migration 001: Initial Complete Schema
  if (!applied.has('001_initial_schema')) {
    console.log('[Migration] Applying 001_initial_schema...');
    
    db.exec(`
      BEGIN IMMEDIATE;

      -- Users & Account state
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'Developer',
        status TEXT NOT NULL DEFAULT 'active', -- active, inactive, suspended
        avatar TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_login_at TEXT,
        preferences TEXT NOT NULL DEFAULT '{"theme":"midnight-cyan","compact_mode":false,"show_avatars":true,"enable_animations":true,"language":"English"}'
      );

      -- Persistent Revocable Sessions
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        is_revoked INTEGER NOT NULL DEFAULT 0,
        ip_address TEXT,
        user_agent TEXT
      );

      -- System & Custom Roles
      CREATE TABLE IF NOT EXISTS roles (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        is_system INTEGER NOT NULL DEFAULT 1
      );

      -- Role Permissions Matrix
      CREATE TABLE IF NOT EXISTS role_permissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        resource TEXT NOT NULL,
        action TEXT NOT NULL,
        UNIQUE(role_id, resource, action)
      );

      -- Per-user Permission Overrides
      CREATE TABLE IF NOT EXISTS user_permission_overrides (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        resource TEXT NOT NULL,
        action TEXT NOT NULL,
        is_granted INTEGER NOT NULL, -- 1 = allow, 0 = deny
        scope_project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
        notes TEXT,
        UNIQUE(user_id, resource, action, scope_project_id)
      );

      -- Per-user Page and Navigation Visibility
      CREATE TABLE IF NOT EXISTS user_page_visibility (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        page_key TEXT NOT NULL,
        is_visible INTEGER NOT NULL DEFAULT 1,
        UNIQUE(user_id, page_key)
      );

      -- Feature & Navigation Management Flags
      CREATE TABLE IF NOT EXISTS feature_flags (
        key TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        description TEXT,
        scope TEXT DEFAULT 'global'
      );

      -- Projects
      CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        key TEXT UNIQUE NOT NULL,
        description TEXT,
        owner_id INTEGER REFERENCES users(id),
        status TEXT NOT NULL DEFAULT 'Active', -- Active, Archived
        start_date TEXT,
        target_date TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      -- Project Members
      CREATE TABLE IF NOT EXISTS project_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role TEXT NOT NULL DEFAULT 'Developer',
        UNIQUE(project_id, user_id)
      );

      -- Repositories (GitHub links with HTTPS validation)
      CREATE TABLE IF NOT EXISTS repositories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        description TEXT,
        is_primary INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      -- Teams
      CREATE TABLE IF NOT EXISTS teams (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        lead_id INTEGER REFERENCES users(id),
        created_at TEXT NOT NULL
      );

      -- Team Members
      CREATE TABLE IF NOT EXISTS team_members (
        team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        PRIMARY KEY(team_id, user_id)
      );

      -- Sprints
      CREATE TABLE IF NOT EXISTS sprints (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        goal TEXT,
        start_date TEXT,
        end_date TEXT,
        status TEXT NOT NULL DEFAULT 'active', -- planning, active, completed
        created_at TEXT NOT NULL
      );

      -- Tickets
      CREATE TABLE IF NOT EXISTS tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        sprint_id INTEGER REFERENCES sprints(id) ON DELETE SET NULL,
        title TEXT NOT NULL,
        description TEXT,
        type TEXT NOT NULL, -- Bug, Mission Critical, Story, Epic, New Feature, Task, Dev Task, Sub-task, Improvement, Incident
        priority TEXT NOT NULL, -- Critical, High, Medium, Low
        status TEXT NOT NULL DEFAULT 'To Do', -- To Do, In Progress, Dev Review, Ready for Packing, Hold Box, Blocked Box, Pending QA, QA Testing, QA Review, Done, Cancelled
        assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        assignment_type TEXT NOT NULL DEFAULT 'Individual', -- Individual, Team, Common Queue
        team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
        creator_id INTEGER NOT NULL REFERENCES users(id),
        story_points INTEGER,
        estimated_hours REAL,
        logged_hours REAL DEFAULT 0,
        due_date TEXT,
        version INTEGER NOT NULL DEFAULT 1, -- Optimistic concurrency control!
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      -- Hold Box Records (Dedicated History & Active State)
      CREATE TABLE IF NOT EXISTS hold_box_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
        hold_reason TEXT NOT NULL,
        category TEXT,
        responsible_owner_id INTEGER REFERENCES users(id),
        responsible_owner_name TEXT,
        expected_release_date TEXT,
        notes TEXT,
        attachments_meta TEXT,
        entered_by_user_id INTEGER REFERENCES users(id),
        entered_at TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        released_at TEXT,
        released_by_user_id INTEGER REFERENCES users(id),
        release_notes TEXT,
        previous_stage TEXT,
        next_stage TEXT
      );

      -- Blocked Box Records (Dedicated History & Active State)
      CREATE TABLE IF NOT EXISTS blocked_box_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
        blocker_description TEXT NOT NULL,
        category TEXT NOT NULL, -- Dependency, Defect, Approval, Prerequisite, External, Access
        responsible_name TEXT NOT NULL,
        severity TEXT NOT NULL, -- Low, Medium, High, Critical
        linked_ticket_id INTEGER REFERENCES tickets(id) ON DELETE SET NULL,
        expected_resolution_date TEXT,
        entered_by_user_id INTEGER REFERENCES users(id),
        entered_at TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        resolved_at TEXT,
        resolved_by_user_id INTEGER REFERENCES users(id),
        resolution_notes TEXT,
        previous_stage TEXT,
        next_stage TEXT
      );

      -- Configurable Workflow Rules Engine
      CREATE TABLE IF NOT EXISTS workflow_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE, -- NULL = global
        name TEXT NOT NULL,
        trigger_event TEXT NOT NULL, -- on_status_change, on_field_update, on_dependency_change, on_qa_fail
        condition_type TEXT NOT NULL, -- missing_info, waiting_approval, incomplete_dependency, critical_defect, hold_resolved, blockers_cleared, qa_prereq_unmet
        target_status TEXT NOT NULL, -- 'Hold Box', 'Blocked Box', etc.
        priority INTEGER NOT NULL DEFAULT 10, -- Lower number = higher precedence
        is_enabled INTEGER NOT NULL DEFAULT 1,
        description TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      -- Workflow Rule Execution History (Prevents Infinite Loops & Duplicates)
      CREATE TABLE IF NOT EXISTS workflow_rule_executions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rule_id INTEGER REFERENCES workflow_rules(id) ON DELETE SET NULL,
        ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
        triggered_by_user_id INTEGER REFERENCES users(id),
        from_status TEXT NOT NULL,
        to_status TEXT NOT NULL,
        condition_evaluated TEXT NOT NULL,
        execution_timestamp TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'success', -- success, skipped, conflict_prevented, error
        details TEXT
      );

      -- Workflow Configuration per Project or Global
      CREATE TABLE IF NOT EXISTS workflow_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
        hold_box_enabled INTEGER NOT NULL DEFAULT 1,
        blocked_box_enabled INTEGER NOT NULL DEFAULT 1,
        allowed_transitions TEXT NOT NULL, -- JSON
        hold_categories TEXT NOT NULL, -- JSON
        blocker_categories TEXT NOT NULL, -- JSON
        permitted_roles_release TEXT NOT NULL, -- JSON
        permitted_roles_override TEXT NOT NULL, -- JSON
        updated_at TEXT NOT NULL
      );

      -- Ticket Comments
      CREATE TABLE IF NOT EXISTS ticket_comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id),
        content TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      -- Ticket Links (Dependencies, Blocks, Relates To)
      CREATE TABLE IF NOT EXISTS ticket_links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
        target_ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
        link_type TEXT NOT NULL, -- blocks, is_blocked_by, relates_to, duplicates
        created_at TEXT NOT NULL,
        UNIQUE(source_ticket_id, target_ticket_id, link_type)
      );

      -- Project Reviews & QA Workflow
      CREATE TABLE IF NOT EXISTS ticket_reviews_qa (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
        stage TEXT NOT NULL, -- Dev Review, Ready for Packing, QA Testing, QA Review
        reviewer_id INTEGER REFERENCES users(id),
        decision TEXT NOT NULL, -- approved, rejected, changes_requested, pending
        comments TEXT,
        test_outcomes TEXT,
        created_at TEXT NOT NULL
      );

      -- Administrative & Operational Audit Logs
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        actor_id INTEGER REFERENCES users(id),
        actor_name TEXT,
        action TEXT NOT NULL,
        target_resource TEXT NOT NULL,
        target_id TEXT,
        details TEXT,
        ip_address TEXT,
        created_at TEXT NOT NULL
      );

      -- Security Events Monitoring
      CREATE TABLE IF NOT EXISTS security_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type TEXT NOT NULL,
        actor_id INTEGER REFERENCES users(id),
        ip_address TEXT,
        user_agent TEXT,
        severity TEXT NOT NULL DEFAULT 'INFO',
        details TEXT,
        created_at TEXT NOT NULL
      );

      -- In-App Notifications
      CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        link TEXT,
        type TEXT DEFAULT 'info',
        is_read INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );

      -- Real Automated Backup Records
      CREATE TABLE IF NOT EXISTS backup_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        backup_id TEXT UNIQUE NOT NULL,
        filename TEXT NOT NULL,
        filepath TEXT NOT NULL,
        storage_location TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'FULL', -- FULL, INCREMENTAL, MANUAL
        status TEXT NOT NULL DEFAULT 'RUNNING', -- PENDING, RUNNING, SUCCEEDED, FAILED
        size_bytes INTEGER DEFAULT 0,
        checksum_sha256 TEXT,
        is_encrypted INTEGER NOT NULL DEFAULT 1,
        retention_expiry TEXT,
        error_message TEXT,
        started_at TEXT NOT NULL,
        completed_at TEXT,
        last_verified_at TEXT,
        verification_status TEXT DEFAULT 'UNVERIFIED'
      );

      -- Restore Verification Sandbox Logs
      CREATE TABLE IF NOT EXISTS restore_verification_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        backup_id TEXT NOT NULL REFERENCES backup_records(backup_id),
        verified_at TEXT NOT NULL,
        verified_by_user_id INTEGER REFERENCES users(id),
        status TEXT NOT NULL, -- PASSED, FAILED
        record_counts TEXT NOT NULL, -- JSON
        integrity_check_output TEXT NOT NULL,
        duration_ms INTEGER NOT NULL,
        details TEXT
      );

      -- Optimized Indexes
      CREATE INDEX IF NOT EXISTS idx_tickets_project ON tickets(project_id);
      CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
      CREATE INDEX IF NOT EXISTS idx_tickets_assignee ON tickets(assignee_id);
      CREATE INDEX IF NOT EXISTS idx_tickets_key ON tickets(key);
      CREATE INDEX IF NOT EXISTS idx_hold_box_ticket ON hold_box_records(ticket_id);
      CREATE INDEX IF NOT EXISTS idx_hold_box_active ON hold_box_records(is_active);
      CREATE INDEX IF NOT EXISTS idx_blocked_box_ticket ON blocked_box_records(ticket_id);
      CREATE INDEX IF NOT EXISTS idx_blocked_box_active ON blocked_box_records(is_active);
      CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(id);
      CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
      CREATE INDEX IF NOT EXISTS idx_security_created ON security_events(created_at);
      CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);

      INSERT INTO _schema_migrations (version, name, applied_at)
      VALUES ('001_initial_schema', 'Initial Complete Schema with Hold Box, Blocked Box, Rules & Backups', datetime('now'));

      COMMIT;
    `);

    console.log('[Migration] 001_initial_schema successfully applied.');
  }

  // Migration 002: UI Element Controls for Pages, Buttons, and Icons
  const hasMigration2 = db.prepare('SELECT 1 FROM _schema_migrations WHERE version = ?').get('002_ui_element_controls');
  if (!hasMigration2) {
    console.log('[Migration] Applying 002_ui_element_controls...');
    db.exec(`
      BEGIN IMMEDIATE;

      CREATE TABLE IF NOT EXISTS ui_element_controls (
        element_id TEXT PRIMARY KEY,
        element_type TEXT NOT NULL, -- 'page', 'button', 'icon'
        name TEXT NOT NULL,
        description TEXT,
        target_location TEXT,
        is_enabled INTEGER NOT NULL DEFAULT 1,
        updated_by_id INTEGER REFERENCES users(id),
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_ui_element_type ON ui_element_controls(element_type);

      -- Populate Default Elements
      INSERT OR IGNORE INTO ui_element_controls (element_id, element_type, name, description, target_location, is_enabled, updated_at)
      VALUES
        -- Pages
        ('page_dashboard', 'page', 'Dashboard View', 'Personalized dashboard with metrics and activity feeds', 'Sidebar & Nav', 1, datetime('now')),
        ('page_board', 'page', 'Kanban Board', 'Interactive board with Hold Box, Blocked Box, and drag-and-drop', 'Sidebar & Nav', 1, datetime('now')),
        ('page_backlog', 'page', 'Backlog Planning', 'Product backlog and sprint issue grooming', 'Sidebar & Nav', 1, datetime('now')),
        ('page_list_view', 'page', 'List View', 'Tabular list of work items with filters', 'Sidebar & Nav', 1, datetime('now')),
        ('page_timeline', 'page', 'Timeline & Roadmap', 'Gantt timeline visualization of sprint schedules', 'Sidebar & Nav', 1, datetime('now')),
        ('page_calendar', 'page', 'Calendar Schedule', 'Monthly calendar view of ticket deadlines and milestones', 'Sidebar & Nav', 1, datetime('now')),
        ('page_reports', 'page', 'Reports & Analytics', 'Sprint velocity, burndown, and on-time delivery rates', 'Sidebar & Nav', 1, datetime('now')),
        ('page_sprints', 'page', 'Sprints Manager', 'Agile iteration cycles and sprint velocity metrics', 'Sidebar & Nav', 1, datetime('now')),
        ('page_projects', 'page', 'Projects Directory', 'Directory of active and archived workspace projects', 'Sidebar & Nav', 1, datetime('now')),
        ('page_teams', 'page', 'Teams & Departments', 'Team organization and member assignments', 'Sidebar & Nav', 1, datetime('now')),
        ('page_my_work', 'page', 'My Work Hub', 'Tickets assigned to, created by, or watched by the user', 'Sidebar & Nav', 1, datetime('now')),
        ('page_settings', 'page', 'Settings View', 'Theme switching and profile preferences', 'Sidebar & Nav', 1, datetime('now')),

        -- Buttons
        ('btn_create_project', 'button', '+ New Project Buttons', 'Buttons allowing users to create new projects', 'TopNav, Sidebar, Kanban, Dashboard, Projects', 1, datetime('now')),
        ('btn_create_ticket', 'button', '+ Create Ticket Buttons', 'Buttons allowing users to create issues and tickets', 'TopNav, Kanban, Backlog, Dashboard', 1, datetime('now')),
        ('btn_override_task', 'button', 'Task Override Action', 'Administrative override action for status and fields', 'Kanban Card & Detail Modal', 1, datetime('now')),
        ('btn_filter_controls', 'button', 'Search & Filter Toolbars', 'Quick search, priority, assignee, and type filters', 'Board, Backlog, Timeline, List', 1, datetime('now')),
        ('btn_export_reports', 'button', 'Export Reports Buttons', 'Buttons permitting users to download reports and data', 'Reports View', 1, datetime('now')),
        ('btn_theme_toggle', 'button', 'Theme Switcher Control', 'Global theme switcher between themes', 'TopNav & Settings', 1, datetime('now')),

        -- Icons & Badges
        ('icon_hold_badge', 'icon', 'Hold Box Column & Badges', 'Hold Box Kanban column and card warning indicators', 'Kanban Board, Ticket Cards, Dashboard', 1, datetime('now')),
        ('icon_blocked_badge', 'icon', 'Blocked Box Column & Badges', 'Blocked Box Kanban column and blocker indicators', 'Kanban Board, Ticket Cards, Dashboard', 1, datetime('now')),
        ('icon_assignee_avatar', 'icon', 'Assignee Avatar Bubbles', 'User profile avatar circles displayed across tickets', 'Cards, Tables, Sprints', 1, datetime('now')),
        ('icon_priority_badges', 'icon', 'Priority Indicators', 'Critical, High, Medium, and Low visual color badges', 'Cards, Tables, Backlog', 1, datetime('now')),
        ('icon_due_date', 'icon', 'Due Date Calendar Badges', 'Due date icons and countdown timestamps on task cards', 'Cards, Timeline, Calendar', 1, datetime('now'));

      INSERT INTO _schema_migrations (version, name, applied_at)
      VALUES ('002_ui_element_controls', 'UI Element Authority for Pages, Buttons and Icons', datetime('now'));

      COMMIT;
    `);

    console.log('[Migration] 002_ui_element_controls successfully applied.');
  }

  // Migration 003: Dedicated Developer Console Identity & Separate Sessions
  const hasMigration3 = db.prepare('SELECT 1 FROM _schema_migrations WHERE version = ?').get('003_separate_developer_console_user');
  if (!hasMigration3) {
    console.log('[Migration] Applying 003_separate_developer_console_user...');
    
    // 1. Add session_type column to sessions if missing
    try {
      const sessionCols = db.prepare("PRAGMA table_info(sessions)").all();
      const hasSessionType = sessionCols.some(c => c.name === 'session_type');
      if (!hasSessionType) {
        db.exec("ALTER TABLE sessions ADD COLUMN session_type TEXT NOT NULL DEFAULT 'workspace';");
      }
    } catch (e) {}

    db.exec('BEGIN IMMEDIATE;');

    // 2. Role for Developer Console Administrator
    db.prepare(`
      INSERT OR IGNORE INTO roles (id, name, description, is_system)
      VALUES ('developer_console_admin', 'Developer Console Administrator', 'Exclusive developer console root authority for UI authority, restrictions, rules, backups, and security', 1)
    `).run();

    // Permissions for developer_console_admin
    const consolePerms = [
      'developer_console', 'ui_controls', 'workflow', 'roles', 'users',
      'audit_logs', 'security_events', 'backups', 'integrations'
    ];
    for (const res of consolePerms) {
      for (const act of ['view', 'create', 'edit', 'delete', 'manage', 'restore']) {
        db.prepare('INSERT OR IGNORE INTO role_permissions (role_id, resource, action) VALUES (?, ?, ?)').run('developer_console_admin', res, act);
      }
    }

    // 3. Create Dedicated Developer Console Identity (DEV-CONSOLE-ROOT)
    const salt = crypto.randomBytes(16).toString('hex');
    const devPassKey = crypto.scryptSync('DevConsole@123', salt, 64).toString('hex');
    const devPassHash = `${salt}:${devPassKey}`;

    db.prepare(`
      INSERT OR REPLACE INTO users (user_id, name, email, password_hash, role, status, avatar, created_at, updated_at)
      VALUES (
        'DEV-CONSOLE-ROOT',
        'System Developer Console',
        'devconsole@system.local',
        ?,
        'super_admin',
        'active',
        'DC',
        datetime('now'),
        datetime('now')
      )
    `).run(devPassHash);

    // 4. Ensure Hyagreenan G is strictly a normal workspace user (project_manager)
    db.prepare(`
      UPDATE users
      SET role = 'project_manager'
      WHERE email = 'hyagreenan@company.com' AND role = 'super_admin'
    `).run();

    db.prepare(`
      INSERT INTO _schema_migrations (version, name, applied_at)
      VALUES ('003_separate_developer_console_user', 'Separated Developer Console Identity and Sessions', datetime('now'))
    `).run();

    db.exec('COMMIT;');
    console.log('[Migration] 003_separate_developer_console_user successfully applied.');
  }

  // Migration 004: Project Edit/Delete actions, marked nav controls, role permissions
  const hasMigration4 = db.prepare('SELECT 1 FROM _schema_migrations WHERE version = ?').get('004_project_actions_and_marked_nav_controls');
  if (!hasMigration4) {
    console.log('[Migration] Applying 004_project_actions_and_marked_nav_controls...');
    db.exec('BEGIN IMMEDIATE;');

    // Grant project_manager and team_lead delete permission on projects
    db.prepare(`
      INSERT OR IGNORE INTO role_permissions (role_id, resource, action)
      VALUES ('project_manager', 'projects', 'delete')
    `).run();
    db.prepare(`
      INSERT OR IGNORE INTO role_permissions (role_id, resource, action)
      VALUES ('team_lead', 'projects', 'delete')
    `).run();

    // Insert new UI element controls for the marked elements
    const newControls = [
      { id: 'btn_nav_projects_dropdown', type: 'button', name: 'TopNav Projects Dropdown', desc: 'Projects dropdown menu in the top navigation bar', location: 'TopNav' },
      { id: 'btn_nav_your_work', type: 'button', name: 'TopNav Your Work Dropdown', desc: 'Your work dropdown menu in the top navigation bar', location: 'TopNav' },
      { id: 'btn_nav_dashboards', type: 'button', name: 'TopNav Dashboards Link', desc: 'Dashboards direct navigation button in top bar', location: 'TopNav' },
      { id: 'btn_nav_teams', type: 'button', name: 'TopNav Teams Link', desc: 'Teams direct navigation button in top bar', location: 'TopNav' },
      { id: 'btn_edit_project', type: 'button', name: 'Allow Project Editing', desc: 'Allows users to edit project details, names, keys, target dates', location: 'Projects & Detail View' },
      { id: 'btn_delete_project', type: 'button', name: 'Allow Project Deletion', desc: 'Allows users to delete or archive projects', location: 'Projects & Detail View' }
    ];

    const insertCtrl = db.prepare(`
      INSERT OR IGNORE INTO ui_element_controls (element_id, element_type, name, description, target_location, is_enabled, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, datetime('now'))
    `);

    for (const ctrl of newControls) {
      insertCtrl.run(ctrl.id, ctrl.type, ctrl.name, ctrl.desc, ctrl.location);
    }

    db.prepare(`
      INSERT INTO _schema_migrations (version, name, applied_at)
      VALUES ('004_project_actions_and_marked_nav_controls', 'Project Edit/Delete Permissions and Marked UI Controls', datetime('now'))
    `).run();

    db.exec('COMMIT;');
    console.log('[Migration] 004_project_actions_and_marked_nav_controls successfully applied.');
  }

  // Migration 005: Normalize user roles to lowercase
  const hasMigration5 = db.prepare('SELECT 1 FROM _schema_migrations WHERE version = ?').get('005_normalize_user_roles');
  if (!hasMigration5) {
    db.exec(`
      BEGIN IMMEDIATE;
      UPDATE users SET role = LOWER(role);
      INSERT INTO _schema_migrations (version, name, applied_at)
      VALUES ('005_normalize_user_roles', 'Normalize user roles to lowercase', datetime('now'));
      COMMIT;
    `);
    console.log('[Migration] 005_normalize_user_roles successfully applied.');
  }

  // Migration 006: Rename 'Ready for Packing' to 'Ready to Test' across database records
  const hasMigration6 = db.prepare('SELECT 1 FROM _schema_migrations WHERE version = ?').get('006_rename_ready_for_packing_to_ready_to_test');
  if (!hasMigration6) {
    console.log('[Migration] Applying 006_rename_ready_for_packing_to_ready_to_test...');
    db.exec(`
      BEGIN IMMEDIATE;

      -- Update tickets status
      UPDATE tickets SET status = 'Ready to Test' WHERE status = 'Ready for Packing';

      -- Update hold and blocked box stage tracking
      UPDATE hold_box_records SET previous_stage = 'Ready to Test' WHERE previous_stage = 'Ready for Packing';
      UPDATE hold_box_records SET next_stage = 'Ready to Test' WHERE next_stage = 'Ready for Packing';
      UPDATE blocked_box_records SET previous_stage = 'Ready to Test' WHERE previous_stage = 'Ready for Packing';
      UPDATE blocked_box_records SET next_stage = 'Ready to Test' WHERE next_stage = 'Ready for Packing';

      -- Update QA review stages
      UPDATE ticket_reviews_qa SET stage = 'Ready to Test' WHERE stage = 'Ready for Packing';

      -- Update workflow rules targets and descriptions
      UPDATE workflow_rules SET target_status = 'Ready to Test' WHERE target_status = 'Ready for Packing';
      UPDATE workflow_rules SET name = REPLACE(name, 'Ready for Packing', 'Ready to Test');
      UPDATE workflow_rules SET description = REPLACE(description, 'Ready for Packing', 'Ready to Test');

      -- Update workflow config JSON strings
      UPDATE workflow_config
      SET allowed_transitions = REPLACE(allowed_transitions, 'Ready for Packing', 'Ready to Test')
      WHERE allowed_transitions LIKE '%Ready for Packing%';

      INSERT INTO _schema_migrations (version, name, applied_at)
      VALUES ('006_rename_ready_for_packing_to_ready_to_test', 'Rename Ready for Packing stage to Ready to Test', datetime('now'));

      COMMIT;
    `);
    console.log('[Migration] 006_rename_ready_for_packing_to_ready_to_test successfully applied.');
  }

  // Migration 007: Role-Based Access Enforcement Control (Developer Console Authority)
  const hasMigration7 = db.prepare('SELECT 1 FROM _schema_migrations WHERE version = ?').get('007_role_enforcement_control');
  if (!hasMigration7) {
    console.log('[Migration] Applying 007_role_enforcement_control...');
    db.exec(`
      BEGIN IMMEDIATE;

      INSERT OR IGNORE INTO ui_element_controls (element_id, element_type, name, description, target_location, is_enabled, updated_at)
      VALUES (
        'btn_role_enforcement',
        'button',
        'Role-Based Access Enforcement',
        'Enforces strict role permissions (super_admin, project_manager, developer, qa_engineer, viewer). If turned OFF, all users can use the entire system freely without any role restrictions.',
        'Developer Console & Permission Engine',
        1,
        datetime('now')
      );

      INSERT INTO _schema_migrations (version, name, applied_at)
      VALUES ('007_role_enforcement_control', 'Role-Based Access Control Enforcement Toggle', datetime('now'));

      COMMIT;
    `);
    console.log('[Migration] 007_role_enforcement_control successfully applied.');
  }

  // Migration 008: All Website Detailing Options (Backlog, Dashboard, Modals, TopNav, Teams)
  const hasMigration8 = db.prepare('SELECT 1 FROM _schema_migrations WHERE version = ?').get('008_all_website_detailing_options');
  if (!hasMigration8) {
    console.log('[Migration] Applying 008_all_website_detailing_options...');
    db.exec('BEGIN IMMEDIATE;');

    const detailingOptions = [
      // Top Navigation Detailing
      { id: 'btn_notifications', type: 'button', name: 'TopNav Notifications Bell', desc: 'Bell icon and notification center dropdown', location: 'Top Navigation Bar' },
      { id: 'btn_user_profile', type: 'button', name: 'TopNav User Profile Menu', desc: 'Avatar circle and user account preferences dropdown', location: 'Top Navigation Bar' },

      // Backlog Page Detailing
      { id: 'btn_backlog_create_issue', type: 'button', name: 'Backlog + Create Issue Button', desc: 'Primary create issue button in backlog header', location: 'Backlog View' },
      { id: 'backlog_search', type: 'input', name: 'Backlog Search Field', desc: 'Search and filter backlog issues by keyword or key', location: 'Backlog View' },
      { id: 'backlog_type_filter', type: 'filter', name: 'Backlog Type Filter Pills', desc: 'All, Task, Bug, Feature, and Story filter pills', location: 'Backlog View' },
      { id: 'backlog_active_sprint_section', type: 'section', name: 'Backlog Active Sprint Section', desc: 'Active sprint container card with sprint issues list', location: 'Backlog View' },
      { id: 'btn_complete_sprint', type: 'button', name: 'Backlog Complete Sprint Button', desc: 'Action button to finalize and close active sprint', location: 'Backlog View' },
      { id: 'backlog_product_backlog_section', type: 'section', name: 'Backlog Product Backlog Section', desc: 'Product backlog container for unassigned backlog tickets', location: 'Backlog View' },
      { id: 'btn_create_sprint', type: 'button', name: 'Backlog Create Sprint Button', desc: 'Action button to spin up a new planning sprint', location: 'Backlog View' },
      { id: 'backlog_story_points', type: 'badge', name: 'Backlog Story Points & Est', desc: 'Story points and estimation bubbles displayed on backlog items', location: 'Backlog View' },
      { id: 'backlog_status_badges', type: 'badge', name: 'Backlog Issue Status Badges', desc: 'Status pills (In Progress, Done, Hold Box, Blocked Box) on backlog rows', location: 'Backlog View' },

      // Dashboard View Detailing
      { id: 'widget_stats_cards', type: 'widget', name: 'Dashboard Metric Stats Cards', desc: 'Top metrics summary cards (Total, In Progress, On Hold, Blocked)', location: 'Dashboard View' },
      { id: 'widget_recent_activity', type: 'widget', name: 'Dashboard Recent Activity Feed', desc: 'Recent audit activity logs feed widget on dashboard', location: 'Dashboard View' },
      { id: 'widget_burndown_chart', type: 'widget', name: 'Dashboard Sprint Burndown Chart', desc: 'Sprint burndown and velocity graphical trajectory', location: 'Dashboard View' },
      { id: 'btn_dashboard_quick_actions', type: 'button', name: 'Dashboard Quick Action Buttons', desc: 'Create Ticket and New Project quick action shortcuts', location: 'Dashboard View' },

      // Modals & Ticket Actions Detailing
      { id: 'btn_put_on_hold', type: 'button', name: 'Ticket Put On Hold Action', desc: 'Action button to place ticket onto Hold Box workflow stage', location: 'Ticket Detail Modal' },
      { id: 'btn_mark_blocked', type: 'button', name: 'Ticket Mark Blocked Action', desc: 'Action button to mark ticket as Blocked Box with blocker details', location: 'Ticket Detail Modal' },
      { id: 'btn_release_hold', type: 'button', name: 'Ticket Release Hold Action', desc: 'Action button to release ticket from Hold Box with notes', location: 'Ticket Detail Modal' },
      { id: 'btn_resolve_blocker', type: 'button', name: 'Ticket Resolve Blocker Action', desc: 'Action button to resolve blockers and resume ticket workflow', location: 'Ticket Detail Modal' },
      { id: 'btn_add_comment', type: 'button', name: 'Ticket Add Comment Section', desc: 'Comment input and submit action inside ticket detail modal', location: 'Ticket Detail Modal' },

      // Projects & Teams Detailing
      { id: 'btn_add_repository', type: 'button', name: 'Project + Add Repository Button', desc: 'Action button to link external Git/HTTPS repositories to project', location: 'Project Detail View' },
      { id: 'btn_open_board', type: 'button', name: 'Project Open Kanban Board Link', desc: 'Shortcut button to navigate from project details to board', location: 'Project Detail View' },
      { id: 'btn_create_team', type: 'button', name: 'Teams + Create Team Button', desc: 'Action button to create a new team workspace', location: 'Teams View' },
      { id: 'btn_invite_member', type: 'button', name: 'Teams Invite Member Button', desc: 'Action button to add and invite team members', location: 'Teams View' }
    ];

    const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO ui_element_controls (element_id, element_type, name, description, target_location, is_enabled, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, datetime('now'))
    `);

    for (const opt of detailingOptions) {
      insertStmt.run(opt.id, opt.type, opt.name, opt.desc, opt.location);
    }

    db.prepare(`
      INSERT INTO _schema_migrations (version, name, applied_at)
      VALUES ('008_all_website_detailing_options', 'Seeded all website detailing options for Developer Console', datetime('now'))
    `).run();

    db.exec('COMMIT;');
    console.log('[Migration] 008_all_website_detailing_options successfully applied.');
  }

  // Migration 009: Clean demo projects & seed Kanban column controls
  const hasMigration9 = db.prepare("SELECT 1 FROM _schema_migrations WHERE version = '009_clean_demo_projects_and_kanban_columns'").get();
  if (!hasMigration9) {
    console.log('[Migration] Applying 009_clean_demo_projects_and_kanban_columns...');
    db.exec('BEGIN IMMEDIATE;');

    // 1. Delete all demo projects and their associated records
    db.exec(`
      CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      DELETE FROM hold_box_records;
      DELETE FROM blocked_box_records;
      DELETE FROM workflow_rule_executions;
      DELETE FROM ticket_comments;
      DELETE FROM ticket_links;
      DELETE FROM ticket_reviews_qa;
      DELETE FROM tickets;
      DELETE FROM sprints;
      DELETE FROM repositories;
      DELETE FROM project_members;
      DELETE FROM workflow_config;
      DELETE FROM projects;
      INSERT OR REPLACE INTO system_settings (key, value) VALUES ('seed_initialized', '1');
    `);

    // 2. Seed Kanban column and role controls
    const kanbanAndRoleControls = [
      { id: 'col_todo', type: 'column', name: 'Kanban Column: To Do', desc: 'To Do column container and card list on Kanban board', location: 'Kanban Board' },
      { id: 'col_in_progress', type: 'column', name: 'Kanban Column: In Progress', desc: 'In Progress column container and card list on Kanban board', location: 'Kanban Board' },
      { id: 'col_dev_review', type: 'column', name: 'Kanban Column: Dev Review', desc: 'Dev Review column container and card list on Kanban board', location: 'Kanban Board' },
      { id: 'col_ready_to_test', type: 'column', name: 'Kanban Column: Ready to Test', desc: 'Ready to Test column container and card list on Kanban board', location: 'Kanban Board' },
      { id: 'col_hold_box', type: 'column', name: 'Kanban Column: Hold Box', desc: 'Hold Box column container and hold card list on Kanban board', location: 'Kanban Board' },
      { id: 'col_pending_qa', type: 'column', name: 'Kanban Column: Pending QA', desc: 'Pending QA column container and card list on Kanban board', location: 'Kanban Board' },
      { id: 'col_qa_testing', type: 'column', name: 'Kanban Column: QA Testing', desc: 'QA Testing column container and card list on Kanban board', location: 'Kanban Board' },
      { id: 'col_qa_review', type: 'column', name: 'Kanban Column: QA Review', desc: 'QA Review column container and card list on Kanban board', location: 'Kanban Board' },
      { id: 'col_done', type: 'column', name: 'Kanban Column: Done', desc: 'Done column container and completed card list on Kanban board', location: 'Kanban Board' },
      { id: 'col_blocked_box', type: 'column', name: 'Kanban Column: Blocked Box', desc: 'Blocked Box column container and blocker card list on Kanban board', location: 'Kanban Board' },
      { id: 'opt_workspace_role', type: 'field', name: 'Workspace Role Display & Field', desc: 'Display and filling options for workspace role in settings and team provisioning', location: 'Settings & Profile' },
      { id: 'btn_project_add_member', type: 'button', name: 'Project Details + Add Member Button', desc: 'Allows adding workspace users as project members', location: 'Project Detail View' },
      { id: 'btn_project_manage_members', type: 'action', name: 'Project Member Role & Removal Actions', desc: 'Allows modifying project member roles and removing project members', location: 'Project Detail View' },
      { id: 'board_search', type: 'input', name: 'Board Search Field', desc: 'Keyword search filter on Kanban board', location: 'Kanban Board' },
      { id: 'board_type_filter', type: 'filter', name: 'Board Type Filter', desc: 'Filter board tickets by type (Task, Bug, Story, Epic, etc.)', location: 'Kanban Board' },
      { id: 'board_priority_filter', type: 'filter', name: 'Board Priority Filter', desc: 'Filter board tickets by priority (Critical, High, Medium, Low)', location: 'Kanban Board' },
      { id: 'board_assignee_filter', type: 'filter', name: 'Board Assignee Filter', desc: 'Filter board tickets by assigned team member', location: 'Kanban Board' },
    ];

    const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO ui_element_controls (element_id, element_type, name, description, target_location, is_enabled, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, datetime('now'))
    `);

    for (const opt of kanbanAndRoleControls) {
      insertStmt.run(opt.id, opt.type, opt.name, opt.desc, opt.location);
    }

    db.prepare(`
      INSERT INTO _schema_migrations (version, name, applied_at)
      VALUES ('009_clean_demo_projects_and_kanban_columns', 'Cleaned all demo projects & seeded Kanban column controls', datetime('now'))
    `).run();

    db.exec('COMMIT;');
    console.log('[Migration] 009_clean_demo_projects_and_kanban_columns successfully applied.');
  }
}

