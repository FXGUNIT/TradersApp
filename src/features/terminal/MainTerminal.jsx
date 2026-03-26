import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { computeJournalMetrics } from "./journalMetrics";
import {
  makeImgHandler,
  onScreenshotDrop,
} from "./terminalUploadUtils";
import { calculateVolatilityRatio, getDynamicParameters, calculateThrottledRisk } from "../../utils/math-engine.js";
import {
  T,
  AMD_PHASES,
  TIME_OPTIONS,
  SCREENSHOT_EXTRACT_PROMPT,
  PART1_PROMPT,
  PART2_PROMPT,
  LED,
  Tag,
  SHead,
  Field,
  Loader,
  RenderOut,
  AMDPhaseTag,
  TrafficLight,
  CountdownBanner,
  PasteZone,
  HourlyHeatmap,
  cardS,
  glowBtn,
  inp,
  lbl,
} from "./terminalHelperComponents";
import { CSS_VARS } from "../../styles/cssVars.js";

// Default states
const defaultAccountState = {
  startingBalance: "",
  currentBalance: "",
  highWaterMark: "",
  dailyStartBalance: "",
};

const defaultFirmRules = {
  parsed: false,
  firmName: "",
  maxDailyLoss: "",
  maxDailyLossType: "dollar",
  maxDrawdown: "",
  drawdownType: "trailing",
  profitTarget: "",
  consistencyMaxDayPct: "",
  restrictedNewsWindowMins: "15",
  newsTrading: true,
  scalpingAllowed: true,
  overnightHoldingAllowed: true,
  weekendTrading: true,
  copyTradingAllowed: false,
  maxContracts: "",
  minimumTradingDays: "",
  keyRules: [],
  notes: "",
  parseStatus: "",
};

function normalizeJournal(journal) {
  if (Array.isArray(journal)) return journal;
  if (journal && typeof journal === "object") return Object.values(journal);
  return [];
}

function buildAccountState(accountState) {
  return {
    ...defaultAccountState,
    ...(accountState || {}),
  };
}

function getISTState() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(utc + istOffset);
  const hour = ist.getHours();
  const minute = ist.getMinutes();
  const day = ist.getDay();
  const isWeekend = day === 0 || day === 6;
  const isOpen = !isWeekend && hour >= 9 && (hour < 16 || (hour === 16 && minute < 0));
  
  let countdown = "";
  if (!isOpen) {
    const nextOpen = new Date(ist);
    if (isWeekend) {
      nextOpen.setDate(nextOpen.getDate() + (7 - day + 1));
      nextOpen.setHours(9, 30, 0, 0);
    } else if (hour >= 16) {
      nextOpen.setDate(nextOpen.getDate() + 1);
      nextOpen.setHours(9, 30, 0, 0);
    } else if (hour < 9 || (hour === 9 && minute < 30)) {
      nextOpen.setHours(9, 30, 0, 0);
    }
    const diff = nextOpen - ist;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    countdown = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
  }
  
  const lbl = isOpen ? "MARKET CLOSES IN" : "MARKETS OPEN IN";
  
  return {
    hour,
    minute,
    day,
    isWeekend,
    isOpen,
    countdown,
    lbl,
    istStr: ist.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false }),
  };
}

