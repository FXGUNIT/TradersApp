/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════════
 * EULA — RISK DISCLOSURE SECTION
 * ═══════════════════════════════════════════════════════════════════════════════════════════════
 *
 * Component: EULARiskSection
 * Purpose: Risk Disclosure legal text — Tab 2 of RegimentEULA
 * Regulation Compliance: CFTC, SEC, DFSA
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════════
 */

import React from 'react';

const EULARiskSection = React.forwardRef(({ content, styleProps }, ref) => {
  return (
    <div
      ref={ref}
      data-eula-section="risk"
      style={{
        height: styleProps?.height ?? '400px',
        overflowY: 'scroll',
        padding: '24px',
        background: '#F8FAFC',
        border: '1px solid #CBD5E1',
        color: '#475569',
        fontSize: '10px',
        lineHeight: 1.6,
        textAlign: 'justify',
        borderRadius: 8,
        fontFamily: '"Courier New", monospace',
        whiteSpace: 'pre-wrap',
        wordWrap: 'break-word',
        ...styleProps,
      }}
    >
      {content}
    </div>
  );
});

EULARiskSection.displayName = 'EULARiskSection';

export default EULARiskSection;

export const RISK_DISCLOSURE_CONTENT = \`
═══════════════════════════════════════════════════════════════════════════════════════════════

6.1 Micro E-mini Futures Risk Acknowledgment. The Licensee hereby explicitly, solemnly, and 
irrevocably acknowledges that trading Micro E-mini Futures Contracts (MNQ, MES) carries 
extraordinary, extreme, and potentially unlimited financial risk. These instruments possess the 
following characteristics:

  (a) Extreme Leverage: Micro E-mini contracts provide leverage ratios of approximately 50:1 to 
  100:1, meaning that a 1% adverse price movement can result in a 50-100% loss of deposited 
  capital.

  (b) Total Capital Loss: It is entirely possible, probable, and foreseeable that the Licensee 
  will lose 100% of all capital deposited with the Platform within a single trading session, a 
  single trading day, or within the first trading week.

  (c) Gap Risk & Gaps Against Position: Given the discontinuous nature of futures markets, 
  overnight gaps, weekend gaps, and holiday gaps may cause the Licensee's stop-loss orders to 
  be executed at prices materially worse than intended. In extreme circumstances, the Licensee 
  may suffer losses exceeding 200-300% of deposited capital.

  (d) Flash Crashes & Algorithmic Volatility: The Licensee acknowledges that algorithmic 
  trading, high-frequency trading, and automated market-making activities can cause sudden, 
  extreme price movements lasting seconds to minutes. Such movements may liquidate the 
  Licensee's position at ruinous prices.

  (e) Overnight Risk: If the Licensee holds any position overnight, the Licensee assumes all 
  risk of adverse price movements occurring during non-trading hours, including but not limited 
  to economic data releases, geopolitical events, corporate announcements, and regulatory 
  actions.

  (f) Psychological Impairment: The Licensee acknowledges that trading leveraged instruments 
  induces psychological stress, fear, greed, overconfidence, and impaired judgment. Such 
  psychological impairment frequently leads to catastrophic trading decisions and total capital 
  loss.

6.2 Unconditional Release & Waiver of Liability. In exchange for access to the Platform, the 
Licensee hereby releases, forever waives, and holds harmless the Licensor, its founders, 
officers, directors, shareholders, employees, agents, subsidiaries, affiliates, assigns, and 
successors from any and all claims, demands, damages, losses, liabilities, costs, and expenses 
arising from or related to:

  (a) Any loss of capital, whether partial or total, resulting from trading activity on the 
  Platform;

  (b) Any liquidation of positions at unfavorable prices, implemented by the Licensor or by 
  automatic mechanisms;

  (c) Any execution failures, technology failures, system downtime, or network connectivity 
  disruptions;

  (d) Any failure of orders to execute as intended, any phantom fills, any erroneous fills, or 
  any orders executed at prices materially different from the price at which the Licensee 
  intended to execute;

  (e) Any data corruption, database failures, clearing failures, or settlement failures;

  (f) Any regulatory intervention, market closure, exchange suspension, or force majeure event;

  (g) Any algorithmic malfunction, artificial intelligence error, machine learning model 
  failure, or software bug;

  (h) Any security breach, unauthorized access, hacking, phishing attack, credential theft, or 
  compromise of the Licensee's account;

  (i) Any false, inaccurate, or outdated market data, quotes, or pricing information;

  (j) Any trading losses resulting from the Licensee's own decisions, research, strategies, or 
  reliance on third-party information;

  (k) Any tax obligations, tax liabilities, or tax penalties resulting from trading activity or 
  withdrawal of capital;

  (l) Any personal injury, psychological harm, emotional distress, or financial ruin resulting 
  from the Licensee's trading activity;

  (m) Any loss of employment, loss of relationships, family dissolution, or personal 
  catastrophe triggered by trading losses;

  (n) Any legal claims asserted against the Licensee by creditors, family members, or other 
  parties as a result of trading losses;

  (o) Any allegations of fraud, market manipulation, insider trading, or regulatory violations 
  committed by the Licensee.

6.3 Sole Responsibility of the Licensee. The Licensee assumes complete, exclusive, and sole 
responsibility for all trading decisions, capital allocation decisions, and risk management 
decisions made on the Platform. The Licensee further assumes sole responsibility for 
understanding the risks enumerated in this Agreement and any additional risks not enumerated 
herein.

6.4 No Fiduciary Duty. Despite any language in the Platform suggesting advisory services, 
algorithmic assistance, or trading recommendations, the Licensor adopts no fiduciary duty 
toward the Licensee. The Licensor does not act as an advisor, agent, or representative of the 
Licensee. All trading activity is conducted solely at the Licensee's own risk and sole direction.

6.5 Indemnification. The Licensee shall indemnify, defend, and hold harmless the Licensor 
against any third-party claims, damages, or liabilities arising from the Licensee's use of the 
Platform, including but not limited to claims by creditors, spouses, dependents, or government 
agencies.

═══════════════════════════════════════════════════════════════════════════════════════════════
SECTION VII: INTELLECTUAL PROPERTY OWNERSHIP & RESTRICTIONS
═══════════════════════════════════════════════════════════════════════════════════════════════

7.1 Licensor Ownership. All intellectual property embedded in or transmitted through the 
Platform, including algorithms, source code, machine learning models, graphical interfaces, 
documentation, and trademarks, is the exclusive property of the Licensor. The Licensee acquires 
no ownership right, title, or interest in such intellectual property.

7.2 Restrictions on Modification. The Licensee shall not modify, adapt, alter, translate, or 
create derivative works based on any component of the Platform.

═══════════════════════════════════════════════════════════════════════════════════════════════
SECTION VIII: LIMITATION OF LIABILITY & DISCLAIMER OF WARRANTIES
═══════════════════════════════════════════════════════════════════════════════════════════════

8.1 Disclaimer of Warranties. THE PLATFORM IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT 
WARRANTY OF ANY KIND. THE LICENSOR MAKES NO WARRANTY, EXPRESS OR IMPLIED, INCLUDING BUT NOT 
LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, OR 
NONINFRINGEMENT.

8.2 Limitation of Liability. IN NO EVENT SHALL THE LICENSOR BE LIABLE FOR ANY DIRECT, 
INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED 
TO LOSS OF PROFITS, LOST REVENUE, LOST DATA, OR BUSINESS INTERRUPTION, EVEN IF THE LICENSOR 
HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.

═══════════════════════════════════════════════════════════════════════════════════════════════
SECTION IX: TERM & TERMINATION
═══════════════════════════════════════════════════════════════════════════════════════════════

9.1 Term. This Agreement commences upon the Licensee's acceptance and continues in perpetuity 
until terminated by the Licensor.

9.2 Termination. The Licensor may terminate this Agreement at any time without notice or cause. 
Upon termination, all rights granted to the Licensee immediately cease.

9.3 Survival. All provisions of this Agreement that by their nature are intended to survive 
termination, including but not limited to indemnification, limitation of liability, and 
assumption of risk, shall survive termination.

═══════════════════════════════════════════════════════════════════════════════════════════════
SECTION VII: INTELLECTUAL PROPERTY OWNERSHIP & RESTRICTIONS
═══════════════════════════════════════════════════════════════════════════════════════════════

7.1 Licensor Ownership. All intellectual property embedded in or transmitted through the 
Platform, including algorithms, source code, machine learning models, graphical interfaces, 
documentation, trademarks, and proprietary trading methodologies, is the exclusive property of 
the Licensor, its corporate entities, subsidiaries, and affiliated enterprises. The Licensee 
acquires no ownership right, title, or interest whatsoever in such intellectual property, whether 
direct, indirect, implied, or arising from estoppel, custom, or industry practice. All such 
intellectual property shall remain vested absolutely and in perpetuity with the Licensor and its 
successors, assigns, and affiliated entities.

7.2 Restrictions on Modification. The Licensee shall not, under any circumstance or pretext, 
modify, adapt, alter, translate, create derivative works, prepare modifications, enhance, 
upgrade, supplement, amend, or otherwise manipulate any component of the Platform's source code, 
algorithms, user interface, documentation, or underlying infrastructure. The Licensee further 
covenants not to attempt to circumvent, bypass, disable, or interfere with any technological 
protection measures, access controls, licensing restrictions, digital rights management systems, 
or security features embedded within or protecting the Platform.

7.3 Reverse Engineering Prohibition. The Licensee absolutely prohibits itself from engaging in 
any form of reverse engineering, decompilation, disassembly, source code derivation, algorithm 
extraction, machine learning model theft, or other engineering activity designed to uncover, 
understand, replicate, or commercialize the underlying logic, technical architecture, or 
proprietary methodologies of the Platform. Any attempt to reverse engineer shall constitute a 
material breach entitling the Licensor to immediate injunctive relief, damages, and punitive 
penalties without limitation.

7.4 Trademark & Brand Protection. The Licensee acknowledges that "Traders Regiment," the 
Regiment logo, "Command Terminal," "Department of Institutional Artillery," and all associated 
trademarks, service marks, trade names, and brand designations are the exclusive intellectual 
property of the Licensor. The Licensee shall not use, display, register, or claim any rights to 
these trademarks or brand elements without explicit prior written consent from an authorized 
officer of the Licensor.

7.5 Feedback & Suggestions Ownership. Any feedback, suggestions, comments, criticism, ideas, 
improvements, or recommendations provided by the Licensee regarding the Platform shall be deemed 
the exclusive property of the Licensor without any obligation to provide compensation, 
attribution, or further consideration to the Licensee. The Licensor may use any such feedback in 
any manner whatsoever without restriction or notice.

═══════════════════════════════════════════════════════════════════════════════════════════════
\`;
