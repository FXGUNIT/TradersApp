# Board Room Rules — ALL Agents Must Follow

**Source:** `sorted-wishing-nebula.md` Phase 7 / ML9-D
**Non-negotiable.** Every AI agent working on this codebase is bound by these rules.
The Board Room has final say on trading decisions. No agent may contradict, override,
or circumvent the Board Room's output.

---

## The 5 Board Members

| Member | Role | Veto Power | Veto Conditions |
|--------|------|------------|-----------------|
| Tech_IB | IB/VA geometry analysis | No | `dead_chop`, `atr_low` |
| Tech_Candle | Candle pattern recognition | No | `wick_noise`, `no_confirm` |
| RegimeWatcher | Market regime detection | **YES** | `CRISIS`, `CONTAGION` |
| OptionsDesk | IV regime + premium health | **YES** | `EXPIRY`, `LOW_IV` |
| RiskOfficer | Hard risk limits | **YES** | `DAILY_STOP` (2 losses), `MAX_POSITIONS` (1 open) |

**RiskOfficer always has final word.** If RiskOfficer vetoes, the signal is always NEUTRAL.

---

## Consensus Rule

- 3 out of 5 members must agree → proceed with trade
- Any single veto → signal becomes NEUTRAL (no trade)
- Agents self-rank by accuracy over time — accurate agents carry more voting weight

---

## Veto Conditions (Codified)

### RiskOfficer Vetoes — ALWAYS respect
```
if losses_today >= 2 → VETO (daily stop hit)
if positions_open >= 1 → VETO (max 1 position)
```
No code, prompt, or agent may disable or bypass these conditions.

### RegimeWatcher Vetoes
```
if regime == "CRISIS" → VETO
if regime == "CONTAGION" → VETO
```
Do not generate, test, or discuss strategies intended for CRISIS or CONTAGION regimes.

### OptionsDesk Vetoes
```
if is_expiry_day == True → VETO
if iv_regime == "LOW" → VETO (premiums too thin)
```
No options trades on Nifty expiry days. Ever.

### Tech_IB / Tech_Candle Vetoes
```
if dead_chop == True → VETO (ATR < ATR_avg × 0.5)
if wick_alone == True → VETO (wick = noise, close = truth)
```
The "wick = noise, close = truth" rule is absolute. Never treat a wick-only candle as an entry signal.

---

## What the Board Cannot Override

The Board Room governs **trading decisions only**. It does NOT govern:
- Infrastructure decisions (deploy, DNS, CI/CD)
- UI/UX design choices
- Non-trading ML tasks (research, training, data pipelines)
- Code quality or architecture decisions

---

## When Implementing Any Trading Logic

Every time you modify, create, or review code related to:
- `ml-engine/inference/predictor.py`
- `ml-engine/inference/consensus_aggregator.py`
- `ml-engine/models/setup/`
- `ml-engine/_routes_pso.py`
- Any component that outputs a trading signal

You MUST:
1. Include the Board Room deliberation result in the consensus response
2. Check veto conditions BEFORE allowing a signal through
3. Log the board vote and veto status to the signal record
4. Never output a LONG/SHORT signal if any veto is active

---

## Anti-Patterns Specific to Board Room

- [ ] Never bypass the Board Room to issue a trading signal directly
- [ ] Never hardcode a LONG/SHORT signal without going through `DeliberativeBoardRoom.deliberate()`
- [ ] Never disable RiskOfficer veto conditions for "testing" or "speed"
- [ ] Never treat a candle wick as a valid entry signal
- [ ] Never allow a new trading signal type without Board Room deliberation
- [ ] Never persist or log a signal that the Board has overridden

---

## Board Room Telemetry

The Board Room POSTs to the BFF after every deliberation and outcome.
If implementing Board Room changes:
- Ensure `board_room_telemetry.py` POSTs deliberation results
- Ensure `board_room_telemetry.py` POSTs trade outcomes
- Heartbeat continues at 90-minute intervals