export default function MainTerminal({
  profile,
  onLogout,
  onSaveJournal,
  onSaveAccount,
  onSaveFirmRules: _onSaveFirmRules,
  showToast,
  auth: _auth,
  privacyMode: _privacyMode,
}) {
  const [activeTab, setActiveTab] = useState("premarket");
  const [screenshots, setScreenshots] = useState([]);
  const [extracting, setExtracting] = useState(false);
  const [extractStatus, setExtractStatus] = useState("");
  const [extractedVals, setExtractedVals] = useState({
    adx: null,
    ci: null,
    vwap: null,
    vwapSlope: null,
    atr: null,
    currentPrice: null,
    fiveDayATR: null,
    twentyDayATR: null,
  });
  
  const [activeZone, setActiveZone] = useState(null);
  const [mpChart, setMpChart] = useState(null);
  const [vwapChart, setVwapChart] = useState(null);
  
  const [p1NewsChart, setP1NewsChart] = useState(null);
  const [p1PremarketChart, setP1PremarketChart] = useState(null);
  const [p1KeyLevelsChart, setP1KeyLevelsChart] = useState(null);
  
  const [journal, setJournal] = useState(() =>
    normalizeJournal(profile?.journal),
  );
  const [accountState, setAccountState] = useState(() =>
    buildAccountState(profile?.accountState),
  );
  const [firmRules] = useState(() => profile?.firmRules || defaultFirmRules);
  
  const [currentAMD, setCurrentAMD] = useState("UNCLEAR");
  const [p1Out, setP1Out] = useState("");
  const [p2Out, setP2Out] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [marketRefresh, setMarketRefresh] = useState(0);
  
  const ist = useMemo(() => getISTState(), [marketRefresh]);
  
  useEffect(() => {
    const interval = setInterval(() => setMarketRefresh(r => r + 1), 1000);
    return () => clearInterval(interval);
  }, []);
  
  const [parsed, setParsed] = useState(null);
  const [parseMsg, setParseMsg] = useState("");
  
  const [f, setF] = useState({
    timeIST: "",
    instrument: "MNQ",
    direction: "Long",
    tradeType: "Trend",
    accountBalance: "",
    riskPct: "0.3",
    entryPrice: "",
    currentPrice: "",
    rrr: "1:2",
    lastTradeResult: "",
    notes: "",
  });
  const sf = (k) => (v) => setF((p) => ({ ...p, [k]: v }));
  
  const [showP2TradeForm, setShowP2TradeForm] = useState(false);
  const [p2Jf, setP2Jf] = useState({
    exit: "",
    result: "win",
    pnl: "",
    balAfter: "",
    lessons: "",
    amdPhase: "UNCLEAR",
  });
  const sp2 = (k) => (v) => setP2Jf((p) => ({ ...p, [k]: v }));
  
  const [jf, setJf] = useState({
    date: new Date().toISOString().slice(0, 10),
    instrument: "MNQ",
    direction: "Long",
    tradeType: "Trend",
    amdPhase: "UNCLEAR",
    rrr: "1:2",
    result: "win",
    entry: "",
    exit: "",
    contracts: "1",
    pnl: "",
    session: "Trading Hours",
    balAfter: "",
    setup: "",
    lessons: "",
  });
  const sjf = (k) => (v) => setJf((p) => ({ ...p, [k]: v }));
  
  const [showForm, setShowForm] = useState(false);
  
  const p1Ref = useRef(null);
  const p2Ref = useRef(null);

  const journalDidMount = useRef(false);
  const accountDidMount = useRef(false);

  useEffect(() => {
    const id = setInterval(() => setIst(getISTState()), 1000);
    return () => clearInterval(id);
  }, []);
  
  useEffect(() => {
    setJournal(normalizeJournal(profile?.journal));
    setAccountState(buildAccountState(profile?.accountState));
  }, [profile?.uid, profile?.journal, profile?.accountState]);

  useEffect(() => {
    const current = Number.parseFloat(accountState.currentBalance || "0");
    const high = Number.parseFloat(accountState.highWaterMark || "0");

    if (Number.isFinite(current) && current > high) {
      setAccountState((previous) => ({
        ...previous,
        highWaterMark: String(current),
      }));
    }
  }, [accountState.currentBalance, accountState.highWaterMark]);

  useEffect(() => {
    if (!journalDidMount.current) {
      journalDidMount.current = true;
      return;
    }
    if (onSaveJournal) {
      void onSaveJournal(journal);
    }
  }, [journal, onSaveJournal]);

  useEffect(() => {
    if (!accountDidMount.current) {
      accountDidMount.current = true;
      return;
    }
    if (onSaveAccount) {
      void onSaveAccount(accountState);
    }
  }, [accountState, onSaveAccount]);

  const metrics = useMemo(() => computeJournalMetrics(journal), [journal]);

  // Trading calculations
  const maxRiskUSD = f.accountBalance && f.riskPct 
    ? Math.round(parseFloat(f.accountBalance) * parseFloat(f.riskPct) / 100 * 100) / 100 
    : null;

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

  // Firm compliance calculations
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

  // Paste handler
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

  // CSV handler
  const handleCsvDrop = useCallback((e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files[0] || e.target.files?.[0];
    if (!file) return;
    
    const r = new FileReader();
    r.onload = ev => {
      const text = ev.target.result;
      const lines = text.trim().split('\n');
      const days = [];
      let totalBars = 0;
      
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');
        if (cols.length < 6) continue;
        
        const date = cols[0]?.trim();
        const time = cols[1]?.trim();
        const open = parseFloat(cols[2]);
        const high = parseFloat(cols[3]);
        const low = parseFloat(cols[4]);
        const close = parseFloat(cols[5]);
        
        if (isNaN(open) || isNaN(close)) continue;
        
        const isPreMarket = time && time.length >= 4 && parseInt(time.slice(0, 2)) < 9;
        const isPostMarket = time && time.length >= 4 && parseInt(time.slice(0, 2)) >= 16;
        
        const tr = isNaN(high - low) ? 0 : high - low;
        
        if (!days.length || days[days.length - 1].date !== date) {
          days.push({
            date,
            bars: 1,
            preMarket: isPreMarket ? 1 : 0,
            tradingHours: !isPreMarket && !isPostMarket ? 1 : 0,
            postMarket: isPostMarket ? 1 : 0,
            atr14: tr,
            tradingHoursAtr14: !isPreMarket && !isPostMarket ? tr : 0,
          });
        } else {
          const d = days[days.length - 1];
          d.bars++;
          if (isPreMarket) d.preMarket++;
          else if (!isPostMarket) d.tradingHours++;
          else d.postMarket++;
          d.atr14 = Math.max(d.atr14, tr);
          if (!isPreMarket && !isPostMarket) d.tradingHoursAtr14 = Math.max(d.tradingHoursAtr14, tr);
        }
        totalBars++;
      }
      
      if (days.length >= 5) {
        days.sort((a, b) => new Date(a.date) - new Date(b.date));
        for (let i = 0; i < Math.min(5, days.length); i++) {
          if (days[i]) days[i].fiveDayATR = days[i].atr14;
        }
        for (let i = 0; i < days.length; i++) {
          const slice = days.slice(Math.max(0, i - 19), i + 1);
          const atrSum = slice.reduce((s, d) => s + (d.atr14 || 0), 0);
          days[i].twentyDayATR = atrSum / slice.length;
        }
      }
      
      const tradingHoursAtr = days.reduce((s, d) => s + (d.tradingHoursAtr14 || 0), 0) / (days.length || 1);
      
      if (days.length < 5) {
        setParseMsg(`⚠ Only ${days.length} days — need 5+`);
        setParsed(null);
        return;
      }
      
      setParsed({ days, totalBars, totalDays: days.length, tradingHoursAtr14: tradingHoursAtr });
      setParseMsg(`✓ ${totalBars.toLocaleString()} bars → ${days.length} days`);
    };
    r.readAsText(file);
  }, []);

  // AI extraction
  const extractFromScreenshots = async () => {
    if (!screenshots.length) return;
    
    setExtracting(true);
    setExtractStatus("Reading...");
    
    try {
      const msgs = screenshots.map(s => ({ 
        type: 'image', 
        source: { type: 'base64', media_type: s.type, data: s.b64 } 
      }));
      msgs.push({ 
        type: 'text', 
        text: 'Extract all trading indicator values. Return ONLY JSON.' 
      });
      
      const DEEPSEEK_KEY = import.meta.env.VITE_DEEPSEEK_KEY || '';
      
      if (!DEEPSEEK_KEY) {
        setExtractStatus("✗ No DeepSeek API key configured");
        setExtracting(false);
        return;
      }
      
      const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_KEY}`
        },
        body: JSON.stringify({ 
          model: 'deepseek-chat', 
          max_tokens: 800, 
          messages: [
            { role: 'system', content: SCREENSHOT_EXTRACT_PROMPT },
            { role: 'user', content: msgs }
          ]
        })
      });
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (errData.error?.message?.includes('image') || errData.error?.message?.doesNotSupport || res.status === 400) {
          setExtractStatus("✗ This model doesn't support images. Use text-based extraction.");
          setExtracting(false);
          return;
        }
        throw new Error(errData.error?.message || `HTTP ${res.status}`);
      }
      
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content || '{}';
      const vals = JSON.parse(content.replace(/```json|```/g, '').trim());
      
      setExtractedVals(prev => ({ 
        ...prev, 
        ...Object.fromEntries(Object.entries(vals).filter(([, v]) => v !== null && typeof v !== 'object')) 
      }));
      
      if (vals.currentPrice) {
        setF(prev => ({ ...prev, currentPrice: String(vals.currentPrice) }));
      }
      
      setExtractStatus(`✓ ${[vals.adx && `ADX=${vals.adx}`, vals.ci && `CI=${vals.ci}`, vals.atr && `ATR=${vals.atr}`, vals.currentPrice && `Price=${vals.currentPrice}`].filter(Boolean).join(' · ')}`);
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('image') || msg.includes('does not support')) {
        setExtractStatus("✗ Model doesn't support images");
      } else {
        setExtractStatus(`✗ ${msg || 'Extract failed'}`);
      }
    } finally {
      setExtracting(false);
    }
  };

  // Run Part 1
  const runPart1 = async () => {
    if (!parsed || parsed.totalDays < 5) { 
      setErr('Upload a valid NinjaTrader CSV file with at least 5 days.'); 
      return; 
    }
    
    setErr(''); 
    setLoading(true); 
    setP1Out('');
    
    try {
      const textMsg = `Run full Premarket Analysis. Today: ${parsed.days[0]?.date} | ${ist.istStr}
Trading Hours ATR(14): ${parsed.tradingHoursAtr14} pts

Screenshots: ${p1NewsChart ? '✓ Calendar' : '✗ No calendar'} | ${p1PremarketChart ? '✓ Premarket chart' : '✗ No chart'} | ${p1KeyLevelsChart ? '✓ Key levels' : '✗ No levels'}
Apply ALL sections including SECTION AMD.`;
      
      const content = [];
      if (p1NewsChart) content.push({ type: 'image', source: { type: 'base64', media_type: p1NewsChart.type, data: p1NewsChart.b64 } });
      if (p1PremarketChart) content.push({ type: 'image', source: { type: 'base64', media_type: p1PremarketChart.type, data: p1PremarketChart.b64 } });
      if (p1KeyLevelsChart) content.push({ type: 'image', source: { type: 'base64', media_type: p1KeyLevelsChart.type, data: p1KeyLevelsChart.b64 } });
      content.push({ type: 'text', text: textMsg });
      
      const DEEPSEEK_KEY = import.meta.env.VITE_DEEPSEEK_KEY || '';
      
      if (!DEEPSEEK_KEY) {
        setErr('No DeepSeek API key configured');
        setLoading(false);
        return;
      }
      
      const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_KEY}`
        },
        body: JSON.stringify({ 
          model: 'deepseek-chat', 
          max_tokens: 4000, 
          messages: [
            { role: 'system', content: PART1_PROMPT },
            { role: 'user', content: JSON.stringify(content) }
          ]
        })
      });
      
      const data = await res.json();
      const response = data.choices?.[0]?.message?.content || 'No response.';
      
      setP1Out(response);
      const amdMatch = response.match(/MACRO AMD PHASE:\s*([A-Z]+)/i);
      if (amdMatch && AMD_PHASES[amdMatch[1]]) {
        setCurrentAMD(amdMatch[1]);
      }
      
      setTimeout(() => p1Ref.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch(e) { 
      setErr('API error: ' + e.message); 
    }
    finally { 
      setLoading(false); 
    }
  };

  // Run Part 2
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
      const textContent = `PRE-ENTRY ANALYSIS + TRADE PLAN
=== PART 1 AMD CONTEXT ===
${p1Out ? p1Out.slice(0, 2500) + (p1Out.length > 2500 ? '\n[truncated]' : '') : 'No morning analysis.'}
Current AMD Phase (Part 1): ${currentAMD}

=== LIVE TRADE ===
Time (IST): ${f.timeIST || '?'} | Instrument: ${f.instrument} ($${ptVal}/pt)
Direction: ${f.direction} | Type: ${f.tradeType} | RRR: ${f.rrr}
Entry: ${f.entryPrice} | ATR: ${atrVal || '?'} | Max Risk: $${maxRiskUSD || 0}
ADX: ${extractedVals.adx || '?'} | CI: ${extractedVals.ci || '?'} | VWAP: ${extractedVals.vwap || '?'}
VWAP SD1: ${sd1Target?.toFixed(2) || '?'} | SD2: ${sd2Target?.toFixed(2) || '?'}
Volatility Regime: ${volatilityRegime}
Notes: ${f.notes || 'none'}

=== FIRM COMPLIANCE ===
Max Daily Loss: $${fr.maxDailyLoss || '?'} | Max Drawdown: $${fr.maxDrawdown || '?'}
Current Balance: $${curBal || '?'} | HWM: $${hwmVal || '?'}`;

      const content = [];
      if (mpChart) content.push({ type: 'image', source: { type: 'base64', media_type: mpChart.type, data: mpChart.b64 } });
      if (vwapChart) content.push({ type: 'image', source: { type: 'base64', media_type: vwapChart.type, data: vwapChart.b64 } });
      
      screenshots.forEach(s => content.push({ type: 'image', source: { type: 'base64', media_type: s.type, data: s.b64 } }));
      content.push({ type: 'text', text: textContent });

      const DEEPSEEK_KEY = import.meta.env.VITE_DEEPSEEK_KEY || '';
      
      if (!DEEPSEEK_KEY) {
        setErr('No DeepSeek API key configured');
        setLoading(false);
        return;
      }

      const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_KEY}`
        },
        body: JSON.stringify({ 
          model: 'deepseek-chat', 
          max_tokens: 4000, 
          messages: [
            { role: 'system', content: PART2_PROMPT },
            { role: 'user', content: JSON.stringify(content) }
          ]
        })
      });
      
      const data = await res.json();
      const response = data.choices?.[0]?.message?.content || 'No response.';
      
      setP2Out(response);
      setP2Jf({ exit: '', result: 'win', pnl: '', balAfter: '', lessons: '', amdPhase: currentAMD });
      
      setTimeout(() => p2Ref.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch { 
      setErr('API error.'); 
    } finally { 
      setLoading(false); 
    }
  };

  // Add trade from Part 2
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
      contracts: String(contracts), 
      pnl: p2Jf.pnl, 
      session: 'Trading Hours', 
      balAfter: p2Jf.balAfter, 
      setup: `${f.timeIST || '?'} IST | ${f.direction} @ ${f.entryPrice} | ${f.rrr}`, 
      lessons: p2Jf.lessons,
      id: `trade-${Date.now()}`
    };
    
    setJournal(prev => [...prev, entry]);
    
    if (p2Jf.balAfter) { 
      const upd = { ...accountState, currentBalance: p2Jf.balAfter }; 
      setAccountState(upd); 
      if (onSaveAccount) onSaveAccount(upd); 
    }
    
    setShowP2TradeForm(false); 
    setErr(''); 
    showToast?.('Trade vector recorded. Journal synchronized.', 'success');
  };

  // Add manual journal entry
  const addJournalEntry = () => {
    if (!jf.entry || !jf.exit) return;
    setJournal(prev => [...prev, { ...jf, id: `trade-${Date.now()}` }]);
    setJf(p => ({ ...p, entry: '', exit: '', pnl: '', setup: '', lessons: '', balAfter: '' }));
  };

  // Get name for greeting
  const getGreetingName = () => {
    return profile?.fullName || profile?.email || "Officer";
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: CSS_VARS.bg, 
      color: CSS_VARS.text, 
      fontFamily: T.font,
      display: "flex",
      flexDirection: "column",
      width: "100%"
    }}>
      
      {/* Header */}
      <div style={{ 
        background: CSS_VARS.surface, 
        borderBottom: `1px solid #E5E7EB`, 
        padding: "16px 32px", 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "space-between", 
        flexWrap: "wrap", 
        gap: 16,
        boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", gap: 4, alignItems: "flex-end" }}>
            {[10, 16, 12, 22, 14, 20, 11].map((h, i) => (
              <div key={i} style={{ width: 4, height: h, background: `hsl(${150 + i * 15},80%,60%)`, borderRadius: 2 }} />
            ))}
          </div>
          <div>
            <div style={{ color: T.text, fontSize: 16, letterSpacing: 4, fontWeight: 800 }}>
              Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {getGreetingName()}
            </div>
            <div style={{ color: T.muted, fontSize: 10, letterSpacing: 2, marginTop: 4, fontWeight: 600 }}>
              INSTITUTIONAL TERMINAL · v9
            </div>
          </div>
          
          {fr.parsed && <Tag label={fr.firmName} color={T.purple} />}
          <AMDPhaseTag phase={currentAMD} />
          {throttleActive && <Tag label="⚠ DRAWDOWN THROTTLE" color={T.gold} />}
        </div>
        
        <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
          <span style={{ color: T.text, fontSize: 12, fontWeight: 600 }}>
            {profile?.fullName || profile?.email}
          </span>
          
          <button onClick={onLogout} style={{ 
            background: "transparent", 
            border: "none", 
            padding: "4px 8px", 
            cursor: "pointer", 
            color: T.muted, 
            fontSize: 11, 
            fontFamily: T.font, 
            letterSpacing: 1, 
            fontWeight: 600 
          }}>
            LOGOUT
          </button>
        </div>
      </div>

      <CountdownBanner ist={ist} />

      {/* Navigation Tabs */}
      <div style={{ 
        background: CSS_VARS.surface, 
        borderBottom: `1px solid #E5E7EB`, 
        padding: "0 32px", 
        display: "flex", 
        gap: 0,
        overflowX: "auto",
        boxShadow: "none"
      }}>
        {[
          { id: 'premarket', label: 'PREMARKET', sub: 'AMD · Macro · Fuel', color: T.blue }, 
          { id: 'trade', label: 'TRADE ENTRY', sub: 'AMD-Exec · Compliance', color: T.orange }, 
          { id: 'journal', label: 'JOURNAL', sub: 'AMD Stats · P&L', color: T.purple }, 
          { id: 'account', label: 'ACCOUNT', sub: 'T&C · Drawdown · Rules', color: T.green }
        ].map(p => (
          <button 
            key={p.id} 
            onClick={() => { setActiveTab(p.id); setErr(''); }} 
            style={{ 
              background: "transparent", 
              border: "none", 
              fontFamily: T.font, 
              borderBottom: activeTab === p.id ? `3px solid ${p.color}` : "3px solid transparent", 
              padding: "16px 24px", 
              cursor: "pointer", 
              marginBottom: -1, 
              textAlign: "left", 
              whiteSpace: "nowrap" 
            }} 
            className="btn-glass"
          >
            <div style={{ color: activeTab === p.id ? p.color : CSS_VARS.textSecondary, fontSize: 12, letterSpacing: 1.5, fontWeight: 800 }}>
              {p.label}
            </div>
            <div style={{ color: activeTab === p.id ? p.color : CSS_VARS.textSecondary, fontSize: 10, marginTop: 4, fontWeight: 500 }}>
              {p.sub}
            </div>
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 1440, margin: "0 auto", padding: "24px 32px", width: "100%", boxSizing: "border-box" }}>
        
        {/* Drawdown Throttle Banner */}
        {throttleActive && (
          <div style={{
            padding: "14px 20px",
            background: "rgba(255,214,10,0.12)",
            border: `2px solid ${T.gold}`,
            borderRadius: 8,
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}>
            <span style={{ fontSize: 20 }}>⚠</span>
            <div>
              <div style={{ color: T.gold, fontSize: 13, fontWeight: 800, letterSpacing: 1 }}>DRAWDOWN THROTTLE ACTIVE: RISK HALVED TO PROTECT CAPITAL</div>
              <div style={{ color: "#A0781A", fontSize: 11, marginTop: 3 }}>Distance to liquidation within 25% of max drawdown. Size reduced to {activeRiskPct}%.</div>
            </div>
          </div>
        )}

        {/* TAB 1: PREMARKET */}
        {activeTab === 'premarket' && (
          <div>
            {/* CSV Upload */}
            <div style={cardS()}>
              <SHead icon="⊞" title="LOAD NINJATRADER 1-MIN DATA" color={T.blue}/>
              <div 
                onDrop={handleCsvDrop} 
                onDragOver={e=>e.preventDefault()} 
                onClick={()=>document.getElementById('csvIn').click()} 
                style={{
                  border:`2px dashed ${parseMsg.startsWith('✓')?T.green:"#E5E7EB"}`,
                  borderRadius:8,
                  padding:"24px",
                  textAlign:"center",
                  cursor:"pointer",
                  background:"#F9FAFB"
                }}
              >
                <input id="csvIn" type="file" accept=".txt,.csv" style={{display:"none"}} onChange={handleCsvDrop}/>
                <div style={{fontSize:24,marginBottom:6,opacity:0.25}}>⊞</div>
                <div style={{color:parseMsg.startsWith('✓')?T.green:"#6B7280",fontSize:12,fontWeight:600}}>{parseMsg||"Drop NinjaTrader .txt / .csv — or click to browse"}</div>
                {parsed && <div style={{color:"#9CA3AF",fontSize:11,marginTop:4}}>Latest: {parsed.days[0]?.date} · ATR(14) = <span style={{color:T.green,fontWeight:700}}>{parsed.tradingHoursAtr14} pts</span></div>}
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
                    <div 
                      onDrop={makeImgHandler(zone.setter)} 
                      onDragOver={e=>e.preventDefault()} 
                      onClick={e=>{e.stopPropagation();document.getElementById(zone.inputId).click();}} 
                      style={{
                        border:`2px dashed ${zone.state?zone.color:"#E5E7EB"}`,
                        borderRadius:6,
                        padding:"12px",
                        textAlign:"center",
                        cursor:"pointer",
                        background:"#F9FAFB",
                        minHeight:64
                      }}
                    >
                      <input id={zone.inputId} type="file" accept="image/*" style={{display:"none"}} onChange={makeImgHandler(zone.setter)}/>
                      {zone.state
                        ?<div><img src={`data:${zone.state.type};base64,${zone.state.b64}`} style={{maxWidth:"100%",maxHeight:56,borderRadius:3,objectFit:"contain",marginBottom:4}}/><button onClick={e=>{e.stopPropagation();zone.setter(null);}} style={{background:"rgba(255,69,58,0.1)",border:`1px solid rgba(255,69,58,0.4)`,borderRadius:4,padding:"2px 8px",cursor:"pointer",color:T.red,fontSize:9,fontFamily:T.font}}>✕ Remove</button></div>
                        :<div><div style={{color:"#9CA3AF",fontSize:11,marginBottom:2}}>Click → Ctrl+V or drag</div><div style={{color:"#D1D5DB",fontSize:9}}>{zone.hint}</div></div>}
                    </div>
                  </div>
                </PasteZone>
              ))}
            </div>

            {err && <div style={{color:T.red,fontSize:12,marginBottom:12,fontWeight:600}}>⚠ {err}</div>}
            <button onClick={runPart1} disabled={loading||!parsed||parsed.totalDays<5} style={glowBtn(T.green,loading||!parsed||parsed.totalDays<5)} className="btn-glass">
              ▶ RUN AMD PREMARKET ANALYSIS
            </button>

            <div ref={p1Ref} style={{marginTop:20}}>
              {loading && <Loader color={T.green} label="COLLECTIVE BRAIN PROCESSING AMD PHASES..."/>}
              {!loading && p1Out && (
                <div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}><Tag label="ANALYSIS COMPLETE" color={T.green}/><AMDPhaseTag phase={currentAMD}/></div>
                    <div style={{display:"flex",gap:8}}>
                      <button onClick={()=>{setActiveTab('trade');setErr('');}} style={glowBtn(T.orange,false)} className="btn-glass">→ TRADE ENTRY</button>
                      <button onClick={()=>navigator.clipboard?.writeText(p1Out)} style={{background:"transparent",border:`1px solid #E5E7EB`,borderRadius:6,padding:"8px 12px",cursor:"pointer",color:"#6B7280",fontSize:10,fontFamily:T.font}}>⎘ COPY</button>
                    </div>
                  </div>
                  <div style={cardS({borderLeft:`4px solid ${T.blue}`})} className="glass-panel"><RenderOut text={p1Out}/></div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: TRADE ENTRY */}
        {activeTab === 'trade' && (
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

            {/* Live extracted values */}
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

            {/* Volatility Regime */}
            <div style={{ padding: "12px 20px", background: "rgba(0,0,0,0.5)", border: `1px solid ${T.blue}40`, borderRadius: 8, marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }} className="glass-panel">
              <span style={{ color: T.dim, fontSize: 10, letterSpacing: 1, fontWeight: 700 }}>VOLATILITY REGIME:</span>
              <span style={{ color: volatilityRegime === 'Compression' ? T.red : volatilityRegime === 'Expansion' ? T.green : T.blue, fontSize: 14, fontWeight: 800 }}>{volatilityRegime}</span>
              <span style={{ color: T.muted, fontSize: 12, fontFamily: T.mono, fontWeight: 600 }}>(VR = {VR.toFixed(2)})</span>
            </div>

            {/* Trade Setup */}
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

            {/* Entry Price */}
            <div style={cardS()}>
              <label style={lbl}>ENTRY PRICE</label>
              <input 
                type="number" 
                value={f.entryPrice} 
                onChange={e => sf('entryPrice')(e.target.value)} 
                placeholder="exact entry level" 
                style={inp} 
                className="input-glass" 
              />
            </div>

            {/* Image Upload Zones */}
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
                      <div 
                        onDrop={onScreenshotDrop} 
                        onDragOver={e => e.preventDefault()} 
                        onClick={e => { e.stopPropagation(); document.getElementById('ssIn').click(); }} 
                        style={{ 
                          border: `2px dashed ${screenshots.length ? T.purple : "rgba(255,255,255,0.15)"}`, 
                          borderRadius: 8, 
                          padding: "16px", 
                          textAlign: "center", 
                          cursor: "pointer", 
                          background: "rgba(0,0,0,0.3)" 
                        }} 
                        className="glass-panel"
                      >
                        <input id="ssIn" type="file" accept="image/*" multiple style={{ display: "none" }} onChange={onScreenshotDrop} />
                        {screenshots.length > 0 ? (
                          <div>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginBottom: 8 }}>
                              {screenshots.map((s, i) => (
                                <div key={i} style={{ position: "relative", width: 60, height: 40, borderRadius: 4, overflow: "hidden", border: `1px solid ${T.purple}60` }}>
                                  <img src={`data:${s.type};base64,${s.b64}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                  <button 
                                    onClick={e => { e.stopPropagation(); setScreenshots(p => p.filter((_, idx) => idx !== i)); }} 
                                    style={{ position: "absolute", top: 0, right: 0, background: "rgba(0,0,0,0.8)", border: "none", width: 16, height: 16, cursor: "pointer", color: "#fff", fontSize: 10, padding: 0 }}
                                  >
                                    ✕
                                  </button>
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
                      <div 
                        onDrop={makeImgHandler(zone.setter)} 
                        onDragOver={e => e.preventDefault()} 
                        onClick={e => { e.stopPropagation(); document.getElementById(zone.inputId).click(); }} 
                        style={{ 
                          border: `2px dashed ${zone.state ? zone.color : "rgba(255,255,255,0.15)"}`, 
                          borderRadius: 8, 
                          padding: "16px", 
                          textAlign: "center", 
                          cursor: "pointer", 
                          background: "rgba(0,0,0,0.3)" 
                        }} 
                        className="glass-panel"
                      >
                        <input id={zone.inputId} type="file" accept="image/*" style={{ display: "none" }} onChange={makeImgHandler(zone.setter)} />
                        {zone.state ? (
                          <div>
                            <img src={`data:${zone.state.type};base64,${zone.state.b64}`} style={{ maxWidth: "100%", maxHeight: 60, borderRadius: 4, objectFit: "contain", marginBottom: 8, cursor: "crosshair" }} />
                            <button 
                              onClick={e => { e.stopPropagation(); zone.setter(null); }} 
                              style={{ display: "block", margin: "0 auto", background: "rgba(255,69,58,0.1)", border: `1px solid rgba(255,69,58,0.4)`, borderRadius: 4, padding: "4px 12px", cursor: "pointer", color: T.red, fontSize: 10, fontFamily: T.font, fontWeight: 700 }}
                            >
                              ✕
                            </button>
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

            {/* AI Extract Button */}
            <div style={{ display: "flex", alignItems: "center", gap: 16, margin: "16px 0", padding: "12px 20px", background: "#FFFFFF", border: `1px solid #E5E7EB`, borderRadius: 8, boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)" }} className="glass-panel">
              <button onClick={extractFromScreenshots} disabled={extracting || screenshots.length === 0} style={glowBtn(T.purple, extracting || !screenshots.length)} className="btn-glass">
                {extracting ? "⟳ READING..." : "◉ EXTRACT INDICATORS"}
              </button>
              <span style={{color:T.muted,fontSize:10,flex:1,fontWeight:500}}>{extractStatus || "Extracts ADX · CI · ATR for Dead Zone check"}</span>
            </div>

            {/* Notes */}
            <div style={cardS()}>
              <label style={lbl}>NOTES</label>
              <textarea 
                value={f.notes} 
                onChange={e => sf('notes')(e.target.value)} 
                style={{ ...inp, minHeight: 60, resize: "vertical" }} 
                className="input-glass" 
              />
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
                    {[8, 15, 10, 20, 12, 17, 9].map((h, i) => (
                      <div key={i} style={{ width: 4, height: h, background: T.orange, borderRadius: 2, animation: `bar ${0.85 + i * 0.05}s ${i * 0.1}s ease-in-out infinite alternate` }} />
                    ))}
                  </div>
                  <span style={{ color: T.muted, fontSize: 12, letterSpacing: 2, fontWeight: 600 }}>RECURSIVE CONSENSUS ENGINE</span>
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

        {/* TAB 3: JOURNAL */}
        {activeTab === 'journal' && (
          <div>
            {/* Performance Dashboard */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 20 }}>
              {[
                { l: "TOTAL P&L", v: `${metrics.pnlTotal >= 0 ? "+" : ""}$${metrics.pnlTotal.toFixed(2)}`, c: metrics.pnlTotal >= 0 ? T.green : T.red }, 
                { l: "WIN RATE", v: `${metrics.wr.toFixed(1)}%`, c: metrics.wr >= 50 ? T.green : T.red }, 
                { l: "PROFIT FACTOR", v: metrics.pf ? metrics.pf.toFixed(2) : "—", c: metrics.pf && metrics.pf >= 1.5 ? T.green : metrics.pf && metrics.pf >= 1 ? T.gold : T.red }
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
            
            {showForm && (
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
                          <th key={i} style={{ padding: "14px 16px", textAlign: "left", color: "#6B7280", fontSize: 10, letterSpacing: 1.5, fontFamily: T.font, fontWeight: 700, whiteSpace: "nowrap", background: "#F9FAFB" }}>{h}</th>
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
                              >
                                ✕
                              </button>
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
        )}

        {/* TAB 4: ACCOUNT */}
        {activeTab === 'account' && (
          <div>
            <div style={cardS({ borderLeft: `4px solid ${T.blue}` })} className="glass-panel card-tilt">
              <SHead icon="💰" title="LIVE ACCOUNT STATE" color={T.blue} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 16 }}>
                <Field label="STARTING BALANCE ($)" value={accountState.startingBalance} onChange={v => setAccountState(p => ({...p, startingBalance: v}))} type="number" mono />
                <Field label="CURRENT BALANCE ($)" value={accountState.currentBalance} onChange={v => setAccountState(p => ({...p, currentBalance: v}))} type="number" mono />
                <Field label="HIGH-WATER MARK ($)" value={accountState.highWaterMark} onChange={v => setAccountState(p => ({...p, highWaterMark: v}))} type="number" mono />
                <Field label="TODAY START BALANCE ($)" value={accountState.dailyStartBalance} onChange={v => setAccountState(p => ({...p, dailyStartBalance: v}))} type="number" mono />
              </div>
              <button 
                onClick={() => { if (onSaveAccount) onSaveAccount(accountState); showToast('Account state persisted to distributed ledger.', 'success'); }} 
                style={glowBtn(T.blue, false)} 
                className="btn-glass"
              >
                💾 SAVE TO CLOUD
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
