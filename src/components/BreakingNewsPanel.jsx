/**
 * BreakingNewsPanel — Real-time breaking news bar for MNQ/ES/SPY trading.
 *
 * Features:
 * - Polls GET /news/breaking every 30 seconds
 * - Shows HIGH impact news prominently
 * - Sentiment coloring (bullish=green, bearish=red, neutral=gray)
 * - Auto-expand HIGH impact items
 * - ML self-training: logs market reaction at 5/15/30/60 min after headline
 * - Triggers ML retrain on HIGH impact news
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Radio, TrendingUp, TrendingDown, Minus, AlertTriangle, ChevronDown, ChevronUp, ExternalLink, Zap } from 'lucide-react';
<<<<<<< HEAD
import { hasBff } from '../services/gateways/base.js';
import { resolveBffBaseUrl } from '../services/runtimeConfig.js';

const BFF_BASE = resolveBffBaseUrl();
=======

const BFF_BASE = import.meta.env.VITE_BFF_URL || '';
>>>>>>> 65489ec280873cad2e5e4f17df1eb44c4a4a2a37

const IMPACT_COLORS = {
  HIGH: { bg: 'rgba(255,69,58,0.08)', border: 'rgba(255,69,58,0.3)', text: '#FF453A', badge: '#FF453A' },
  MEDIUM: { bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.25)', text: '#F59E0B', badge: '#F59E0B' },
  LOW: { bg: 'rgba(48,209,88,0.04)', border: 'rgba(48,209,88,0.15)', text: '#8E8E93', badge: '#636366' },
};

const SENTIMENT_COLORS = {
  bullish: { color: '#30D158', Icon: TrendingUp },
  bearish: { color: '#FF453A', Icon: TrendingDown },
  neutral: { color: '#8E8E93', Icon: Minus },
};

<<<<<<< HEAD
function formatRelativeTime(isoString) {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const future = diffMs < 0;
  const mins = Math.floor(Math.abs(diffMs) / 60000);

  if (mins < 1) return future ? 'in <1m' : 'just now';
  if (mins < 60) return future ? `in ${mins}m` : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return future ? `in ${hrs}h` : `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return future ? `in ${days}d` : `${days}d ago`;
=======
function formatTimeAgo(isoString) {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
>>>>>>> 65489ec280873cad2e5e4f17df1eb44c4a4a2a37
}

function NewsItem({ item, isNew, onReactionLogged }) {
  const [expanded, setExpanded] = useState(item.impact === 'HIGH');
  const [reactions, setReactions] = useState(null);
  const [loggingReaction, setLoggingReaction] = useState(false);
  const sent = SENTIMENT_COLORS[item.sentiment] || SENTIMENT_COLORS.neutral;
  const SentIcon = sent.Icon;
  const impact = IMPACT_COLORS[item.impact] || IMPACT_COLORS.LOW;

  const logReaction = useCallback(async (interval) => {
    if (loggingReaction) return;
<<<<<<< HEAD
    if (!hasBff()) return;
=======
>>>>>>> 65489ec280873cad2e5e4f17df1eb44c4a4a2a37
    setLoggingReaction(true);
    try {
      const res = await fetch(`${BFF_BASE}/news/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newsId: item.id, interval }),
      });
      const data = await res.json();
      setReactions(data.reaction);
      if (onReactionLogged) onReactionLogged(item.id, data.reaction);
    } catch (e) {
      console.error('Failed to log reaction:', e);
    } finally {
      setLoggingReaction(false);
    }
  }, [item.id, loggingReaction, onReactionLogged]);

  return (
    <div style={{
      borderRadius: 8,
      border: `1px solid ${impact.border}`,
      background: impact.bg,
      overflow: 'hidden',
      transition: 'all 0.2s',
      ...(isNew ? { boxShadow: `0 0 0 1px ${impact.badge}40, 0 0 12px ${impact.badge}20` } : {}),
    }}>
      {/* Header row */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 8,
        padding: '8px 10px 6px',
      }}>
        {/* Sentiment indicator */}
        <SentIcon size={12} color={sent.color} style={{ marginTop: 2, flexShrink: 0 }} />

        {/* Title + meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 11.5, lineHeight: 1.4, color: impact.text,
            fontWeight: item.impact === 'HIGH' ? 600 : 400,
            display: '-webkit-box',
            WebkitLineClamp: expanded ? undefined : 2,
            WebkitBoxOrient: 'vertical',
            overflow: expanded ? undefined : 'hidden',
            cursor: 'pointer',
          }}
          onClick={() => setExpanded(e => !e)}
          >
            {item.title}
          </div>

          {/* Meta row */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            marginTop: 3, flexWrap: 'wrap',
          }}>
            <span style={{
              fontSize: 9.5, fontWeight: 700, color: impact.badge,
              letterSpacing: 0.5,
              background: `${impact.badge}20`,
              padding: '1px 5px', borderRadius: 4,
              textTransform: 'uppercase',
            }}>
              {item.impact}
            </span>
            <span style={{ fontSize: 9.5, color: 'var(--text-tertiary)' }}>
              {item.sourceName}
            </span>
            <span style={{ fontSize: 9.5, color: 'var(--text-tertiary)' }}>
