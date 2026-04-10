/**
 * ModelVotesPanel — Individual model votes list
 * Extracted from CollectiveConsciousness.jsx (I06)
 */
import React from 'react';
import { BarChart2 } from 'lucide-react';
import { SectionCard } from './SectionCard.jsx';
import { VoteItem } from './VoteItem.jsx';

export const ModelVotesPanel = React.memo(function ModelVotesPanel({ votes }) {
  if (!votes || Object.keys(votes).length === 0) return null;
  return (
    <SectionCard title={`Model Votes (${Object.keys(votes).length})`} icon={BarChart2} accent="rgba(255,255,255,0.4)">
      {Object.entries(votes).map(([name, vote]) => (
        <VoteItem
          key={name}
          name={name}
          signal={vote.signal}
          confidence={vote.confidence}
          reason={vote.reason}
        />
      ))}
    </SectionCard>
  );
});
