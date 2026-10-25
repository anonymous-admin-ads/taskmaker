import { getDatabase } from '../db/database.js';

export function isRoleEnforcementEnabled() {
  try {
    const db = getDatabase();
    const row = db.prepare("SELECT is_enabled FROM ui_element_controls WHERE element_id = 'btn_role_enforcement'").get();
    if (!row) return true; // Enabled by default
    return row.is_enabled === 1;
  } catch (e) {
    return true;
  }
}

export function hasPermission(user, resource, action, projectId = null) {
  if (!user) return false;
  
  // Super Admin has universal access
  if (user.role === 'super_admin') return true;

  // IF DEVELOPER CONSOLE TURNS OFF ROLE ENFORCEMENT:
  // All users can be used without any role restrictions across the entire website!
  if (!isRoleEnforcementEnabled()) {
    return true;
  }

  const db = getDatabase();

  // 1. Check Per-User Overrides first
  let overrideQuery = `
    SELECT is_granted FROM user_permission_overrides
    WHERE user_id = ? AND resource = ? AND action = ?
  `;
  const params = [user.id, resource, action];

  if (projectId) {
    overrideQuery += ' AND (scope_project_id = ? OR scope_project_id IS NULL) ORDER BY scope_project_id DESC LIMIT 1';
    params.push(projectId);
  } else {
    overrideQuery += ' AND scope_project_id IS NULL LIMIT 1';
  }

  const override = db.prepare(overrideQuery).get(...params);
  if (override) {
    return override.is_granted === 1;
  }

  // 2. Check Role Permissions
  const rolePerm = db.prepare(`
    SELECT id FROM role_permissions
    WHERE LOWER(role_id) = LOWER(?) AND resource = ? AND action = ?
  `).get(user.role, resource, action);

  if (!rolePerm) return false;

  // 3. For project-scoped actions, check membership, project ownership, or management role
  if (projectId && !['super_admin', 'admin', 'project_manager'].includes(user.role?.toLowerCase())) {
    const isOwner = db.prepare('SELECT id FROM projects WHERE id = ? AND owner_id = ?').get(projectId, user.id);
    if (!isOwner) {
      const isMember = db.prepare(`
        SELECT id FROM project_members
        WHERE project_id = ? AND user_id = ?
      `).get(projectId, user.id);
      
      // If not a project member and not project owner, deny
      if (!isMember) return false;
    }
  }

  return true;
}

export function getUserEffectivePermissions(userId, role) {
  const db = getDatabase();
  const roleEnforcement = isRoleEnforcementEnabled();

  if (!roleEnforcement || role?.toLowerCase() === 'super_admin') {
    return {
      isSuperAdmin: role?.toLowerCase() === 'super_admin',
      roleEnforcementDisabled: !roleEnforcement,
      allAllowed: true
    };
  }

  const rolePerms = db.prepare(`
    SELECT resource, action FROM role_permissions WHERE LOWER(role_id) = LOWER(?)
  `).all(role || '');

  const overrides = db.prepare(`
    SELECT resource, action, is_granted, scope_project_id FROM user_permission_overrides WHERE user_id = ?
  `).all(userId);

  const pages = db.prepare(`
    SELECT page_key, is_visible FROM user_page_visibility WHERE user_id = ?
  `).all(userId);

  return {
    isSuperAdmin: false,
    roleEnforcementDisabled: false,
    rolePermissions: rolePerms,
    userOverrides: overrides,
    pageVisibility: pages
  };
}

export function requirePermission(resource, action) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const projectId = req.body?.projectId || req.query?.projectId || req.params?.projectId || null;
    if (!hasPermission(req.user, resource, action, projectId)) {
      return res.status(403).json({
        error: `Forbidden: You lack '${action}' permission on '${resource}'`,
        resource,
        action
      });
    }
    next();
  };
}

export function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (!['super_admin', 'admin', 'developer_console_admin'].includes(req.user.role)) {
    // If developer turned off role enforcement, allow workspace users to access administrative features
    if (!isRoleEnforcementEnabled()) {
      return next();
    }
    return res.status(403).json({ error: 'Forbidden: Platform Administrator access required' });
  }
  next();
}

