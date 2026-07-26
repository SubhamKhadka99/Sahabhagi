import { GoogleLogin } from "@react-oauth/google";
import {
  ArrowLeft, Eye, EyeOff, Loader2, Lock, LogIn, Mail, ShieldCheck, Sparkles, User as UserIcon,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";

type Mode = "signin" | "signup";
type SignupStep = "form" | "otp";

const DEMO_ACCOUNTS = [
  { label: "Citizen demo", email: "ramila.tamang@example.com", role: "Reports issues, tracks fixes" },
  { label: "Officer demo", email: "officer.ward10@example.com", role: "Ward triage & response dashboard" },
];
const DEMO_PASSWORD = "Demo@1234";

function passwordStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const labels = ["Too weak", "Weak", "Fair", "Good", "Strong", "Very strong"];
  const colors = ["bg-red-500", "bg-red-500", "bg-amber-500", "bg-amber-400", "bg-emerald-500", "bg-emerald-500"];
  return { score, label: labels[score], color: colors[score] };
}

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>("signin");
  const [signupStep, setSignupStep] = useState<SignupStep>("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [anonymous, setAnonymous] = useState(false);
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState("");
  const [error, setError] = useState("");

  // OTP step
  const [otp, setOtp] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [resendMsg, setResendMsg] = useState("");
  const [resending, setResending] = useState(false);

  function resetSignupFlow() {
    setSignupStep("form");
    setOtp("");
    setPendingEmail("");
    setResendMsg("");
  }

  function switchMode(m: Mode) {
    setMode(m);
    setError("");
    resetSignupFlow();
  }

  function afterLogin(token: string, user: Parameters<typeof login>[1]) {
    login(token, user);
    navigate(user.role === "citizen" ? "/app" : "/admin", { replace: true });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    if (mode === "signup" && !name.trim()) {
      setError("Enter your full name.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (mode === "signup" && password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    try {
      if (mode === "signup") {
        // Two-step signup: this only sends an OTP — no account exists yet.
        await api.auth.registerStart(email.trim(), name.trim(), password, anonymous);
        setPendingEmail(email.trim());
        setSignupStep("otp");
        return;
      }
      const { token, user } = await api.auth.login(email.trim(), password);
      afterLogin(token, user);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    if (otp.length !== 6) return;
    setError("");
    setLoading(true);
    try {
      const { token, user } = await api.auth.registerVerify(pendingEmail, otp);
      afterLogin(token, user);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid code. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResendOtp() {
    setError("");
    setResendMsg("");
    setResending(true);
    try {
      await api.auth.registerResend(pendingEmail);
      setResendMsg("A new code has been sent.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't resend code.");
    } finally {
      setResending(false);
    }
  }

  async function handleDemoLogin(demoEmail: string) {
    setError("");
    setDemoLoading(demoEmail);
    try {
      const { token, user } = await api.auth.login(demoEmail, DEMO_PASSWORD);
      afterLogin(token, user);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Demo sign-in failed.");
    } finally {
      setDemoLoading("");
    }
  }

  async function handleGoogleSuccess(idToken: string | undefined) {
    if (!idToken) {
      setError("Google sign-in didn't return a credential. Try again.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const { token, user } = await api.auth.loginGoogle(idToken, anonymous);
      afterLogin(token, user);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Google sign-in failed.");
    } finally {
      setLoading(false);
    }
  }

  const strength = password ? passwordStrength(password) : null;
  const showOtpStep = mode === "signup" && signupStep === "otp";

  return (
    <div className="min-h-screen min-h-[100dvh] w-full bg-gradient-to-b from-[#071224] via-[#0A192F] to-[#0d2848] flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-sm">

        {/* Brand */}
        <div className="text-center mb-6">
          <div className="inline-block bg-white rounded-2xl p-3 shadow-xl shadow-cyan-500/10">
            <img
              src="/icons/logo-full.png"
              alt="Sahabhagi — Together for a safer, stronger Kathmandu"
              className="w-40 sm:w-44"
            />
          </div>
        </div>

        {/* Card */}
        <div className="bg-white/[0.06] border border-white/10 rounded-3xl p-5 sm:p-6 backdrop-blur-md shadow-2xl">

          {!showOtpStep && (
            <>
              {/* Mode switch */}
              <div className="grid grid-cols-2 gap-1 bg-white/5 rounded-xl p-1 mb-5">
                {(["signin", "signup"] as Mode[]).map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => switchMode(m)}
                    className={`py-2 rounded-lg text-sm font-semibold transition-all ${
                      mode === m ? "bg-[#00B4D8] text-white shadow-lg shadow-cyan-500/20" : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {m === "signin" ? "Sign In" : "Create Account"}
                  </button>
                ))}
              </div>

              <div className="mb-4">
                <h2 className="text-white text-lg font-semibold mb-1">
                  {mode === "signin" ? "Welcome back" : "Join Ward 10"}
                </h2>
                <p className="text-slate-400 text-xs">
                  {mode === "signin"
                    ? "Sign in to report issues and track fixes in your ward."
                    : "Report hazards in seconds and help hold your ward accountable."}
                </p>
              </div>

              <form onSubmit={e => void handleSubmit(e)} className="space-y-3" autoComplete="on">
                {mode === "signup" && (
                  <label className="block">
                    <span className="sr-only">Full name</span>
                    <div className="relative">
                      <UserIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Full name"
                        autoComplete="name"
                        className="w-full bg-white/10 border border-white/15 rounded-xl pl-9 pr-4 py-3 text-[15px] text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#00B4D8] transition"
                      />
                    </div>
                  </label>
                )}

                <label className="block">
                  <span className="sr-only">Email</span>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@gmail.com"
                      autoComplete="email"
                      inputMode="email"
                      className="w-full bg-white/10 border border-white/15 rounded-xl pl-9 pr-4 py-3 text-[15px] text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#00B4D8] transition"
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="sr-only">Password</span>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Password"
                      autoComplete={mode === "signup" ? "new-password" : "current-password"}
                      minLength={8}
                      className="w-full bg-white/10 border border-white/15 rounded-xl pl-9 pr-10 py-3 text-[15px] text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#00B4D8] transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </label>

                {mode === "signup" && (
                  <label className="block">
                    <span className="sr-only">Confirm password</span>
                    <div className="relative">
                      <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type={showPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        placeholder="Confirm password"
                        autoComplete="new-password"
                        minLength={8}
                        className={`w-full bg-white/10 border rounded-xl pl-9 pr-10 py-3 text-[15px] text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 transition ${
                          confirmPassword && confirmPassword !== password
                            ? "border-red-500/50 focus:ring-red-500/50"
                            : "border-white/15 focus:ring-[#00B4D8]"
                        }`}
                      />
                    </div>
                  </label>
                )}

                {mode === "signup" && strength && (
                  <div className="flex items-center gap-2 px-0.5">
                    <div className="flex-1 flex gap-1">
                      {[0,1,2,3,4].map(i => (
                        <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i < strength.score ? strength.color : "bg-white/10"}`} />
                      ))}
                    </div>
                    <span className="text-[10px] text-slate-400 flex-shrink-0">{strength.label}</span>
                  </div>
                )}

                {mode === "signup" && (
                  <div
                    className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${anonymous ? "border-[#00B4D8]/40 bg-[#00B4D8]/10" : "border-white/10 bg-white/5"}`}
                    onClick={() => setAnonymous(v => !v)}
                  >
                    <div className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition ${anonymous ? "border-[#00B4D8] bg-[#00B4D8]" : "border-white/30"}`}>
                      {anonymous && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium flex items-center gap-1.5">
                        <EyeOff size={13} className="text-[#00B4D8]" /> Post reports anonymously
                      </p>
                      <p className="text-slate-400 text-xs mt-0.5">Your name shows as "Anonymous Citizen" publicly. Still traceable by Ward admin if a report is disputed.</p>
                    </div>
                  </div>
                )}

                {error && (
                  <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 bg-[#00B4D8] hover:bg-cyan-500 disabled:opacity-60 text-white rounded-xl py-3 font-semibold transition active:scale-[0.98] shadow-lg shadow-cyan-500/20"
                >
                  {loading ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
                  {loading ? "Please wait…" : mode === "signin" ? "Sign In" : "Send Verification Code"}
                </button>
              </form>

              {/* Divider */}
              <div className="flex items-center gap-3 my-4">
                <div className="h-px flex-1 bg-white/10" />
                <span className="text-[11px] text-slate-500 uppercase tracking-widest">or</span>
                <div className="h-px flex-1 bg-white/10" />
              </div>

              <div className="flex justify-center">
                <GoogleLogin
                  onSuccess={cred => void handleGoogleSuccess(cred.credential)}
                  onError={() => setError("Google sign-in failed.")}
                  theme="filled_black"
                  shape="pill"
                  width="304"
                />
              </div>

              {/* Demo quick-select */}
              <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                <p className="text-amber-400 text-xs font-semibold mb-2 flex items-center gap-1.5">
                  <Sparkles size={12} /> Demo Mode — one tap login
                </p>
                <div className="space-y-1.5">
                  {DEMO_ACCOUNTS.map(acc => (
                    <button
                      key={acc.email}
                      onClick={() => void handleDemoLogin(acc.email)}
                      disabled={!!demoLoading}
                      className="w-full flex items-center justify-between text-left bg-white/5 hover:bg-white/10 disabled:opacity-50 rounded-lg px-3 py-2 transition"
                    >
                      <span className="text-xs text-slate-300 min-w-0">
                        <span className="text-white font-medium">{acc.label}</span>
                        <span className="block text-[10px] text-slate-500 truncate">{acc.role}</span>
                      </span>
                      {demoLoading === acc.email
                        ? <Loader2 size={13} className="animate-spin text-amber-400 flex-shrink-0" />
                        : <span className="text-amber-400 text-xs flex-shrink-0">→</span>
                      }
                    </button>
                  ))}
                </div>
              </div>

              {/* Security note */}
              <div className="mt-4 flex items-start gap-2 text-slate-500 text-[11px] px-0.5">
                <ShieldCheck size={13} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                <p>Passwords are encrypted (bcrypt) and never stored in plain text. Your session is protected with a signed, expiring token.</p>
              </div>
            </>
          )}

          {showOtpStep && (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => { resetSignupFlow(); setError(""); }}
                className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 text-xs transition"
              >
                <ArrowLeft size={13} /> Back
              </button>

              <div>
                <h2 className="text-white text-lg font-semibold mb-1">Check your email</h2>
                <p className="text-slate-400 text-xs">
                  We sent a 6-digit code to <span className="text-white font-medium">{pendingEmail}</span>.
                  Enter it below to finish creating your account.
                </p>
              </div>

              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                autoFocus
                className="w-full text-center tracking-[0.5em] text-lg bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#00B4D8] transition"
              />

              {error && (
                <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
              )}
              {resendMsg && !error && (
                <p className="text-emerald-400 text-xs bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">{resendMsg}</p>
              )}

              <button
                onClick={() => void handleVerifyOtp()}
                disabled={loading || otp.length !== 6}
                className="w-full flex items-center justify-center gap-2 bg-[#00B4D8] hover:bg-cyan-500 disabled:opacity-60 text-white rounded-xl py-3 font-semibold transition active:scale-[0.98] shadow-lg shadow-cyan-500/20"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
                {loading ? "Verifying…" : "Verify & Create Account"}
              </button>

              <button
                type="button"
                onClick={() => void handleResendOtp()}
                disabled={resending}
                className="w-full text-xs text-slate-400 hover:text-slate-200 underline disabled:opacity-50"
              >
                {resending ? "Sending…" : "Resend code"}
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-slate-600 text-xs mt-5">Sahabhagi · Ward 10 Pilot · Kathmandu 2026</p>
      </div>
    </div>
  );
}
