import React, { useState } from 'react';
import {
  Palette, User, Bell, Shield, Key, Sliders, Check, Globe, Eye
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useUiControls } from '../../context/UiControlsContext';
import { DevAuthorityControl } from '../common/DevAuthorityControl';
import { ThemeName } from '../../types';

export const SettingsView: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  const { success } = useToast();
  const { isButtonEnabled } = useUiControls();
  const isRoleEnforcementActive = isButtonEnabled('btn_role_enforcement');

  const [activeTab, setActiveTab] = useState<'appearance' | 'profile' | 'notifications' | 'security'>('appearance');

  // Other preferences state
  const [compactMode, setCompactMode] = useState(false);
  const [showAvatars, setShowAvatars] = useState(true);
  const [enableAnimations, setEnableAnimations] = useState(true);
  const [language, setLanguage] = useState('English');

  const themes: Array<{
    id: ThemeName;
    name: string;
    subtitle: string;
    bg: string;
    surface: string;
    primary: string;
    text: string;
    isDark: boolean;
  }> = [
    {
      id: 'midnight-cyan',
      name: 'Midnight Cyan',
      subtitle: 'Default Dark Theme',
      bg: '#0B0D12',
      surface: '#151922',
      primary: '#62D6CF',
      text: '#F3F6FC',
      isDark: true,
    },
    {
      id: 'ocean-blue',
      name: 'Ocean Blue',
      subtitle: 'Dark Theme',
      bg: '#0A1220',
      surface: '#111E31',
      primary: '#3B82F6',
      text: '#F1F5F9',
      isDark: true,
    },
    {
      id: 'arctic-light',
      name: 'Arctic Light',
      subtitle: 'Light Theme',
      bg: '#F4F7FB',
      surface: '#FFFFFF',
      primary: '#2563EB',
      text: '#172033',
      isDark: false,
    },
  ];

  const handleSelectTheme = (tId: ThemeName) => {
    setTheme(tId);
    success('Theme Preference Updated', `Switched to ${tId.replace('-', ' ')}`);
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto space-y-6 bg-theme-bg">
      <div>
        <h1 className="text-xl font-bold text-theme-text tracking-tight">Settings</h1>
        <p className="text-xs text-theme-muted mt-0.5">Manage your preferences and workspace appearance.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Settings Left Navigation */}
        <div className="space-y-1">
          {[
            { id: 'appearance', label: 'Appearance & Themes', icon: Palette },
            { id: 'profile', label: 'User Profile', icon: User },
            { id: 'notifications', label: 'Notifications', icon: Bell },
            { id: 'security', label: 'Security & Sessions', icon: Shield },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                  isActive
                    ? 'bg-theme-primary/10 text-theme-primary'
                    : 'text-theme-muted hover:text-theme-text hover:bg-theme-surface'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Settings Right Content */}
        <div className="md:col-span-3 space-y-6">
          {activeTab === 'appearance' && (
            <div className="space-y-6">
              {/* Theme Selector (Matching screenshot Settings & Theme screen) */}
              <div className="p-6 rounded-2xl border border-theme-border bg-theme-surface space-y-4 shadow-sm">
                <div>
                  <h3 className="font-bold text-sm text-theme-text">Theme</h3>
                  <p className="text-xs text-theme-muted mt-0.5">
                    Select your preferred interface colour palette. Changes apply globally without reload.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                  {themes.map(t => {
                    const isSelected = theme === t.id;
                    return (
                      <div
                        key={t.id}
                        onClick={() => handleSelectTheme(t.id)}
                        className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 relative ${
                          isSelected
                            ? 'ring-2 ring-theme-primary border-theme-primary shadow-lg shadow-theme-primary/10'
                            : 'border-theme-border hover:border-theme-muted/50'
                        }`}
                        style={{ backgroundColor: t.surface }}
                      >
                        {isSelected && (
                          <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-theme-primary text-slate-950 flex items-center justify-center">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                        )}

                        {/* Palette preview pills */}
                        <div className="flex items-center gap-1.5 mb-3">
                          <div className="w-4 h-4 rounded-full" style={{ backgroundColor: t.bg }} />
                          <div className="w-4 h-4 rounded-full" style={{ backgroundColor: t.surface }} />
                          <div className="w-4 h-4 rounded-full" style={{ backgroundColor: t.primary }} />
                        </div>

                        <div className="font-bold text-xs" style={{ color: t.text }}>
                          {t.name}
                        </div>
                        <div className="text-[10px] opacity-70 mt-0.5" style={{ color: t.text }}>
                          {t.subtitle}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Other Preferences (Matching screenshot) */}
              <div className="p-6 rounded-2xl border border-theme-border bg-theme-surface space-y-4 shadow-sm">
                <h3 className="font-bold text-sm text-theme-text">Other Preferences</h3>

                <div className="space-y-3.5 divide-y divide-theme-border/50 text-xs">
                  {/* Compact mode */}
                  <div className="flex items-center justify-between pt-1">
                    <div>
                      <span className="font-semibold text-theme-text block">Compact mode</span>
                      <span className="text-theme-muted text-[11px]">Display denser lists and smaller cards</span>
                    </div>
                    <button
                      onClick={() => setCompactMode(!compactMode)}
                      className={`w-10 h-5 rounded-full transition-colors relative ${
                        compactMode ? 'bg-theme-primary' : 'bg-slate-700'
                      }`}
                    >
                      <div
                        className={`w-3.5 h-3.5 rounded-full bg-white transition-transform absolute top-0.5 left-0.5 ${
                          compactMode ? 'translate-x-5' : ''
                        }`}
                      />
                    </button>
                  </div>

                  {/* Show avatars */}
                  <div className="flex items-center justify-between pt-3">
                    <div>
                      <span className="font-semibold text-theme-text block">Show avatars</span>
                      <span className="text-theme-muted text-[11px]">Display user profile pictures across ticket cards</span>
                    </div>
                    <button
                      onClick={() => setShowAvatars(!showAvatars)}
                      className={`w-10 h-5 rounded-full transition-colors relative ${
                        showAvatars ? 'bg-theme-primary' : 'bg-slate-700'
                      }`}
                    >
                      <div
                        className={`w-3.5 h-3.5 rounded-full bg-white transition-transform absolute top-0.5 left-0.5 ${
                          showAvatars ? 'translate-x-5' : ''
                        }`}
                      />
                    </button>
                  </div>

                  {/* Enable animations */}
                  <div className="flex items-center justify-between pt-3">
                    <div>
                      <span className="font-semibold text-theme-text block">Enable animations</span>
                      <span className="text-theme-muted text-[11px]">Smooth modal transitions and card drags</span>
                    </div>
                    <button
                      onClick={() => setEnableAnimations(!enableAnimations)}
                      className={`w-10 h-5 rounded-full transition-colors relative ${
                        enableAnimations ? 'bg-theme-primary' : 'bg-slate-700'
                      }`}
                    >
                      <div
                        className={`w-3.5 h-3.5 rounded-full bg-white transition-transform absolute top-0.5 left-0.5 ${
                          enableAnimations ? 'translate-x-5' : ''
                        }`}
                      />
                    </button>
                  </div>

                  {/* Language */}
                  <div className="flex items-center justify-between pt-3">
                    <div>
                      <span className="font-semibold text-theme-text block">Language</span>
                      <span className="text-theme-muted text-[11px]">Interface translation language</span>
                    </div>
                    <select
                      value={language}
                      onChange={e => setLanguage(e.target.value)}
                      className="bg-theme-bg border border-theme-border rounded-lg px-3 py-1.5 text-xs text-theme-text focus:outline-none focus:border-theme-primary"
                    >
                      <option value="English">English</option>
                      <option value="Spanish">Spanish</option>
                      <option value="German">German</option>
                      <option value="Japanese">Japanese</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="p-6 rounded-2xl border border-theme-border bg-theme-surface space-y-4 shadow-sm">
              <h3 className="font-bold text-sm text-theme-text">User Profile Information</h3>
              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-theme-muted block mb-1">User ID</span>
                  <span className="font-mono font-bold text-theme-primary">{user?.userId}</span>
                </div>
                <div>
                  <span className="text-theme-muted block mb-1">Full Name</span>
                  <span className="font-semibold text-theme-text">{user?.name}</span>
                </div>
                <div>
                  <span className="text-theme-muted block mb-1">Email Address</span>
                  <span className="font-medium text-theme-text">{user?.email}</span>
                </div>
                <DevAuthorityControl elementId="opt_workspace_role" name="Workspace Role Field" location="Settings & Profile" inline>
                  <div>
                    <span className="text-theme-muted block mb-1">Workspace Role</span>
                    {isRoleEnforcementActive ? (
                      <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-theme-primary/10 text-theme-primary border border-theme-primary/20">
                        {user?.role?.toUpperCase()}
                      </span>
                    ) : (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          REGULAR USER (UNIVERSAL PERMISSIONS ACTIVE)
                        </span>
                        <span className="text-[11px] text-theme-muted">
                          (Role enforcement disabled by Developer Console)
                        </span>
                      </div>
                    )}
                  </div>
                </DevAuthorityControl>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="p-6 rounded-2xl border border-theme-border bg-theme-surface space-y-4 shadow-sm">
              <h3 className="font-bold text-sm text-theme-text">Security & Authentication</h3>
              <p className="text-xs text-theme-muted">
                Your session is secured using HTTP-only, SameSite cookies with server-recognized token revocation.
              </p>
              <div className="p-3.5 rounded-xl bg-theme-bg/60 border border-theme-border text-xs text-emerald-400 flex items-center gap-2">
                <Shield className="w-4 h-4" />
                <span>Active authenticated session verified with scrypt cryptography</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

