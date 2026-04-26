import React, { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Maximize2, Print, Download } from "lucide-react";
import { PITCH_SLIDES, PITCH_THEME } from "../../data/pitchDeckSlides.js";

export default function AdminPitchDeck({ onClose }) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const total = PITCH_SLIDES.length;
  const slide = PITCH_SLIDES[currentSlide];

  const prev = useCallback(() => {
    setCurrentSlide((s) => (s > 0 ? s - 1 : s));
  }, []);

  const next = useCallback(() => {
    setCurrentSlide((s) => (s < total - 1 ? s + 1 : s));
  }, [total]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prev();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [next, prev]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  const printDeck = () => window.print();

  const T = PITCH_THEME;

  const pageStyle = {
    minHeight: "100vh",
    background: T.bg,
    color: T.text,
    fontFamily: "'Cormorant Garamond', 'Spectral', Georgia, serif",
    display: "flex",
    flexDirection: "column",
  };

  const headerStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 24px",
    borderBottom: `1px solid ${T.border}`,
    background: T.surface,
  };

  const slideStyle = {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "48px 64px",
    maxWidth: 900,
    margin: "0 auto",
    width: "100%",
  };

  const labelStyle = {
    fontSize: 10,
    letterSpacing: 3,
    color: T.muted,
    textTransform: "uppercase",
    fontFamily: "sans-serif",
    fontWeight: 700,
    marginBottom: 16,
  };

  const headlineStyle = {
    fontSize: "clamp(28px, 5vw, 48px)",
    fontWeight: 700,
    letterSpacing: "-1px",
    color: T.text,
    marginBottom: 24,
    lineHeight: 1.1,
  };

  const bodyStyle = {
    fontSize: 16,
    lineHeight: 1.8,
    color: T.muted,
    maxWidth: 700,
  };

  const navStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    padding: "16px 24px",
    borderTop: `1px solid ${T.border}`,
    background: T.surface,
  };

  const renderSlide = () => {
    switch (slide.type) {
      case "cover":
        return (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, letterSpacing: 5, color: T.muted, textTransform: "uppercase", fontFamily: "sans-serif", marginBottom: 24 }}>
              Confidential — For Investor Use Only
            </div>
            <div style={{ fontSize: "clamp(40px, 8vw, 80px)", fontWeight: 900, letterSpacing: "-3px", lineHeight: 0.9, color: T.text, marginBottom: 8 }}>
              {slide.content.title}
            </div>
            <div style={{ fontSize: "clamp(14px, 2vw, 18px)", color: T.accent, fontFamily: "sans-serif", letterSpacing: 2, textTransform: "uppercase", fontWeight: 700, marginBottom: 32 }}>
              {slide.content.tagline}
            </div>
            <div style={{ width: 60, height: 1, background: T.border, margin: "0 auto 32px" }} />
            <div style={{ fontSize: 14, color: T.muted, fontFamily: "sans-serif", letterSpacing: 1 }}>
              Founded by {slide.content.founder} · {slide.content.founded}
            </div>
          </div>
        );

      case "content":
        return (
          <div style={{ ...slideStyle, alignItems: "flex-start" }}>
            <div style={labelStyle}>{slide.content.label}</div>
            <div style={headlineStyle}>{slide.content.headline}</div>
            <div style={bodyStyle}>
              {slide.content.body.map((para, i) => (
                <p key={i} style={{ marginBottom: 16 }}>{para}</p>
              ))}
            </div>
            {slide.content.stat && (
              <div style={{ marginTop: 24, padding: "16px 20px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 14, color: T.muted }}>
                {slide.content.stat}
              </div>
            )}
          </div>
        );

      case "demo":
        return (
          <div style={{ textAlign: "center" }}>
            <div style={labelStyle}>Product Demo</div>
            <div style={headlineStyle}>{slide.content.headline}</div>
            <div style={{ marginTop: 32, padding: "48px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, color: T.muted, fontSize: 14 }}>
              {slide.content.description}
            </div>
          </div>
        );

      case "private":
        return (
          <div style={{ ...slideStyle, alignItems: "flex-start" }}>
            <div style={{ ...labelStyle, color: T.accent }}>
              [CONFIDENTIAL — PRIVATE — FOR INVESTORS ONLY]
            </div>
            <div style={headlineStyle}>{slide.content.headline}</div>
            <div style={bodyStyle}>
              {slide.content.body.map((para, i) => (
                <p key={i} style={{ marginBottom: 16 }}>{para}</p>
              ))}
            </div>
          </div>
        );

      case "ask":
        return (
          <div style={{ textAlign: "center" }}>
            <div style={labelStyle}>The Ask</div>
            <div style={headlineStyle}>{slide.content.headline}</div>
            <div style={{ ...bodyStyle, textAlign: "left" }}>
              {slide.content.body.map((para, i) => (
                <p key={i} style={{ marginBottom: 16 }}>{para}</p>
              ))}
            </div>
            <div style={{ marginTop: 40, fontSize: 24, fontWeight: 700, color: T.accent }}>
              {slide.content.cta}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div style={pageStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ color: T.accent, fontSize: 12, fontWeight: 800, letterSpacing: 2, fontFamily: "sans-serif" }}>
            TRADERS REGIMENT
          </span>
          <span style={{ color: T.muted, fontSize: 11, fontFamily: "sans-serif" }}>
            Pitch Deck
          </span>
          <span style={{ color: T.muted, fontSize: 11, fontFamily: "sans-serif" }}>
            · {currentSlide + 1} / {total}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={printDeck}
            title="Print / Save as PDF"
            style={{
              background: "transparent",
              border: `1px solid ${T.border}`,
              color: T.muted,
              borderRadius: 6,
              padding: "6px 10px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
            }}
          >
            <Print size={14} />
          </button>
          <button
            onClick={toggleFullscreen}
            title="Fullscreen"
            style={{
              background: "transparent",
              border: `1px solid ${T.border}`,
              color: T.muted,
              borderRadius: 6,
              padding: "6px 10px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
            }}
          >
            <Maximize2 size={14} />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                background: "transparent",
                border: `1px solid ${T.border}`,
                color: T.muted,
                borderRadius: 6,
                padding: "6px 12px",
                cursor: "pointer",
                fontFamily: "sans-serif",
                fontSize: 12,
              }}
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* Slide content */}
      <div style={slideStyle}>
        {renderSlide()}
      </div>

      {/* Navigation */}
      <div style={navStyle}>
        <button
          onClick={prev}
          disabled={currentSlide === 0}
          style={{
            background: "transparent",
            border: `1px solid ${T.border}`,
            color: currentSlide === 0 ? T.muted : T.text,
            borderRadius: 6,
            padding: "8px 16px",
            cursor: currentSlide === 0 ? "default" : "pointer",
            opacity: currentSlide === 0 ? 0.4 : 1,
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontFamily: "sans-serif",
            fontSize: 12,
          }}
        >
          <ChevronLeft size={14} /> Prev
        </button>

        {/* Dot indicators */}
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {PITCH_SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentSlide(i)}
              style={{
                width: i === currentSlide ? 20 : 6,
                height: 6,
                borderRadius: 3,
                background: i === currentSlide ? T.accent : T.border,
                border: "none",
                cursor: "pointer",
                padding: 0,
                transition: "all 0.3s ease",
              }}
            />
          ))}
        </div>

        <button
          onClick={next}
          disabled={currentSlide === total - 1}
          style={{
            background: "transparent",
            border: `1px solid ${T.border}`,
            color: currentSlide === total - 1 ? T.muted : T.text,
            borderRadius: 6,
            padding: "8px 16px",
            cursor: currentSlide === total - 1 ? "default" : "pointer",
            opacity: currentSlide === total - 1 ? 0.4 : 1,
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontFamily: "sans-serif",
            fontSize: 12,
          }}
        >
          Next <ChevronRight size={14} />
        </button>
      </div>

      <style>{`
        @media print {
          div { display: none !important; }
          div[style*="slideStyle"] { display: flex !important; }
          @page { margin: 0; size: landscape; }
        }
      `}</style>
    </div>
  );
}
