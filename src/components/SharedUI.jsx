// Shared foundational UI primitives
import React, { useState, useRef, useEffect } from 'react';
import { T, AMD_PHASES } from '../constants/theme.js';
import { lbl, inp } from '../utils/styleUtils.js';

// RULE #54: Loading Overlay Component - Shows while syncing with database
export const LoadingOverlay = ({ isLoading }) => {
  if (!isLoading) return null;

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: "rgba(0,0,0,0.4)",
      backdropFilter: "blur(8px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000,
      pointerEvents: "none"
    }}>
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
        background: "rgba(20,20,20,0.95)",
        borderRadius: 12,
        padding: "40px",
        border: `1px solid rgba(0,122,255,0.2)`,
        pointerEvents: "auto",
        boxShadow: "0 8px 32px rgba(0,0,0,0.6)"
      }}>
        {/* Spinner Animation */}
        <div style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          border: "3px solid rgba(0,122,255,0.2)",
          borderTopColor: T.blue,
          animation: "spin 1s linear infinite",
          pointerEvents: "none"
        }} />

        {/* Loading Text */}
        <div style={{
          color: T.blue,
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: 1,
          textTransform: "uppercase",
          animation: "pulse 2s ease-in-out infinite"
        }}>
          ⚡ Syncing with Database...
        </div>
      </div>
    </div>
  );
};

// RULE #131: Skeleton Shimmer Loader - Smooth loading animation
export const SkeletonLoader = ({ width = "100%", height = "20px", borderRadius = "8px", count = 1 }) => {
  const skeletonStyle = {
    width,
    height,
    borderRadius,
    background: "linear-gradient(90deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 100%)",
    backgroundSize: "200% 100%",
    animation: "shimmer 2s infinite",
    marginBottom: count > 1 ? "12px" : "0px"
  };

  return (
    <div>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={skeletonStyle} />
      ))}
    </div>
  );
};

// RULE #132: Lazy Image Component - Progressive image loading
export const LazyImage = ({ src, alt = "Image", width = "100%", height = "auto", borderRadius = "8px", onLoad }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [imageSrc, setImageSrc] = useState(null);
  const imgRef = useRef(null);

  useEffect(() => {
    if (!src) return;

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          const img = new Image();
          img.onload = () => {
            setImageSrc(src);
            setIsLoaded(true);
            if (onLoad) onLoad();
          };
          img.onerror = () => {
            setImageSrc(src); // Still show broken image
            setIsLoaded(true);
          };
          img.src = src;
          observer.unobserve(imgRef.current);
        }
      },
      { threshold: 0.1 }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, [src, onLoad]);

  return (
    <div
      ref={imgRef}
      style={{
        width,
        height,
        borderRadius,
        overflow: "hidden",
        background: "rgba(255,255,255,0.05)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
      }}
    >
      {!isLoaded ? (
        <SkeletonLoader width={width} height={height} borderRadius={borderRadius} />
      ) : (
        <img
          src={imageSrc}
          alt={alt}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            borderRadius,
            opacity: isLoaded ? 1 : 0,
            transition: "opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
          }}
        />
      )}
    </div>
  );
};

// RULE #53: Enhanced Empty State Card
export const EmptyStateCard = ({ searchQuery, filterStatus }) => {
  const getEmptyMessage = () => {
    if (searchQuery) {
      return {
        icon: '\uD83D\uDD0D',
        title: 'NO TRADERS FOUND MATCHING THAT SEARCH',
        subtitle: `No traders match "${searchQuery}". Try adjusting your search terms or clearing filters.`
      };
    } else if (filterStatus === 'PENDING') {
      return {
        icon: '\uD83D\uDCCB',
        title: 'NO PENDING APPLICATIONS FOUND',
        subtitle: 'All applications have been processed. Come back later for new registrations.'
      };
    } else if (filterStatus === 'ACTIVE') {
      return {
        icon: '\u2713',
        title: 'NO ACTIVE TRADERS FOUND',
        subtitle: 'No traders are currently active. Approve pending applications to activate them.'
      };
    } else if (filterStatus === 'BLOCKED') {
      return {
        icon: '\uD83D\uDEAB',
        title: 'NO BANNED USERS FOUND',
        subtitle: 'No users have been banned from the platform.'
      };
    } else {
      return {
        icon: '\uD83D\uDC65',
        title: 'NO USERS REGISTERED YET',
        subtitle: 'No traders have signed up yet. Share your invitation link to get started.'
      };
    }
  };

  const msg = getEmptyMessage();

  return (
    <div style={{
      padding: "80px 40px",
      textAlign: "center",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "400px",
      background: "rgba(255,255,255,0.01)"
    }}>
      <div style={{
        fontSize: 48,
        marginBottom: 20,
        opacity: 0.6,
        animation: "float 3s ease-in-out infinite"
      }}>
        {msg.icon}
      </div>

      <div style={{
        color: T.muted,
        fontSize: 14,
        fontWeight: 600,
        marginBottom: 12,
        maxWidth: 400
      }}>
        {msg.title}
      </div>

      <div style={{
        color: T.dim,
        fontSize: 12,
        marginBottom: 24,
        maxWidth: 400,
        lineHeight: 1.6
      }}>
        {msg.subtitle}
      </div>
    </div>
  );
};

// Micro-primitive: pulsing LED dot indicator
export function LED({ color, size = 10, pulse = true }) {
  return <div style={{ width: size, height: size, borderRadius: "50%", background: color, boxShadow: `0 0 ${size}px ${color},0 0 ${size * 2}px ${color}60`, animation: pulse ? `led-pulse 1.8s ease-in-out infinite` : "none", flexShrink: 0 }} />;
}

// Micro-primitive: coloured label tag
export function Tag({ label, color }) {
  return <span style={{ background: color + "15", color, border: `1px solid ${color}35`, borderRadius: 6, padding: "4px 10px", fontSize: 11, letterSpacing: 1, fontWeight: 600, whiteSpace: "nowrap" }}>{label}</span>;
}

