import React, { useState, useEffect } from 'react';
import { Layers, Eye, EyeOff, AlertCircle, LogIn, ArrowRight, Zap, Shield, Lock, Terminal, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface LoginPageProps {
  onSwitchToSignUp: () => void;
  initialPortalMode?: 'workspace' | 'developer_console';
  isGodModeRoute?: boolean;
  onExitGodMode?: () => void;
  onPortalModeChange?: (mode: 'workspace' | 'developer_console') => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onSwitchToSignUp,
  initialPortalMode = 'workspace',
  isGodModeRoute = false,
  onExitGodMode,
  onPortalModeChange
}) => {
  const { login } = useAuth();
  const effectiveMode = isGodModeRoute || initialPortalMode === 'developer_console' ? 'developer_console' : 'workspace';
  const [portalMode, setPortalMode] = useState<'workspace' | 'developer_console'>(effectiveMode);
  const [identifier, setIdentifier] = useState(
    effectiveMode === 'developer_console' ? 'DEV-CONSOLE-ROOT' : 'kamalesh@company.com'
  );
  const [password, setPassword] = useState(
    effectiveMode === 'developer_console' ? 'DevConsole@123' : 'Admin@123'
  );

  useEffect(() => {
    const mode = isGodModeRoute || initialPortalMode === 'developer_console' ? 'developer_console' : 'workspace';
    setPortalMode(mode);
    if (mode === 'developer_console') {
      setIdentifier('DEV-CONSOLE-ROOT');
      setPassword('DevConsole@123');
    } else {
      setIdentifier('kamalesh@company.com');
      setPassword('Admin@123');
    }
  }, [initialPortalMode, isGodModeRoute]);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const isDevConsole = portalMode === 'developer_console';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      setLoading(true);
      await login(identifier.trim(), password, rememberMe, portalMode);
    } catch (err: any) {
      setErrorMsg(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  // Instant 1-click login for testing
  const handleInstantLogin = async (email: string, pass = 'Admin@123', targetMode?: 'workspace' | 'developer_console') => {
    const mode = targetMode || portalMode;
    setIdentifier(email);
    setPassword(pass);
    setErrorMsg('');
    try {
      setLoading(true);
      await login(email, pass, true, mode);
    } catch (err: any) {
      setErrorMsg(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-[#07090E] text-white select-none relative overflow-hidden">
      {/* Background Ambient Glows */}
      <div className={`absolute top-1/4 left-1/4 w-96 h-96 ${isDevConsole ? 'bg-amber-600/15' : 'bg-blue-600/10'} rounded-full blur-3xl pointer-events-none transition-all duration-500`} />
      <div className={`absolute bottom-1/4 right-1/4 w-96 h-96 ${isDevConsole ? 'bg-cyan-500/15' : 'bg-cyan-500/10'} rounded-full blur-3xl pointer-events-none transition-all duration-500`} />

      <div className={`w-full max-w-[460px] rounded-2xl border shadow-2xl p-6 sm:p-7 space-y-4 relative z-10 transition-all duration-300 ${
        isDevConsole
          ? 'bg-[#121620] border-amber-500/50 shadow-amber-500/10'
          : 'bg-[#151922] border-[#292F3A] shadow-blue-500/5'
      }`}>
        {/* GOD MODE RESTRICTED BANNER (Only displayed when navigating to /godmode) */}
        {isDevConsole && (
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-xs animate-in fade-in">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="font-extrabold text-amber-300 text-[11px] uppercase tracking-wider">⚡ GOD MODE AUTHENTICATION</span>
            </div>
            {onExitGodMode && (
              <button
                type="button"
                onClick={onExitGodMode}
                className="text-[11px] text-cyan-400 hover:text-cyan-300 hover:underline transition font-bold cursor-pointer"
              >
                ← Workspace Login
              </button>
            )}
          </div>
        )}

        {/* TaskFlow Logo & Header */}
        <div className="text-center space-y-1.5">
          <div className={`w-11 h-11 mx-auto rounded-xl flex items-center justify-center shadow-lg transition-all ${
            isDevConsole
              ? 'bg-gradient-to-br from-amber-400 to-cyan-400 shadow-amber-500/25'
              : 'bg-gradient-to-br from-[#3B82F6] to-[#62D6CF] shadow-blue-500/20'
          }`}>
            {isDevConsole ? (
              <Terminal className="w-6 h-6 text-black stroke-[2.5]" />
            ) : (
              <Layers className="w-6 h-6 text-black stroke-[2.5]" />
            )}
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white flex items-center justify-center gap-1.5">
              <span>TaskFlow {isDevConsole ? 'Developer Console' : ''}</span>
            </h2>
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">
              {isDevConsole ? 'Administrative Access & UI Authority' : 'Organize • Track • Deliver'}
            </p>
          </div>

          {/* DEVELOPER CONSOLE RESTRICTION NOTICE */}
          {isDevConsole ? (
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-left text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-amber-300 text-[11px] uppercase tracking-wider">
                <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Dedicated Console Identity • Separate From Users</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Developer Console has a strictly separate login ID and session. Normal website user accounts cannot log in here. Console admins manage options, restrictions, and rules without viewing user workspace data.
              </p>
            </div>
          ) : (
            <div className="pt-0.5">
              <h1 className="text-base font-bold text-white">Log in to your workspace</h1>
              <p className="text-xs text-slate-400">Enter your credentials or click any 1-click demo login below</p>
            </div>
          )}
        </div>

        {/* 1-CLICK INSTANT DEMO LOGIN BAR */}
        <div className={`p-2.5 rounded-xl border space-y-1.5 ${
          isDevConsole
            ? 'bg-amber-950/20 border-amber-500/30'
            : 'bg-blue-950/30 border-blue-500/30'
        }`}>
          <div className="flex items-center justify-between text-[11px] font-bold">
            <span className={`flex items-center gap-1 ${isDevConsole ? 'text-amber-300' : 'text-blue-300'}`}>
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              {isDevConsole ? 'Dedicated Console Administrator ID:' : '1-Click Instant Demo Login:'}
            </span>
            <span className="text-[10px] font-normal text-slate-400">1-click test</span>
          </div>

          {isDevConsole ? (
            <div>
              <button
                type="button"
                onClick={() => handleInstantLogin('DEV-CONSOLE-ROOT', 'DevConsole@123', 'developer_console')}
                className="w-full py-2.5 px-3 rounded-lg bg-gradient-to-r from-amber-500/20 via-cyan-500/20 to-amber-500/20 hover:from-amber-500/30 hover:to-cyan-500/30 border border-amber-400/50 text-xs font-bold text-amber-300 hover:text-white transition flex items-center justify-between cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>Developer Console Admin (DEV-CONSOLE-ROOT)</span>
                </span>
                <span className="text-[10px] font-semibold text-cyan-300 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-500/40">
                  Separate Console ID
                </span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleInstantLogin('kamalesh@company.com', 'Admin@123', 'workspace')}
                className="py-2 px-2 rounded-lg bg-amber-600/20 hover:bg-amber-600/40 border border-amber-500/40 text-xs font-bold text-amber-300 hover:text-white transition flex flex-col items-center cursor-pointer text-center"
              >
                <span>Kamalesh</span>
                <span className="text-[10px] font-normal opacity-80">(Project Mgr)</span>
              </button>
              <button
                type="button"
                onClick={() => handleInstantLogin('aman@company.com', 'Admin@123', 'workspace')}
                className="py-2 px-2 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/40 border border-emerald-500/40 text-xs font-bold text-emerald-300 hover:text-white transition flex flex-col items-center cursor-pointer text-center"
              >
                <span>Aman</span>
                <span className="text-[10px] font-normal opacity-80">(QA Lead)</span>
              </button>
              <button
                type="button"
                onClick={() => handleInstantLogin('hyagreenan@company.com', 'Admin@123', 'workspace')}
                className="py-2 px-2 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/40 text-xs font-bold text-cyan-300 hover:text-white transition flex flex-col items-center cursor-pointer text-center"
              >
                <span>Hyagreenan G</span>
                <span className="text-[10px] font-normal opacity-80">(Workspace User)</span>
              </button>
            </div>
          )}
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
            <div className="min-w-0">
              <div className="font-bold">{errorMsg}</div>
              {isDevConsole && (
                <div className="text-[11px] text-rose-300/80 mt-0.5">
                  Only the dedicated Developer Console administrator ID (DEV-CONSOLE-ROOT) can log in to the Developer Console. Normal user accounts are prohibited.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Standard Login Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block font-semibold text-slate-300 mb-1">
              {isDevConsole ? 'Developer Console Administrator ID' : 'Email or User ID'}
            </label>
            <input
              type="text"
              required
              value={identifier}
              onChange={e => setIdentifier(e.target.value)}
              placeholder={isDevConsole ? 'DEV-CONSOLE-ROOT' : 'kamalesh@company.com'}
              className={`w-full bg-[#0B0D12] border rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none transition ${
                isDevConsole
                  ? 'border-amber-500/40 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400'
                  : 'border-[#292F3A] focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6]'
              }`}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-semibold text-slate-300">
                {isDevConsole ? 'Console Security Password' : 'Password'}
              </label>
              <button
                type="button"
                className="text-[11px] text-[#3B82F6] hover:underline"
              >
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className={`w-full bg-[#0B0D12] border rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none transition pr-10 ${
                  isDevConsole
                    ? 'border-amber-500/40 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400'
                    : 'border-[#292F3A] focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6]'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-0.5">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-[#292F3A] bg-[#0B0D12] text-[#3B82F6] focus:ring-0 cursor-pointer"
              />
              <span className="text-[11px] text-slate-400">Remember session</span>
            </label>
            <span className="text-[10px] text-slate-400">Press Enter ↵</span>
          </div>

          {/* SUBMIT BUTTON */}
          <button
            type="submit"
            id="login-button"
            data-testid="login-button"
            disabled={loading}
            className={`w-full py-3 rounded-xl font-bold text-sm tracking-wide shadow-lg transition-all duration-150 transform active:scale-[0.99] disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 ${
              isDevConsole
                ? 'bg-gradient-to-r from-amber-500 to-cyan-500 hover:brightness-110 active:brightness-95 text-slate-950 shadow-amber-500/25 ring-2 ring-amber-500/30'
                : 'bg-[#2563EB] hover:bg-[#1D4ED8] active:bg-[#1E40AF] text-white shadow-blue-500/30 ring-2 ring-blue-500/20'
            }`}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                {isDevConsole ? 'Authorizing Console Access...' : 'Signing in...'}
              </span>
            ) : isDevConsole ? (
              <>
                <Shield className="w-4 h-4 stroke-[2.5]" />
                <span>Log in to Developer Console</span>
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4 stroke-[2.5]" />
                <span>Log In to TaskFlow Workspace</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>



        {/* Switch to Sign Up */}
        {!isDevConsole && (
          <div className="text-center text-xs text-slate-400 pt-1">
            New to TaskFlow?{' '}
            <button
              type="button"
              onClick={onSwitchToSignUp}
              className="font-bold text-[#3B82F6] hover:underline ml-1"
            >
              Create an account
            </button>
          </div>
        )}

        {isDevConsole && onExitGodMode && (
          <div className="text-center text-xs text-slate-400 pt-1">
            <button
              type="button"
              onClick={onExitGodMode}
              className="text-xs text-cyan-400 hover:text-cyan-300 hover:underline transition inline-flex items-center gap-1 cursor-pointer font-semibold"
            >
              <span>← Return to Standard Workspace Login</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
