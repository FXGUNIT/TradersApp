export const fuzzySearchScore = (query, text) => {
  if (!query || !text) return -1;
  
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  
  if (t === q) return 1000;
  if (t.startsWith(q)) return 900;
  if (t.includes(q)) return 800;
  
  let qIdx = 0;
  let score = 0;
  let lastIdx = -1;
  
  for (let i = 0; i < t.length && qIdx < q.length; i++) {
    if (t[i] === q[qIdx]) {
      const distance = i - lastIdx;
      const proximity = distance === 1 ? 10 : Math.max(0, 10 - (distance / 10));
      score += 50 + proximity;
      lastIdx = i;
      qIdx++;
    }
  }
  
  return qIdx === q.length ? score : -1;
};

export const highlightMatches = (text, query) => {
  if (!query || !text) return text;
  
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedQuery})`, 'gi');
  
  const parts = text.split(regex);
  return parts.map((part) => {
    if (regex.test(part)) {
      return { highlighted: true, text: part };
    }
    return { highlighted: false, text: part };
  });
};

export const renderHighlightedText = (text, query) => {
  if (!query || !text) return text;
  
  const parts = highlightMatches(text, query);
  const jsxParts = [];
  let markIdx = 0;
  
  parts.forEach((part) => {
    if (part.highlighted) {
      jsxParts.push(
        <mark key={`mark-${markIdx++}`} style={{
          background: "linear-gradient(135deg, rgba(255,214,10,0.4), rgba(255,214,10,0.2))",
          boxShadow: "0 0 8px rgba(255,214,10,0.5)",
          padding: "2px 4px",
          borderRadius: 3,
          color: "inherit",
          fontWeight: 600
        }}>
          {part.text}
        </mark>
      );
    } else {
      jsxParts.push(part.text);
    }
  });
  
  return jsxParts;
};

export const copyToClipboard = async (text, label, showToast) => {
  try {
    await navigator.clipboard.writeText(text);
    showToast(`${label} transmitted to system memory. Standing by.`, 'success');
  } catch (error) {
    console.error('Failed to copy:', error);
    showToast('Clipboard connection unstable. Retrying..', 'error');
  }
};
