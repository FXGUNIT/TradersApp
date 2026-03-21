import { T } from '../constants/theme.js';

export const authBtn = (color, disabled) => ({ background: disabled ? "rgba(0,0,0,0.3)" : "#000000", border: `none`, borderRadius: 6, height: 44, display: "flex", alignItems: "center", justifyContent: "center", cursor: disabled ? "not-allowed" : "pointer", color: disabled ? "rgba(255,255,255,0.6)" : "#FFFFFF", fontFamily: T.font, fontSize: 14, fontWeight: 600, letterSpacing: "0.05em", width: "100%", transition: "all 0.2s ease", opacity: disabled ? 0.6 : 1, backdropFilter: "none", WebkitBackdropFilter: "none", className: "btn-glass", boxShadow: disabled ? "none" : "0 4px 6px -1px rgba(0, 0, 0, 0.1)" });

export const cardS = (e = {}) => ({ background: "#FFFFFF", border: "none", borderRadius: 12, padding: "24px 32px", marginBottom: 16, boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)", ...e });

export const glowBtn = (color, disabled) => ({ background: disabled ? "rgba(0,0,0,0.05)" : `${color}08`, border: `1px solid ${disabled ? "rgba(0,0,0,0.1)" : `${color}30`}`, borderRadius: 8, padding: "14px 28px", cursor: disabled ? "not-allowed" : "pointer", color: disabled ? "#9CA3AF" : color, fontFamily: T.font, fontSize: 13, fontWeight: 600, letterSpacing: 1.5, transition: "all 0.2s ease", opacity: disabled ? 0.6 : 1, backdropFilter: "none", WebkitBackdropFilter: "none", className: "btn-glass" });

export const authCard = { 
  background: "#FFFFFF", 
  backgroundImage: "linear-gradient(rgba(255,255,255,0.97), rgba(255,255,255,0.97)), url('/wallpaper.png')",
  backgroundSize: "cover",
  backgroundPosition: "center",
  backgroundBlendMode: "lighten",
  backgroundAttachment: "fixed",
  border: "none",
  borderRadius: 24, 
  padding: "clamp(56px, 12vw, 90px)", 
  width: "100%", 
  maxWidth: 460, 
  margin: "0 auto", 
  backdropFilter: "blur(20px)", 
  WebkitBackdropFilter: "blur(20px)", 
  boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
  position: "relative"
};

export const authInp = { background: "#FFFFFF", border: `1px solid #E2E8F0`, borderRadius: 6, padding: "12px 40px 12px 40px", color: "#0F172A", fontSize: 14, width: "100%", boxSizing: "border-box", outline: "none", transition: "all 0.2s ease", marginBottom: 16, backdropFilter: "none", WebkitBackdropFilter: "none", height: 44 };

export const lbl = { color: "#64748B", fontSize: 11, letterSpacing: 1.5, marginBottom: 6, display: "block", textTransform: "uppercase", fontWeight: 600, fontFamily: T.font };

export const inp = { background: "#F9FAFB", border: `1px solid rgba(0,0,0,0.08)`, borderRadius: 8, padding: "12px 14px", color: T.text, fontFamily: T.mono, fontSize: 14, width: "100%", boxSizing: "border-box", outline: "none", transition: "all 0.2s ease", backdropFilter: "none", WebkitBackdropFilter: "none" };
