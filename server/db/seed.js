import { getDatabase } from './database.js';
import crypto from 'node:crypto';

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derivedKey}`;
}

export function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, key] = storedHash.split(':');
  const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(key, 'hex'), Buffer.from(derivedKey, 'hex'));
}

export function seedDatabase() {
  const db = getDatabase();

  // If already seeded / initialized once, do not recreate deleted demo projects
  const isInitialized = db.prepare("SELECT value FROM system_settings WHERE key = 'seed_initialized'").get();
  if (isInitialized) {
    console.log('[Seed] Database already initialized. Skipping initial data population.');
    return;
  }

  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  const projectCount = db.prepare('SELECT COUNT(*) as count FROM projects').get().count;

  if (userCount > 0) {
    console.log('[Seed] Database users already populated. Skipping initial data population.');
    db.prepare("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('seed_initialized', '1')").run();
    return;
  }

  console.log('[Seed] Seeding initial enterprise TaskFlow data...');

  const now = new Date().toISOString();
  const defaultPasswordHash = hashPassword('Admin@123'); // Strong seed password
  const userMap = {};

  if (userCount > 0) {
    const existingUsers = db.prepare('SELECT id, name FROM users').all();
    for (const u of existingUsers) {
      userMap[u.name] = u.id;
    }
  }

  db.exec('BEGIN IMMEDIATE;');

  try {
    if (userCount === 0) {
    // 1. Roles
    const roles = [
      { id: 'super_admin', name: 'Super Administrator', desc: 'Complete access to all resources and developer console', is_system: 1 },
      { id: 'admin', name: 'Administrator', desc: 'Platform and user management access', is_system: 1 },
      { id: 'project_manager', name: 'Project Manager', desc: 'Project oversight, workflow configuration and releases', is_system: 1 },
      { id: 'team_lead', name: 'Team Lead', desc: 'Sprint lead and team assignment controls', is_system: 1 },
      { id: 'developer', name: 'Developer', desc: 'Standard development and ticket update capabilities', is_system: 1 },
      { id: 'qa_engineer', name: 'QA Engineer', desc: 'Testing, QA reviews and defect logging', is_system: 1 },
      { id: 'viewer', name: 'Viewer', desc: 'Read-only access across assigned projects', is_system: 1 }
    ];

    const insertRole = db.prepare('INSERT INTO roles (id, name, description, is_system) VALUES (?, ?, ?, ?)');
    for (const r of roles) {
      insertRole.run(r.id, r.name, r.desc, r.is_system);
    }

    // 2. Role Permissions Matrix
    const resources = [
      'dashboard', 'users', 'roles', 'projects', 'tickets', 'comments',
      'attachments', 'workflow', 'hold_box', 'blocked_box', 'sprints',
      'reviews', 'qa', 'repositories', 'reports', 'developer_console',
      'audit_logs', 'security_events', 'backups', 'integrations'
    ];

    const insertPerm = db.prepare('INSERT INTO role_permissions (role_id, resource, action) VALUES (?, ?, ?)');
    
    // Super Admin gets all permissions
    for (const res of resources) {
      for (const act of ['view', 'create', 'edit', 'delete', 'assign', 'approve', 'reject', 'override', 'manage', 'export']) {
        insertPerm.run('super_admin', res, act);
      }
    }

    // Admin permissions
    for (const res of resources) {
      for (const act of ['view', 'create', 'edit', 'delete', 'assign', 'approve', 'reject', 'override', 'manage', 'export']) {
        if (res === 'backups' && act === 'delete') continue;
        insertPerm.run('admin', res, act);
      }
    }

    // Project Manager permissions
    for (const res of ['dashboard', 'projects', 'tickets', 'comments', 'attachments', 'workflow', 'hold_box', 'blocked_box', 'sprints', 'reviews', 'qa', 'repositories', 'reports']) {
      for (const act of ['view', 'create', 'edit', 'assign', 'approve', 'reject', 'override', 'manage']) {
        insertPerm.run('project_manager', res, act);
      }
    }

    // Team Lead permissions
    for (const res of ['dashboard', 'projects', 'tickets', 'comments', 'attachments', 'hold_box', 'blocked_box', 'sprints', 'reviews', 'qa', 'repositories', 'reports']) {
      for (const act of ['view', 'create', 'edit', 'assign', 'approve']) {
        insertPerm.run('team_lead', res, act);
      }
    }

    // Developer permissions
    for (const res of ['dashboard', 'projects', 'tickets', 'comments', 'attachments', 'sprints', 'repositories', 'reviews']) {
      for (const act of ['view', 'create', 'edit']) {
        insertPerm.run('developer', res, act);
      }
    }

    // QA Engineer permissions
    for (const res of ['dashboard', 'projects', 'tickets', 'comments', 'attachments', 'reviews', 'qa']) {
      for (const act of ['view', 'create', 'edit', 'approve', 'reject']) {
        insertPerm.run('qa_engineer', res, act);
      }
    }

    // Viewer permissions
    for (const res of ['dashboard', 'projects', 'tickets', 'comments', 'reports']) {
      insertPerm.run('viewer', res, 'view');
    }

    // 3. Feature Flags
    const insertFlag = db.prepare('INSERT INTO feature_flags (key, name, enabled, description) VALUES (?, ?, ?, ?)');
    insertFlag.run('reports_enabled', 'Reports & Analytics', 1, 'Enable advanced metrics and reporting dashboards');
    insertFlag.run('calendar_enabled', 'Calendar View', 1, 'Interactive team and sprint calendar view');
    insertFlag.run('repo_management_enabled', 'GitHub Repositories', 1, 'Project repository linking and metadata');
    insertFlag.run('exports_enabled', 'Data Exports', 1, 'CSV and JSON data export controls');
    insertFlag.run('sprint_management_enabled', 'Sprints & Releases', 1, 'Agile sprint planning and completion flows');
    insertFlag.run('hold_box_enabled', 'Hold Box Stage', 1, 'Temporary hold branch for dependencies & confirmations');
    insertFlag.run('blocked_box_enabled', 'Blocked Box Stage', 1, 'Work-stopped blocker branch with defect tracking');

    // 4. Users (from reference screenshot)
    const users = [
      { user_id: 'USR-ADMIN', name: 'Hyagreenan G', email: 'hyagreenan@company.com', role: 'super_admin', avatar: 'HG' },
      { user_id: 'USR-101', name: 'Kamalesh', email: 'kamalesh@company.com', role: 'project_manager', avatar: 'K' },
      { user_id: 'USR-102', name: 'Lokesh', email: 'lokesh@company.com', role: 'developer', avatar: 'L' },
      { user_id: 'USR-103', name: 'Aman', email: 'aman@company.com', role: 'qa_engineer', avatar: 'A' },
      { user_id: 'USR-104', name: 'Karthik', email: 'karthik@company.com', role: 'developer', avatar: 'K' },
      { user_id: 'USR-105', name: 'Afzal', email: 'afzal@company.com', role: 'team_lead', avatar: 'A' },
      { user_id: 'USR-106', name: 'Dhanush', email: 'dhanush@company.com', role: 'developer', avatar: 'D' },
      { user_id: 'USR-107', name: 'Mohammed', email: 'mohammed@company.com', role: 'developer', avatar: 'M' }
    ];

    const insertUser = db.prepare(`
      INSERT INTO users (user_id, name, email, password_hash, role, status, avatar, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)
    `);

      for (const u of users) {
        const res = insertUser.run(u.user_id, u.name, u.email, defaultPasswordHash, u.role, u.avatar, now, now);
        userMap[u.name] = Number(res.lastInsertRowid);
      }
    }

    if (projectCount === 0) {
      const fallbackUserId = db.prepare('SELECT id FROM users LIMIT 1').get()?.id || 1;
      const getUid = (name) => userMap[name] || fallbackUserId;

      // 5. Teams
      const insertTeam = db.prepare('INSERT INTO teams (name, description, lead_id, created_at) VALUES (?, ?, ?, ?)');
      const tErp = insertTeam.run('ERP Core Team', 'Main enterprise planning developers', getUid('Kamalesh'), now);
      const tQa = insertTeam.run('QA Assurance Team', 'Quality verification and compliance', getUid('Aman'), now);

      const insertTeamMember = db.prepare('INSERT INTO team_members (team_id, user_id) VALUES (?, ?)');
      insertTeamMember.run(Number(tErp.lastInsertRowid), getUid('Kamalesh'));
      insertTeamMember.run(Number(tErp.lastInsertRowid), getUid('Lokesh'));
      insertTeamMember.run(Number(tErp.lastInsertRowid), getUid('Karthik'));
      insertTeamMember.run(Number(tErp.lastInsertRowid), getUid('Dhanush'));
      insertTeamMember.run(Number(tQa.lastInsertRowid), getUid('Aman'));

      // 6. Projects (from screenshot)
      const projects = [
        { name: 'Texawave-ERP', key: 'TEXA', desc: 'Enterprise resource planning system for Texawave', owner: getUid('Kamalesh'), start: '2026-09-21', target: '2026-10-21' },
        { name: 'FAS', key: 'FAS', desc: 'Fitness automation system', owner: getUid('Kamalesh'), start: '2026-08-10', target: '2026-11-30' },
        { name: 'Texawave Demo', key: 'DEMO', desc: 'Demo environment for client walkthroughs', owner: getUid('Kamalesh'), start: '2026-07-15', target: '2026-12-31' },
        { name: 'Texawave Website', key: 'WEB', desc: 'Marketing website and landing portals', owner: getUid('Mohammed'), start: '2026-01-01', target: '2026-10-31' },
        { name: 'GymCom', key: 'GYM', desc: 'Gym management system', owner: getUid('Afzal'), start: '2026-05-20', target: '2026-11-15' }
      ];

    const insertProj = db.prepare(`
      INSERT INTO projects (name, key, description, owner_id, status, start_date, target_date, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'Active', ?, ?, ?, ?)
    `);

    const projMap = {};
    for (const p of projects) {
      const res = insertProj.run(p.name, p.key, p.desc, p.owner, p.start, p.target, now, now);
      projMap[p.key] = Number(res.lastInsertRowid);
    }

    // Project Memberships
    const insertProjMember = db.prepare('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)');
    for (const u of Object.values(userMap)) {
      insertProjMember.run(projMap['TEXA'], u, 'Member');
      insertProjMember.run(projMap['FAS'], u, 'Member');
    }

    // 7. Repositories for Texawave-ERP (matching screenshot)
    const insertRepo = db.prepare(`
      INSERT INTO repositories (project_id, name, url, description, is_primary, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insertRepo.run(projMap['TEXA'], 'Main Repository', 'https://github.com/texawave/erp-main', 'Core monorepo repository', 1, now, now);
    insertRepo.run(projMap['TEXA'], 'Frontend', 'https://github.com/texawave/erp-frontend', 'Next.js & React frontend workspace', 0, now, now);
    insertRepo.run(projMap['TEXA'], 'Backend', 'https://github.com/texawave/erp-backend', 'Core API microservices and event brokers', 0, now, now);

    // 8. Sprints
    const insertSprint = db.prepare(`
      INSERT INTO sprints (project_id, name, goal, start_date, end_date, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'active', ?)
    `);
    const sprint1 = insertSprint.run(projMap['TEXA'], 'Sprint 1', 'Stabilize packing pipeline & review workflow', '2026-10-01', '2026-10-25', now);
    const sprint1Id = Number(sprint1.lastInsertRowid);

    // 9. Workflow Configuration
    const defaultTransitions = {
      'To Do': ['In Progress', 'Cancelled'],
      'In Progress': ['Dev Review', 'To Do', 'Hold Box', 'Blocked Box'],
      'Dev Review': ['Ready to Test', 'In Progress', 'Hold Box', 'Blocked Box'],
      'Ready to Test': ['Hold Box', 'Blocked Box', 'Pending QA', 'Dev Review'],
      'Hold Box': ['Ready to Test', 'Pending QA', 'In Progress', 'Dev Review'],
      'Blocked Box': ['Ready to Test', 'Pending QA', 'In Progress', 'Dev Review'],
      'Pending QA': ['QA Testing', 'Ready to Test', 'Hold Box', 'Blocked Box'],
      'QA Testing': ['QA Review', 'In Progress', 'Blocked Box'],
      'QA Review': ['Done', 'QA Testing', 'In Progress', 'Blocked Box'],
      'Done': ['In Progress', 'Dev Review'],
      'Cancelled': ['To Do']
    };

    const holdCats = [
      'Waiting for Materials or Required Information',
      'Awaiting Customer or Manager Confirmation',
      'Waiting for Scheduled Packing Window',
      'Pending Required Document or Approval',
      'Business Dependency Hold'
    ];

    const blockerCats = [
      'Dependent Ticket Unfinished',
      'Required Approval Rejected',
      'Critical Defect Identified',
      'Required Components / Access Unavailable',
      'QA / Mandatory Prerequisite Failed',
      'External Vendor / API Dependency'
    ];

    const insertWfConfig = db.prepare(`
      INSERT INTO workflow_config (
        project_id, hold_box_enabled, blocked_box_enabled,
        allowed_transitions, hold_categories, blocker_categories,
        permitted_roles_release, permitted_roles_override, updated_at
      ) VALUES (?, 1, 1, ?, ?, ?, ?, ?, ?)
    `);

    insertWfConfig.run(
      projMap['TEXA'],
      JSON.stringify(defaultTransitions),
      JSON.stringify(holdCats),
      JSON.stringify(blockerCats),
      JSON.stringify(['super_admin', 'admin', 'project_manager', 'team_lead']),
      JSON.stringify(['super_admin', 'admin', 'project_manager']),
      now
    );

    // 10. Automated Workflow Rules
    const insertRule = db.prepare(`
      INSERT INTO workflow_rules (project_id, name, trigger_event, condition_type, target_status, priority, is_enabled, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
    `);

    insertRule.run(projMap['TEXA'], 'Auto-hold when specifications missing', 'on_status_change', 'missing_info', 'Hold Box', 1, 'Routes ticket to Hold Box if required packing specifications are incomplete', now, now);
    insertRule.run(projMap['TEXA'], 'Auto-block on unresolved dependency', 'on_dependency_change', 'incomplete_dependency', 'Blocked Box', 2, 'Routes ticket to Blocked Box if prerequisite dependency is not Done', now, now);
    insertRule.run(projMap['TEXA'], 'Auto-block on critical defect detected', 'on_qa_fail', 'critical_defect', 'Blocked Box', 3, 'Routes ticket to Blocked Box when critical defect is flagged during QA testing', now, now);
    insertRule.run(projMap['TEXA'], 'Auto-release hold when conditions met', 'on_field_update', 'hold_resolved', 'Ready to Test', 4, 'Permits release back to Ready to Test once hold checklist is satisfied', now, now);
    insertRule.run(projMap['TEXA'], 'Prevent QA entry if prerequisites unmet', 'on_status_change', 'qa_prereq_unmet', 'Ready to Test', 5, 'Blocks movement into Pending QA when packing sign-off is missing', now, now);

    // 11. Tickets (matching the reference UI cards exactly!)
    const insertTicket = db.prepare(`
      INSERT INTO tickets (
        key, project_id, sprint_id, title, description, type, priority, status,
        assignee_id, assignment_type, creator_id, story_points, estimated_hours,
        due_date, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Individual', ?, ?, ?, ?, ?, ?)
    `);

    const t1 = insertTicket.run('TEXA-145', projMap['TEXA'], sprint1Id, 'Project module UI changes', 'Refactor enterprise project module to match Figma system', 'Task', 'High', 'In Progress', getUid('Kamalesh'), getUid('Hyagreenan G'), 5, 12, '2026-10-22', now, now);
    const t2 = insertTicket.run('TEXA-96', projMap['TEXA'], sprint1Id, 'Settings module bug fix', 'Resolve theme preference persistence and toggle latency', 'Bug', 'Medium', 'Dev Review', getUid('Lokesh'), getUid('Kamalesh'), 3, 6, '2026-10-25', now, now);
    const t3 = insertTicket.run('TEXA-41', projMap['TEXA'], sprint1Id, 'Login authentication', 'Implement HTTP-only cookies and persistent session tokens', 'Task', 'High', 'To Do', null, getUid('Kamalesh'), 5, 10, '2026-10-28', now, now);
    const t4 = insertTicket.run('TEXA-18', projMap['TEXA'], sprint1Id, 'User management', 'Role permission matrix and granular per-user overrides', 'Story', 'High', 'QA Testing', getUid('Afzal'), getUid('Kamalesh'), 8, 20, '2026-10-24', now, now);
    const t5 = insertTicket.run('FAS-8', projMap['FAS'], null, 'Quotation API integration', 'Integrate ERP pricing matrix with external Quotation API service', 'Epic', 'Critical', 'Ready to Test', getUid('Dhanush'), getUid('Kamalesh'), 13, 30, '2026-10-14', now, now);
    const t6 = insertTicket.run('FAS-12', projMap['FAS'], null, 'Customer master enhancements', 'Add company code validation and customer credit limits', 'New Feature', 'Medium', 'To Do', getUid('Aman'), getUid('Kamalesh'), 5, 8, '2026-10-26', now, now);
    const t7 = insertTicket.run('WEB-3', projMap['WEB'], null, 'Landing page redesign', 'Mobile responsive hero section and feature walkthrough', 'Improvement', 'Low', 'In Progress', getUid('Mohammed'), getUid('Kamalesh'), 2, 5, '2026-10-26', now, now);

    // 12. Tickets specifically in Hold Box and Blocked Box!
    const tHold = insertTicket.run(
      'TEXA-102', projMap['TEXA'], sprint1Id,
      'Inventory - Stock Availability Service',
      'Real-time warehouse inventory synchronization connector',
      'Task', 'High', 'Hold Box',
      getUid('Kamalesh'), getUid('Hyagreenan G'), 8, 16, '2026-10-28', now, now
    );

    const tBlocked = insertTicket.run(
      'TEXA-110', projMap['TEXA'], sprint1Id,
      'Quotation Customer Picker Component',
      'Autocomplete customer search component inside quotation creation modal',
      'Task', 'Critical', 'Blocked Box',
      getUid('Karthik'), getUid('Kamalesh'), 5, 10, '2026-10-27', now, now
    );

    const tDone1 = insertTicket.run(
      'TEXA-80', projMap['TEXA'], sprint1Id,
      'Sales - Quotation creation workflow',
      'End-to-end quotation generation and export to PDF',
      'Story', 'Medium', 'Done',
      getUid('Kamalesh'), getUid('Hyagreenan G'), 5, 14, '2026-10-18', now, now
    );

    // 13. Create Hold Box Record
    const insertHoldRecord = db.prepare(`
      INSERT INTO hold_box_records (
        ticket_id, hold_reason, category, responsible_owner_id, responsible_owner_name,
        expected_release_date, notes, entered_by_user_id, entered_at, is_active, previous_stage
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'Ready to Test')
    `);
    insertHoldRecord.run(
      Number(tHold.lastInsertRowid),
      'Awaiting customer and warehouse packing window confirmation',
      'Waiting for Scheduled Packing Window',
      getUid('Kamalesh'),
      'Kamalesh',
      '2026-10-28',
      'Materials are staged at Dock 4. Waiting for client dispatch clearance window.',
      getUid('Hyagreenan G'),
      now
    );

    // 14. Create Blocked Box Record
    const insertBlockedRecord = db.prepare(`
      INSERT INTO blocked_box_records (
        ticket_id, blocker_description, category, responsible_name, severity,
        linked_ticket_id, expected_resolution_date, entered_by_user_id, entered_at, is_active, previous_stage
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'Ready to Test')
    `);
    insertBlockedRecord.run(
      Number(tBlocked.lastInsertRowid),
      'Critical blocker: Dependent Quotation API schema breaking changes in FAS-8',
      'Dependent Ticket Unfinished',
      'Dhanush (Backend Team)',
      'Critical',
      Number(t5.lastInsertRowid),
      '2026-10-27',
      getUid('Kamalesh'),
      now
    );

    // Ticket Link (TEXA-110 is blocked by FAS-8)
    const insertLink = db.prepare('INSERT INTO ticket_links (source_ticket_id, target_ticket_id, link_type, created_at) VALUES (?, ?, ?, ?)');
    insertLink.run(Number(tBlocked.lastInsertRowid), Number(t5.lastInsertRowid), 'is_blocked_by', now);

    // 15. Initial Audit and Security Logs
    const insertAudit = db.prepare(`
      INSERT INTO audit_logs (actor_id, actor_name, action, target_resource, target_id, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insertAudit.run(getUid('Hyagreenan G'), 'Hyagreenan G', 'SYSTEM_INITIALIZATION', 'WORKSPACE', 'MAIN', 'TaskFlow enterprise platform initialized with secure roles and workflow branches', now);
    insertAudit.run(getUid('Kamalesh'), 'Kamalesh', 'HOLD_BOX_ENTER', 'TICKET', 'TEXA-102', 'Moved to Hold Box: Awaiting customer and warehouse packing window confirmation', now);
    insertAudit.run(getUid('Kamalesh'), 'Kamalesh', 'BLOCKED_BOX_ENTER', 'TICKET', 'TEXA-110', 'Moved to Blocked Box: Blocked by FAS-8 quotation schema', now);

    const insertSecEvent = db.prepare(`
      INSERT INTO security_events (event_type, actor_id, ip_address, severity, details, created_at)
      VALUES (?, ?, '127.0.0.1', 'INFO', ?, ?)
    `);
    insertSecEvent.run('ACCOUNT_ACTIVATION', getUid('Hyagreenan G'), 'Super Administrator account USR-ADMIN provisioned with scrypt encryption', now);

    // 16. In-App Notifications
    const insertNotification = db.prepare(`
      INSERT INTO notifications (user_id, title, message, link, type, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insertNotification.run(getUid('Hyagreenan G'), 'Welcome to TaskFlow', 'Your enterprise workspace is active with 5 projects and 10 tickets.', '/dashboard', 'info', now);
    insertNotification.run(getUid('Kamalesh'), 'Ticket Moved to Hold Box', 'TEXA-102 has been paused awaiting warehouse packing window confirmation.', '/board', 'hold', now);
    insertNotification.run(getUid('Karthik'), 'Blocker Flagged on TEXA-110', 'Critical blocker recorded: Dependent Quotation API schema breaking changes in FAS-8.', '/board', 'blocked', now);
    }

    db.exec('COMMIT;');
    console.log('[Seed] Enterprise TaskFlow database seeded successfully.');
  } catch (err) {
    db.exec('ROLLBACK;');
    console.error('[Seed] Database seeding failed:', err);
    throw err;
  }
}