// Micro-primitive: section heading with icon, title, optional sub and right slot
export function SHead({ icon, title, color, sub, right }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18, paddingBottom: 12, borderBottom: `1px solid ${color}20` }}>
      <span style={{ color, fontSize: 18 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ color, fontSize: 13, letterSpacing: 1.5, fontWeight: 700 }}>{title}</div>
        {sub && <div style={{ color: T.muted, fontSize: 11, marginTop: 4, fontWeight: 400 }}>{sub}</div>}
      </div>
      {right}
    </div>
  );
}

// RULE #116: Safe Area Insets — ensures content isn't hidden by notches
export const SafeAreaWrapper = ({ children, style = {} }) => (
  <div
    style={{
      ...style,
      paddingTop: 'max(16px, env(safe-area-inset-top))',
      paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
      paddingLeft: 'max(16px, env(safe-area-inset-left))',
      paddingRight: 'max(16px, env(safe-area-inset-right))'
    }}
  >
    {children}
  </div>
);

// RULE #101: Full-Screen Toggle — hide browser UI for deep trading focus
export const FullScreenToggle = ({ showToast }) => {
  const [isFullScreen, setIsFullScreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullScreen(document.fullscreenElement !== null);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullScreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen().catch(err => {
          console.warn('Fullscreen request denied:', err);
          showToast('Fullscreen mode is sleeping. Wake it later.', 'warning');
        });
        setIsFullScreen(true);
        showToast('Viewport expanded. Immersive mode engaged. [ESC] to exit.', 'success');
      } else {
        await document.exitFullscreen();
        setIsFullScreen(false);
        showToast('\uD83D\uDCFA Full-Screen Mode Disabled', 'info');
      }
    } catch (error) {
      console.error('Fullscreen toggle error:', error);
      showToast('Fullscreen dimension unavailable. Adjust your timeline.', 'error');
    }
  };

  return (
    <button
      onClick={toggleFullScreen}
      style={{
        background: isFullScreen ? "rgba(0,122,255,0.2)" : "transparent",
        border: `1px solid ${isFullScreen ? "rgba(0,122,255,0.5)" : "rgba(255,255,255,0.2)"}`,
        borderRadius: 6,
        padding: "8px 12px",
        cursor: "pointer",
        color: isFullScreen ? T.blue : T.muted,
        fontFamily: T.font,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 1,
        transition: "all 0.2s ease-in-out",
        display: 'flex',
        alignItems: 'center',
        gap: 6
      }}
      onMouseEnter={e => {
        if (!isFullScreen) {
          e.currentTarget.style.background = "rgba(255,255,255,0.05)";
          e.currentTarget.style.borderColor = "rgba(255,255,255,0.3)";
          e.currentTarget.style.transform = "translateY(-2px)";
        }
      }}
      onMouseLeave={e => {
        if (!isFullScreen) {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)";
          e.currentTarget.style.transform = "translateY(0)";
        }
      }}
      className="btn-glass"
      title={isFullScreen ? "Exit Full-Screen (ESC)" : "Enter Full-Screen Mode"}
    >
      {isFullScreen ? '\u26F6' : '\u26F6'}
    </button>
  );
};

// Bar-chart style animated loader
export function Loader({ color, label }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 240, gap: 16 }}>
      <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 28 }}>
        {[8, 15, 10, 20, 12, 17, 9].map((h, i) => (
          <div key={i} style={{ width: 4, height: h, background: color, borderRadius: 2, animation: `bar ${0.85 + i * 0.05}s ${i * 0.1}s ease-in-out infinite alternate` }} />
        ))}
      </div>
      <span style={{ color: T.muted, fontSize: 12, letterSpacing: 2, fontWeight: 600 }}>{label}</span>
    </div>
  );
}

// Premium Video Loader — AI processing state
export function VideoLoader({ label = "PROCESSING..." }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 240, gap: 20 }}>
      <div style={{
        width: 100,
        height: 100,
        borderRadius: "50%",
        overflow: "hidden",
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
        background: "#F9FAFB",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}>
        <video
          src="/logo.mp4"
          autoPlay
          loop
          muted
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          onError={(e) => {
            e.target.parentElement.innerHTML = '\uD83D\uDD04';
            e.target.parentElement.style.fontSize = '48px';
            e.target.parentElement.style.display = 'flex';
            e.target.parentElement.style.alignItems = 'center';
            e.target.parentElement.style.justifyContent = 'center';
          }}
        />
      </div>
      <span style={{ color: "#6B7280", fontSize: 12, letterSpacing: 2, fontWeight: 600 }}>{label}</span>
    </div>
  );
}

// Market phase tag — AMD cycle indicator
export function AMDPhaseTag({ phase }) {
  const cfg = AMD_PHASES[phase] || AMD_PHASES.UNCLEAR;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", background: cfg.color + "15", border: `1px solid ${cfg.color}40`, borderRadius: 8 }} className="glass-panel">
      <LED color={cfg.color} size={10} pulse={phase !== 'UNCLEAR'} />
      <div>
        <div style={{ color: cfg.color, fontSize: 12, fontWeight: 700, letterSpacing: 1 }}>{cfg.icon} {cfg.label}</div>
        <div style={{ color: T.muted, fontSize: 11, marginTop: 2 }}>{cfg.desc}</div>
      </div>
    </div>
  );
}

// Compliance traffic light — green/yellow/red state
export function TrafficLight({ state }) {
  if (state === 'none') return null;
  const cfg = {
    green:  { color: T.green, label: "TRADE CLEAR",    sub: "All systems go \u00B7 Compliance passed" },
    yellow: { color: T.gold,  label: "CAUTION ACTIVE", sub: "Warning detected \u2014 review analysis" },
    red:    { color: T.red,   label: "TERMINAL LOCKED", sub: "Compliance breach or market closed" }
  };
  const c = cfg[state];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 20px", background: "rgba(0,0,0,0.4)", border: `1px solid ${c.color}30`, borderRadius: 10, marginBottom: 16 }} className="glass-panel">
      <div style={{ width: 22, height: 22, borderRadius: "50%", background: c.color, boxShadow: `0 0 12px ${c.color},0 0 32px ${c.color}60`, animation: `led-pulse 1.6s ease-in-out infinite`, flexShrink: 0 }} />
      <div>
        <div style={{ color: c.color, fontSize: 13, letterSpacing: 2, fontWeight: 800 }}>{c.label}</div>
        <div style={{ color: T.muted, fontSize: 11, marginTop: 3 }}>{c.sub}</div>
      </div>
    </div>
  );
}

