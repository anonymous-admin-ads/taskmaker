import React, { useState, useEffect } from 'react';
import {
  X, PauseCircle, Ban, PlayCircle, CheckCircle, ShieldAlert,
  MessageSquare, History, CheckSquare, Link2, Clock, Send, AlertTriangle
} from 'lucide-react';
import { Ticket, User } from '../../types';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useUiControls } from '../../context/UiControlsContext';
import { DevAuthorityControl } from '../common/DevAuthorityControl';
import { HoldBoxModal } from './HoldBoxModal';
import { BlockedBoxModal } from './BlockedBoxModal';
import { ReleaseHoldModal } from './ReleaseHoldModal';
import { ResolveBlockerModal } from './ResolveBlockerModal';
import { OverrideTaskModal } from './OverrideTaskModal';

interface TicketDetailModalProps {
  ticketId: number;
  users: User[];
  projectTickets: Ticket[];
  onClose: () => void;
  onTicketUpdated: () => void;
}

export const TicketDetailModal: React.FC<TicketDetailModalProps> = ({
  ticketId,
  users,
  projectTickets,
  onClose,
  onTicketUpdated,
}) => {
  const { user } = useAuth();
  const { success, error } = useToast();
  const { isButtonEnabled } = useUiControls();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'details' | 'comments' | 'reviews' | 'history'>('details');

  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // Sub-modal states
  const [showHoldModal, setShowHoldModal] = useState(false);
  const [showBlockedModal, setShowBlockedModal] = useState(false);
  const [showReleaseModal, setShowReleaseModal] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [showOverrideModal, setShowOverrideModal] = useState(false);

  const loadTicket = async () => {
    try {
      setLoading(true);
      const res = await api.getTicket(ticketId);
      setTicket(res.ticket);
    } catch (err: any) {
      error('Failed to load ticket details', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTicket();
  }, [ticketId]);

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    try {
      setSubmittingComment(true);
      await api.addComment(ticketId, newComment.trim());
      setNewComment('');
      success('Comment posted');
      loadTicket();
    } catch (err: any) {
      error('Failed to add comment', err.message);
    } finally {
      setSubmittingComment(false);
    }
  };

  // Workflow Action Handlers
  const handleHoldConfirm = async (data: any) => {
    await api.transitionTicket(ticketId, {
      targetStatus: 'Hold Box',
      holdData: data,
      expectedVersion: ticket?.version,
    });
    success('Moved to Hold Box', `${ticket?.key} is now temporarily on hold`);
    loadTicket();
    onTicketUpdated();
  };

  const handleBlockedConfirm = async (data: any) => {
    await api.transitionTicket(ticketId, {
      targetStatus: 'Blocked Box',
      blockedData: data,
      expectedVersion: ticket?.version,
    });
    success('Moved to Blocked Box', `Blocker recorded for ${ticket?.key}`);
    loadTicket();
    onTicketUpdated();
  };

  const handleReleaseConfirm = async (targetStatus: any, releaseNotes: string) => {
    await api.transitionTicket(ticketId, {
      targetStatus,
      releaseData: { release_notes: releaseNotes },
      expectedVersion: ticket?.version,
    });
    success('Hold Released', `${ticket?.key} resumed to ${targetStatus}`);
    loadTicket();
    onTicketUpdated();
  };

  const handleResolveConfirm = async (targetStatus: any, resolutionNotes: string) => {
    await api.transitionTicket(ticketId, {
      targetStatus,
      releaseData: { resolution_notes: resolutionNotes },
      expectedVersion: ticket?.version,
    });
    success('Blocker Resolved', `${ticket?.key} returned to ${targetStatus}`);
    loadTicket();
    onTicketUpdated();
  };

  const handleOverrideConfirm = async (data: any) => {
    await api.overrideTicket(ticketId, data);
    success('Task Overridden', 'Audit event recorded successfully');
    loadTicket();
    onTicketUpdated();
  };

  if (loading || !ticket) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
        <div className="p-8 rounded-2xl border border-theme-border bg-theme-surface text-theme-muted text-xs animate-pulse">
          Loading ticket details...
        </div>
      </div>
    );
  }

  const isHold = ticket.status === 'Hold Box';
  const isBlocked = ticket.status === 'Blocked Box';

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in">
        <div className="w-full max-w-3xl rounded-2xl border border-theme-border bg-theme-surface shadow-2xl overflow-hidden my-6 flex flex-col max-h-[90vh]">
          {/* Top Bar: Key, Status, Actions, Close */}
          <div className="p-4 border-b border-theme-border flex items-center justify-between shrink-0 bg-theme-bg/40">
            <div className="flex items-center gap-3">
              <span className="font-mono font-bold text-sm text-theme-primary px-2.5 py-1 rounded bg-theme-primary/10 border border-theme-primary/20">
                {ticket.key}
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold border border-theme-border bg-theme-surface text-theme-text">
                {ticket.status}
              </span>
              <span className="text-xs px-2 py-0.5 rounded font-medium bg-slate-800 text-slate-300">
                {ticket.type}
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded font-semibold ${
                  ticket.priority === 'Critical'
                    ? 'bg-rose-500/20 text-rose-400'
                    : ticket.priority === 'High'
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-sky-500/20 text-sky-400'
                }`}
              >
                {ticket.priority}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Override Button (Admin / PM) - UI Authority Controlled */}
              <DevAuthorityControl elementId="btn_override_task" name="Override Task" location="Ticket Modal" inline>
                <button
                  onClick={() => setShowOverrideModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-500/30 text-rose-300 hover:bg-rose-500/10 text-xs font-semibold transition"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Override</span>
                </button>
              </DevAuthorityControl>

              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-theme-muted hover:text-theme-text hover:bg-theme-surface-hover transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* ACTIVE HOLD BOX BANNER */}
          {isHold && ticket.activeHold && (
            <div className="p-3.5 bg-amber-500/15 border-b border-amber-500/30 flex items-center justify-between gap-4 shrink-0">
              <div className="flex items-start gap-2.5 min-w-0">
                <PauseCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="min-w-0 text-xs">
                  <div className="font-semibold text-amber-300 flex items-center gap-2">
                    <span>TICKET ON TEMPORARY HOLD</span>
                    {ticket.activeHold.expected_release_date && (
                      <span className="text-[11px] text-amber-200/80 font-normal">
                        (Expected Release: {ticket.activeHold.expected_release_date})
                      </span>
                    )}
                  </div>
                  <div className="text-amber-100/90 truncate mt-0.5">
                    <span className="font-medium">Reason:</span> {ticket.activeHold.hold_reason}
                  </div>
                  <div className="text-[11px] text-amber-200/70 mt-0.5">
                    Owner: {ticket.activeHold.responsible_owner_name} • Entered: {new Date(ticket.activeHold.entered_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowReleaseModal(true)}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shrink-0 transition flex items-center gap-1.5 shadow-md shadow-emerald-500/20"
              >
                <PlayCircle className="w-4 h-4" />
                <span>Release Hold</span>
              </button>
            </div>
          )}

          {/* ACTIVE BLOCKED BOX BANNER */}
          {isBlocked && ticket.activeBlocker && (
            <div className="p-3.5 bg-rose-500/15 border-b border-rose-500/40 flex items-center justify-between gap-4 shrink-0">
              <div className="flex items-start gap-2.5 min-w-0">
                <Ban className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div className="min-w-0 text-xs">
                  <div className="font-semibold text-rose-300 flex items-center gap-2">
                    <span>WORK BLOCKED — CRITICAL IMPEDIMENT</span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] bg-rose-500/30 text-rose-200 border border-rose-500/40">
                      {ticket.activeBlocker.severity}
                    </span>
                  </div>
                  <div className="text-rose-100/90 truncate mt-0.5">
                    <span className="font-medium">Blocker:</span> {ticket.activeBlocker.blocker_description}
                  </div>
                  <div className="text-[11px] text-rose-200/70 mt-0.5">
                    Responsible: {ticket.activeBlocker.responsible_name} • Category: {ticket.activeBlocker.category}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowResolveModal(true)}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shrink-0 transition flex items-center gap-1.5 shadow-md shadow-emerald-500/20"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Resolve Blocker</span>
              </button>
            </div>
          )}

          {/* Title & Quick Stage Transitions */}
          <div className="p-5 border-b border-theme-border/60 shrink-0">
            <h2 className="text-lg font-bold text-theme-text leading-snug">{ticket.title}</h2>
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span className="text-xs text-theme-muted font-medium">Quick Branching:</span>
              {!isHold && (
                <DevAuthorityControl elementId="btn_ticket_route_hold" name="Route to Hold Box" location="Ticket Modal" inline>
                  <button
                    onClick={() => setShowHoldModal(true)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-medium hover:bg-amber-500/20 transition"
                  >
                    <PauseCircle className="w-3.5 h-3.5" />
                    <span>Route to Hold Box</span>
                  </button>
                </DevAuthorityControl>
              )}
              {!isBlocked && (
                <DevAuthorityControl elementId="btn_ticket_route_blocked" name="Route to Blocked Box" location="Ticket Modal" inline>
                  <button
                    onClick={() => setShowBlockedModal(true)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium hover:bg-rose-500/20 transition"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>Route to Blocked Box</span>
                  </button>
                </DevAuthorityControl>
              )}
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-4 px-5 border-b border-theme-border text-xs font-medium text-theme-muted shrink-0">
            <button
              onClick={() => setActiveTab('details')}
              className={`py-3 border-b-2 transition ${
                activeTab === 'details'
                  ? 'border-theme-primary text-theme-primary font-bold'
                  : 'border-transparent hover:text-theme-text'
              }`}
            >
              Details & Attributes
            </button>
            <button
              onClick={() => setActiveTab('comments')}
              className={`py-3 border-b-2 transition flex items-center gap-1.5 ${
                activeTab === 'comments'
                  ? 'border-theme-primary text-theme-primary font-bold'
                  : 'border-transparent hover:text-theme-text'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Comments ({ticket.comments?.length || 0})</span>
            </button>
            <button
              onClick={() => setActiveTab('reviews')}
              className={`py-3 border-b-2 transition flex items-center gap-1.5 ${
                activeTab === 'reviews'
                  ? 'border-theme-primary text-theme-primary font-bold'
                  : 'border-transparent hover:text-theme-text'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>QA & Reviews</span>
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`py-3 border-b-2 transition flex items-center gap-1.5 ${
                activeTab === 'history'
                  ? 'border-theme-primary text-theme-primary font-bold'
                  : 'border-transparent hover:text-theme-text'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Activity Trail</span>
            </button>
          </div>

          {/* Tab Content Body (Scrollable) */}
          <div className="p-5 overflow-y-auto flex-1 space-y-5">
            {activeTab === 'details' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Main 2 columns: Description & Links */}
                <div className="md:col-span-2 space-y-4">
                  <div>
                    <h4 className="text-xs font-semibold text-theme-muted uppercase tracking-wider mb-2">Description</h4>
                    <div className="p-3.5 rounded-xl bg-theme-bg/60 border border-theme-border text-xs text-theme-text whitespace-pre-wrap leading-relaxed min-h-[90px]">
                      {ticket.description || 'No description provided.'}
                    </div>
                  </div>

                  {/* Linked Work Items */}
                  <div>
                    <h4 className="text-xs font-semibold text-theme-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Link2 className="w-3.5 h-3.5" />
                      <span>Linked Work Items ({ticket.links?.length || 0})</span>
                    </h4>
                    {ticket.links && ticket.links.length > 0 ? (
                      <div className="space-y-2">
                        {ticket.links.map(l => (
                          <div
                            key={l.id}
                            className="p-2.5 rounded-lg bg-theme-bg border border-theme-border flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-theme-primary font-bold">{l.target_key}</span>
                              <span className="text-theme-text truncate max-w-xs">{l.target_title}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-theme-muted uppercase tracking-wider">{l.link_type}</span>
                              <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300">{l.target_status}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-3 rounded-lg bg-theme-bg/40 border border-dashed border-theme-border text-xs text-theme-muted text-center">
                        No linked dependencies or blockers
                      </div>
                    )}
                  </div>
                </div>

                {/* Right 1 column: Metadata Attributes */}
                <div className="p-4 rounded-xl bg-theme-bg/40 border border-theme-border space-y-3.5 text-xs">
                  <div>
                    <span className="text-theme-muted block text-[11px] mb-1">Assignee</span>
                    <div className="flex items-center gap-2 font-medium text-theme-text">
                      <div className="w-6 h-6 rounded-full bg-theme-primary/20 text-theme-primary font-bold text-[10px] flex items-center justify-center">
                        {ticket.assignee_avatar || 'U'}
                      </div>
                      <span>{ticket.assignee_name || 'Unassigned'}</span>
                    </div>
                  </div>

                  <div>
                    <span className="text-theme-muted block text-[11px] mb-1">Sprint</span>
                    <span className="font-medium text-theme-text">{ticket.sprint_name || 'Backlog'}</span>
                  </div>

                  <div className="border-t border-theme-border pt-3">
                    <span className="text-theme-muted block text-[10px] font-mono">
                      Version: v{ticket.version} • Created: {new Date(ticket.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Comments Tab */}
            {activeTab === 'comments' && (
              <div className="space-y-4">
                <form onSubmit={handleAddComment} className="flex gap-2">
                  <input
                    type="text"
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    placeholder="Write a comment or update..."
                    className="flex-1 bg-theme-bg border border-theme-border rounded-lg px-3 py-2 text-xs text-theme-text placeholder:text-theme-muted focus:outline-none focus:border-theme-primary transition"
                  />
                  <DevAuthorityControl elementId="btn_ticket_send_comment" name="Send Comment Button" location="Ticket Modal" inline>
                    <button
                      type="submit"
                      disabled={submittingComment || !newComment.trim()}
                      className="px-4 py-2 rounded-lg bg-theme-primary text-slate-950 font-bold text-xs flex items-center gap-1.5 transition disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Send</span>
                    </button>
                  </DevAuthorityControl>
                </form>

                <div className="space-y-3 mt-4">
                  {ticket.comments && ticket.comments.length > 0 ? (
                    ticket.comments.map(c => (
                      <div key={c.id} className="p-3 rounded-xl bg-theme-bg/60 border border-theme-border text-xs space-y-1">
                        <div className="flex items-center justify-between text-theme-muted">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-theme-text">{c.user_name}</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">{c.user_role}</span>
                          </div>
                          <span className="text-[10px]">{new Date(c.created_at).toLocaleString()}</span>
                        </div>
                        <div className="text-theme-text leading-relaxed">{c.content}</div>
                      </div>
                    ))
                  ) : (
                    <div className="py-8 text-center text-xs text-theme-muted">No comments recorded yet.</div>
                  )}
                </div>
              </div>
            )}

            {/* QA & Reviews Tab */}
            {activeTab === 'reviews' && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-theme-bg/50 border border-theme-border space-y-3">
                  <h4 className="text-xs font-bold text-theme-text uppercase tracking-wider">Record Review Decision</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <button
                      onClick={async () => {
                        await api.addReviewQA(ticketId, { stage: 'Dev Review', decision: 'approved', comments: 'Code review approved' });
                        success('Dev Review Approved');
                        loadTicket();
                      }}
                      className="px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-semibold text-xs hover:bg-emerald-500/20 transition"
                    >
                      Approve Dev Review
                    </button>
                    <button
                      onClick={async () => {
                        await api.addReviewQA(ticketId, { stage: 'Ready to Test', decision: 'approved', comments: 'Test readiness verified' });
                        success('Test Readiness Confirmed');
                        loadTicket();
                      }}
                      className="px-3 py-2 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-300 font-semibold text-xs hover:bg-sky-500/20 transition"
                    >
                      Sign Off Test Readiness
                    </button>
                    <button
                      onClick={async () => {
                        await api.addReviewQA(ticketId, { stage: 'QA Testing', decision: 'approved', comments: 'QA test suite passed 100%' });
                        success('QA Testing Passed');
                        loadTicket();
                      }}
                      className="px-3 py-2 rounded-lg bg-teal-500/10 border border-teal-500/30 text-teal-300 font-semibold text-xs hover:bg-teal-500/20 transition"
                    >
                      Record QA Pass
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-theme-muted uppercase tracking-wider">Review History</h4>
                  {ticket.reviews && ticket.reviews.length > 0 ? (
                    ticket.reviews.map(r => (
                      <div key={r.id} className="p-3 rounded-lg bg-theme-bg border border-theme-border flex items-center justify-between text-xs">
                        <div>
                          <div className="font-bold text-theme-text">{r.stage}: <span className="text-emerald-400 capitalize">{r.decision}</span></div>
                          {r.comments && <div className="text-theme-muted text-[11px] mt-0.5">{r.comments}</div>}
                        </div>
                        <div className="text-right text-[10px] text-theme-muted">
                          <div>By {r.reviewer_name || 'System'}</div>
                          <div>{new Date(r.created_at).toLocaleString()}</div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-6 text-center text-xs text-theme-muted">No reviews logged</div>
                  )}
                </div>
              </div>
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
              <div className="space-y-2">
                {ticket.activity && ticket.activity.length > 0 ? (
                  ticket.activity.map(a => (
                    <div key={a.id} className="p-3 rounded-lg bg-theme-bg/60 border border-theme-border text-xs flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-theme-primary">{a.action}</span>
                          <span className="text-theme-muted">•</span>
                          <span className="text-theme-text font-medium">{a.actor_name}</span>
                        </div>
                        {a.details && (
                          <div className="text-theme-muted text-[11px] mt-1 font-mono break-all">
                            {typeof a.details === 'object' ? JSON.stringify(a.details) : a.details}
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] text-theme-muted shrink-0 font-mono">
                        {new Date(a.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="py-6 text-center text-xs text-theme-muted">No activity records found</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sub Modals */}
      {showHoldModal && (
        <HoldBoxModal
          ticket={ticket}
          users={users}
          onConfirm={handleHoldConfirm}
          onClose={() => setShowHoldModal(false)}
        />
      )}
      {showBlockedModal && (
        <BlockedBoxModal
          ticket={ticket}
          projectTickets={projectTickets}
          onConfirm={handleBlockedConfirm}
          onClose={() => setShowBlockedModal(false)}
        />
      )}
      {showReleaseModal && (
        <ReleaseHoldModal
          ticket={ticket}
          onConfirm={handleReleaseConfirm}
          onClose={() => setShowReleaseModal(false)}
        />
      )}
      {showResolveModal && (
        <ResolveBlockerModal
          ticket={ticket}
          onConfirm={handleResolveConfirm}
          onClose={() => setShowResolveModal(false)}
        />
      )}
      {showOverrideModal && (
        <OverrideTaskModal
          ticket={ticket}
          users={users}
          onConfirm={handleOverrideConfirm}
          onClose={() => setShowOverrideModal(false)}
        />
      )}
    </>
  );
};

