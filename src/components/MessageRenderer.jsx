import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

export default function MessageRenderer({ content, isDark = true }) {
  const textColor = isDark ? '#E2E8F0' : '#1E293B';
  const mutedColor = isDark ? '#94A3B8' : '#64748B';
  const borderColor = isDark ? '#334155' : '#CBD5E1';
  const headerBg = isDark ? '#0F172A' : '#F1F5F9';
  const codeBg = isDark ? '#0D1117' : '#F8FAFC';
  const inlineCodeBg = isDark ? 'rgba(148,163,184,0.12)' : 'rgba(15,23,42,0.06)';
  const blockquoteBorder = isDark ? '#7C3AED' : '#8B5CF6';

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{

        // ── Code Blocks ──────────────────────────────────────────
        code({ className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '');
          const codeString = String(children).replace(/\n$/, '');

          if (match) {
            return (
              <div style={{
                borderRadius: 10,
                overflow: 'hidden',
                margin: '14px 0',
                border: `1px solid ${borderColor}`,
                background: codeBg,
              }}>
                {/* IDE title bar */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 14px',
                  background: isDark ? '#161B22' : '#E2E8F0',
                  borderBottom: `1px solid ${borderColor}`,
                }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#FF5F57' }} />
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#FEBC2E' }} />
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#28C840' }} />
                  </div>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: 1.5,
                    textTransform: 'uppercase',
                    color: mutedColor,
                  }}>
                    {match[1]}
                  </span>
                </div>
                <SyntaxHighlighter
                  style={vscDarkPlus}
                  language={match[1]}
                  PreTag="div"
                  customStyle={{
                    margin: 0,
                    padding: '16px',
                    background: codeBg,
                    fontSize: 13,
                    lineHeight: 1.65,
                    borderRadius: 0,
                  }}
                >
                  {codeString}
                </SyntaxHighlighter>
              </div>
            );
          }

          // Inline code
          return (
            <code
              style={{
                background: inlineCodeBg,
                padding: '2px 7px',
                borderRadius: 5,
                fontSize: '0.88em',
                fontFamily: '"SF Mono", "Fira Code", "JetBrains Mono", ui-monospace, monospace',
                color: isDark ? '#E0B0FF' : '#7C3AED',
                border: `1px solid ${isDark ? 'rgba(148,163,184,0.1)' : 'rgba(0,0,0,0.06)'}`,
              }}
              {...props}
            >
              {children}
            </code>
          );
        },

        // ── Tables ───────────────────────────────────────────────
        table({ children }) {
          return (
            <div style={{ overflowX: 'auto', margin: '16px 0', borderRadius: 8, border: `1px solid ${borderColor}` }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 13,
                lineHeight: 1.5,
              }}>
                {children}
              </table>
            </div>
          );
        },
        thead({ children }) {
          return <thead style={{ background: headerBg }}>{children}</thead>;
        },
        th({ children }) {
          return (
            <th style={{
              padding: '10px 14px',
              textAlign: 'left',
              fontWeight: 700,
              fontSize: 10,
              letterSpacing: 1.2,
              textTransform: 'uppercase',
              color: mutedColor,
              borderBottom: `2px solid ${borderColor}`,
            }}>
              {children}
            </th>
          );
        },
        td({ children }) {
          return (
            <td style={{
              padding: '10px 14px',
              borderBottom: `1px solid ${isDark ? 'rgba(51,65,85,0.5)' : 'rgba(203,213,225,0.6)'}`,
              color: textColor,
            }}>
              {children}
            </td>
          );
        },

        // ── Lists ────────────────────────────────────────────────
        ul({ children }) {
          return (
            <ul style={{
              paddingLeft: 20,
              margin: '10px 0',
              listStyleType: 'none',
            }}>
              {children}
            </ul>
          );
        },
        ol({ children }) {
          return (
            <ol style={{
              paddingLeft: 20,
              margin: '10px 0',
              listStyleType: 'decimal',
              color: mutedColor,
            }}>
              {children}
            </ol>
          );
        },
        li({ children, ordered }) {
          return (
            <li style={{
              marginBottom: 6,
              lineHeight: 1.7,
              color: textColor,
              paddingLeft: ordered ? 4 : 14,
              position: 'relative',
            }}>
              {!ordered && (
                <span style={{
                  position: 'absolute',
                  left: 0,
                  top: '0.55em',
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  background: mutedColor,
                }} />
              )}
              {children}
            </li>
          );
        },

        // ── Headings ─────────────────────────────────────────────
        h1({ children }) {
          return (
            <h1 style={{
              fontSize: 20,
              fontWeight: 800,
              color: textColor,
              margin: '24px 0 10px',
              paddingBottom: 8,
              borderBottom: `2px solid ${isDark ? '#334155' : '#E2E8F0'}`,
              letterSpacing: 0.3,
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif',
            }}>
              {children}
            </h1>
          );
        },
        h2({ children }) {
          return (
            <h2 style={{
              fontSize: 17,
              fontWeight: 700,
              color: textColor,
              margin: '20px 0 8px',
              paddingBottom: 6,
              borderBottom: `1px solid ${isDark ? 'rgba(51,65,85,0.5)' : 'rgba(226,232,240,0.8)'}`,
              letterSpacing: 0.2,
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif',
            }}>
              {children}
            </h2>
          );
        },
        h3({ children }) {
          return (
            <h3 style={{
              fontSize: 15,
              fontWeight: 700,
              color: isDark ? '#CBD5E1' : '#334155',
              margin: '16px 0 6px',
              letterSpacing: 0.15,
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif',
            }}>
              {children}
            </h3>
          );
        },

        // ── Paragraphs ──────────────────────────────────────────
        p({ children }) {
          return (
            <p style={{
              margin: '0 0 14px',
              lineHeight: 1.8,
              color: textColor,
            }}>
              {children}
            </p>
          );
        },

        // ── Blockquotes ─────────────────────────────────────────
        blockquote({ children }) {
          return (
            <blockquote style={{
              borderLeft: `3px solid ${blockquoteBorder}`,
              padding: '6px 18px',
              margin: '14px 0',
              background: isDark ? 'rgba(124,58,237,0.06)' : 'rgba(139,92,246,0.04)',
              borderRadius: '0 8px 8px 0',
              color: isDark ? '#A1A1AA' : '#6B7280',
              fontStyle: 'italic',
            }}>
              {children}
            </blockquote>
          );
        },

        // ── Strong / Bold ───────────────────────────────────────
        strong({ children }) {
          return <strong style={{ fontWeight: 700, color: isDark ? '#F1F5F9' : '#0F172A' }}>{children}</strong>;
        },

        // ── Horizontal Rules ────────────────────────────────────
        hr() {
          return (
            <hr style={{
              border: 'none',
              borderTop: `1px solid ${borderColor}`,
              margin: '20px 0',
            }} />
          );
        },

        // ── Links ───────────────────────────────────────────────
        a({ href, children }) {
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: '#0A84FF',
                textDecoration: 'none',
                borderBottom: '1px solid rgba(10,132,255,0.3)',
                transition: 'border-color 0.2s',
              }}
            >
              {children}
            </a>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