// IST market-hours countdown banner
export function CountdownBanner({ ist }) {
  const color = ist.isOpen ? T.green : T.red;
  const [hh, mm, ss] = ist.countdown.split(':');
  const urgent = ist.isOpen && parseInt(hh) === 0 && parseInt(mm) < 30;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "12px 28px", background: urgent ? "rgba(255,69,58,0.1)" : ist.isOpen ? "rgba(48,209,88,0.05)" : "rgba(255,69,58,0.05)", borderBottom: `1px solid ${color}25`, borderTop: `1px solid ${color}15`, flexWrap: "wrap" }} className="glass-panel">
      <LED color={color} size={8} pulse />
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <span style={{ color: T.muted, fontSize: 11, letterSpacing: 2, fontWeight: 600 }}>{ist.lbl}</span>
        <span style={{ color, fontSize: 24, fontFamily: T.mono, fontWeight: 700, letterSpacing: 4 }}>{hh}:{mm}:{ss}</span>
      </div>
      <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.1)" }} />
      <span style={{ color: T.muted, fontSize: 12, fontWeight: 600 }}>{ist.istStr}</span>
      {!ist.isOpen && <span style={{ marginLeft: "auto", color: T.red, fontSize: 11, letterSpacing: 1, fontWeight: 700 }}>LOCKED \u00B7 10:00AM\u20135:00PM IST ONLY</span>}
      {urgent && <span style={{ marginLeft: "auto", color: T.gold, fontSize: 11, letterSpacing: 1, fontWeight: 700, animation: "led-pulse 1s infinite" }}>{"\u26A0"} SESSION ENDING SOON</span>}
    </div>
  );
}
// Step 23: Breadcrumbs extracted from App.jsx
export const Breadcrumbs = ({ items, onNavigate }) => {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '12px 32px',
      borderBottom: `1px solid rgba(255,255,255,0.1)`,
      background: 'rgba(0,0,0,0.3)',
      overflowX: 'auto'
    }}>
      {items.map((item, idx) => (
        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => item.onNavigate && onNavigate(item.path)}
            style={{
              background: item.active ? 'rgba(0,122,255,0.2)' : 'transparent',
              border: 'none',
              color: item.active ? T.blue : T.muted,
              cursor: item.onNavigate ? 'pointer' : 'default',
              fontSize: 11,
              fontFamily: T.font,
              fontWeight: 700,
              letterSpacing: 1,
              padding: '4px 8px',
              borderRadius: 4,
              transition: 'all 0.2s ease',
              pointerEvents: item.onNavigate ? 'auto' : 'none'
            }}
            onMouseEnter={e => {
              if (item.onNavigate && !item.active) {
                e.currentTarget.style.background = 'rgba(0,122,255,0.1)';
                e.currentTarget.style.color = T.blue;
              }
            }}
            onMouseLeave={e => {
              if (item.onNavigate && !item.active) {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = T.muted;
              }
            }}
            title={item.label}
          >
            {item.icon} {item.label}
          </button>
          {idx < items.length - 1 && (
            <span style={{ color: T.dim, fontSize: 10 }}>{'\u203A'}</span>
          )}
        </div>
      ))}
    </div>
  );
};

// Step 24: SystemThemeSync extracted from App.jsx
export const SystemThemeSync = ({ isDarkMode, onThemeChange }) => {
  return (
    <button
      onClick={() => onThemeChange(!isDarkMode)}
      style={{
        background: isDarkMode ? 'rgba(0,122,255,0.15)' : 'rgba(255,193,7,0.15)',
        border: `1px solid ${isDarkMode ? 'rgba(0,122,255,0.3)' : 'rgba(255,193,7,0.3)'}`,
        borderRadius: 6,
        padding: '8px 12px',
        cursor: 'pointer',
        color: isDarkMode ? '#0A84FF' : '#FFD60A',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto',
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 1,
        transition: 'all 0.2s ease-in-out',
        display: 'flex',
        alignItems: 'center',
        gap: 6
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = isDarkMode ? 'rgba(0,122,255,0.2)' : 'rgba(255,193,7,0.2)';
        e.currentTarget.style.boxShadow = isDarkMode ? '0 0 15px rgba(0,122,255,0.2)' : '0 0 15px rgba(255,193,7,0.2)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = isDarkMode ? 'rgba(0,122,255,0.15)' : 'rgba(255,193,7,0.15)';
        e.currentTarget.style.boxShadow = 'none';
      }}
      title={isDarkMode ? 'Light Mode' : 'Dark Mode'}
    >
      {isDarkMode ? '\uD83C\uDF19' : '\u2600\uFE0F'}
    </button>
  );
};

