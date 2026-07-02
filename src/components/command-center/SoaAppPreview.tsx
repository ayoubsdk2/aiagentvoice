import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wrench, Gauge, FileText, Package, Mic,
  CheckCircle2, Send, BarChart3, FileDown,
} from "lucide-react";
import soaLogo from "@/assets/soa-logo.png";
import phaosLogo from "@/assets/phaos-ai-logo.png";
import soaIcon from "@/assets/soa-logo-icon.png";

/* Realistic iOS home screen apps using CSS-only icons */
const HOME_APPS = [
  { label: "FaceTime", bg: "bg-green-500", emoji: "📹" },
  { label: "Calendar", bg: "bg-white", emoji: "📅" },
  { label: "Photos", bg: "bg-gradient-to-br from-orange-400 via-pink-400 to-purple-400", emoji: "🌸" },
  { label: "Camera", bg: "bg-gray-600", emoji: "📷" },
  { label: "Mail", bg: "bg-blue-500", emoji: "✉️" },
  { label: "Clock", bg: "bg-black", emoji: "🕐" },
  { label: "Maps", bg: "bg-gradient-to-b from-green-400 to-green-600", emoji: "🗺️" },
  { label: "Weather", bg: "bg-gradient-to-b from-blue-400 to-cyan-300", emoji: "🌤️" },
  { label: "Reminders", bg: "bg-white", emoji: "📋" },
  { label: "Notes", bg: "bg-yellow-100", emoji: "📝" },
  { label: "Stocks", bg: "bg-black", emoji: "📈" },
  { label: "News", bg: "bg-gradient-to-br from-red-500 to-pink-500", emoji: "📰" },
  { label: "Books", bg: "bg-orange-500", emoji: "📚" },
  { label: "App Store", bg: "bg-blue-500", emoji: "🅰️" },
  { label: "Podcasts", bg: "bg-purple-500", emoji: "🎙️" },
  { label: "TV", bg: "bg-black", emoji: "📺" },
  { label: "Health", bg: "bg-white", emoji: "❤️" },
  { label: "Home", bg: "bg-orange-400", emoji: "🏠" },
  { label: "Wallet", bg: "bg-black", emoji: "💳" },
  { label: "Settings", bg: "bg-gray-400", emoji: "⚙️" },
];

const DOCK_APPS = [
  { label: "Phone", bg: "bg-green-500", emoji: "📞" },
  { label: "Safari", bg: "bg-blue-400", emoji: "🧭" },
  { label: "Messages", bg: "bg-green-500", emoji: "💬" },
  { label: "Music", bg: "bg-gradient-to-br from-pink-500 to-red-500", emoji: "🎵" },
];

const SUGGESTIONS = [
  { emoji: "📦", label: "Order Supplies" },
  { emoji: "🔧", label: "Schedule Service" },
  { emoji: "📊", label: "Submit Meter Read" },
  { emoji: "📄", label: "Get Contract Details" },
];

const ACTIVITY_FEED = [
  { icon: Send, iconColor: "text-emerald-600", iconBg: "bg-emerald-50", title: "SMS Sent to John Doe", detail: 'Phaos AI Agent: "Contract PDF for Sharp MFP sent."', time: "2m ago" },
  { icon: Package, iconColor: "text-blue-600", iconBg: "bg-blue-50", title: "Supply Order #4492 Processed", detail: "Cyan Toner for Houston Branch.", time: "8m ago" },
  { icon: BarChart3, iconColor: "text-purple-600", iconBg: "bg-purple-50", title: "Meter Reading Recorded", detail: "Device ID MX-M4070 updated in database.", time: "14m ago" },
  { icon: FileDown, iconColor: "text-amber-600", iconBg: "bg-amber-50", title: "Contract Emailed", detail: "Sharp MX-M4070 details sent to Rep Sarah Jones.", time: "21m ago" },
];

