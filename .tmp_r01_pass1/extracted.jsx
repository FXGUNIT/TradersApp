function MainTerminal({ profile, onLogout, onSaveJournal, onSaveAccount, onSaveFirmRules, showToast }) {
  const [part, setPart] = useState('1'); 
  const [p2Out, setP2Out] = useState(''); 
  const [loading, setLoading] = useState(false); 
  const [err, setErr] = useState('');
  const [_dailyQuote, setDailyQuote] = useState(getRandomQuote());
  
  const [ist, setIst] = useState(getISTState()); 
  
  useEffect(() => { 
    const id = setInterval(() => setIst(getISTState()), 1000); 
    return () => clearInterval(id); 
  }, []);
  
  useEffect(() => {
    setDailyQuote(getRandomQuote());
  }, []);
  
  const [screenshots, setScreenshots] = useState([]); 
  const [extracting, setExtracting] = useState(false); 
  const [extractedVals, setExtractedVals] = useState({ 
    adx: null, ci: null, vwap: null, vwapSlope: null, atr: null, 
    currentPrice: null, fiveDayATR: null, twentyDayATR: null 
  }); 
  
  const [activeZone, setActiveZone] = useState(null); 
  const [mpChart, setMpChart] = useState(null); 
  const [vwapChart, setVwapChart] = useState(null);
  
  const [f, setF] = useState({ 
    timeIST: '', instrument: 'MNQ', direction: 'Long', tradeType: 'Trend', 
    accountBalance: '', riskPct: '0.3', entryPrice: '', currentPrice: '', 
    rrr: '1:2', lastTradeResult: '', notes: '' 
  }); 
  
  const sf = k => v => setF(p => ({ ...p, [k]: v })); 
  
  const maxRiskUSD = f.accountBalance && f.riskPct 
    ? Math.round(parseFloat(f.accountBalance) * parseFloat(f.riskPct) / 100 * 100) / 100 
    : null;

  const [journal, setJournal] = useState(profile?.journal ? Object.values(profile.journal) : []); 
  
  // State variables
  const [currentAMD, setCurrentAMD] = useState('UNCLEAR');
  const [parsed, setParsed] = useState(null);
  const [parseMsg, setParseMsg] = useState('');
  const [p1Out, setP1Out] = useState('');
  const [p1NewsChart, setP1NewsChart] = useState(null);
  const [p1PremarketChart, setP1PremarketChart] = useState(null);
  const [p1KeyLevelsChart, setP1KeyLevelsChart] = useState(null);
  const [extractStatus, setExtractStatus] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [jf, setJf] = useState({date:new Date().toISOString().slice(0,10),instrument:'MNQ',direction:'Long',tradeType:'Trend',amdPhase:'UNCLEAR',rrr:'1:2',result:'win',entry:'',exit:'',contracts:'1',pnl:'',session:'Trading Hours',balAfter:'',setup:'',lessons:''});
  const sjf = k => v => setJf(p=>({...p,[k]:v}));
  const p1Ref = useRef(null);
  
  const [showP2TradeForm, setShowP2TradeForm] = useState(false); 
  
  const [p2Jf, setP2Jf] = useState({ 
    exit: '', result: 'win', pnl: '', balAfter: '', lessons: '', amdPhase: 'UNCLEAR' 
  }); 
  const sp2 = k => v => setP2Jf(p => ({ ...p, [k]: v }));
  
  const [firmRules, setFirmRules] = useState(profile?.firmRules || { 
    parsed: false, firmName: '', maxDailyLoss: '', maxDailyLossType: 'dollar', 
    maxDrawdown: '', drawdownType: 'trailing', profitTarget: '', consistencyMaxDayPct: '', 
    restrictedNewsWindowMins: '15', newsTrading: true, scalpingAllowed: true, 
    overnightHoldingAllowed: true, weekendTrading: true, copyTradingAllowed: false, 
    maxContracts: '', minimumTradingDays: '', keyRules: [], notes: '', parseStatus: '' 
  }); 
  
  const [tcParsing, setTcParsing] = useState(false);
  
  const [accountState, setAccountState] = useState(profile?.accountState || { 
    startingBalance: '', currentBalance: '', highWaterMark: '', dailyStartBalance: '' 
  }); 
  const sacc = k => v => setAccountState(p => ({ ...p, [k]: v }));

  useEffect(() => { 
    const cur = parseFloat(accountState.currentBalance) || 0;
    const hwm = parseFloat(accountState.highWaterMark) || 0; 
    if (cur > hwm && cur > 0) { 
      const upd = { ...accountState, highWaterMark: String(cur) }; 
      setAccountState(upd); 
      if (onSaveAccount) onSaveAccount(upd); 
    } 
  }, [accountState, onSaveAccount]);
  
  useEffect(() => { 
    if (journal.length > 0 && onSaveJournal) onSaveJournal(journal); 
  }, [journal, onSaveJournal]);

  // ─── DYNAMIC VOLATILITY & RISK MATH ───
  const fiveDayATR = extractedVals.fiveDayATR || (parsed && parsed.days && parsed.days.length >= 5 ? parsed.days[4]?.atr14 : null) || 0;
  const twentyDayATR = extractedVals.twentyDayATR || (parsed && parsed.tradingHoursAtr14) || 0;
  
  const VR = calculateVolatilityRatio(fiveDayATR, twentyDayATR);
  const { vwapSD1, vwapSD2, trendSLMult, mrSLMult } = getDynamicParameters(VR);
  const { activeRiskPct, isThrottled } = calculateThrottledRisk(parseFloat(f.riskPct) || 0.3, VR, parseFloat(accountState.currentBalance) || 0, parseFloat(firmRules.maxDrawdown) || 0);

  let volatilityRegime = "Normal";
  if (VR < 0.85) volatilityRegime = "Compression"; 
  else if (VR > 1.15) volatilityRegime = "Expansion";

  const atrVal = parseFloat(extractedVals.atr) || parseFloat(parsed?.tradingHoursAtr14) || 0;
  const slMult = f.tradeType === 'Trend' ? trendSLMult : mrSLMult;
  const slPts = atrVal * slMult;
  const ptVal = f.instrument === 'MNQ' ? 2 : f.instrument === 'MES' ? 5 : f.instrument === 'US100' ? 1 : 10;
  
  const contracts = maxRiskUSD && slPts && ptVal 
    ? Math.max(1, Math.floor((maxRiskUSD * (isThrottled ? 0.5 : 1)) / (slPts * ptVal))) 
    : 1; 
    
  const proposedSLDollars = contracts * slPts * ptVal;
  const vwapPrice = extractedVals.vwap ? parseFloat(extractedVals.vwap) : null;
  
  const sd1Target = vwapPrice && vwapSD1 
    ? (f.direction === 'Long' ? vwapPrice + vwapSD1 : vwapPrice - vwapSD1) 
    : null;
    
  const sd2Target = vwapPrice && vwapSD2 
    ? (f.direction === 'Long' ? vwapPrice + vwapSD2 : vwapPrice - vwapSD2) 
    : null;
    // ─── FIRM COMPLIANCE & EXECUTION BLOCKS ───
  const fr = firmRules;
  const maxDL = parseFloat(fr.maxDailyLoss) || 0;
  const maxDD = parseFloat(fr.maxDrawdown) || 0;
  
  const curBal = parseFloat(accountState.currentBalance) || 0;
  const hwmVal = parseFloat(accountState.highWaterMark) || curBal;
  const startBal = parseFloat(accountState.startingBalance) || curBal;
  
  const liqLevel = fr.drawdownType === 'trailing' ? hwmVal - maxDD : startBal - maxDD;
  const distToLiq = curBal - liqLevel;
  const throttleActive = maxDD > 0 && distToLiq / maxDD < 0.25; 

  const today = new Date().toISOString().slice(0, 10);
  const todayPnl = journal.filter(t => t.date === today).reduce((s, t) => s + parseFloat(t.pnl || 0), 0);
  const dailyLossUsed = Math.abs(Math.min(0, todayPnl));
  const dailyRemaining = maxDL > 0 ? maxDL - dailyLossUsed : null;
  
  const slBreachesDailyLimit = maxDL > 0 && dailyRemaining !== null && proposedSLDollars > dailyRemaining;
  const slBreachesDrawdown = maxDD > 0 && curBal > 0 && (curBal - proposedSLDollars) < liqLevel;
  const isDailyBreached = maxDL > 0 && dailyLossUsed >= maxDL;
  const isDDBreached = maxDD > 0 && curBal > 0 && curBal <= liqLevel;
  
  const consPct = parseFloat(fr.consistencyMaxDayPct) || 0;
  const profT = parseFloat(fr.profitTarget) || 0;
  const totalPnlJ = journal.reduce((s, t) => s + parseFloat(t.pnl || 0), 0);
  const todayPct = profT > 0 && totalPnlJ > 0 ? (todayPnl / profT) * 100 : null;
  const isConsistencyBreached = consPct > 0 && todayPct !== null && todayPct >= consPct;
  
  const isDailyWarning = maxDL > 0 && dailyLossUsed / maxDL >= 0.8;
  const isDDWarning = maxDD > 0 && curBal > 0 && (curBal - liqLevel) / maxDD < 0.2;
  const complianceBlocked = isDailyBreached || isDDBreached || isConsistencyBreached;
  
  const isDeadZone = (extractedVals.adx !== null && extractedVals.adx < 20) || (extractedVals.ci !== null && extractedVals.ci > 61.8);
  const execBlocked = !ist.isOpen || isDeadZone || complianceBlocked || slBreachesDailyLimit || slBreachesDrawdown;
  
  let execBlockReason = '';
  if (!ist.isOpen) {
    execBlockReason = `Market closed — opens in ${ist.countdown}`;
  } else if (isDailyBreached) {
    execBlockReason = `Daily loss limit of $${maxDL} reached`;
  } else if (isDDBreached) {
    execBlockReason = `Account at liquidation level ($${liqLevel.toFixed(0)})`;
  } else if (isConsistencyBreached) {
    execBlockReason = `Consistency cap reached (${consPct}%)`;
  } else if (slBreachesDailyLimit) {
    execBlockReason = `SL ($${proposedSLDollars.toFixed(0)}) exceeds remaining limit ($${dailyRemaining?.toFixed(0)})`;
  } else if (slBreachesDrawdown) {
    execBlockReason = `SL would breach trailing drawdown`;
  } else if (isDeadZone) {
    execBlockReason = `Dead Zone — ADX < 20 or CI > 61.8`;
  }

  const complianceColor = complianceBlocked ? T.red : (isDailyWarning || isDDWarning) ? T.gold : T.green;
  const hasLevelWarning = p2Out && /SIGNAL:\s*(YELLOW|yellow)|wait.{0,40}level/i.test(p2Out);
  const isBlocked = p2Out && /🚫 TRADE BLOCKED/i.test(p2Out);
  const trafficState = (execBlocked || isBlocked) ? 'red' : (isDailyWarning || isDDWarning || hasLevelWarning || throttleActive) ? 'yellow' : p2Out ? 'green' : 'none';

  const p2Ref = useRef(null);
  // ─── EVENT HANDLERS (DRAG & DROP, PASTE) ───
  useEffect(() => {
    const handler = (e) => {
      if (!activeZone) return;
      
      const items = Array.from(e.clipboardData?.items || []);
      const img = items.find(i => i.type.startsWith('image/'));
      
      if (!img) return; 
      e.preventDefault();
      
      const file = img.getAsFile(); 
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = ev => {
        const b64 = ev.target.result.split(',')[1];
        const imgObj = { name: 'pasted.png', b64, type: 'image/png' };
        
        switch (activeZone) {
          case 'ss': 
            setScreenshots(prev => prev.length >= 4 ? prev : [...prev, imgObj]); 
            break;
          case 'vwap': 
            setVwapChart(imgObj); 
            break;
          case 'mp': 
            setMpChart(imgObj); 
            break;
          case 'p1news': 
            setP1NewsChart(imgObj); 
            break;
          case 'p1prem': 
            setP1PremarketChart(imgObj); 
            break;
          case 'p1lvl': 
            setP1KeyLevelsChart(imgObj); 
            break;
        }
      };
      reader.readAsDataURL(file);
    };
    
    document.addEventListener('paste', handler);
    return () => document.removeEventListener('paste', handler);
  }, [activeZone]);

  const onScreenshotDrop = useCallback(e => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer?.files || e.target.files || []);
    
    files.filter(f => f.type.startsWith('image/')).forEach(file => { 
      const r = new FileReader(); 
      r.onload = ev => {
        setScreenshots(prev => prev.length >= 4 ? prev : [
          ...prev, 
          { name: file.name, b64: ev.target.result.split(',')[1], type: file.type }
        ]);
      };
      r.readAsDataURL(file); 
    });
  }, []);

  const makeImgHandler = (setter) => (e) => {
    e.preventDefault();
    const file = (e.dataTransfer?.files || e.target.files)?.[0]; 
    if (!file || !file.type.startsWith('image/')) return;
    
    const r = new FileReader(); 
    r.onload = ev => {
      setter({ name: file.name, b64: ev.target.result.split(',')[1], type: file.type }); 
    };
    r.readAsDataURL(file);
  };

  // ─── CSV FILE DROP ───
  const onFileDrop = useCallback(e => {
    e.preventDefault();
    const file = e.dataTransfer?.files[0] || e.target.files?.[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = ev => {
      const result = parseAndAggregate(ev.target.result);
      if (result.error) { setParseMsg('✗ ' + result.error); setParsed(null); return; }
      setParsed(result);
      setParseMsg(result.totalDays >= 20 ? `✓ ${result.totalBars.toLocaleString()} bars → ${result.totalDays} days` : `⚠ ${result.totalDays} days — need 20+`);
    };
    r.readAsText(file);
  }, []);

  // ─── RUN PART 1 ───
  const runPart1 = async () => {
    if (!parsed || parsed.totalDays < 5) { setErr('Upload a valid NinjaTrader 1-min file.'); return; }
    setErr(''); setLoading(true); setP1Out('');
    try {
      const textMsg = `Run full Premarket Analysis. Today: ${parsed.days[0]?.date} | ${ist.istStr}\nTrading Hours ATR(14): ${parsed.tradingHoursAtr14} pts\n\n${buildDataSummary(parsed)}\n\nScreenshots: ${p1NewsChart ? '✓ Calendar' : '✗ No calendar'} | ${p1PremarketChart ? '✓ Premarket chart' : '✗ No chart'} | ${p1KeyLevelsChart ? '✓ Key levels' : '✗ No levels'}\nApply ALL sections including SECTION AMD.`;
      const content = [];
      if (p1NewsChart) content.push({ type: 'image', source: { type: 'base64', media_type: p1NewsChart.type, data: p1NewsChart.b64 } });
      if (p1PremarketChart) content.push({ type: 'image', source: { type: 'base64', media_type: p1PremarketChart.type, data: p1PremarketChart.b64 } });
      if (p1KeyLevelsChart) content.push({ type: 'image', source: { type: 'base64', media_type: p1KeyLevelsChart.type, data: p1KeyLevelsChart.b64 } });
      content.push({ type: 'text', text: textMsg });
      const response = await runDeliberation(PART1_PROMPT, JSON.stringify(content));
      const out = response || 'No response.';
      setP1Out(out);
      const amdMatch = out.match(/MICRO AMD PHASE:\s*([A-Z]+)/);
      if (amdMatch && AMD_PHASES[amdMatch[1]]) setCurrentAMD(amdMatch[1]);
      setTimeout(() => p1Ref.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch(e) { setErr('API error: ' + e.message); }
    finally { setLoading(false); }
  };

  // ─── ADD MANUAL JOURNAL ENTRY ───
  const addJournalEntry = () => {
    if (!jf.entry || !jf.exit) return;
    setJournal(prev => [...prev, { ...jf }]);
    setJf(p => ({ ...p, entry: '', exit: '', pnl: '', setup: '', lessons: '', balAfter: '' }));
  };

  // ─── AI INTEGRATION FUNCTIONS ───
  const parseTandC = useCallback(async (text) => {
    setTcParsing(true);
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          model: 'claude-sonnet-4-20250514', 
          max_tokens: 1200, 
          system: TNC_PARSE_PROMPT, 
          messages: [{ role: 'user', content: `Parse these T&C:\n\n${text.slice(0, 12000)}` }] 
        })
      });
      const data = await res.json();
      const raw = data.content?.map(b => b.text || '').join('') || '{}';
      const vals = JSON.parse(raw.replace(/```json|```/g, '').trim());
      const updated = { 
        ...firmRules, 
        ...vals, 
        parsed: true, 
        parseStatus: `✓ Parsed: ${vals.firmName || 'Unknown Firm'}` 
      };
      
      setFirmRules(updated);
      if (onSaveFirmRules) onSaveFirmRules(updated);
    } catch (e) { 
      setFirmRules(p => ({ ...p, parseStatus: '✗ Parse failed — ' + e.message })); 
    } finally { 
      setTcParsing(false); 
    }
  }, [firmRules, onSaveFirmRules]);

  const onTcDrop = useCallback(async (e) => {
    e.preventDefault();
    const file = (e.dataTransfer?.files || e.target.files)?.[0]; 
    if (!file) return;
    
    setFirmRules(p => ({ ...p, parseStatus: 'Reading T&C document...' }));
    
    const r = new FileReader();
    r.onload = async ev => { 
      await parseTandC(ev.target.result); 
    };
    r.readAsText(file);
  }, [parseTandC]);
  const extractFromScreenshots = async () => {
    if (!screenshots.length) return;
    
    setExtracting(true); 
    
    try {
      const msgs = screenshots.map(s => ({ 
        type: 'image', 
        source: { type: 'base64', media_type: s.type, data: s.b64 } 
      }));
      msgs.push({ 
        type: 'text', 
        text: 'Extract all trading indicator values. Return ONLY JSON.' 
      });
      
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          model: 'claude-sonnet-4-20250514', 
          max_tokens: 800, 
          system: SCREENSHOT_EXTRACT_PROMPT, 
          messages: [{ role: 'user', content: msgs }] 
        })
      });
      
      const data = await res.json();
      const vals = JSON.parse((data.content?.map(b => b.text || '').join('') || '{}').replace(/```json|```/g, '').trim());
      
      setExtractedVals(prev => ({ 
        ...prev, 
        ...Object.fromEntries(Object.entries(vals).filter(([, v]) => v !== null && typeof v !== 'object')) 
      }));
      
      if (vals.currentPrice) {
        setF(prev => ({ ...prev, currentPrice: String(vals.currentPrice) }));
      }
      
      setExtractStatus(`✓ ${[vals.adx&&`ADX=${vals.adx}`,vals.ci&&`CI=${vals.ci}`,vals.atr&&`ATR=${vals.atr}`,vals.currentPrice&&`Price=${vals.currentPrice}`].filter(Boolean).join(' · ')}`);
    } catch {
      setExtractStatus('✗ Extract failed');
    } finally {
      setExtracting(false);
    }
  };

  const buildFirmContext = () => {
    if (!fr.parsed) return '=== NO FIRM T&C LOADED ===';
    return `=== FIRM COMPLIANCE ===
Firm: ${fr.firmName || 'Unknown'}
Max Daily Loss: $${fr.maxDailyLoss || '?'} (${fr.maxDailyLossType})
Max Drawdown: $${fr.maxDrawdown || '?'} (${fr.drawdownType})
Profit Target: $${fr.profitTarget || '?'}
Consistency Cap: ${fr.consistencyMaxDayPct || 'none'}%/day
News Window: ±${fr.restrictedNewsWindowMins}min
Current Balance: $${curBal || '?'} | HWM: $${hwmVal || '?'} | Liq Level: $${liqLevel.toFixed(0) || '?'}
Distance to Liq: $${(curBal - liqLevel).toFixed(0) || '?'} (${maxDD > 0 ? ((curBal - liqLevel) / maxDD * 100).toFixed(0) + '%' : 'N/A'})
Today P&L: ${todayPnl >= 0 ? "+" : ""}$${todayPnl.toFixed(0)} (${maxDL > 0 ? `${(dailyLossUsed / maxDL * 100).toFixed(0)}% of daily limit` : 'no limit set'})
Daily Remaining: ${dailyRemaining !== null ? `$${dailyRemaining.toFixed(0)}` : 'unlimited'}
Consistency: ${todayPct !== null ? `${todayPct.toFixed(1)}% of target today (cap: ${consPct}%)` : 'N/A'}`;
  };

  const runPart2 = async () => {
    if (execBlocked) { 
      setErr(`Blocked: ${execBlockReason}`); 
      return; 
    }
    if (!f.entryPrice) { 
      setErr('Entry price required.'); 
      return; 
    }
    
    setErr(''); 
    setLoading(true); 
    setP2Out(''); 
    setShowP2TradeForm(false);
    
    try {
      const textContent = `PRE-ENTRY ANALYSIS + TRADE PLAN\n=== PART 1 AMD CONTEXT ===\n${p1Out ? p1Out.slice(0, 2500) + (p1Out.length > 2500 ? '\n[truncated]' : '') : 'No morning analysis.'}\nCurrent AMD Phase (Part 1): ${currentAMD}\n\n=== LIVE TRADE ===\nTime (IST): ${f.timeIST || '?'} | Instrument: ${f.instrument} ($${ptVal}/pt)\nDirection: ${f.direction} | Type: ${f.tradeType} | RRR: ${f.rrr}\nEntry: ${f.entryPrice} | ATR: ${atrVal || '?'} | Max Risk: $${maxRiskUSD || 0}\nADX: ${extractedVals.adx || '?'} | CI: ${extractedVals.ci || '?'} | VWAP: ${extractedVals.vwap || '?'}\nVWAP SD1: ${sd1Target?.toFixed(2) || '?'} | SD2: ${sd2Target?.toFixed(2) || '?'}\nVolatility Regime: ${volatilityRegime}\nNotes: ${f.notes || 'none'}\n\n${buildFirmContext()}`;
      
      const content = [];
      if (mpChart) content.push({ type: 'image', source: { type: 'base64', media_type: mpChart.type, data: mpChart.b64 } });
      if (vwapChart) content.push({ type: 'image', source: { type: 'base64', media_type: vwapChart.type, data: vwapChart.b64 } });
      
      screenshots.forEach(s => content.push({ type: 'image', source: { type: 'base64', media_type: s.type, data: s.b64 } }));
      content.push({ type: 'text', text: textContent });

      const response = await runDeliberation(PART2_PROMPT, JSON.stringify(content));
      setP2Out(response || 'No response.');
      setP2Jf({ exit: '', result: 'win', pnl: '', balAfter: '', lessons: '', amdPhase: currentAMD });
      
      setTimeout(() => p2Ref.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch { 
      setErr('API error.'); 
    } finally { 
      setLoading(false); 
    }
  };

  const addP2Trade = () => {
    if (!p2Jf.exit) { 
      setErr('Exit price required.'); 
      return; 
    }
    
    const entry = { 
      date: today, 
      instrument: f.instrument, 
      direction: f.direction, 
      tradeType: f.tradeType, 
      amdPhase: p2Jf.amdPhase || currentAMD, 
      rrr: f.rrr, 
      result: p2Jf.result, 
      entry: f.entryPrice, 
      exit: p2Jf.exit, 
      contracts: '1', 
      pnl: p2Jf.pnl, 
      session: 'Trading Hours', 
      balAfter: p2Jf.balAfter, 
      setup: `${f.timeIST || '?'} IST | ${f.direction} @ ${f.entryPrice} | ${f.rrr}`, 
      lessons: p2Jf.lessons 
    };
    
    setJournal(prev => [...prev, entry]);
    
    if (p2Jf.balAfter) { 
      const upd = { ...accountState, currentBalance: p2Jf.balAfter }; 
      setAccountState(upd); 
      if (onSaveAccount) onSaveAccount(upd); 
    }
    
    setShowP2TradeForm(false); 
    setErr(''); 
    showToast('Trade vector recorded. Journal synchronized.', 'success');
    
    // RULE #123: Confetti on successful trade logging
    triggerConfetti(35, 2);
  };
  // ─── RENDER MAIN TERMINAL ───
  
  // Get dynamic greeting
  const { fullGreeting } = getTimeBasedGreeting(profile?.fullName);
  
  return (
    <div style={{ minHeight: '100vh', background: "#FFFFFF", color: "#111827", fontFamily: T.font, display: "flex", flexDirection: "column" }}>
      
      {/* Terminal Header */}
      <div style={{ background: "#FFFFFF", borderBottom: `1px solid #E5E7EB`, padding: "16px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16, boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)" }} className="glass-panel">
        
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", gap: 4, alignItems: "flex-end" }}>
            {[10, 16, 12, 22, 14, 20, 11].map((h, i) => (
              <div key={i} style={{ width: 4, height: h, background: `hsl(${150 + i * 15},80%,60%)`, borderRadius: 2 }} />
            ))}
          </div>
          <div>
            <div style={{ color: "#111827", fontSize: 16, letterSpacing: 4, fontWeight: 800 }}>{fullGreeting}</div>
            <div style={{ color: "#6B7280", fontSize: 10, letterSpacing: 2, marginTop: 4, fontWeight: 600 }}>INSTITUTIONAL TERMINAL · v9</div>
          </div>
          
          {fr.parsed && <Tag label={fr.firmName} color={T.purple} />}
          <AMDPhaseTag phase={currentAMD} />
          {throttleActive && <Tag label="⚠ DRAWDOWN THROTTLE" color={T.gold} />}
        </div>
        
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <LED color={complianceColor} size={8} />
            <span style={{ color: T.muted, fontSize: 11, fontWeight: 600 }}>WATCHDOG</span>
          </div>
          
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <LED color={parsed?.totalDays >= 20 ? T.green : T.dim} size={8} pulse={false} />
            <span style={{ color: T.muted, fontSize: 11, fontWeight: 600 }}>
              {parsed ? `${parsed.totalBars.toLocaleString()} bars` : 'no data'}
            </span>
          </div>
          
          <div style={{ color: T.text, fontSize: 12, letterSpacing: 1, fontWeight: 600 }}>
            {profile?.fullName || profile?.email}
            {profile?.mobile && <span style={{ color: T.muted, fontSize: 11, marginLeft: 12 }}>📞 {formatPhoneNumber(profile.mobile)}</span>}
          </div>
          
          <button onClick={onLogout} style={{ background: "rgba(255,69,58,0.15)", border: `1px solid rgba(255,69,58,0.3)`, borderRadius: 6, padding: "8px 16px", cursor: "pointer", color: T.red, fontSize: 11, fontFamily: T.font, letterSpacing: 1, fontWeight: 700 }} className="btn-glass">
            LOGOUT
          </button>
        </div>
      </div>

      <CountdownBanner ist={ist} />

      {/* Navigation Tabs */}
      <div style={{ background: "#FFFFFF", borderBottom: `1px solid #E5E7EB`, padding: "0 32px", display: "flex", overflowX: "auto", boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.05)" }} className="glass-panel">
        {[
          { id: '1', label: 'PREMARKET', sub: 'AMD · Macro · Fuel', color: T.blue }, 
          { id: '2', label: 'TRADE ENTRY', sub: 'AMD-Exec · Compliance', color: T.orange }, 
          { id: '3', label: 'JOURNAL', sub: 'AMD Stats · P&L', color: T.purple }, 
          { id: '4', label: 'ACCOUNT MANAGER', sub: 'T&C · Drawdown · Rules', color: T.green }
        ].map(p => (
          <button 
            key={p.id} 
            onClick={() => { setPart(p.id); setErr(''); }} 
            style={{ 
              background: "transparent", border: "none", fontFamily: T.font, 
              borderBottom: part === p.id ? `3px solid ${p.color}` : "3px solid transparent", 
              padding: "16px 24px", cursor: "pointer", marginBottom: -1, 
              textAlign: "left", whiteSpace: "nowrap" 
            }} 
            className="btn-glass"
          >
            <div style={{ color: part === p.id ? p.color : "#6B7280", fontSize: 12, letterSpacing: 1.5, fontWeight: 800 }}>
              {p.label}
            </div>
            <div style={{ color: part === p.id ? "#6B7280" : "#D1D5DB", fontSize: 10, marginTop: 4, fontWeight: 500 }}>
              {p.sub}
            </div>
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 1440, margin: "0 auto", padding: "32px 40px", width: "100%", boxSizing: "border-box" }}>

        {/* ── DRAWDOWN THROTTLE BANNER ── */}
        {throttleActive && (
          <div style={{padding:"14px 20px",background:"rgba(255,214,10,0.12)",border:`2px solid ${T.gold}`,borderRadius:8,marginBottom:16,display:"flex",alignItems:"center",gap:12,animation:"led-pulse 1s ease-in-out infinite"}}>
            <span style={{fontSize:20}}>⚠</span>
            <div><div style={{color:T.gold,fontSize:13,fontWeight:800,letterSpacing:1}}>DRAWDOWN THROTTLE ACTIVE: RISK HALVED TO PROTECT CAPITAL</div><div style={{color:"#A0781A",fontSize:11,marginTop:3}}>Distance to liquidation within 25% of max drawdown. Size reduced to {activeRiskPct}%.</div></div>
          </div>
        )}

        {/* ══════════ TAB 1: PREMARKET ══════════ */}
        {part === '1' && (
          <div>
            {/* AMD Phase Selector */}
            <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
              {Object.entries(AMD_PHASES).map(([phase,cfg])=>(
                <div key={phase} onClick={()=>setCurrentAMD(phase)} style={{display:"flex",alignItems:"center",gap:6,padding:"7px 12px",background:currentAMD===phase?cfg.color+"18":"#F9FAFB",border:`1px solid ${currentAMD===phase?cfg.color+"60":"#E5E7EB"}`,borderRadius:8,cursor:"pointer",transition:"all 0.15s"}}>
                  <LED color={cfg.color} size={7} pulse={currentAMD===phase}/>
                  <span style={{color:currentAMD===phase?cfg.color:"#6B7280",fontSize:10,fontWeight:700,letterSpacing:0.5}}>{cfg.icon} {phase}</span>
                </div>
              ))}
              <span style={{marginLeft:"auto",color:"#9CA3AF",fontSize:9,alignSelf:"center"}}>AI sets automatically · click to override</span>
            </div>

            {/* CSV Upload */}
            <div style={cardS()} className="glass-panel">
              <SHead icon="⊞" title="LOAD NINJATRADER 1-MIN DATA" color={T.blue}/>
              <div onDrop={onFileDrop} onDragOver={e=>e.preventDefault()} onClick={()=>document.getElementById('csvIn').click()} style={{border:`2px dashed ${parseMsg.startsWith('✓')?T.green:"#E5E7EB"}`,borderRadius:8,padding:"24px",textAlign:"center",cursor:"pointer",background:"#F9FAFB"}}>
                <input id="csvIn" type="file" accept=".txt,.csv" style={{display:"none"}} onChange={onFileDrop}/>
                <div style={{fontSize:24,marginBottom:6,opacity:0.25}}>⊞</div>
                <div style={{color:parseMsg.startsWith('✓')?T.green:"#6B7280",fontSize:12,fontWeight:600}}>{parseMsg||"Drop NinjaTrader .txt / .csv — or click to browse"}</div>
                {parsed&&<div style={{color:"#9CA3AF",fontSize:11,marginTop:4}}>Latest: {parsed.days[0]?.date} · ATR(14) = <span style={{color:T.green,fontWeight:700}}>{parsed.tradingHoursAtr14} pts</span></div>}
              </div>
            </div>

            {/* Screenshot Paste Zones */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:14,marginBottom:14}}>
              {[
                {zid:'p1news',icon:'📅',title:'ECONOMIC CALENDAR',color:T.red,hint:'★★★ events only',state:p1NewsChart,setter:setP1NewsChart,inputId:'p1newsIn'},
                {zid:'p1prem',icon:'🌅',title:'PREMARKET CHART',color:T.orange,hint:'open type + prev week H/L',state:p1PremarketChart,setter:setP1PremarketChart,inputId:'p1premIn'},
                {zid:'p1lvl',icon:'◈',title:'KEY LEVELS CHART',color:T.gold,hint:'PDH/PDL/POC/VAH/VAL/VWAP',state:p1KeyLevelsChart,setter:setP1KeyLevelsChart,inputId:'p1lvlIn'}
              ].map(zone=>(
                <PasteZone key={zone.zid} zoneId={zone.zid} activeZone={activeZone} setActiveZone={setActiveZone}>
                  <div style={cardS({margin:0,borderLeft:`4px solid ${zone.color}`})} className="glass-panel">
                    <SHead icon={zone.icon} title={zone.title} color={zone.color}/>
                    <div onDrop={makeImgHandler(zone.setter)} onDragOver={e=>e.preventDefault()} onClick={e=>{e.stopPropagation();document.getElementById(zone.inputId).click();}} style={{border:`2px dashed ${zone.state?zone.color:"#E5E7EB"}`,borderRadius:6,padding:"12px",textAlign:"center",cursor:"pointer",background:"#F9FAFB",minHeight:64}}>
                      <input id={zone.inputId} type="file" accept="image/*" style={{display:"none"}} onChange={makeImgHandler(zone.setter)}/>
                      {zone.state
                        ?<div><img src={`data:${zone.state.type};base64,${zone.state.b64}`} style={{maxWidth:"100%",maxHeight:56,borderRadius:3,objectFit:"contain",marginBottom:4}}/><button onClick={e=>{e.stopPropagation();zone.setter(null);}} style={{background:"rgba(255,69,58,0.1)",border:`1px solid rgba(255,69,58,0.4)`,borderRadius:4,padding:"2px 8px",cursor:"pointer",color:T.red,fontSize:9,fontFamily:T.font}}>✕ Remove</button></div>
                        :<div><div style={{color:"#9CA3AF",fontSize:11,marginBottom:2}}>Click → Ctrl+V or drag</div><div style={{color:"#D1D5DB",fontSize:9}}>{zone.hint}</div></div>}
                    </div>
                  </div>
                </PasteZone>
              ))}
            </div>

            {err&&<div style={{color:T.red,fontSize:12,marginBottom:12,fontWeight:600}}>⚠ {err}</div>}
            <button onClick={runPart1} disabled={loading||!parsed||parsed.totalDays<5} style={glowBtn(T.green,loading||!parsed||parsed.totalDays<5)} className="btn-glass">
              ▶ RUN AMD PREMARKET ANALYSIS
            </button>

            <div ref={p1Ref} style={{marginTop:20}}>
              {loading&&<Loader color={T.green} label="COLLECTIVE BRAIN PROCESSING AMD PHASES..."/>}
              {!loading&&p1Out&&(
                <div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}><Tag label="ANALYSIS COMPLETE" color={T.green}/><AMDPhaseTag phase={currentAMD}/></div>
                    <div style={{display:"flex",gap:8}}>
                      <button onClick={()=>{setPart('2');setErr('');}} style={glowBtn(T.orange,false)} className="btn-glass">→ TRADE ENTRY</button>
                      <button onClick={()=>navigator.clipboard?.writeText(p1Out)} style={{background:"transparent",border:`1px solid #E5E7EB`,borderRadius:6,padding:"8px 12px",cursor:"pointer",color:"#6B7280",fontSize:10,fontFamily:T.font}}>⎘ COPY</button>
                    </div>
                  </div>
                  <div style={cardS({borderLeft:`4px solid ${T.blue}`})} className="glass-panel"><RenderOut text={p1Out}/></div>
                </div>
              )}
            </div>
          </div>
        )}
      {/* ========================================================================= */}
        {/* TAB 2: TRADE ENTRY & COMPLIANCE */}
        {/* ========================================================================= */}
        {part === '2' && (
          <div>
            <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 280 }}>
                <AMDPhaseTag phase={currentAMD} />
              </div>
              <div style={{ flex: 2, minWidth: 280 }}>
                <TrafficLight state={trafficState} />
              </div>
            </div>

            {fr.parsed && (
              <div style={{ display: "flex", gap: 16, padding: "14px 20px", background: "#FFFFFF", border: `1px solid ${complianceColor}40`, borderRadius: 10, marginBottom: 16, flexWrap: "wrap", boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)" }} className="glass-panel">
                <LED color={complianceColor} size={10} />
                <span style={{ color: complianceColor, fontSize: 11, letterSpacing: 1, fontWeight: 700 }}>WATCHDOG:</span>
                {maxDL > 0 && <span style={{ color: isDailyBreached ? T.red : isDailyWarning ? T.gold : T.green, fontSize: 11, fontWeight: 600 }}>Daily ${dailyLossUsed.toFixed(0)}/${maxDL}</span>}
                {maxDD > 0 && curBal > 0 && <span style={{ color: isDDBreached ? T.red : isDDWarning ? T.gold : T.green, fontSize: 11, fontWeight: 600 }}>LiqDist ${(curBal - liqLevel).toFixed(0)}</span>}
                <span style={{ color: ist.isOpen ? T.green : T.red, fontSize: 11, fontWeight: 600 }}>{ist.isOpen ? "● MARKET OPEN" : "● MARKET CLOSED"}</span>
                {throttleActive && <span style={{ color: T.gold, fontSize: 11, fontWeight: 700 }}>⚠ DRAWDOWN THROTTLE</span>}
              </div>
            )}

            {parsed && <HourlyHeatmap hourlyHeatmap={parsed.hourlyHeatmap} />}

            {(extractedVals.adx !== null || extractedVals.ci !== null || sd1Target) && (
              <div style={{ display: "flex", gap: 16, padding: "12px 20px", background: "rgba(0,0,0,0.5)", border: `1px solid rgba(255,255,255,0.1)`, borderRadius: 8, marginBottom: 16, flexWrap: "wrap" }} className="glass-panel">
                <span style={{ color: T.dim, fontSize: 10, letterSpacing: 1, fontWeight: 700 }}>LIVE:</span>
                {extractedVals.adx !== null && <span style={{ color: extractedVals.adx < 20 ? T.red : T.green, fontSize: 12, fontWeight: 700, fontFamily: T.mono }}>ADX {extractedVals.adx}</span>}
                {extractedVals.ci !== null && <span style={{ color: extractedVals.ci > 61.8 ? T.red : T.green, fontSize: 12, fontWeight: 700, fontFamily: T.mono }}>CI {extractedVals.ci}</span>}
                {extractedVals.vwap !== null && <span style={{ color: T.blue, fontSize: 12, fontWeight: 700, fontFamily: T.mono }}>VWAP {extractedVals.vwap}</span>}
                {sd1Target && <span style={{ color: T.cyan, fontSize: 12, fontWeight: 700, fontFamily: T.mono }}>SD1 {sd1Target.toFixed(2)}</span>}
                {sd2Target && <span style={{ color: T.purple, fontSize: 12, fontWeight: 700, fontFamily: T.mono }}>SD2 {sd2Target.toFixed(2)}</span>}
              </div>
            )}

            <div style={{ padding: "12px 20px", background: "rgba(0,0,0,0.5)", border: `1px solid ${T.blue}40`, borderRadius: 8, marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }} className="glass-panel">
              <span style={{ color: T.dim, fontSize: 10, letterSpacing: 1, fontWeight: 700 }}>VOLATILITY REGIME:</span>
              <span style={{ color: volatilityRegime === 'Compression' ? T.red : volatilityRegime === 'Expansion' ? T.green : T.blue, fontSize: 14, fontWeight: 800 }}>{volatilityRegime}</span>
              <span style={{ color: T.muted, fontSize: 12, fontFamily: T.mono, fontWeight: 600 }}>(VR = {VR.toFixed(2)})</span>
            </div>

            <div style={cardS({ borderLeft: `4px solid ${T.orange}` })} className="glass-panel card-tilt">
              <SHead icon="⚡" title="TRADE SETUP" color={T.orange} />
              
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
                <Field label="TIME (IST)" value={f.timeIST} onChange={sf('timeIST')} options={TIME_OPTIONS} />
                <Field label="INSTRUMENT" value={f.instrument} onChange={sf('instrument')} options={[{ v: 'MNQ', l: 'MNQ · $2/pt' }, { v: 'MES', l: 'MES · $5/pt' }]} />
                <Field label="DIRECTION" value={f.direction} onChange={sf('direction')} options={[{ v: 'Long', l: '↑ Long' }, { v: 'Short', l: '↓ Short' }]} />
                <Field label="TRADE TYPE" value={f.tradeType} onChange={sf('tradeType')} options={[{ v: 'Trend', l: 'Trend' }, { v: 'MR', l: 'Mean Reversion' }]} />
                <Field label="ACCOUNT BALANCE ($)" value={f.accountBalance} onChange={sf('accountBalance')} type="number" mono />
                <Field label="RISK %" value={f.riskPct} onChange={sf('riskPct')} options={[{ v: '0.2', l: '0.2%' }, { v: '0.3', l: '0.3%' }, { v: '0.4', l: '0.4%' }]} />
              </div>
              
              {isThrottled && (
                <div style={{ marginTop: 12, padding: "10px 16px", background: "rgba(255,214,10,0.1)", border: `1px solid rgba(255,214,10,0.3)`, borderRadius: 6, color: T.gold, fontSize: 12, fontWeight: 600 }}>
                  ⚠ Drawdown throttle active: risk halved to {activeRiskPct}%
                </div>
              )}
            </div>

            <div style={cardS()} className="glass-panel card-tilt">
              <label style={lbl}>ENTRY PRICE</label>
              <input type="number" value={f.entryPrice} onChange={e => sf('entryPrice')(e.target.value)} placeholder="exact entry level" style={inp} className="input-glass" />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 12 }}>
              {[
                { zid: 'ss', icon: '📊', title: 'INDICATORS', color: T.purple, isMulti: true }, 
                { zid: 'vwap', icon: '〰', title: 'VWAP CHART', color: T.blue, state: vwapChart, setter: setVwapChart, inputId: 'vwapIn' }, 
                { zid: 'mp', icon: '◈', title: '30-MIN MP CHART', color: T.gold, state: mpChart, setter: setMpChart, inputId: 'mpIn' }
              ].map(zone => (
                <PasteZone key={zone.zid} zoneId={zone.zid} activeZone={activeZone} setActiveZone={setActiveZone}>
                  <div data-pastezone="true" style={cardS({ margin: 0, borderLeft: `4px solid ${zone.color}` })} className="glass-panel">
                    <SHead icon={zone.icon} title={zone.title} color={zone.color} />
                    
                    {zone.isMulti ? (
                      <div onDrop={onScreenshotDrop} onDragOver={e => e.preventDefault()} onClick={e => { e.stopPropagation(); document.getElementById('ssIn').click(); }} style={{ border: `2px dashed ${screenshots.length ? T.purple : "rgba(255,255,255,0.15)"}`, borderRadius: 8, padding: "16px", textAlign: "center", cursor: "pointer", background: "rgba(0,0,0,0.3)" }} className="glass-panel">
                        <input id="ssIn" type="file" accept="image/*" multiple style={{ display: "none" }} onChange={onScreenshotDrop} />
                        {screenshots.length > 0 ? (
                          <div>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginBottom: 8 }}>
                              {screenshots.map((s, i) => (
                                <div key={i} style={{ position: "relative", width: 60, height: 40, borderRadius: 4, overflow: "hidden", border: `1px solid ${T.purple}60` }}>
                                  <img src={`data:${s.type};base64,${s.b64}`} className="aspect-ratio-4-3" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                  <button onClick={e => { e.stopPropagation(); setScreenshots(p => p.filter((_, idx) => idx !== i)); }} style={{ position: "absolute", top: 0, right: 0, background: "rgba(0,0,0,0.8)", border: "none", width: 16, height: 16, cursor: "pointer", color: "#fff", fontSize: 10, padding: 0 }}>✕</button>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div style={{ color: T.muted, fontSize: 12, marginBottom: 4, fontWeight: 600 }}>Click → Ctrl+V or drag</div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div onDrop={makeImgHandler(zone.setter)} onDragOver={e => e.preventDefault()} onClick={e => { e.stopPropagation(); document.getElementById(zone.inputId).click(); }} style={{ border: `2px dashed ${zone.state ? zone.color : "rgba(255,255,255,0.15)"}`, borderRadius: 8, padding: "16px", textAlign: "center", cursor: "pointer", background: "rgba(0,0,0,0.3)" }} className="glass-panel">
                        <input id={zone.inputId} type="file" accept="image/*" style={{ display: "none" }} onChange={makeImgHandler(zone.setter)} />
                        {zone.state ? (
                          <div>
                            <img src={`data:${zone.state.type};base64,${zone.state.b64}`} className="aspect-ratio-4-3" style={{ maxWidth: "100%", maxHeight: 60, borderRadius: 4, objectFit: "contain", marginBottom: 8, cursor: "crosshair" }} />
                            <button onClick={e => { e.stopPropagation(); zone.setter(null); }} style={{ display: "block", margin: "0 auto", background: "rgba(255,69,58,0.1)", border: `1px solid rgba(255,69,58,0.4)`, borderRadius: 4, padding: "4px 12px", cursor: "pointer", color: T.red, fontSize: 10, fontFamily: T.font, fontWeight: 700 }}>✕</button>
                          </div>
                        ) : (
                          <div>
                            <div style={{ color: T.muted, fontSize: 12, marginBottom: 4, fontWeight: 600 }}>Click → Ctrl+V or drag</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </PasteZone>
              ))}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 16, margin: "16px 0", padding: "12px 20px", background: "#FFFFFF", border: `1px solid #E5E7EB`, borderRadius: 8, boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)" }} className="glass-panel">
              <button onClick={extractFromScreenshots} disabled={extracting || screenshots.length === 0} style={glowBtn(T.purple, extracting || !screenshots.length)} className="btn-glass">
                {extracting ? "⟳ READING..." : "◉ EXTRACT INDICATORS"}
              </button>
              <span style={{color:T.muted,fontSize:10,flex:1,fontWeight:500}}>{extractStatus||"Extracts ADX · CI · ATR for Dead Zone check"}</span>
            </div>

            <div style={cardS()} className="glass-panel card-tilt">
              <label style={lbl}>NOTES</label>
              <textarea value={f.notes} onChange={e => sf('notes')(e.target.value)} style={{ ...inp, minHeight: 60, resize: "vertical" }} className="input-glass" />
            </div>

            {err && (
              <div style={{ color: T.red, fontSize: 13, marginBottom: 16, fontWeight: 600, padding: "12px 16px", background: "rgba(255,69,58,0.1)", borderRadius: 8 }}>
                ⚠ {err}
              </div>
            )}

            <button onClick={runPart2} disabled={loading || execBlocked} style={glowBtn(T.orange, loading || execBlocked)} className="btn-glass">
              {execBlocked ? `🚫 LOCKED` : "⚡ RUN AMD COMPLIANCE + EXECUTION PLAN"}
            </button>

            <div ref={p2Ref} style={{ marginTop: 24 }}>
              {loading && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 240, gap: 16 }}>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 28 }}>
                    {[8, 15, 10, 20, 12, 17, 9].map((h, i) => <div key={i} style={{ width: 4, height: h, background: T.orange, borderRadius: 2, animation: `bar ${0.85 + i * 0.05}s ${i * 0.1}s ease-in-out infinite alternate` }} />)}
                  </div>
                  <span style={{ color: T.muted, fontSize: 12, letterSpacing: 2, fontWeight: 600 }}>RECURSIVE CONSENSUS ENGINE</span>
                  {/* Stage progress indicator */}
                  <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                    {[
                      { key: 'stage1', icon: '\uD83D\uDCE1', label: 'Triple-Front' },
                      { key: 'stage2', icon: '\u2696\uFE0F', label: 'Preliminary' },
                      { key: 'stage3', icon: '\uD83D\uDD0D', label: 'Cross-Exam' },
                      { key: 'stage4', icon: '\uD83C\uDFDB\uFE0F', label: 'Briefing' },
                      { key: 'stage5', icon: '\uD83C\uDFC6', label: 'Verdict' },
                    ].map((s) => {
                      const stages = ['stage1', 'stage2', 'stage3', 'stage4', 'stage5', 'complete'];
                      const ci = stages.indexOf(councilStage.current);
                      const si = stages.indexOf(s.key);
                      const isActive = councilStage.current === s.key;
                      const isDone = ci > si;
                      return (
                        <div key={s.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, opacity: isDone ? 1 : isActive ? 1 : 0.35, transition: 'opacity 0.4s' }}>
                          <div style={{
                            width: 36, height: 36, borderRadius: '50%',
                            background: isDone ? 'rgba(34,197,94,0.15)' : isActive ? 'rgba(249,115,22,0.15)' : 'rgba(255,255,255,0.05)',
                            border: `2px solid ${isDone ? '#22C55E' : isActive ? T.orange : 'rgba(255,255,255,0.1)'}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                            animation: isActive ? 'led-pulse 1.5s ease-in-out infinite' : 'none'
                          }}>
                            {isDone ? '\u2713' : s.icon}
                          </div>
                          <span style={{ fontSize: 9, color: isDone ? '#22C55E' : isActive ? T.orange : T.dim, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>{s.label}</span>
                        </div>
                      );
                    })}
                  </div>
                  <span style={{ fontSize: 11, color: T.orange, fontWeight: 600, letterSpacing: 1, marginTop: 4, animation: 'led-pulse 2s ease-in-out infinite' }}>{councilStage.label}</span>
                </div>
              )}
              {!loading && p2Out && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <Tag label="EXECUTION PLAN READY" color={T.orange} />
                    <div style={{ display: "flex", gap: 10 }}>
                      <button onClick={() => setShowP2TradeForm(v => !v)} style={glowBtn(T.purple, false)} className="btn-glass">
                        {showP2TradeForm ? "✕ CANCEL" : "+ LOG TRADE"}
                      </button>
                    </div>
                  </div>
                  
                  {showP2TradeForm && (
                    <div style={{ background: "#FFFFFF", border: `1px solid #E5E7EB`, borderRadius: 12, padding: "20px 24px", marginBottom: 20, boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)" }} className="glass-panel">
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 16 }}>
                        <Field label="EXIT PRICE" value={p2Jf.exit} onChange={sp2('exit')} type="number" mono />
                        <Field label="RESULT" value={p2Jf.result} onChange={sp2('result')} options={[{ v: 'win', l: '✓ Win' }, { v: 'loss', l: '✗ Loss' }, { v: 'breakeven', l: '◎ BE' }]} />
                        <Field label="AMD PHASE AT TRADE" value={p2Jf.amdPhase} onChange={sp2('amdPhase')} options={Object.keys(AMD_PHASES).map(k => ({ v: k, l: AMD_PHASES[k].label }))} />
                        <Field label="P&L ($)" value={p2Jf.pnl} onChange={sp2('pnl')} type="number" mono />
                        <Field label="BALANCE AFTER ($)" value={p2Jf.balAfter} onChange={sp2('balAfter')} type="number" mono />
                      </div>
                      <button onClick={addP2Trade} style={glowBtn(T.purple, false)} className="btn-glass">+ ADD TO JOURNAL</button>
                    </div>
                  )}
                  
                  <TrafficLight state={trafficState} />
                  
                  <div style={cardS({ borderLeft: `4px solid ${T.orange}` })} className="glass-panel card-tilt">
                    <RenderOut text={p2Out} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        {/* ========================================================================= */}
        {/* TAB 3: TRADE JOURNAL & STATS */}
        {/* ========================================================================= */}
        {part === '3' && (() => {
          const wins = journal.filter(t => t.result === 'win');
          const losses = journal.filter(t => t.result === 'loss');
          const pnlTotal = journal.reduce((s, t) => s + parseFloat(t.pnl || 0), 0);
          const wr = journal.length ? (wins.length / journal.length) * 100 : 0;
          const avgWin = wins.length ? wins.reduce((s, t) => s + parseFloat(t.pnl || 0), 0) / wins.length : 0;
          const avgLoss = losses.length ? Math.abs(losses.reduce((s, t) => s + parseFloat(t.pnl || 0), 0) / losses.length) : 0;
          const pf = avgLoss > 0 && losses.length ? (avgWin * wins.length) / (avgLoss * losses.length) : null;
          
          return (
            <div>
              {/* Performance Dashboard */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 20 }}>
                {[
                  { l: "TOTAL P&L", v: `${pnlTotal >= 0 ? "+" : ""}$${pnlTotal.toFixed(2)}`, c: pnlTotal >= 0 ? T.green : T.red }, 
                  { l: "WIN RATE", v: `${wr.toFixed(1)}%`, c: wr >= 50 ? T.green : T.red }, 
                  { l: "PROFIT FACTOR", v: pf ? pf.toFixed(2) : "—", c: pf && pf >= 1.5 ? T.green : pf && pf >= 1 ? T.gold : T.red }
                ].map((s, i) => (
                  <div key={i} style={cardS({ margin: 0, textAlign: "center", padding: "20px" })} className="glass-panel card-tilt">
                    <div style={{ color: T.dim, fontSize: 11, letterSpacing: 1.5, marginBottom: 8, fontWeight: 700 }}>{s.l}</div>
                    <div style={{ color: s.c, fontSize: 24, fontWeight: 800, fontFamily: T.mono }}>{s.v}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <span style={{ color: T.muted, fontSize: 11, letterSpacing: 1.5, fontWeight: 700 }}>TRADE HISTORY — {journal.length} ENTRIES</span>
                <button onClick={()=>setShowForm(f=>!f)} style={glowBtn(showForm?T.muted:T.green,false)} className="btn-glass">{showForm?"✕ CANCEL":"+ LOG TRADE"}</button>
              </div>
              {showForm&&(
                <div style={{background:"#F9FAFB",border:`1px solid #E5E7EB`,borderRadius:10,padding:"18px 20px",marginBottom:14}}>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10,marginBottom:10}}>
                    <div><label style={lbl}>DATE</label><input type="date" value={jf.date} onChange={e=>sjf('date')(e.target.value)} style={inp}/></div>
                    <Field label="INSTRUMENT" value={jf.instrument} onChange={sjf('instrument')} options={[{v:'MNQ',l:'MNQ'},{v:'MES',l:'MES'},{v:'US100',l:'US100'}]}/>
                    <Field label="DIRECTION" value={jf.direction} onChange={sjf('direction')} options={[{v:'Long',l:'↑ Long'},{v:'Short',l:'↓ Short'}]}/>
                    <Field label="TYPE" value={jf.tradeType} onChange={sjf('tradeType')} options={[{v:'Trend',l:'Trend'},{v:'MR',l:'Mean Reversion'}]}/>
                    <Field label="AMD PHASE" value={jf.amdPhase} onChange={sjf('amdPhase')} options={Object.keys(AMD_PHASES).map(k=>({v:k,l:AMD_PHASES[k].label}))}/>
                    <Field label="RRR" value={jf.rrr} onChange={sjf('rrr')} options={[{v:'1:1',l:'1:1'},{v:'1:1.2',l:'1:1.2'},{v:'1:2',l:'1:2'},{v:'1:2.2',l:'1:2.2'}]}/>
                    <Field label="RESULT" value={jf.result} onChange={sjf('result')} options={[{v:'win',l:'✓ Win'},{v:'loss',l:'✗ Loss'},{v:'breakeven',l:'◎ BE'}]}/>
                    <Field label="ENTRY" value={jf.entry} onChange={sjf('entry')} type="number" mono/>
                    <Field label="EXIT" value={jf.exit} onChange={sjf('exit')} type="number" mono/>
                    <Field label="P&L ($)" value={jf.pnl} onChange={sjf('pnl')} type="number" mono/>
                    <Field label="BAL AFTER ($)" value={jf.balAfter} onChange={sjf('balAfter')} type="number" mono/>
                  </div>
                  <button onClick={()=>{addJournalEntry();setShowForm(false);}} style={glowBtn(T.green,false)} className="btn-glass">+ ADD TO LOG</button>
                </div>
              )}

              {journal.length === 0 ? (
                <div style={{ background: "#FFFFFF", border: `1px solid #E5E7EB`, borderRadius: 12, padding: "60px", textAlign: "center", color: "#6B7280", fontSize: 14, fontWeight: 600, boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)" }} className="glass-panel">
                  No trades logged yet
                </div>
              ) : (
                <div style={{ background: "#FFFFFF", border: `1px solid #E5E7EB`, borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)" }} className="glass-panel">
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ borderBottom: `1px solid #E5E7EB` }}>
                          {["DATE", "INST", "DIR", "TYPE", "AMD", "ENTRY", "EXIT", "P&L", "RESULT", ""].map((h, i) => (
                            <th key={i} style={{ padding: "14px 16px", textAlign: "left", color: "#6B7280", fontSize: 10, letterSpacing: 1.5, fontFamily: T.font, fontWeight: 700, whiteSpace: "nowrap", background: "#F9FAFB" }} className="gemini-gradient-text">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[...journal].reverse().map((t, i) => { 
                          const pv = parseFloat(t.pnl || 0);
                          const isW = t.result === 'win';
                          const isL = t.result === 'loss';
                          return (
                            <tr key={i} style={{ borderBottom: `1px solid #E5E7EB`, background: i % 2 === 0 ? "#F9FAFB" : "#FFFFFF" }}>
                              <td style={{ padding: "12px 16px", color: "#6B7280", fontSize: 11, whiteSpace: "nowrap", fontFamily: T.mono }}>{t.date}</td>
                              <td style={{ padding: "12px 16px", color: "#111827", fontSize: 12, fontWeight: 700 }}>{t.instrument}</td>
                              <td style={{ padding: "12px 16px" }}>
                                <span style={{ color: t.direction === 'Long' ? "#10B981" : "#EF4444", fontSize: 11, fontWeight: 600 }}>
                                  {t.direction === 'Long' ? 'BUY' : 'SELL'}
                                </span>
                              </td>
                              <td style={{ padding: "12px 16px", color: "#0EA5E9", fontSize: 11, fontWeight: 500 }}>{t.tradeType}</td>
                              <td style={{ padding: "12px 16px" }}>
                                <span style={{ color: "#D97706", fontSize: 10, fontWeight: 600 }}>{t.amdPhase?.slice(0, 10)}</span>
                              </td>
                              <td style={{ padding: "12px 16px", color: "#A1A1A6", fontSize: 11, fontFamily: T.mono }}>{t.entry || "—"}</td>
                              <td style={{ padding: "12px 16px", color: "#A1A1A6", fontSize: 11, fontFamily: T.mono }}>{t.exit || "—"}</td>
                              <td style={{ padding: "12px 16px", color: pv >= 0 ? "#10B981" : "#EF4444", fontSize: 13, fontWeight: 800, fontFamily: T.mono }}>
                                {pv >= 0 ? "+" : ""}${pv.toFixed(0)}
                              </td>
                              <td style={{ padding: "12px 16px" }}>
                                <span style={{ color: isW ? "#10B981" : isL ? "#EF4444" : "#6B7280", fontSize: 11, fontWeight: 800 }}>
                                  {isW ? "WIN" : isL ? "LOSS" : "BE"}
                                </span>
                              </td>
                              <td style={{ padding: "12px 16px" }}>
                                <button 
                                  onClick={() => setJournal(prev => prev.filter((_, idx) => idx !== journal.length - 1 - i))} 
                                  style={{ background: "rgba(255,69,58,0.1)", border: "1px solid rgba(255,69,58,0.3)", borderRadius: 4, cursor: "pointer", color: T.red, fontSize: 10, padding: "4px 8px", fontWeight: 700 }}
                                >✕</button>
                              </td>
                            </tr>
                          ); 
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
        {/* ========================================================================= */}
        {/* TAB 4: ACCOUNT MANAGER & FIRM RULES */}
        {/* ========================================================================= */}
        {part === '4' && (
          <div>
            {/* Exchange Facility Badge */}
            <ExchangeFacilityBadge />

            <div style={cardS({ borderLeft: `4px solid ${T.green}` })} className="glass-panel card-tilt">
              <SHead icon="📋" title="PROP FIRM TERMS & CONDITIONS" color={T.green} />
              <div 
                onDrop={onTcDrop} 
                onDragOver={e => e.preventDefault()} 
                onClick={() => document.getElementById('tcIn').click()} 
                style={{ border: `2px dashed ${fr.parsed ? T.green : "rgba(255,255,255,0.15)"}`, borderRadius: 10, padding: "32px", textAlign: "center", cursor: "pointer", background: "rgba(0,0,0,0.3)", marginBottom: 16, position: "relative", overflow: "hidden" }} 
                className="glass-panel"
              >
                <input id="tcIn" type="file" accept=".pdf,.txt,.doc,.docx" style={{ display: "none" }} onChange={onTcDrop} />
                <div style={{ fontSize: 32, marginBottom: 12, opacity: fr.parsed ? 1 : 0.2 }}>
                  {fr.parsed ? "✓" : "📋"}
                </div>
                <div style={{ color: fr.parsed ? T.green : T.muted, fontSize: 13, marginBottom: 6, fontWeight: 600 }}>
                  {fr.parsed ? `T&C Loaded: ${fr.firmName}` : "Drop T&C document or click to browse"}
                </div>
              </div>
              
              {tcParsing && <div style={{ color: T.blue, fontSize: 12, textAlign: "center", fontWeight: 600 }}>⟳ AI ANALYZING COMPLIANCE RULES...</div>}
              {fr.parseStatus && <div style={{ color: fr.parseStatus.startsWith('✓') ? T.green : T.red, fontSize: 12, textAlign: "center", marginTop: 8 }}>{fr.parseStatus}</div>}
            </div>

            <div style={cardS({ borderLeft: `4px solid ${T.blue}` })} className="glass-panel card-tilt">
              <SHead icon="💰" title="LIVE ACCOUNT STATE" color={T.blue} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 16 }}>
                <Field label="STARTING BALANCE ($)" value={accountState.startingBalance} onChange={sacc('startingBalance')} type="number" mono />
                <Field label="CURRENT BALANCE ($)" value={accountState.currentBalance} onChange={sacc('currentBalance')} type="number" mono />
                <Field label="HIGH-WATER MARK ($)" value={accountState.highWaterMark} onChange={sacc('highWaterMark')} type="number" mono />
                <Field label="TODAY START BALANCE ($)" value={accountState.dailyStartBalance} onChange={sacc('dailyStartBalance')} type="number" mono />
              </div>
              <button 
                onClick={() => { if (onSaveAccount) onSaveAccount(accountState); showToast('Account state persisted to distributed ledger.', 'success'); }} 
                style={glowBtn(T.blue, false)} 
                className="btn-glass"
              >
                💾 SAVE TO CLOUD
              </button>
            </div>

            {fr.parsed && (
              <div style={cardS({ borderLeft: `4px solid ${T.purple}` })} className="glass-panel card-tilt">
                <SHead icon="⚖" title="EXTRACTED FIRM RULES" color={T.purple} />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 12 }}>
                  {fr.keyRules && fr.keyRules.map((rule, idx) => (
                    <div key={idx} style={{ padding: "10px 14px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: T.muted, fontSize: 12 }}>
                      • {rule}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  } // end MainTerminal

// ═══════════════════════════════════════════════════════════════════

//  ROOT — AUTH STATE MACHINE
// ═══════════════════════════════════════════════════════════════════