// Step 25: MegaMenu extracted from App.jsx
export const MegaMenu = ({ isOpen, onClose }) => {
  const toolsCategories = [
    {
      name: 'Analytics',
      icon: '\uD83D\uDCCA',
      items: [
        { label: 'Dashboard', icon: '\uD83D\uDCC8', action: () => void 0 },
        { label: 'Performance', icon: '\u26A1', action: () => void 0 },
        { label: 'Reports', icon: '\uD83D\uDCCB', action: () => void 0 }
      ]
    },
    {
      name: 'Management',
      icon: '\u2699\uFE0F',
      items: [
        { label: 'Users', icon: '\uD83D\uDC65', action: () => void 0 },
        { label: 'Permissions', icon: '\uD83D\uDD10', action: () => void 0 },
        { label: 'Settings', icon: '\uD83D\uDEE0\uFE0F', action: () => void 0 }
      ]
    },
    {
      name: 'Data',
      icon: '\uD83D\uDCBE',
      items: [
        { label: 'Backup', icon: '\uD83D\uDCBF', action: () => void 0 },
        { label: 'Exports', icon: '\uD83D\uDCE4', action: () => void 0 },
        { label: 'Imports', icon: '\uD83D\uDCE5', action: () => void 0 }
      ]
    },
    {
      name: 'Security',
      icon: '\uD83D\uDD12',
      items: [
        { label: 'Audit Log', icon: '\uD83D\uDCDD', action: () => void 0 },
        { label: 'Encryption', icon: '\uD83D\uDD10', action: () => void 0 },
        { label: 'Access Control', icon: '\uD83D\uDEE1\uFE0F', action: () => void 0 }
      ]
    }
  ];

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 'var(--header-height, 60px)',
        left: 0,
        right: 0,
        background: 'rgba(0,0,0,0.95)',
        borderBottom: `1px solid rgba(0,122,255,0.3)`,
        backdropFilter: 'blur(10px)',
        zIndex: 999,
        padding: '24px 32px',
        maxHeight: '80vh',
        overflowY: 'auto',
        animation: 'fadeInDashboard 0.2s ease-out'
      }}
      onClick={onClose}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: 24,
          onClick: (e) => e.stopPropagation()
        }}
      >
        {toolsCategories.map((category) => (
          <div key={category.name} style={{ minWidth: '240px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 12,
              paddingBottom: 8,
              borderBottom: `1px solid rgba(0,122,255,0.3)`
            }}>
              <span style={{ fontSize: 16 }}>{category.icon}</span>
              <div style={{ color: T.blue, fontSize: 12, fontWeight: 700, letterSpacing: 1 }}>
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
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '10px 12px',
                  background: 'transparent',
                  border: 'none',
                  color: T.muted,
                  cursor: 'pointer',
                  fontSize: 11,
                  fontFamily: T.font,
                  fontWeight: 600,
                  transition: 'all 0.15s ease',
                  borderRadius: 4,
                  marginBottom: 4,
                  textAlign: 'left'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(0,122,255,0.15)';
                  e.currentTarget.style.color = T.blue;
                  e.currentTarget.style.transform = 'translateX(4px)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = T.muted;
                  e.currentTarget.style.transform = 'translateX(0)';
                }}
              >
                <span style={{ fontSize: 14, minWidth: 20 }}>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

// Step 26: BackToTopButton extracted from App.jsx
export const BackToTopButton = () => {
  const [isVisible, setIsVisible] = React.useState(false);

  React.useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.scrollY || document.documentElement.scrollTop;
      setIsVisible(scrolled > 300);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!isVisible) return null;

  return (
    <button
      onClick={scrollToTop}
      style={{
        position: 'fixed',
        bottom: '30px',
        right: '30px',
        background: `linear-gradient(135deg, ${T.purple}, ${T.blue})`,
        border: 'none',
        borderRadius: '50%',
        width: '48px',
        height: '48px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: T.text,
        fontSize: 20,
        fontWeight: 700,
        zIndex: 900,
        transition: 'all 0.3s ease-in-out',
        boxShadow: `0 8px 24px rgba(0,0,0,0.4), 0 0 20px ${T.purple}40`,
        animation: 'float 3s ease-in-out infinite'
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'scale(1.1)';
        e.currentTarget.style.boxShadow = `0 12px 32px rgba(0,0,0,0.6), 0 0 30px ${T.purple}60`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'scale(1)';
        e.currentTarget.style.boxShadow = `0 8px 24px rgba(0,0,0,0.4), 0 0 20px ${T.purple}40`;
      }}
      title="Back to Top"
    >
      {'↑'}
    </button>
  );
};