export function SoaAppPreview() {
  const [isAppOpen, setIsAppOpen] = useState(false);
  const [orbScale, setOrbScale] = useState(1);

  useEffect(() => {
    if (!isAppOpen) return;
    const id = setInterval(() => setOrbScale((s) => (s === 1 ? 1.06 : 1)), 1800);
    return () => clearInterval(id);
  }, [isAppOpen]);

  /* 50% larger: 480 x 975 */
  const PHONE_W = 480;
  const PHONE_H = 975;

  return (
    <div className="flex items-center justify-center h-full min-h-[1020px]">
      <div
        className="relative rounded-[3rem] border-[14px] border-black bg-black shadow-2xl overflow-hidden select-none"
        style={{ width: PHONE_W, height: PHONE_H, boxShadow: "0 30px 80px -16px rgba(0,0,0,0.65), 0 0 0 2px rgba(255,255,255,0.08)" }}
      >
        {/* Dynamic Island */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-[130px] h-[34px] bg-black rounded-full z-50" />

        <div className="relative w-full h-full rounded-[2.2rem] overflow-hidden">
          {/* Wallpaper — iOS dark red/magenta gradient matching reference */}
          <div className="absolute inset-0" style={{ background: "linear-gradient(160deg, #1a0a12 0%, #3d0a20 20%, #8b1538 40%, #cc2244 55%, #e83560 65%, #b8185a 75%, #4a0a30 90%, #0a0508 100%)" }} />

          {/* Home Screen */}
          <AnimatePresence>
            {!isAppOpen && (
              <motion.div key="home" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.3 }} className="absolute inset-0 flex flex-col z-10">
                {/* Time */}
                <div className="pt-14 text-center">
                  <div className="text-white text-5xl font-light tracking-tight">{new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                  <div className="text-white/60 text-sm mt-1">{new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}</div>
                </div>

                {/* App grid — 4 cols */}
                <div className="flex-1 px-6 pt-8">
                  <div className="grid grid-cols-4 gap-x-5 gap-y-5">
                    {HOME_APPS.slice(0, 8).map((app) => (
                      <DimmedApp key={app.label} app={app} />
                    ))}

                    {/* Row 3: 2 dimmed + SOA AI + 1 dimmed */}
                    {HOME_APPS.slice(8, 10).map((app) => (
                      <DimmedApp key={app.label} app={app} />
                    ))}

                    {/* SOA AI App — hero position */}
                    <button onClick={() => setIsAppOpen(true)} className="flex flex-col items-center gap-1.5 group">
                      <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center shadow-lg shadow-purple-500/40 group-hover:shadow-purple-500/60 transition-all duration-200 group-active:scale-90 ring-2 ring-purple-400/40 ring-offset-1 ring-offset-transparent overflow-hidden">
                        <img src={soaIcon} alt="SOA AI" className="w-14 h-14 object-contain" />
                      </div>
                      <span className="text-white text-[11px] font-semibold drop-shadow-md">SOA AI</span>
                    </button>

                    <DimmedApp app={HOME_APPS[10]} />

                    {HOME_APPS.slice(11, 19).map((app) => (
                      <DimmedApp key={app.label} app={app} />
                    ))}
                  </div>
                </div>

                {/* Page dots */}
                <div className="flex justify-center gap-1.5 py-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  <div className="w-1.5 h-1.5 rounded-full bg-white/30" />
                  <div className="w-1.5 h-1.5 rounded-full bg-white/30" />
                </div>

                {/* Dock */}
                <div className="px-5 pb-5">
                  <div className="flex justify-around items-center bg-white/15 backdrop-blur-xl rounded-3xl py-3 px-4">
                    {DOCK_APPS.map((app) => (
                      <div key={app.label} className="opacity-50">
                        <div className={`w-14 h-14 rounded-2xl ${app.bg} flex items-center justify-center text-xl`}>
                          {app.emoji}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* App Interface */}
          <AnimatePresence>
            {isAppOpen && (
              <motion.div key="app" initial={{ opacity: 0, scale: 0.5, borderRadius: "2rem" }} animate={{ opacity: 1, scale: 1, borderRadius: "0rem" }} exit={{ opacity: 0, scale: 0.5, borderRadius: "2rem" }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="absolute inset-0 z-10 bg-slate-50 flex flex-col">
                <div className="h-12 shrink-0 bg-white" />

                {/* Status bar */}
                <div className="flex items-center justify-between px-6 py-1.5 bg-white text-[10px] text-slate-400 font-medium">
                  <span>LTE ▪ SOA Network</span>
                  <span>100% 🔋</span>
                </div>

                {/* Cobranded header */}
                <div className="flex items-center justify-center gap-4 px-5 py-3 border-b border-slate-100 bg-white">
                  <img src={soaLogo} alt="Smart Office Automation" className="h-9 w-auto object-contain" />
                  <div className="w-px h-6 bg-slate-200" />
                  <img src={phaosLogo} alt="Phaos AI" className="h-9 w-auto object-contain" />
                </div>

                {/* Scrollable content */}
                <div className="flex-1 overflow-y-auto">
                  <p className="text-center text-xs font-medium text-slate-500 leading-relaxed px-8 pt-4 pb-3">
                    Real-time service, supply, and database tools, powered by your AI Agent on the fly.
                  </p>

                  {/* Central AI Orb */}
                  <div className="flex flex-col items-center py-5">
                    <div className="relative">
                      <div className="absolute inset-0 -m-5 rounded-full bg-gradient-to-br from-purple-400/20 to-blue-400/20 blur-xl animate-pulse" />
                      <div className="absolute inset-0 -m-3 rounded-full bg-gradient-to-br from-purple-500/10 to-blue-500/10 blur-md" />
                      <motion.button animate={{ scale: orbScale }} transition={{ duration: 1.2, ease: "easeInOut" }} className="relative w-24 h-24 rounded-full flex items-center justify-center shadow-lg shadow-purple-500/30" style={{ background: "linear-gradient(135deg, #7c3aed 0%, #3b82f6 50%, #6366f1 100%)" }}>
                        <Mic className="text-white" size={34} strokeWidth={2.5} />
                      </motion.button>
                    </div>
                    <span className="text-sm font-semibold text-slate-700 mt-3">Speak to AI Agent</span>
                    <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-1 mt-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" /> Active &amp; Listening
                    </span>
                  </div>

                  {/* Suggestion chips */}
                  <div className="px-4 pb-4">
                    <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1">
                      {SUGGESTIONS.map((s) => (
                        <button key={s.label} className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-100 active:scale-95 transition-all shadow-sm">
                          <span>{s.emoji}</span><span>{s.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Activity feed */}
                  <div className="px-4 pb-5">
                    <div className="flex items-center justify-between px-1 mb-2.5">
                      <span className="text-[11px] font-semibold text-slate-800 uppercase tracking-wider">Recent Activity</span>
                      <span className="text-[10px] text-slate-400">Today</span>
                    </div>
                    <div className="space-y-2.5">
                      {ACTIVITY_FEED.map((item, i) => {
                        const Icon = item.icon;
                        return (
                          <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-white border border-slate-100 shadow-sm">
                            <div className={`w-9 h-9 rounded-lg ${item.iconBg} flex items-center justify-center shrink-0`}>
                              <Icon className={item.iconColor} size={17} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <CheckCircle2 className="text-emerald-500 shrink-0" size={11} />
                                <span className="text-xs font-semibold text-slate-800 truncate">{item.title}</span>
                              </div>
                              <p className="text-[10px] text-slate-500 leading-snug mt-0.5 line-clamp-2">{item.detail}</p>
                            </div>
                            <span className="text-[9px] text-slate-400 shrink-0 mt-0.5">{item.time}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Home indicator */}
                <div className="shrink-0 flex items-end justify-center pb-3 pt-1.5 bg-slate-50">
                  <button onClick={() => setIsAppOpen(false)} className="w-36 h-1.5 bg-slate-800 rounded-full hover:bg-slate-600 transition-colors" aria-label="Return to home screen" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function DimmedApp({ app }: { app: { label: string; bg: string; emoji: string } }) {
  return (
    <div className="flex flex-col items-center gap-1.5 opacity-45">
      <div className={`w-16 h-16 rounded-2xl ${app.bg} flex items-center justify-center text-xl shadow-sm`}>
        {app.emoji}
      </div>
      <span className="text-white/50 text-[10px]">{app.label}</span>
    </div>
  );
}
