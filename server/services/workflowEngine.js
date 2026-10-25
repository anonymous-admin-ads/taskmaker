import { getDatabase } from '../db/database.js';
import { logAudit } from './auditService.js';
import { isRoleEnforcementEnabled } from './permissionService.js';

// Default transitions fallback
const DEFAULT_ALLOWED_TRANSITIONS = {
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

export function getWorkflowConfig(projectId = null) {
  const db = getDatabase();
  let row = null;
  if (projectId) {
    row = db.prepare('SELECT * FROM workflow_config WHERE project_id = ?').get(projectId);
  }
  if (!row) {
    row = db.prepare('SELECT * FROM workflow_config LIMIT 1').get();
  }

  if (!row) {
    return {
      holdBoxEnabled: true,
      blockedBoxEnabled: true,
      allowedTransitions: DEFAULT_ALLOWED_TRANSITIONS,
      holdCategories: [
        'Waiting for Materials or Required Information',
        'Awaiting Customer or Manager Confirmation',
        'Waiting for Scheduled Packing Window',
        'Pending Required Document or Approval',
        'Business Dependency Hold'
      ],
      blockerCategories: [
        'Dependent Ticket Unfinished',
        'Required Approval Rejected',
        'Critical Defect Identified',
        'Required Components / Access Unavailable',
        'QA / Mandatory Prerequisite Failed',
        'External Vendor / API Dependency'
      ],
      permittedRolesRelease: ['super_admin', 'admin', 'project_manager', 'team_lead'],
      permittedRolesOverride: ['super_admin', 'admin', 'project_manager']
    };
  }

  return {
    holdBoxEnabled: row.hold_box_enabled === 1,
    blockedBoxEnabled: row.blocked_box_enabled === 1,
    allowedTransitions: JSON.parse(row.allowed_transitions || '{}'),
    holdCategories: JSON.parse(row.hold_categories || '[]'),
    blockerCategories: JSON.parse(row.blocker_categories || '[]'),
    permittedRolesRelease: JSON.parse(row.permitted_roles_release || '[]'),
    permittedRolesOverride: JSON.parse(row.permitted_roles_override || '[]')
  };
}

export function validateTransition(currentStatus, targetStatus, projectId = null) {
  const config = getWorkflowConfig(projectId);
  
  if (targetStatus === 'Hold Box' && !config.holdBoxEnabled) {
    return { valid: false, reason: 'Hold Box stage is currently disabled in workflow configuration' };
  }
  if (targetStatus === 'Blocked Box' && !config.blockedBoxEnabled) {
    return { valid: false, reason: 'Blocked Box stage is currently disabled in workflow configuration' };
  }

  const allowed = config.allowedTransitions[currentStatus];
  if (!allowed || !allowed.includes(targetStatus)) {
    return {
      valid: false,
      reason: `Transition from '${currentStatus}' to '${targetStatus}' is not permitted by workflow rules`
    };
  }

  return { valid: true };
}

export function transitionTicket({
  ticketId,
  targetStatus,
  user,
  holdData = null,
  blockedData = null,
  releaseData = null,
  expectedVersion = null,
  isOverride = false,
  overrideReason = null
}) {
  const db = getDatabase();
  const now = new Date().toISOString();

  // Load ticket
  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);
  if (!ticket) {
    throw new Error(`Ticket with ID ${ticketId} not found`);
  }

  // Optimistic concurrency check
  if (expectedVersion !== null && ticket.version !== expectedVersion) {
    throw new Error(`Concurrency Conflict: Ticket ${ticket.key} was modified by another user (expected v${expectedVersion}, current v${ticket.version}). Please refresh.`);
  }

  const currentStatus = ticket.status;
  if (currentStatus === targetStatus) {
    return { ticket, unchanged: true };
  }

  // Check override authorization
  if (isOverride) {
    const config = getWorkflowConfig(ticket.project_id);
    const roleEnforcement = isRoleEnforcementEnabled();
    if (roleEnforcement && !['super_admin', 'admin'].includes(user.role) && !config.permittedRolesOverride.includes(user.role)) {
      throw new Error(`User role '${user.role}' is not authorized to perform task overrides`);
    }
    if (!overrideReason || overrideReason.trim().length < 5) {
      throw new Error('A valid reason (minimum 5 characters) is required to override this task');
    }
  } else {
    // Normal transition validation
    const validation = validateTransition(currentStatus, targetStatus, ticket.project_id);
    if (!validation.valid) {
      throw new Error(validation.reason);
    }
  }

  // Hold Box Validation
  if (targetStatus === 'Hold Box') {
    if (!holdData || !holdData.hold_reason || holdData.hold_reason.trim() === '') {
      throw new Error('A hold reason is mandatory when routing a ticket to Hold Box');
    }
    if (!holdData.responsible_owner_name && !holdData.responsible_owner_id) {
      throw new Error('A responsible owner is mandatory when placing a ticket in Hold Box');
    }
  }

  // Blocked Box Validation
  if (targetStatus === 'Blocked Box') {
    if (!blockedData || !blockedData.blocker_description || blockedData.blocker_description.trim() === '') {
      throw new Error('A blocker description is mandatory when placing a ticket in Blocked Box');
    }
    if (!blockedData.category) {
      throw new Error('A blocking category is mandatory for Blocked Box entry');
    }
    if (!blockedData.responsible_name) {
      throw new Error('Responsible person or team is mandatory for Blocked Box entry');
    }
    if (!blockedData.severity) {
      throw new Error('Severity level is mandatory for Blocked Box entry');
    }
  }

  // Release authorization check if releasing from Hold or Blocked
  if (currentStatus === 'Hold Box' || currentStatus === 'Blocked Box') {
    const config = getWorkflowConfig(ticket.project_id);
    const roleEnforcement = isRoleEnforcementEnabled();
    if (roleEnforcement && !['super_admin', 'admin'].includes(user.role) && !config.permittedRolesRelease.includes(user.role)) {
      throw new Error(`Your role '${user.role}' is not permitted to release or resolve tickets from ${currentStatus}`);
    }
  }

  // Perform transactional state change
  db.exec('BEGIN IMMEDIATE;');

  try {
    // 1. Update ticket status & version
    db.prepare(`
      UPDATE tickets
      SET status = ?, version = version + 1, updated_at = ?
      WHERE id = ?
    `).run(targetStatus, now, ticketId);

    // 2. Handle Hold Box Entry
    if (targetStatus === 'Hold Box') {
      db.prepare(`
        INSERT INTO hold_box_records (
          ticket_id, hold_reason, category, responsible_owner_id, responsible_owner_name,
          expected_release_date, notes, attachments_meta, entered_by_user_id, entered_at,
          is_active, previous_stage
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
      `).run(
        ticketId,
        holdData.hold_reason.trim(),
        holdData.category || 'General Hold',
        holdData.responsible_owner_id || null,
        holdData.responsible_owner_name || user.name,
        holdData.expected_release_date || null,
        holdData.notes || null,
        holdData.attachments_meta ? JSON.stringify(holdData.attachments_meta) : null,
        user.id,
        now,
        currentStatus
      );
    }

    // 3. Handle Hold Box Release
    if (currentStatus === 'Hold Box') {
      db.prepare(`
        UPDATE hold_box_records
        SET is_active = 0, released_at = ?, released_by_user_id = ?, release_notes = ?, next_stage = ?
        WHERE ticket_id = ? AND is_active = 1
      `).run(
        now,
        user.id,
        releaseData?.release_notes || 'Hold condition resolved',
        targetStatus,
        ticketId
      );
    }

    // 4. Handle Blocked Box Entry
    if (targetStatus === 'Blocked Box') {
      db.prepare(`
        INSERT INTO blocked_box_records (
          ticket_id, blocker_description, category, responsible_name, severity,
          linked_ticket_id, expected_resolution_date, entered_by_user_id, entered_at,
          is_active, previous_stage
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
      `).run(
        ticketId,
        blockedData.blocker_description.trim(),
        blockedData.category,
        blockedData.responsible_name,
        blockedData.severity,
        blockedData.linked_ticket_id || null,
        blockedData.expected_resolution_date || null,
        user.id,
        now,
        currentStatus
      );

      // Create ticket link if linked_ticket_id is provided
      if (blockedData.linked_ticket_id) {
        db.prepare(`
          INSERT OR IGNORE INTO ticket_links (source_ticket_id, target_ticket_id, link_type, created_at)
          VALUES (?, ?, 'is_blocked_by', ?)
        `).run(ticketId, blockedData.linked_ticket_id, now);
      }
    }

    // 5. Handle Blocked Box Resolution
    if (currentStatus === 'Blocked Box') {
      db.prepare(`
        UPDATE blocked_box_records
        SET is_active = 0, resolved_at = ?, resolved_by_user_id = ?, resolution_notes = ?, next_stage = ?
        WHERE ticket_id = ? AND is_active = 1
      `).run(
        now,
        user.id,
        releaseData?.resolution_notes || 'Blocker resolved and verified',
        targetStatus,
        ticketId
      );
    }

    // 6. Record Audit Log
    const actionType = isOverride
      ? 'TICKET_OVERRIDE'
      : (targetStatus === 'Hold Box' ? 'HOLD_BOX_ENTER' :
         targetStatus === 'Blocked Box' ? 'BLOCKED_BOX_ENTER' :
         currentStatus === 'Hold Box' ? 'HOLD_BOX_RELEASE' :
         currentStatus === 'Blocked Box' ? 'BLOCKED_BOX_RESOLVE' : 'STATUS_TRANSITION');

    logAudit({
      actorId: user.id,
      actorName: user.name,
      action: actionType,
      targetResource: 'TICKET',
      targetId: ticket.key,
      details: {
        ticketId,
        fromStatus: currentStatus,
        toStatus: targetStatus,
        isOverride,
        overrideReason,
        holdData,
        blockedData,
        releaseData
      }
    });

    // 7. Notify Assignee / Creator
    if (ticket.assignee_id && ticket.assignee_id !== user.id) {
      db.prepare(`
        INSERT INTO notifications (user_id, title, message, link, type, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        ticket.assignee_id,
        `Status changed for ${ticket.key}`,
        `${user.name} moved ${ticket.key} to ${targetStatus}${targetStatus === 'Hold Box' ? ' (On Hold)' : targetStatus === 'Blocked Box' ? ' (Blocked)' : ''}.`,
        `/board`,
        targetStatus === 'Hold Box' ? 'hold' : targetStatus === 'Blocked Box' ? 'blocked' : 'info',
        now
      );
    }

    db.exec('COMMIT;');

    const updated = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);
    return { ticket: updated, previousStatus: currentStatus };
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

// Configurable Rules Engine Evaluation
export function evaluateWorkflowRules(ticketId, eventType, triggerUser, contextData = {}) {
  const db = getDatabase();
  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);
  if (!ticket) return null;

  // Fetch active rules applicable to this project (or global)
  const rules = db.prepare(`
    SELECT * FROM workflow_rules
    WHERE is_enabled = 1 AND (project_id = ? OR project_id IS NULL)
    ORDER BY priority ASC, id ASC
  `).all(ticket.project_id);

  if (rules.length === 0) return null;

  for (const rule of rules) {
    // Infinite loop & conflict prevention:
    // Check if this rule executed for this ticket within the last 30 seconds
    const recentExec = db.prepare(`
      SELECT id, execution_timestamp FROM workflow_rule_executions
      WHERE rule_id = ? AND ticket_id = ? AND execution_timestamp >= datetime('now', '-30 seconds')
    `).get(rule.id, ticketId);

    if (recentExec) {
      // Loop protection: skip rule to prevent infinite ping-pong
      db.prepare(`
        INSERT INTO workflow_rule_executions (rule_id, ticket_id, triggered_by_user_id, from_status, to_status, condition_evaluated, execution_timestamp, status, details)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'), 'conflict_prevented', 'Execution suppressed to prevent infinite loop or duplicate event within 30s window')
      `).run(rule.id, ticketId, triggerUser.id, ticket.status, rule.target_status, rule.condition_type);
      continue;
    }

    let conditionMet = false;
    let evalDetails = '';

    switch (rule.condition_type) {
      case 'missing_info':
        if (contextData.missing_required_info || (!ticket.description || ticket.description.length < 10)) {
          conditionMet = true;
          evalDetails = 'Required specifications or ticket details are incomplete';
        }
        break;

      case 'waiting_approval':
        if (contextData.waiting_approval) {
          conditionMet = true;
          evalDetails = 'Pending customer or managerial sign-off';
        }
        break;

      case 'incomplete_dependency':
        // Check if any blocking ticket is not Done
        const blockers = db.prepare(`
          SELECT t.key, t.status FROM ticket_links tl
          JOIN tickets t ON tl.target_ticket_id = t.id
          WHERE tl.source_ticket_id = ? AND tl.link_type = 'is_blocked_by' AND t.status != 'Done'
        `).all(ticketId);
        if (blockers.length > 0) {
          conditionMet = true;
          evalDetails = `Incomplete dependencies: ${blockers.map(b => `${b.key} (${b.status})`).join(', ')}`;
        }
        break;

      case 'critical_defect':
        if (contextData.critical_defect || (ticket.type === 'Bug' && ticket.priority === 'Critical')) {
          conditionMet = true;
          evalDetails = 'Critical defect identified impeding release';
        }
        break;

      case 'hold_resolved':
        if (ticket.status === 'Hold Box' && contextData.hold_conditions_satisfied) {
          conditionMet = true;
          evalDetails = 'Hold prerequisites marked resolved';
        }
        break;

      case 'blockers_cleared':
        if (ticket.status === 'Blocked Box') {
          const activeBlockers = db.prepare(`
            SELECT count(*) as count FROM ticket_links tl
            JOIN tickets t ON tl.target_ticket_id = t.id
            WHERE tl.source_ticket_id = ? AND tl.link_type = 'is_blocked_by' AND t.status != 'Done'
          `).get(ticketId).count;
          if (activeBlockers === 0) {
            conditionMet = true;
            evalDetails = 'All blocking tickets have reached Done status';
          }
        }
        break;

      case 'qa_prereq_unmet':
        if (contextData.targetStatus === 'QA Testing' && !contextData.packingApproved) {
          conditionMet = true;
          evalDetails = 'Ready to Test sign-off is missing prior to QA Testing';
        }
        break;
    }

    if (conditionMet) {
      // Execute automated transition safely
      try {
        let holdData = null;
        let blockedData = null;
        let releaseData = null;

        if (rule.target_status === 'Hold Box') {
          holdData = {
            hold_reason: `[Automated Rule: ${rule.name}] ${evalDetails}`,
            category: 'Business Dependency Hold',
            responsible_owner_name: triggerUser.name,
            responsible_owner_id: triggerUser.id,
            notes: 'Automated workflow transition initiated by rule engine'
          };
        } else if (rule.target_status === 'Blocked Box') {
          blockedData = {
            blocker_description: `[Automated Rule: ${rule.name}] ${evalDetails}`,
            category: 'Dependent Ticket Unfinished',
            responsible_name: triggerUser.name,
            severity: 'High'
          };
        } else if (ticket.status === 'Hold Box' || ticket.status === 'Blocked Box') {
          releaseData = {
            release_notes: `[Automated Rule: ${rule.name}] ${evalDetails}`,
            resolution_notes: `[Automated Rule: ${rule.name}] ${evalDetails}`
          };
        }

        const result = transitionTicket({
          ticketId,
          targetStatus: rule.target_status,
          user: triggerUser,
          holdData,
          blockedData,
          releaseData,
          isOverride: false
        });

        // Record execution in rule execution table
        db.prepare(`
          INSERT INTO workflow_rule_executions (
            rule_id, ticket_id, triggered_by_user_id, from_status, to_status,
            condition_evaluated, execution_timestamp, status, details
          ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), 'success', ?)
        `).run(rule.id, ticketId, triggerUser.id, ticket.status, rule.target_status, rule.condition_type, evalDetails);

        return { ruleExecuted: rule, result };
      } catch (err) {
        db.prepare(`
          INSERT INTO workflow_rule_executions (
            rule_id, ticket_id, triggered_by_user_id, from_status, to_status,
            condition_evaluated, execution_timestamp, status, details
          ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), 'error', ?)
        `).run(rule.id, ticketId, triggerUser.id, ticket.status, rule.target_status, rule.condition_type, err.message);
      }
    }
  }

  return null;
}