// Step 27: AuthLogo extracted from App.jsx
export const AuthLogo = () => (
  <div style={{ textAlign: "center", marginBottom: 36 }}>
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginBottom: 20 }}>
      {/* Logo Image - Left aligned */}
      <img
        src="/logo.png"
        alt="Logo"
        style={{
          borderRadius: '50%',
          overflow: 'hidden',
          objectFit: 'cover',
          width: '60px',
          height: '60px',
          border: 'none',
          display: 'block'
        }}
        onError={(e) => {
          e.target.style.display = 'none';
        }}
      />
      {/* Header Text */}
      <div style={{ textAlign: "left" }}>
        <div style={{ color: "#111827", fontSize: "clamp(16px, 3vw, 18px)", letterSpacing: 1.5, fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif", fontWeight: 700 }}>THE DEPARTMENT OF INSTITUTIONAL ARTILLERY</div>
        <div style={{ color: "#1e40af", fontSize: "0.7rem", letterSpacing: 0.5, fontFamily: "Arial, 'Courier New', monospace", fontWeight: 700 }}>Traders’ Regiment Territory.</div>
      </div>
    </div>
  </div>
);

// Step 28: RenderOut extracted from App.jsx
export function RenderOut({ text }) {
  if (!text) return null;
  return <div style={{ fontFamily: T.font, lineHeight: 1.8, fontSize: 13 }}>
    {text.split('\n').map((line, i) => {
      const t = line.trim();
      if (t.startsWith('## ')) return <h2 key={i} style={{ color: T.gold, fontSize: 15, margin: "24px 0 10px", borderBottom: `1px solid rgba(255,255,255,0.1)`, paddingBottom: 8, letterSpacing: 1, fontWeight: 700 }} className="gemini-gradient-text">{t.slice(3)}</h2>;
      if (t.startsWith('### ')) return <h3 key={i} style={{ color: T.blue, fontSize: 13, margin: "14px 0 6px", letterSpacing: 0.5, fontWeight: 600 }}>{t.slice(4)}</h3>;
      if (t.includes('🚫')) return <div key={i} style={{ background: "rgba(255,69,58,0.1)", border: `1px solid rgba(255,69,58,0.3)`, borderRadius: 6, padding: "12px 16px", margin: "8px 0", color: T.red, fontSize: 13, fontWeight: 600 }}>{t}</div>;
      if (t.includes('✅')) return <div key={i} style={{ background: "rgba(48,209,88,0.1)", border: `1px solid rgba(48,209,88,0.3)`, borderRadius: 6, padding: "12px 16px", margin: "8px 0", color: T.green, fontSize: 13, fontWeight: 600 }}>{t}</div>;
      if (t.includes('⚠️') || t.includes('⚠')) return <div key={i} style={{ background: "rgba(255,214,10,0.1)", border: `1px solid rgba(255,214,10,0.3)`, borderRadius: 6, padding: "12px 16px", margin: "8px 0", color: T.gold, fontSize: 13, fontWeight: 600 }}>{t}</div>;
      if (t.includes('**')) { const parts = t.split(/(\*\*[^*]+\*\*)/g); return <p key={i} style={{ color: "#A1A1A6", margin: "4px 0" }}>{parts.map((p2, j) => p2.startsWith('**') ? <strong key={j} style={{ color: T.text, fontWeight: 600 }}>{p2.replace(/\*\*/g, '')}</strong> : p2)}</p>; }
      if (!t) return <div key={i} style={{ height: 6 }} />;
      return <p key={i} style={{ color: t.startsWith('→') || t.startsWith('AMD') ? T.cyan : "#A1A1A6", margin: "3px 0" }}>{line}</p>;
    })}
  </div>;
}

// AMDPhaseTag + TrafficLight + CountdownBanner extracted to src/components/SharedUI.jsx

// Step 28: PasteZone extracted from App.jsx
export function PasteZone({ zoneId, activeZone, setActiveZone, children, style }) {
  const isActive = activeZone === zoneId;
  return (
    <div onClick={() => setActiveZone(zoneId)} style={{ position: "relative", cursor: "pointer", ...style, outline: isActive ? `2px solid ${T.blue}60` : "2px solid transparent", borderRadius: 12, transition: "all 0.2s ease" }} className="glass-panel">
      {children}
      <div style={{ position: "absolute", top: 8, right: 8, background: isActive ? T.blue + "25" : "rgba(0,0,0,0.6)", border: isActive ? `1px solid ${T.blue}50` : "none", borderRadius: 6, padding: "4px 10px", fontSize: 10, color: isActive ? T.blue : T.muted, fontWeight: 600, pointerEvents: "none", letterSpacing: 1 }}>
        {isActive ? "CTRL+V READY" : "Click → Ctrl+V"}
      </div>
    </div>
  );
}

// Step 28: HourlyHeatmap extracted from App.jsx
export function HourlyHeatmap({ hourlyHeatmap }) {
  if (!hourlyHeatmap || !Object.keys(hourlyHeatmap).length) return null;
  const hrs = [4, 5, 6, 7, 8, 9, 10, 11], nowUTC = new Date().getUTCHours();
  const lbls = ['9:30', '10:30', '11:30', '12:30', '1:30', '2:30', '3:30', '4:30'];
  return (
    <div style={{ padding: "16px 20px", background: "rgba(0,0,0,0.3)", border: `1px solid rgba(255,255,255,0.08)`, borderRadius: 10, marginBottom: 16 }} className="glass-panel heatmap">
      <div style={{ color: T.muted, fontSize: 11, letterSpacing: 2, marginBottom: 12, fontWeight: 600 }}>45D HOURLY HEATMAP (IST) · TREND vs RANGE</div>
      <div style={{ display: "flex", gap: 4, alignItems: "flex-end", overflowX: "auto" }} className="hourly-heatmap">
        {hrs.map((utcH, i) => { 
          const st = hourlyHeatmap[utcH], isCur = utcH === nowUTC; 
          if (!st || !st.total) return <div key={utcH} style={{ flex: 1, minWidth: 40, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}><div style={{ height: 40, background: "rgba(255,255,255,0.03)", borderRadius: 4, width: "100%" }} /><div style={{ color: T.dim, fontSize: 10 }}>{lbls[i]}</div></div>; 
          const tp = st.trend / st.total, barH = 40, tH = Math.round(tp * barH); 
          const heatColor = tp > 0.7 ? T.green : tp > 0.5 ? "#88cc44" : tp > 0.35 ? "#ccaa22" : tp > 0.2 ? "#cc6622" : T.red; 
          return (
            <div key={utcH} title={`${lbls[i]} IST | Trend ${Math.round(tp * 100)}% | ${st.total} days`} style={{ flex: 1, minWidth: 40, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: "default" }}>
              <div style={{ height: barH, width: "100%", borderRadius: 4, overflow: "hidden", display: "flex", flexDirection: "column", position: "relative", border: isCur ? `2px solid ${T.gold}` : "none", boxSizing: "border-box" }}>
                <div style={{ height: tH, background: heatColor + "90" }} />
                <div style={{ height: barH - tH, background: "rgba(0,0,0,0.5)" }} />
              </div>
              <div style={{ color: isCur ? T.gold : T.muted, fontSize: 10, fontWeight: 600 }}>{lbls[i]}</div>
              <div style={{ color: heatColor, fontSize: 10, fontFamily: T.mono }}>{Math.round(tp * 100)}%</div>
            </div>
          ); 
        })}
      </div>
    </div>
  );
}

// Step 31: SplashScreen extracted from App.jsx
export function SplashScreen() {
  return (
    <div style={{ minHeight: "100vh", background: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: T.font }}>
      <div style={{ textAlign: "center" }}>
        <AuthLogo />
        <div style={{ display: "flex", justifyContent: "center", gap: 5, alignItems: "flex-end", height: 30, marginTop: 24 }}>
          {[10, 18, 12, 24, 15, 20, 11].map((h, i) => <div key={i} style={{ width: 5, height: h, background: "#10B981", borderRadius: 3, animation: `bar 0.85s ${i * 0.1}s ease-in-out infinite alternate` }} />)}
        </div>
        <div style={{ color: "#64748B", fontSize: 11, letterSpacing: 4, marginTop: 16, fontWeight: 600 }}>INITIALIZING...</div>
      </div>
    </div>
  );
}

// Step 32: MobileBottomNav extracted from App.jsx
export const MobileBottomNav = ({ currentPage, onNavigate }) => {
  const [windowWidth, setWindowWidth] = React.useState(typeof window !== 'undefined' ? window.innerWidth : 1024);

  React.useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = windowWidth < 768;

  if (!isMobile) return null;

  const navItems = [
    { icon: '\uD83D\uDCCA', label: 'Dashboard', id: 'dashboard' },
    { icon: '\uD83D\uDC65', label: 'Users', id: 'users' },
    { icon: '\uD83D\uDD14', label: 'Alerts', id: 'alerts' },
    { icon: '\u2699\uFE0F', label: 'Settings', id: 'settings' }
  ];

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '60px',
        background: 'rgba(20,20,20,0.95)',
        borderTop: `1px solid rgba(0,122,255,0.3)`,
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        zIndex: 999,
        backdropFilter: 'blur(10px)',
        paddingBottom: 'max(0px, env(safe-area-inset-bottom))'
      }}
    >
      {navItems.map(item => (
        <button
          key={item.id}
          onClick={() => onNavigate(item.id)}
          style={{
            background: currentPage === item.id ? 'rgba(0,122,255,0.2)' : 'transparent',
            border: 'none',
            borderTop: currentPage === item.id ? `2px solid ${T.blue}` : 'none',
            cursor: 'pointer',
            color: currentPage === item.id ? T.blue : T.muted,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
            padding: '8px 12px',
            fontSize: 10,
            fontFamily: T.font,
            fontWeight: 700,
            letterSpacing: 0.5,
            transition: 'all 0.2s ease',
            flx: 1,
            width: '100%'
          }}
          onMouseEnter={e => {
            if (currentPage !== item.id) {
              e.currentTarget.style.color = T.blue;
              e.currentTarget.style.background = 'rgba(0,122,255,0.1)';
            }
          }}
          onMouseLeave={e => {
            if (currentPage !== item.id) {
              e.currentTarget.style.color = T.muted;
              e.currentTarget.style.background = 'transparent';
            }
          }}
        >
          <span style={{ fontSize: 18 }}>{item.icon}</span>
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
};

// RULE #119: Notification Center - Sidebar on desktop, overlay on mobile
export const NotificationCenter = ({ isOpen, onClose, notifications = [] }) => {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const isMobile = windowWidth < 768;
  
  // Mobile: Full-screen overlay
  if (isMobile) {
    if (!isOpen) return null;
    
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.9)',
          zIndex: 1001,
          display: 'flex',
          flexDirection: 'column',
          animation: 'fadeInDashboard 0.3s ease-out',
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px',
            borderBottom: `1px solid rgba(0,122,255,0.3)`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div style={{ color: T.blue, fontSize: 16, fontWeight: 700, letterSpacing: 1 }}>
            \uD83D\uDD14 NOTIFICATIONS
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: T.muted,
              fontSize: 20,
              cursor: 'pointer',
              padding: '4px 8px'
            }}
          >
            \u2715
          </button>
        </div>
        
        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          {notifications.length === 0 ? (
            <div style={{ textAlign: 'center', color: T.muted, paddingTop: '32px' }}>
              <div style={{ fontSize: 32, marginBottom: 16 }}>\uD83D\uDD07</div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>No new notifications</div>
            </div>
          ) : (
            notifications.map((notif, idx) => (
              <div
                key={idx}
                style={{
                  padding: '12px',
                  background: 'rgba(0,122,255,0.1)',
                  border: `1px solid rgba(0,122,255,0.2)`,
                  borderRadius: 6,
                  marginBottom: 12,
                  color: T.text,
                  fontSize: 12
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{notif.title}</div>
                <div style={{ color: T.muted, fontSize: 11 }}>{notif.message}</div>
                <div style={{ color: T.dim, fontSize: 10, marginTop: 6 }}>{notif.time}</div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }
  
  // Desktop: Sidebar
  if (!isOpen) return null;
  
  return (
    <div
      style={{
        position: 'fixed',
        right: 0,
        top: 0,
        bottom: 0,
        width: '320px',
        background: 'rgba(20,20,20,0.95)',
        borderLeft: `1px solid rgba(0,122,255,0.3)`,
        zIndex: 1001,
        display: 'flex',
        flexDirection: 'column',
        animation: 'slideInToast 0.3s ease-out',
        backdropFilter: 'blur(10px)'
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px',
          borderBottom: `1px solid rgba(0,122,255,0.3)`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0
        }}
      >
        <div style={{ color: T.blue, fontSize: 14, fontWeight: 700, letterSpacing: 1 }}>
          \uD83D\uDD14 ALERTS
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: T.muted,
            fontSize: 18,
            cursor: 'pointer',
            padding: '4px 8px',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color = T.blue;
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = T.muted;
          }}
        >
          \u2715
        </button>
      </div>
      
      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
        {notifications.length === 0 ? (
          <div style={{ textAlign: 'center', color: T.muted, paddingTop: '48px' }}>
            <div style={{ fontSize: 32, marginBottom: 16 }}>\uD83D\uDD07</div>
            <div style={{ fontSize: 11, fontWeight: 600 }}>No alerts</div>
          </div>
        ) : (
          notifications.map((notif, idx) => (
            <div
              key={idx}
              style={{
                padding: '12px',
                background: 'rgba(0,122,255,0.1)',
                border: `1px solid rgba(0,122,255,0.2)`,
                borderRadius: 6,
                marginBottom: 12,
                color: T.text,
                fontSize: 11
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 4 }}>{notif.title}</div>
              <div style={{ color: T.muted, fontSize: 10 }}>{notif.message}</div>
              <div style={{ color: T.dim, fontSize: 9, marginTop: 6 }}>{notif.time}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// RULE #109, #111: User Switcher - Shadow Mode to view as another user
export const UserSwitcher = ({ users, currentViewAsUser, onSwitchUser, ghostMode }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  const currentUser = currentViewAsUser 
    ? Object.entries(users).find(([uid]) => uid === currentViewAsUser)?.[1]
    : null;
  
  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: ghostMode ? 'rgba(0,255,127,0.15)' : currentViewAsUser ? 'rgba(0,122,255,0.15)' : 'transparent',
          border: `1px solid ${ghostMode ? 'rgba(0,255,127,0.4)' : currentViewAsUser ? 'rgba(0,122,255,0.4)' : 'rgba(255,255,255,0.2)'}`,
          borderRadius: 6,
          padding: '8px 12px',
          cursor: 'pointer',
          color: ghostMode ? '#00FF7F' : currentViewAsUser ? T.blue : T.muted,
          fontFamily: T.font,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 1,
          transition: 'all 0.2s ease-in-out',
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}
        onMouseEnter={e => {
          if (!currentViewAsUser && !ghostMode) {
            e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)';
          }
        }}
        onMouseLeave={e => {
          if (!currentViewAsUser && !ghostMode) {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
          }
        }}
        title={currentViewAsUser ? `Viewing as: ${currentUser?.fullName}` : 'Switch to view as another user'}
      >
        <span>{ghostMode ? '\uD83D\uDC7B' : currentViewAsUser ? '\uD83D\uDC41\uFE0F' : '\uD83D\uDC65'}</span>
        <span>{ghostMode ? 'GHOST' : currentViewAsUser ? `AS: ${currentUser?.fullName?.split(' ')[0].toUpperCase()}` : 'SHADOW MODE'}</span>
      </button>
      
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 4,
            background: 'rgba(20,20,20,0.95)',
            border: `1px solid rgba(0,122,255,0.3)`,
            borderRadius: 6,
            padding: '8px 0',
            minWidth: '200px',
            maxHeight: '300px',
            overflowY: 'auto',
            zIndex: 1001,
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Exit Shadow Mode */}
          {currentViewAsUser && (
            <button
              onClick={() => {
                onSwitchUser(null);
                setIsOpen(false);
              }}
              style={{
                width: '100%',
                padding: '8px 16px',
                background: 'rgba(255,69,58,0.15)',
                border: 'none',
                cursor: 'pointer',
                color: T.red,
                fontSize: 10,
                fontWeight: 600,
                textAlign: 'left',
                borderBottom: `1px solid rgba(255,69,58,0.2)`,
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,69,58,0.25)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,69,58,0.15)'}
            >
              \u2715 Exit Shadow Mode
            </button>
          )}
          
          {/* User List */}
          {Object.entries(users).slice(0, 20).map(([uid, user]) => (
            <button
              key={uid}
              onClick={() => {
                onSwitchUser(uid);
                setIsOpen(false);
              }}
              style={{
                width: '100%',
                padding: '8px 16px',
                background: currentViewAsUser === uid ? 'rgba(0,122,255,0.2)' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: currentViewAsUser === uid ? T.blue : T.muted,
                fontSize: 10,
                fontWeight: 600,
                textAlign: 'left',
                transition: 'all 0.15s ease',
                borderBottom: `1px solid rgba(255,255,255,0.05)`
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(0,122,255,0.15)';
                e.currentTarget.style.color = T.text;
              }}
              onMouseLeave={e => {
                if (currentViewAsUser !==uid) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = T.muted;
                }
              }}
            >
              <div style={{ fontSize: 9, fontWeight: 700 }}>\uD83D\uDC64 {user.fullName || 'Unknown'}</div>
              <div style={{ fontSize: 8, color: T.dim, marginTop: 2 }}>{user.email || 'no-email'}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// RULE #99: Command Palette - Search users, jump pages, toggle features
export const CommandPalette = ({ isOpen, onClose, users, onJumpToUser, onToggleGhostMode, ghostMode, showToast }) => {
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  
  if (!isOpen) return null;
  
  // Generate command list
  const commands = [
    {
      id: 'ghost-mode',
      label: ghostMode ? '\uD83D\uDC41\uFE0F Disable Ghost Mode' : '\uD83D\uDC41\uFE0F Enable Ghost Mode',
      category: 'Settings',
      action: () => onToggleGhostMode()
    },
    {
      id: 'refresh-users',
      label: '\u21BA Refresh User List',
      category: 'Data',
      action: () => {
        showToast('Refreshing user data...', 'info');
        // Refresh would be triggered by parent
      }
    },
    {
      id: 'export-users',
      label: '\uD83D\uDCBE Export Users (CSV)', 
      category: 'Data',
      action: () => showToast('Export feature coming soon!', 'info')
    }
  ];
  
  // Add users as commands
  const userCommands = Object.entries(users).map(([uid, user]) => ({
    id: `user-${uid}`,
    label: `\uD83D\uDC64 ${user.fullName || 'Unknown'} (${user.email || 'no-email'})`,
    category: 'Users',
    action: () => onJumpToUser(uid),
    metadata: { uid, user }
  }));
  
  const allCommands = [...commands, ...userCommands];
  
  // Filter by query
  const queryLower = query.toLowerCase();
  const filtered = allCommands.filter(cmd =>
    cmd.label.toLowerCase().includes(queryLower) ||
    cmd.category.toLowerCase().includes(queryLower)
  );
  
  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(Math.min(selectedIdx + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(Math.max(selectedIdx - 1, 0));
    } else if (e.key === 'Enter' && filtered[selectedIdx]) {
      e.preventDefault();
      filtered[selectedIdx].action();
      onClose();
      setQuery('');
      setSelectedIdx(0);
    }
  };
  
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '20vh',
        zIndex: 2000,
        animation: 'fadeInDashboard 0.15s ease-out'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: T.bg,
          borderRadius: 12,
          border: `1px solid rgba(0,122,255,0.3)`,
          width: '90%',
          maxWidth: '600px',
          maxHeight: '70vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div style={{ padding: '16px', borderBottom: `1px solid rgba(255,255,255,0.1)` }}>
          <input
            autoFocus
            type="text"
            placeholder="\u2318 Search users, commands..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIdx(0);
            }}
            onKeyDown={handleKeyDown}
            style={{
              width: '100%',
              background: 'rgba(0,0,0,0.4)',
              border: `1px solid rgba(0,122,255,0.3)`,
              borderRadius: 6,
              padding: '12px 16px',
              color: T.text,
              fontSize: 14,
              fontFamily: T.font,
              outline: 'none',
              transition: 'all 0.2s ease'
            }}
          />
        </div>
        
        {/* Results List */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: T.muted }}>
              <div style={{ fontSize: 20, marginBottom: 8 }}>\u2205</div>
              <div style={{ fontSize: 12 }}>No commands or users match "{query}"</div>
            </div>
          ) : (
            filtered.map((cmd, idx) => (
              <div
                key={cmd.id}
                onClick={() => {
                  cmd.action();
                  onClose();
                  setQuery('');
                  setSelectedIdx(0);
                }}
                style={{
                  padding: '12px 16px',
                  borderBottom: `1px solid rgba(255,255,255,0.05)`,
                  background: selectedIdx === idx ? 'rgba(0,122,255,0.15)' : 'transparent',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
                onMouseEnter={() => setSelectedIdx(idx)}
              >
                <div>
                  <div style={{ color: T.text, fontSize: 13, fontWeight: 500 }}>{cmd.label}</div>
                  <div style={{ color: T.dim, fontSize: 10, marginTop: 2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {cmd.category}
                  </div>
                </div>
                <div style={{ color: T.muted, fontSize: 10, fontWeight: 600 }}>
                  {selectedIdx === idx && '\u23CE'}
                </div>
              </div>
            ))
          )}
        </div>
        
        {/* Footer Help */}
        <div style={{ padding: '8px 16px', background: 'rgba(0,122,255,0.05)', borderTop: `1px solid rgba(255,255,255,0.1)`, fontSize: 10, color: T.muted }}>
          <span style={{ marginRight: 16 }}>\u2191\u2193 Navigate</span>
          <span style={{ marginRight: 16 }}>\u23CE Select</span>
          <span>ESC Close</span>
        </div>
      </div>
    </div>
  );
};

// Reusable form field component with label + input/select
export function Field({ label, type = "text", value, onChange, placeholder, options, highlight, disabled, mono }) { 
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={lbl}>{label}</label>
      {options ? (
        <select value={value} onChange={e => onChange(e.target.value)} disabled={disabled} style={{ ...inp, borderColor: highlight ? T.green : "rgba(255,255,255,0.12)", opacity: disabled ? 0.5 : 1, fontFamily: T.font }} className="input-glass">
          {options.map(o => <option key={o.v ?? o} value={o.v ?? o}>{o.l ?? o}</option>)}
        </select>
      ) : (
        <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} disabled={disabled} style={{ ...inp, borderColor: highlight ? T.green : "rgba(255,255,255,0.12)", opacity: disabled ? 0.5 : 1, fontFamily: mono ? T.mono : T.font }} className="input-glass" />
      )}
    </div>
  ); 
}

// Table skeleton loading placeholder (5 pulsing rows)
export function TableSkeletonLoader() {
  const skeletonRows = Array.from({ length: 5 }, (_, i) => (
    <div
      key={i}
      style={{
        padding: "14px 20px",
        borderBottom: `1px solid rgba(255,255,255,0.1)`,
        display: "grid",
        gridTemplateColumns: "2fr 2fr 1.5fr 1.2fr 1fr",
        gap: 16,
        alignItems: "center",
      }}
    >
      {/* Name skeleton */}
      <div>
        <div style={{
          height: 12,
          background: "rgba(255,255,255,0.06)",
          borderRadius: 4,
          marginBottom: 6,
          animation: "pulse 1.5s ease-in-out infinite",
          width: "70%"
        }} />
        <div style={{
          height: 10,
          background: "rgba(255,255,255,0.04)",
          borderRadius: 4,
          width: "50%",
          animation: "pulse 1.5s ease-in-out infinite",
          animationDelay: "0.1s"
        }} />
      </div>
      {/* Email skeleton */}
      <div style={{
        height: 11,
        background: "rgba(255,255,255,0.06)",
        borderRadius: 4,
        animation: "pulse 1.5s ease-in-out infinite",
        animationDelay: "0.2s",
        width: "80%"
      }} />
      {/* Date skeleton */}
      <div style={{
        height: 11,
        background: "rgba(255,255,255,0.06)",
        borderRadius: 4,
        animation: "pulse 1.5s ease-in-out infinite",
        animationDelay: "0.3s",
        width: "60%"
      }} />
      {/* Status pill skeleton */}
      <div style={{
        height: 24,
        background: "rgba(255,255,255,0.06)",
        borderRadius: 20,
        animation: "pulse 1.5s ease-in-out infinite",
        animationDelay: "0.4s",
        width: "80px"
      }} />
      {/* Actions skeleton */}
      <div style={{
        display: "flex",
        gap: 8,
        justifyContent: "flex-end"
      }}>
        <div style={{
          height: 24,
          width: 70,
          background: "rgba(255,255,255,0.06)",
          borderRadius: 4,
          animation: "pulse 1.5s ease-in-out infinite",
          animationDelay: "0.5s"
        }} />
      </div>
    </div>
  ));

  return (
    <div>
      {skeletonRows}
    </div>
  );
}

// Suspense fallback component for lazy-loaded dashboards (RULE #157, #161)
export function LoadingFallback() {
  const [dots, setDots] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(d => (d + 1) % 4);
    }, 500);
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div style={{
      minHeight: "100vh",
      background: "#F9FAFB",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: '"Inter", "Helvetica", sans-serif',
      flexDirection: "column",
      gap: 24
    }}>
      {/* Premium Video Loading Indicator */}
      <div style={{
        width: 120,
        height: 120,
        borderRadius: "50%",
        overflow: "hidden",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.15)",
        background: "#FFFFFF",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}>
        <video
          src="/logo.mp4"
          autoPlay
          loop
          muted
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover"
          }}
          onError={(e) => {
            // Fallback spinner
            e.target.parentElement.innerHTML = '\u27F3';
            e.target.parentElement.style.fontSize = '48px';
            e.target.parentElement.style.display = 'flex';
            e.target.parentElement.style.alignItems = 'center';
            e.target.parentElement.style.justifyContent = 'center';
            e.target.parentElement.style.animation = 'spin 1s linear infinite';
          }}
        />
      </div>
      
      <div style={{ textAlign: "center" }}>
        <div style={{
          color: "#111827",
          fontSize: 14,
          fontWeight: 600,
          letterSpacing: 2,
          marginBottom: 8
        }}>
          {"LOADING".split("").map((char, i) => (
            <span key={i} style={{
              display: "inline-block",
              animation: `wave 0.6s ease-in-out ${i * 0.1}s infinite`,
              transformOrigin: "center bottom"
            }}>
              {char}
            </span>
          ))}
          {"...".padStart(1 + (dots || 0), ".")}
        </div>
        <div style={{
          color: "#6B7280",
          fontSize: 12,
          letterSpacing: 1,
          marginTop: 12
        }}>
          Initializing dashboard {"\u00B7"} Compiling modules
        </div>
      </div>
      
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes wave {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
      `}</style>
    </div>
  );
}