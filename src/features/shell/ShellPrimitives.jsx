import { useEffect, useState } from "react";
import { CSS_VARS } from "../../styles/cssVars.js";
import {
  BarChart2,        // Analytics
  LayoutDashboard,  // Dashboard
  Zap,              // Performance
  FileText,         // Reports
  Settings,         // Settings / Management
  Users,            // Users
  Lock,              // Permissions / Encryption
  Shield,           // Access Control
  Database,         // Data / Backup
  Download,         // Exports
  Upload,           // Imports
  ClipboardList,    // Audit Log
} from "lucide-react";

export function Breadcrumbs({ items, onNavigate, theme }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "12px 32px",
        borderBottom: `1px solid ${CSS_VARS.borderStrong}`,
        background: CSS_VARS.surfaceGlass,
        overflowX: "auto",
      }}
    >
      {items.map((item, index) => (
        <div key={index} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={() => item.onNavigate && onNavigate(item.path)}
            style={{
              background: item.active ? "var(--accent-glow, rgba(0,122,255,0.2))" : "transparent",
              border: "none",
              color: item.active ? theme.blue : theme.muted,
              cursor: item.onNavigate ? "pointer" : "default",
              fontSize: 11,
              fontFamily: theme.font,
              fontWeight: 700,
              letterSpacing: 1,
              padding: "4px 8px",
              borderRadius: 4,
              transition: "all 0.2s ease",
              pointerEvents: item.onNavigate ? "auto" : "none",
            }}
            onMouseEnter={(event) => {
              if (item.onNavigate && !item.active) {
                event.currentTarget.style.background = "var(--accent-glow, rgba(0,122,255,0.1))";
                event.currentTarget.style.color = theme.blue;
              }
            }}
            onMouseLeave={(event) => {
              if (item.onNavigate && !item.active) {
                event.currentTarget.style.background = "transparent";
                event.currentTarget.style.color = theme.muted;
              }
            }}
            title={item.label}
          >
            {item.icon} {item.label}
          </button>
          {index < items.length - 1 && <span style={{ color: theme.dim, fontSize: 10 }}>{"\u203A"}</span>}
        </div>
      ))}
    </div>
  );
}

const TOOLS_CATEGORIES = [
  {
    name: "Analytics",
    Icon: BarChart2,
    items: [
      { label: "Dashboard", Icon: LayoutDashboard, action: () => void 0 },
      { label: "Performance", Icon: Zap, action: () => void 0 },
      { label: "Reports", Icon: FileText, action: () => void 0 },
    ],
  },
  {
    name: "Management",
    Icon: Settings,
    items: [
      { label: "Users", Icon: Users, action: () => void 0 },
      { label: "Permissions", Icon: Lock, action: () => void 0 },
      { label: "Settings", Icon: Settings, action: () => void 0 },
    ],
  },
  {
    name: "Data",
    Icon: Database,
    items: [
      { label: "Backup", Icon: Database, action: () => void 0 },
      { label: "Exports", Icon: Download, action: () => void 0 },
      { label: "Imports", Icon: Upload, action: () => void 0 },
    ],
  },
  {
    name: "Security",
    Icon: Shield,
    items: [
      { label: "Audit Log", Icon: ClipboardList, action: () => void 0 },
      { label: "Encryption", Icon: Lock, action: () => void 0 },
      { label: "Access Control", Icon: Shield, action: () => void 0 },
    ],
  },
];

export function MegaMenu({ isOpen, onClose, theme }) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: "var(--header-height, 60px)",
        left: 0,
        right: 0,
        background: "var(--surface-overlay-strong, rgba(0,0,0,0.95))",
        borderBottom: `1px solid ${CSS_VARS.accentPrimary}`,
        backdropFilter: "blur(10px)",
        zIndex: 999,
        padding: "24px 32px",
        maxHeight: "80vh",
        overflowY: "auto",
        animation: "fadeInDashboard 0.2s ease-out",
      }}
      onClick={onClose}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
          gap: 24,
        }}
        onClick={(event) => event.stopPropagation()}
      >
        {TOOLS_CATEGORIES.map((category) => (
          <div key={category.name} style={{ minWidth: "240px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 12,
                paddingBottom: 8,
                borderBottom: `1px solid ${CSS_VARS.accentPrimary}`,
              }}
            >
              {category.Icon && <category.Icon size={16} color={theme.blue} />}
              <div
                style={{
                  color: theme.blue,
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: 1,
                }}
              >
                {category.name.toUpperCase()}
              </div>
            </div>
            {category.items.map((item) => (
              <button
                key={item.label}
                onClick={() => {
                  item.action();
                  onClose();
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  width: "100%",
                  padding: "10px 12px",
                  background: "transparent",
                  border: "none",
                  color: theme.muted,
                  cursor: "pointer",
                  fontSize: 11,
                  fontFamily: theme.font,
                  fontWeight: 600,
                  transition: "all 0.15s ease",
                  borderRadius: 4,
                  marginBottom: 4,
                  textAlign: "left",
                }}
                onMouseEnter={(event) => {
                  event.currentTarget.style.background = "var(--accent-glow, rgba(0,122,255,0.15))";
                  event.currentTarget.style.color = theme.blue;
                  event.currentTarget.style.transform = "translateX(4px)";
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.background = "transparent";
                  event.currentTarget.style.color = theme.muted;
                  event.currentTarget.style.transform = "translateX(0)";
                }}
              >
                {item.Icon && (() => { const ItemIcon = item.Icon; return <ItemIcon size={14} color={theme.muted} />; })()}
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function BackToTopButton({ theme }) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.scrollY || document.documentElement.scrollTop;
      setIsVisible(scrolled > 300);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (!isVisible) return null;

  return (
    <button
      onClick={() => {
        window.scrollTo({
          top: 0,
          behavior: "smooth",
        });
      }}
      style={{
        position: "fixed",
        bottom: "30px",
        right: "30px",
        background: `linear-gradient(135deg, ${theme.purple}, ${theme.blue})`,
        border: "none",
        borderRadius: "50%",
        width: "48px",
        height: "48px",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: theme.text,
        fontSize: 20,
        fontWeight: 700,
        zIndex: 900,
        transition: "all 0.3s ease-in-out",
        boxShadow: `0 8px 24px ${CSS_VARS.borderStrong}, 0 0 20px ${theme.purple}40`,
        animation: "float 3s ease-in-out infinite",
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.transform = "scale(1.1)";
        event.currentTarget.style.boxShadow = `0 12px 32px ${CSS_VARS.borderStrong}, 0 0 30px ${theme.purple}60`;
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.transform = "scale(1)";
        event.currentTarget.style.boxShadow = `0 8px 24px ${CSS_VARS.borderStrong}, 0 0 20px ${theme.purple}40`;
      }}
      title="Back to Top"
    >
      {"\u2191"}
    </button>
  );
}
