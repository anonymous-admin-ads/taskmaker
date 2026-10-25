import React from 'react';
import { Lock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUiControls } from '../../context/UiControlsContext';
import { useDevContextMenu } from './DevContextMenu';
import { useToast } from '../../context/ToastContext';

interface DevAuthorityControlProps {
  elementId: string;
  name?: string;
  type?: string;
  location?: string;
  children: React.ReactNode;
  className?: string;
  inline?: boolean;
  block?: boolean;
}

export const DevAuthorityControl: React.FC<DevAuthorityControlProps> = ({
  elementId,
  name,
  type = 'button',
  location,
  children,
  className = '',
  inline = false,
  block = false,
}) => {
  const { user } = useAuth();
  const { controlsMap, toggleControl } = useUiControls();
  const { openContextMenu } = useDevContextMenu();
  const { success } = useToast();

  const isDevSession = Boolean(
    user && (user.isDevConsole || user.portalMode === 'developer_console' || user.sessionType === 'developer_console' || user.role === 'developer_console_admin')
  );

  const isEnabled = controlsMap[elementId] !== false;

  // Case 1: Normal workspace user
  if (!isDevSession) {
    if (!isEnabled) {
      // Completely hidden / not found to normal users
      return null;
    }
    return <>{children}</>;
  }

  // Case 2: Developer in Developer Suite mode
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    openContextMenu({
      x: e.clientX,
      y: e.clientY,
      elementId,
      name: name || elementId,
      type,
      location: location || 'Live Workspace App',
    });
  };

  if (isEnabled) {
    // Enabled on Normal Website & Developer Console
    return (
      <div
        data-dev-id={elementId}
        data-dev-name={name || elementId}
        data-dev-type={type}
        data-dev-location={location}
        onContextMenu={handleContextMenu}
        title={`${name || elementId} (Right-click to manage in Developer Console)`}
        className={`relative group/dev-item transition-all ${
          inline ? 'inline-flex items-center' : block ? 'block' : 'flex items-center'
        } ${className}`}
      >
        {children}
      </div>
    );
  }

  // Turned ON ONLY for Developer Console (Hidden from Normal Users)
  return (
    <div
      data-dev-id={elementId}
      data-dev-name={name || elementId}
      data-dev-type={type}
      data-dev-location={location}
      onContextMenu={handleContextMenu}
      title={`${name || elementId} — Turned ON ONLY for Developer Console (Hidden from normal website). Right-click to make visible to all.`}
      className={`relative group/dev-item rounded-lg ring-1 ring-amber-500/60 bg-amber-500/5 transition-all ${
        inline ? 'inline-flex items-center' : block ? 'block' : 'flex items-center'
      } ${className}`}
    >
      {/* Subtle Dev Only Pill Indicator on top-right */}
      <div className="absolute -top-1.5 -right-1.5 z-20 pointer-events-auto">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleControl(elementId, true);
            success('Developer UI Authority', `Turned ON for normal website: '${name || elementId}'`);
          }}
          title="Turned ON only for Developer Console (Hidden from normal website). Click or right-click to make visible to all."
          className="px-1 py-0.2 rounded text-[8px] font-extrabold bg-amber-500 text-slate-950 uppercase tracking-wider shadow-sm flex items-center gap-0.5 hover:bg-emerald-400 cursor-pointer animate-pulse"
        >
          <Lock className="w-2 h-2" />
          <span>DEV ONLY</span>
        </button>
      </div>

      {children}
    </div>
  );
};
