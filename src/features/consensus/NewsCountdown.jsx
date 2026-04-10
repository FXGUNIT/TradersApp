/**
 * NewsCountdown — News sentiment, next event, trading-allowed panel
 * Extracted from CollectiveConsciousness.jsx (I06)
 */
import React from 'react';
import { Activity, TrendingUp } from 'lucide-react';
import { SectionCard } from './SectionCard.jsx';
import { MetricRow } from './MetricRow.jsx';

export const NewsCountdown = React.memo(function NewsCountdown({ consensus }) {
  const { news, breaking_news, news_sentiment, confidenceNote } = consensus || {};
  if (!news && !breaking_news && !news_sentiment) return null;

  return (
    <SectionCard title="News & Events" icon={Activity} accent="rgba(255,69,58,0.8)">
      {news_sentiment && (
        <>
          <MetricRow
            icon={TrendingUp} label="News Sentiment"
            value={news_sentiment.bias?.toUpperCase()}
            sub={`${news_sentiment.bullish}↑ / ${news_sentiment.bearish}↓ · ${news_sentiment.highImpactCount} HIGH impact`}
            color={news_sentiment.bias === 'bullish' ? '#30D158' : news_sentiment.bias === 'bearish' ? '#FF453A' : '#8E8E93'}
          />
          {confidenceNote && (
            <div style={{
              marginTop: 4, padding: '4px 8px', borderRadius: 6,
              background: 'rgba(245,158,11,0.06)',
              border: '1px solid rgba(245,158,11,0.2)',
              fontSize: 9.5, color: '#F59E0B',
            }}>
              {confidenceNote}
            </div>
          )}
        </>
      )}
      {news?.next_event && (
        <MetricRow
          icon={Activity} label="Next Scheduled Event"
          value={news.next_event.title}
          sub={news.next_event ? `in ${news.next_event.timeUntil_min || 0} min` : ''}
          color={news.trade_allowed === false ? '#FF453A' : undefined}
        />
      )}
      <MetricRow
        icon={Activity} label="Trading Allowed"
        value={news?.trade_allowed !== false ? 'YES' : 'REDUCE SIZE'}
        color={news?.trade_allowed !== false ? '#30D158' : '#FF453A'}
      />
      {news?.warning && (
        <div style={{
          marginTop: 8, padding: '8px 10px', borderRadius: 8,
          background: 'rgba(255,69,58,0.06)',
          border: '1px solid rgba(255,69,58,0.2)',
          fontSize: 10.5, color: '#FF453A', lineHeight: 1.5,
        }}>
          {news.warning}
        </div>
      )}
    </SectionCard>
  );
});