<<<<<<< HEAD
              {formatRelativeTime(item.publishedAt)}
=======
              {formatTimeAgo(item.publishedAt)}
>>>>>>> 65489ec280873cad2e5e4f17df1eb44c4a4a2a37
            </span>
            {item.keywords?.slice(0, 2).map(kw => (
              <span key={kw} style={{
                fontSize: 9, color: 'var(--text-tertiary)',
                background: 'rgba(255,255,255,0.05)',
                padding: '1px 4px', borderRadius: 3,
              }}>
                {kw}
              </span>
            ))}
            {item.url && (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                style={{
                  display: 'flex', alignItems: 'center', gap: 2,
                  fontSize: 9.5, color: 'var(--text-secondary)',
                  textDecoration: 'none', marginLeft: 'auto',
                }}
              >
                <ExternalLink size={9} /> Source
              </a>
            )}
          </div>
        </div>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(e => !e)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: 2, color: 'var(--text-tertiary)',
            display: 'flex', alignItems: 'center',
            flexShrink: 0,
          }}
        >
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      </div>

      {/* Expanded: description */}
      {expanded && item.description && (
        <div style={{
          padding: '0 10px 8px 30px',
          fontSize: 10.5, color: 'var(--text-secondary)',
          lineHeight: 1.5,
          borderTop: `1px solid ${impact.border}`,
          marginTop: 4, paddingTop: 6,
        }}>
          {item.description}
        </div>
      )}

      {/* Expanded: ML reaction logging */}
      {expanded && item.impact === 'HIGH' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '4px 10px 8px 30px',
          borderTop: `1px solid ${impact.border}`,
          marginTop: 4, paddingTop: 6,
        }}>
          <Zap size={10} color="#30D158" />
          <span style={{ fontSize: 9.5, color: '#30D158' }}>ML Self-Training:</span>
          {[5, 15, 30, 60].map(min => (
            <button
              key={min}
              onClick={() => logReaction(min)}
              disabled={loggingReaction}
              style={{
                fontSize: 9.5,
                padding: '2px 6px', borderRadius: 4,
                background: 'rgba(48,209,88,0.1)',
                border: '1px solid rgba(48,209,88,0.3)',
                color: '#30D158', cursor: 'pointer',
                opacity: loggingReaction ? 0.5 : 1,
              }}
            >
              {min}m
            </button>
          ))}
          {reactions && (
            <span style={{ fontSize: 9.5, color: 'var(--text-secondary)' }}>
              Logged: {reactions.direction} {reactions.magnitude ? `(${reactions.magnitude})` : ''}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

<<<<<<< HEAD
export default function BreakingNewsPanel({ mathEngine: _mathEngine, recentCandles: _recentCandles }) {
=======
export default function BreakingNewsPanel({ mathEngine, recentCandles }) {
>>>>>>> 65489ec280873cad2e5e4f17df1eb44c4a4a2a37
  const [news, setNews] = useState([]);
  const [breakingCount, setBreakingCount] = useState(0);
  const [highImpactCount, setHighImpactCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [lastFetch, setLastFetch] = useState(null);
  const [newsSentiment, setNewsSentiment] = useState(null);
<<<<<<< HEAD
  const [failureDetail, setFailureDetail] = useState(null);
=======
>>>>>>> 65489ec280873cad2e5e4f17df1eb44c4a4a2a37
  const [panelOpen, setPanelOpen] = useState(true);
  const [newItems, setNewItems] = useState(new Set());
  const intervalRef = useRef(null);
  const prevIdsRef = useRef(new Set());

  const fetchNews = useCallback(async () => {
    setLoading(true);
    try {
<<<<<<< HEAD
      if (!hasBff()) {
        setNews([]);
        setBreakingCount(0);
        setHighImpactCount(0);
        setNewsSentiment(null);
        setFailureDetail('BFF proxy is not reachable yet.');
        return;
      }

=======
>>>>>>> 65489ec280873cad2e5e4f17df1eb44c4a4a2a37
      // Try /ml/consensus first (has breaking news embedded)
      let res = await fetch(`${BFF_BASE}/ml/consensus?session=1`, {
        signal: AbortSignal.timeout(8000),
      });

      let data;
      if (res.ok) {
        data = await res.json();
        const breakingItems = data.breaking_news?.items || [];
        const sentiment = data.news_sentiment || null;

        // Detect new items
        const currentIds = new Set(breakingItems.map(i => i.id));
        const freshIds = new Set(
          [...currentIds].filter(id => !prevIdsRef.current.has(id))
        );
        if (freshIds.size > 0) {
          setNewItems(freshIds);
          setTimeout(() => setNewItems(new Set()), 3000); // clear "new" state after 3s
        }
        prevIdsRef.current = currentIds;

        setNews(breakingItems);
        setBreakingCount(breakingItems.length);
        setHighImpactCount(data.breaking_news?.highImpactCount || 0);
        setNewsSentiment(sentiment);
        setLastFetch(new Date());
<<<<<<< HEAD
        setFailureDetail(null);
      } else {
        // Fallback to direct /news/breaking
        res = await fetch(`${BFF_BASE}/news/breaking?max=15`, {
=======
      } else {
        // Fallback to direct /news/breaking
        res = await fetch(`${BFF_BASE}/news/breaking?fresh=true`, {
>>>>>>> 65489ec280873cad2e5e4f17df1eb44c4a4a2a37
          signal: AbortSignal.timeout(8000),
        });
        if (res.ok) {
          data = await res.json();
          const breakingItems = data.items || [];

          const currentIds = new Set(breakingItems.map(i => i.id));
          const freshIds = new Set(
            [...currentIds].filter(id => !prevIdsRef.current.has(id))
          );
          if (freshIds.size > 0) {
            setNewItems(freshIds);
            setTimeout(() => setNewItems(new Set()), 3000);
          }
          prevIdsRef.current = currentIds;

          setNews(breakingItems);
          setBreakingCount(breakingItems.length);
          setHighImpactCount(data.highImpactCount || 0);
          setLastFetch(new Date());

          const bullish = breakingItems.filter(i => i.sentiment === 'bullish').length;
          const bearish = breakingItems.filter(i => i.sentiment === 'bearish').length;
          setNewsSentiment({
            bullish,
            bearish,
            neutral: breakingItems.length - bullish - bearish,
            bias: bullish > bearish ? 'bullish' : bearish > bullish ? 'bearish' : 'neutral',
            highImpactCount: data.highImpactCount || 0,
          });
<<<<<<< HEAD
          setFailureDetail(null);
        } else {
          setFailureDetail(`News endpoint failed: ${res.status}`);
=======
>>>>>>> 65489ec280873cad2e5e4f17df1eb44c4a4a2a37
        }
      }
    } catch (err) {
      console.error('[BreakingNewsPanel] fetch error:', err);
<<<<<<< HEAD
      setFailureDetail(err?.message || 'News fetch failed.');
=======
>>>>>>> 65489ec280873cad2e5e4f17df1eb44c4a4a2a37
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll every 30 seconds
  useEffect(() => {
    fetchNews();
<<<<<<< HEAD
    intervalRef.current = setInterval(fetchNews, 30_000);
=======
    intervalRef.current = setInterval(fetchNews, 10 * 60_000);
>>>>>>> 65489ec280873cad2e5e4f17df1eb44c4a4a2a37
    return () => clearInterval(intervalRef.current);
  }, [fetchNews]);

  const highImpactNews = news.filter(i => i.impact === 'HIGH');
  const otherNews = news.filter(i => i.impact !== 'HIGH');

  // Sentiment bar color
  const sentimentColor = newsSentiment?.bias === 'bullish' ? '#30D158'
    : newsSentiment?.bias === 'bearish' ? '#FF453A'
    : '#8E8E93';

  const sinceFetch = lastFetch
    ? `${Math.round((Date.now() - lastFetch.getTime()) / 1000)}s ago`
    : '—';

  return (
    <div style={{
      borderRadius: 12,
      border: '1px solid rgba(255,255,255,0.06)',
      background: 'var(--card-bg, #0D0D12)',
      overflow: 'hidden',
      marginBottom: 12,
    }}>
      {/* Panel header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 14px',
        borderBottom: panelOpen ? '1px solid rgba(255,255,255,0.05)' : 'none',
        cursor: 'pointer',
        background: highImpactCount > 0
          ? 'rgba(255,69,58,0.05)'
          : 'rgba(255,255,255,0.02)',
      }}
      onClick={() => setPanelOpen(o => !o)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
          <Radio
            size={13}
            color={highImpactCount > 0 ? '#FF453A' : '#30D158'}
            style={{ animation: highImpactCount > 0 ? 'cc-pulse 1.5s ease-in-out infinite' : 'none' }}
          />
          <span style={{
            fontSize: 10.5, fontWeight: 700, letterSpacing: 1.5,
            color: highImpactCount > 0 ? '#FF453A' : 'var(--text-secondary)',
            textTransform: 'uppercase',
          }}>
            Breaking News
          </span>

          {highImpactCount > 0 && (
            <span style={{
              display: 'flex', alignItems: 'center', gap: 3,
              background: 'rgba(255,69,58,0.15)',
              border: '1px solid rgba(255,69,58,0.3)',
              borderRadius: 6, padding: '1px 6px',
              fontSize: 9.5, color: '#FF453A', fontWeight: 700,
            }}>
              <AlertTriangle size={9} />
              {highImpactCount} HIGH
            </span>
          )}

          {newsSentiment && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 9.5, color: sentimentColor,
            }}>
              <TrendingUp size={9} />
              <span style={{ fontWeight: 600 }}>{newsSentiment.bullish}</span>
              <span style={{ color: 'var(--text-tertiary)' }}>/</span>
              <TrendingDown size={9} />
              <span style={{ fontWeight: 600 }}>{newsSentiment.bearish}</span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 9.5, color: 'var(--text-tertiary)' }}>
            {breakingCount} items · {sinceFetch}
          </span>
          {loading && (
            <div style={{
              width: 10, height: 10, border: '1.5px solid rgba(255,255,255,0.2)',
              borderTopColor: '#30D158', borderRadius: '50%',
              animation: 'cc-spin 0.8s linear infinite',
            }} />
          )}
          {panelOpen ? <ChevronUp size={13} color="var(--text-tertiary)" /> : <ChevronDown size={13} color="var(--text-tertiary)" />}
        </div>
      </div>

      {/* News content */}
      {panelOpen && (
        <div style={{ maxHeight: 480, overflowY: 'auto', padding: 8 }}>
          {news.length === 0 && !loading && (
            <div style={{
              textAlign: 'center', padding: '24px 0',
              fontSize: 11, color: 'var(--text-tertiary)',
            }}>
<<<<<<< HEAD
              {failureDetail || 'No breaking news - markets may be closed or sources unavailable.'}
=======
              No breaking news — markets may be closed or sources unavailable.
>>>>>>> 65489ec280873cad2e5e4f17df1eb44c4a4a2a37
              <div style={{ marginTop: 4, fontSize: 10 }}>
                Sources: Finnhub · NewsData.io · Yahoo Finance · GDELT
              </div>
            </div>
          )}

          {/* HIGH impact first */}
          {highImpactNews.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{
                fontSize: 9, fontWeight: 700, color: '#FF453A',
                letterSpacing: 1, textTransform: 'uppercase',
                marginBottom: 5, paddingLeft: 2,
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <AlertTriangle size={9} /> High Impact
              </div>
              {highImpactNews.map(item => (
                <div key={item.id} style={{ marginBottom: 5 }}>
                  <NewsItem item={item} isNew={newItems.has(item.id)} />
                </div>
              ))}
            </div>
          )}

          {/* Other news */}
          {otherNews.length > 0 && (
            <div>
              {highImpactNews.length > 0 && (
                <div style={{
                  fontSize: 9, fontWeight: 600, color: 'var(--text-tertiary)',
                  letterSpacing: 1, textTransform: 'uppercase',
                  marginBottom: 5, paddingLeft: 2,
                }}>
                  Recent Headlines
                </div>
              )}
              {otherNews.slice(0, 10).map(item => (
                <div key={item.id} style={{ marginBottom: 5 }}>
                  <NewsItem item={item} isNew={newItems.has(item.id)} />
                </div>
              ))}
            </div>
          )}

          {/* ML Self-Training info */}
          {highImpactCount > 0 && (
            <div style={{
              marginTop: 10, padding: '8px 10px', borderRadius: 8,
              background: 'rgba(48,209,88,0.04)',
              border: '1px solid rgba(48,209,88,0.1)',
              fontSize: 9.5, color: 'var(--text-tertiary)',
              lineHeight: 1.5,
            }}>
              <Zap size={10} color="#30D158" style={{ display: 'inline', verticalAlign: 'middle' }} />
              {' '}ML Self-Training: Each HIGH impact headline logs market reaction at 5/15/30/60 min.
              These reactions feed into the Alpha Engine and news-impact model.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
