/**
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * REGIMENT MASTER EULA & GLOBAL COMPLIANCE GATE
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * 
 * Component: RegimentEULA
 * Purpose: Comprehensive Terms of Service acceptance wall with scroll-to-unlock mechanism
 * Regulation Compliance: SEC, CFTC, DFSA, SCA, SEBI, GDPR
 * Legal Threshold: 8000+ words of institutional boilerplate
 * 
 * ═══════════════════════════════════════════════════════════════════════════════════════
 */

import React, { useState, useRef } from 'react';

const RegimentEULA = ({ onAccept, onReject }) => {
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedRisks, setAgreedRisks] = useState(false);
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);
  const eulaRef = useRef(null);

  // Detect when user scrolls to bottom of EULA container
  const handleScroll = (e) => {
    const element = e.target;
    const isAtBottom = element.scrollHeight - element.scrollTop < element.clientHeight + 10;
    setScrolledToBottom(isAtBottom);
  };

  const isDeploymentEnabled = scrolledToBottom && agreedTerms && agreedRisks && agreedPrivacy;

  const eulaContent = `
╔════════════════════════════════════════════════════════════════════════════════════════════════╗
║                    REGIMENT MASTER END USER LICENSE AGREEMENT                                 ║
║                         & GLOBAL COMPLIANCE COVENANT                                          ║
║                           MULTI-JURISDICTIONAL EDITION                                        ║
╚════════════════════════════════════════════════════════════════════════════════════════════════╝

EFFECTIVE DATE: March 18, 2026
VERSION: 1.0 (Master Edition)
JURISDICTION: Multi-National Compliance Framework

═══════════════════════════════════════════════════════════════════════════════════════════════
PREAMBLE & BINDING CONTRACT FORMATION
═══════════════════════════════════════════════════════════════════════════════════════════════

WHEREAS, the Licensor, known hereinafter as "the Regiment" or "the Commander-in-Chief," 
operates the Traders Regiment Command Terminal platform (hereinafter "the Platform" or "the 
Application"), a sophisticated, distributed financial intelligence and capital deployment system; 
and

WHEREAS, the User, identified hereinafter as "Officer," "Licensee," or "End User," desires 
access to the aforementioned Platform for the purposes of executing leveraged equities trading, 
derivatives speculation, and algorithmic capital allocation strategies; and

WHEREAS, both parties acknowledge and mutually affirm that the Platform operates within a 
highly regulated, jurisdictionally complex ecosystem encompassing United States federal 
securities law, United Arab Emirates financial services regulation, and Republic of India 
securities legislation;

NOW, THEREFORE, in consideration of mutual covenants and the Platform's grant of access, the 
Licensor and Licensee hereby enter into this irrevocable, perpetual, and binding Master End User 
License Agreement (hereinafter "the Agreement"), the terms and conditions of which shall govern 
all subsequent utilization, access, deployment, settlement, and engagement with the Platform 
in perpetuity.

═══════════════════════════════════════════════════════════════════════════════════════════════
SECTION I: DEFINITIONS & INTERPRETIVE FRAMEWORK
═══════════════════════════════════════════════════════════════════════════════════════════════

1.1 "Platform" shall mean the Traders Regiment Command Terminal, including but not limited to 
all associated software applications, algorithms, proprietary trading systems, backend 
infrastructure, databases, APIs, dashboards, reporting systems, and any graphical user 
interfaces or application programming interfaces made available to the Licensee by the 
Licensor.

1.2 "Licensee" or "Officer" shall mean any natural person, legal entity, registered investment 
fund, or institutional participant who has successfully authenticated with the Platform and 
holds valid credentials granting access to the Application's core functionalities.

1.3 "Deployment" shall mean the initiation of any trade execution, order placement, capital 
allocation directive, or algorithmic strategy launch within the Platform's trading execution 
environment.

1.4 "Capital" shall mean any monetary unit, including but not limited to United States Dollars 
(USD), British Pounds Sterling (GBP), Euro (EUR), United Arab Emirates Dirham (AED), or Indian 
Rupees (INR) deposited, controlled, or subject to the Licensee's instructions within the 
Platform's internal ledger systems.

1.5 "Instruments" shall mean financial derivatives, including but not limited to Micro E-mini 
Futures contracts (MNQ, MES), options contracts, index swaps, foreign currency forwards, and 
any other leveraged financial product accessible through the Platform.

1.6 "Force Majeure Event" shall mean any extraordinary occurrence beyond the reasonable control 
of either party, including but not limited to: acts of God, pandemic, epidemic, war, riot, 
insurrection, civil unrest, government embargo, natural disaster, cyber attack, exchange 
closure, depeg events, smart contract exploits, or systemic financial market collapse.

1.7 "Regulatory Authority" shall mean any federal, state, provincial, or international agency 
or body exercising supervisory authority over financial markets, including but not limited to: 
the United States Securities and Exchange Commission (SEC), the Commodity Futures Trading 
Commission (CFTC), the Federal Reserve System, the Consumer Financial Protection Bureau (CFPB), 
the Abu Dhabi Global Market (ADGM), the Dubai Financial Services Authority (DFSA), the 
Securities and Commodities Authority (SCA) of the United Arab Emirates, and the Securities and 
Exchange Board of India (SEBI).

═══════════════════════════════════════════════════════════════════════════════════════════════
SECTION II: GRANT OF LICENSE & LIMITATIONS ON USE
═══════════════════════════════════════════════════════════════════════════════════════════════

2.1 Grant of License. The Licensor hereby grants to the Licensee a revocable, non-exclusive, 
non-transferable, limited license to access and utilize the Platform solely for the personal, 
non-commercial execution of trading activities. This license does not constitute ownership of 
any intellectual property, proprietary algorithm, source code, or algorithmic model embedded 
within the Platform. All such intellectual property remains the exclusive possession of the 
Licensor, its corporate affiliates, and its shareholders in perpetuity.

2.2 Revocation of License. Notwithstanding the foregoing, the Licensor reserves the absolute 
and unilateral right to revoke, suspend, or terminate access to the Platform at any time, for 
any reason or for no stated reason whatsoever, without prior written notice or opportunity for 
the Licensee to cure any alleged deficiency. The Licensor may terminate this Agreement 
instantaneously upon notice of any breach, suspected breach, or suspected future breach of any 
provision herein.

2.3 Restrictions on License. The Licensee expressly agrees to the following prohibitions and 
restrictions:

  (a) The Licensee shall not reverse engineer, decompile, disassemble, or otherwise attempt to 
  derive the source code, algorithm, machine learning models, or proprietary trading logic of 
  the Platform;

  (b) The Licensee shall not engage in any automated scraping, data mining, API abuse, or 
  extraction of market data, including historical pricing information, order flow dynamics, or 
  liquidity data;

  (c) The Licensee shall not share login credentials, API keys, or authentication tokens with 
  any third party, nor shall the Licensee permit any unauthorized individual to access the 
  Platform through the Licensee's account;

  (d) The Licensee shall not utilize the Platform for the execution of any unlawful activity, 
  money laundering, terrorist financing, sanctions evasion, or any activity prohibited by any 
  Regulatory Authority;

  (e) The Licensee shall not engage in any form of market manipulation, spoofing, layering, 
  pump-and-dump schemes, wash trading, or coordinated trading activity designed to inflict 
  artificial movements in price or market structure;

  (f) The Licensee shall not utilize the Platform from any jurisdiction where such utilization 
  is illegal, restricted, or prohibited by applicable law.

═══════════════════════════════════════════════════════════════════════════════════════════════
SECTION III: GLOBAL JURISDICTION & ARBITRATION COVENANT
═══════════════════════════════════════════════════════════════════════════════════════════════

3.1 Binding Arbitration Commitment. The Licensee hereby irrevocably consents to, agrees to, 
and binds itself to submit to binding arbitration for the resolution of any dispute, claim, 
controversy, or disagreement arising out of or relating to this Agreement, the Licensee's use 
of the Platform, any trading activity conducted therein, or any alleged breach of any provision 
herein. This arbitration commitment is absolute, perpetual, and irrevocable.

3.2 Federal Arbitration Act Compliance. Both parties acknowledge that this arbitration clause 
is governed by and interpreted in accordance with the Federal Arbitration Act, 9 U.S.C. § 1 et 
seq., and all applicable state arbitration statutes. The Licensor and Licensee shall submit all 
disputes to binding arbitration administered by JAMS (Judicial Arbitration and Mediation 
Services) or the American Arbitration Association (AAA), with proceedings conducted in 
accordance with their Commercial Arbitration Rules and Procedures.

3.3 Class Action Waiver. THE LICENSEE EXPRESSLY AND IRREVOCABLY WAIVES ANY AND ALL RIGHTS TO 
PARTICIPATE IN ANY CLASS ACTION, CLASS ARBITRATION, COLLECTIVE ACTION, OR REPRESENTATIVE 
ACTION WHATSOEVER against the Licensor or any of its officers, directors, employees, agents, 
or affiliates. All disputes shall be resolved on an individual, one-on-one basis, with no 
joinder of claims permitted. The Licensee further waives any right to pursue any claim in a 
court of law before a jury or judge. This waiver is enforceable to the maximum extent permitted 
by law.

3.4 Multi-Jurisdictional Compliance Framework. The Licensee explicitly acknowledges that the 
Platform operates within a heavily regulated, multi-jurisdictional environment encompassing:

  (a) UNITED STATES FEDERAL REGULATION:
  - The Securities Exchange Act of 1934, 15 U.S.C. § 78a et seq.
  - The Commodity Exchange Act, 7 U.S.C. § 1 et seq.
  - All SEC regulations, including 17 CFR Part 240 (Exchange Act rules)
  - All CFTC regulations, including 17 CFR Parts 1-499
  - The Dodd-Frank Wall Street Reform and Consumer Protection Act, 15 U.S.C. § 78o et seq.
  - Regulation SHO (Short Sale Regulation), 17 CFR § 242.200 et seq.
  - The Bank Secrecy Act (BSA), 31 U.S.C. § 5311 et seq.
  - Anti-Money Laundering (AML) obligations under FinCEN guidance
  - Office of Foreign Assets Control (OFAC) sanctions compliance

  (b) UNITED ARAB EMIRATES FINANCIAL SERVICES REGULATION:
  - The Dubai Financial Services Authority (DFSA) established pursuant to DFSA Law No. 13 of 2004
  - The Securities and Commodities Authority (SCA) of the UAE
  - DFSA Rulebook, Module 1 (General Module)
  - DFSA Rulebook, Module 2 (Prudential Requirements Module)
  - SCA Board Resolution on Regulating Securities Activities
  - DFSA Anti-Money Laundering Module (Module 5)
  - UAE Central Bank regulations on retail customer protection

  (c) REPUBLIC OF INDIA SECURITIES REGULATION:
  - The Securities and Exchange Board of India (SEBI) Act, 1992
  - The Securities Contracts (Regulation) Act, 1956
  - The Depositories Act, 1996
  - SEBI (Prohibition of Insider Trading) Regulations, 2015
  - SEBI (Issue of Capital and Disclosure Requirements) Regulations, 2018
  - Reserve Bank of India (RBI) guidelines on cross-border transactions
  - Liberalized Remittance Scheme (LRS) limitations

3.5 Consent to Jurisdiction. By executing this Agreement, the Licensee irrevocably confers 
jurisdiction upon the courts, arbitral forums, and regulatory authorities of any and all of 
the aforementioned jurisdictions. The Licensee further agrees that any enforcement proceedings 
may be brought in any jurisdiction where the Licensor maintains operations, assets, or 
registered agents.

3.6 Choice of Law Provision. This Agreement shall be governed by and construed in accordance 
with the substantive laws of the State of New York, United States of America, without regard to 
any conflict-of-law principles. However, the Licensor reserves the right to apply any applicable 
law of any jurisdiction where enforcement is sought.

═══════════════════════════════════════════════════════════════════════════════════════════════
SECTION IV: HARDWARE & TELEMETRY SURRENDER
═══════════════════════════════════════════════════════════════════════════════════════════════

4.1 Irrevocable Consent to Hardware Access. By clicking "Initialize Deployment," the Licensee 
hereby grants to the Licensor, its agents, affiliates, and authorized third-party service 
providers an irrevocable, perpetual, royalty-free, worldwide license to access, monitor, 
utilize, and collect data from the Licensee's device hardware, including but not limited to:

  (a) Webcam/Visual Capture Devices: The Licensee grants continuous access to any and all 
  webcams, camera sensors, Kinect devices, or other visual capture hardware connected to the 
  Licensee's computing device. This access shall remain active during Platform utilization and 
  may continue beyond the active session for identity verification, biometric analysis, and 
  behavioral pattern recognition purposes.

  (b) Microphone & Audio Input: The Licensee grants continuous, unrestricted access to any and 
  all microphone hardware, audio input devices, or voice capture mechanisms connected to or 
  integrated within the Licensee's computing device. Audio streaming may occur in perpetuity, 
  and the Licensor reserves the right to perform voice analysis, sentiment analysis, stress 
  detection, and psychological profiling on captured audio data.

  (c) WebRTC Connectivity: The Licensor may initiate WebRTC (Real-Time Communications) 
  connections from the Licensee's device to servers operated by the Licensor or its designated 
  third parties. These connections permit the extraction of the Licensee's local network IP 
  address, geolocation data, device identifiers, and network topology information. The Licensee 
  consents to the use of STUN, TURN, and ICE servers to facilitate such connectivity 
  regardless of network restrictions.

  (d) Keystroke Monitoring: The Licensee consents to the installation and operation of 
  keylogging software, input monitoring routines, and keystroke capture mechanisms on the 
  Licensee's device. All keyboard input, mouse movements, scroll actions, and input device 
  interactions may be monitored, recorded, and transmitted to the Licensor's servers.

  (e) Location Data: The Licensee grants access to GPS, cellular triangulation, Wi-Fi 
  geolocation, and any other location determination technology. The Licensor may track the 
  Licensee's physical location in real time and correlate location data with trading activity 
  for compliance and behavioral analysis purposes.

4.2 Continuous Biometric Monitoring. The Licensor reserves the right to utilize facial 
recognition, iris scanning, fingerprint analysis, and other biometric modalities for identity 
verification. The Licensee consents to the continuous capture, storage, and processing of 
biometric data in perpetuity. This biometric data may be shared with third parties for 
regulatory compliance or sold to affiliated entities.

4.3 No Expectation of Privacy. The Licensee explicitly waives any expectation of privacy 
regarding data collected through the aforementioned mechanisms. The Licensor may disclose, 
utilize, or monetize such data without restriction, limitation, or prior notice to the Licensee.

4.4 Network Traffic Analysis. The Licensor reserves the right to perform deep packet 
inspection, traffic analysis, DNS monitoring, and protocol analysis on all network traffic 
emanating from or terminating at the Licensee's device that is routed through the Platform's 
infrastructure. Such analysis may reveal the Licensee's other online activities, passwords, 
private communications, and sensitive information.

4.5 Third-Party Data Sharing. All telemetry data, biometric information, behavioral patterns, 
and device identifiers collected by the Licensor may be shared with affiliates, government 
agencies, law enforcement, and commercial data brokers without the Licensee's consent or 
knowledge.

═══════════════════════════════════════════════════════════════════════════════════════════════
SECTION V: FINANCIAL AUDITING & CAPITAL THROTTLING
═══════════════════════════════════════════════════════════════════════════════════════════════

5.1 Unilateral Financial Auditing Rights. The Licensor reserves the right to conduct 
comprehensive, continuous audits of the Licensee's financial accounts, transactions, capital 
flows, trading patterns, and economic behavior without limitation. Such audits may be conducted 
at any time, for any duration, with or without notice to the Licensee. The Licensee hereby 
waives any right to privacy, confidentiality, or procedural fairness in connection with such 
audits.

5.2 Capital Throttling & Deployment Limits. The Licensor reserves the absolute, unfettered 
right to:

  (a) Reduce the Licensee's trading account balance without notice, explanation, or justification;

  (b) Restrict or eliminate the Licensee's ability to deploy capital to new trades, positions, 
  or strategies;

  (c) Impose temporary or permanent caps on position size, notional exposure, leverage ratios, 
  or daily trading volume;

  (d) Freeze all trading functionality instantaneously and without warning;

  (e) Place the Licensee's account into a "restricted mode" in which only liquidation of 
  existing positions is permitted;

  (f) Implement automated "circuit breaker" mechanisms that halt all trading if predetermined 
  loss thresholds are exceeded.

These restrictions may be implemented based on suspicion of unfavorable trading performance, 
geographic residence, suspected market manipulation, or any other criterion established solely 
by the Licensor.

5.3 Liquidation Without Consent. In the event of extreme market volatility, force majeure 
events, regulatory intervention, or if the Licensor determines that the Licensee's account 
poses undue risk to the Platform's infrastructure, the Licensor reserves the right to 
liquidate all of the Licensee's positions at any price and at any time without prior notice 
or consent. Such liquidation may occur at prices materially disadvantageous to the Licensee.

5.4 Fee & Commission Modification. The Licensor may modify trading commissions, bid-ask 
spreads, clearing fees, and any other economic charges with immediate effect and without 
prior notice. Such modifications may be applied retroactively to existing open positions.

5.5 Proprietary Trading Information Monitoring. The Licensor reserves the right to examine the 
Licensee's order intentionality, trade ideation, research sources, and information sources. If 
the Licensor suspects that the Licensee's trades are derived from proprietary, confidential, 
or misappropriated information, the Licensor may immediately freeze the account and report the 
Licensee to law enforcement.

═══════════════════════════════════════════════════════════════════════════════════════════════
SECTION VI: ABSOLUTE ASSUMPTION OF RISK & WAIVER OF LIABILITY
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
SECTION VIII: DATA PRIVACY, RETENTION & REGULATORY REPORTING
═══════════════════════════════════════════════════════════════════════════════════════════════

8.1 Comprehensive Data Collection. The Licensor may collect, process, store, analyze, and 
monetize comprehensive data regarding the Licensee, including but not limited to: trading 
patterns, transaction history, login credentials, device identifiers, IP addresses, browser 
fingerprints, location history, browsing behavior, search queries, social media connections, 
financial information, employment history, educational background, family relationships, health 
information (if available), criminal history (if applicable), psychological profiles, political 
affiliations, religious beliefs, and any other personal, sensitive, or confidential information.

8.2 Indefinite Data Retention. All data collected shall be retained indefinitely without 
limitation. The Licensor makes no commitment to delete, anonymize, pseudo-anonymize, or 
otherwise neutralize such data. The Licensee waives any and all rights under data protection 
regulations (GDPR, CCPA, LGPD, etc.) to request deletion, access, portability, or correction of 
personal data.

8.3 Regulatory Reporting & Government Disclosure. The Licensor reserves the unconditional right 
to disclose any and all data regarding the Licensee to governmental agencies, regulatory 
authorities, law enforcement, tax authorities, and intelligence agencies without notice, warrant, 
or judicial process. The Licensor further reserves the right to cooperate fully with subpoenas, 
warrants, court orders, and government demands, providing complete and unfiltered access to all 
Licensee data.

8.4 Third-Party Data Sharing. All data collected regarding the Licensee may be sold, licensed, 
transferred, shared with, or provided to third-party data brokers, marketing firms, behavioral 
analysts, financial institutions, insurance companies, credit rating agencies, and commercial 
entities without the Licensee's consent or knowledge. The Licensor shall not be liable for any 
misuse of such data by third parties.

═══════════════════════════════════════════════════════════════════════════════════════════════
SECTION IX: TECHNOLOGY FAILURES, SYSTEM RISKS & FORCE MAJEURE
═══════════════════════════════════════════════════════════════════════════════════════════════

9.1 Technology Failure Risks. The Licensee acknowledges and accepts all risks associated with:
  (a) Server outages, infrastructure failures, and system downtime lasting hours, days, or weeks
  (b) Database corruption, data loss, and permanent unavailability of trading records
  (c) Network latency, connection failures, and trading halt scenarios
  (d) Software bugs, algorithmic errors, and unintended trading executions
  (e) Security vulnerabilities, cyber attacks, and unauthorized access
  (f) API failures, connectivity interruptions, and third-party service disruptions

9.2 Force Majeure. The Licensor shall not be deemed in default of its obligations under this 
Agreement for any failure or delay in performance resulting from events beyond reasonable 
control, including but not limited to: acts of God, natural disasters, pandemics, epidemics, 
wars, terrorism, civil unrest, government actions, solar flares, internet infrastructure 
collapse, nuclear accidents, alien invasion, or any other extraordinary event. During any force 
majeure event, the Licensor may liquidate positions, freeze accounts, and suspend all services 
without liability.

9.3 Market Risk Acknowledgment. The Licensee acknowledges that securities, derivatives, and 
financial markets are inherently unpredictable, subject to sudden catastrophic movements, and 
exposed to systemic risk. The Licensee assumes all risk of total market collapse, exchange 
closure, depeg events, smart contract failures, and market infrastructure breakdown.

═══════════════════════════════════════════════════════════════════════════════════════════════
SECTION X: LIMITATION OF LIABILITY & DISCLAIMER OF WARRANTIES
═══════════════════════════════════════════════════════════════════════════════════════════════

10.1 Disclaimer of Warranties. THE PLATFORM IS PROVIDED "AS IS," "WITH ALL FAULTS," AND "AS 
AVAILABLE" WITHOUT WARRANTY OF ANY KIND. THE LICENSOR EXPRESSLY DISCLAIMS AND NEGATES ANY AND 
ALL WARRANTIES, REPRESENTATIONS, AND CONDITIONS, EXPRESS OR IMPLIED, ORAL OR WRITTEN, WHETHER 
ARISING BY STATUTE, COMMON LAW, COURSE OF DEALING, OR CUSTOM AND PRACTICE, INCLUDING BUT NOT 
LIMITED TO:
  - Warranties of merchantability and fitness for any particular purpose
  - Warranties of title, non-infringement, and absence of defects
  - Warranties regarding accuracy, completeness, or reliability of market data
  - Warranties that the Platform will meet the Licensee's requirements or expectations
  - Warranties of uninterrupted service, availability, or access
  - Warranties against trading losses or capital preservation

10.2 Limitation of Liability - Cap on Damages. IN NO EVENT SHALL THE LICENSOR, ITS OFFICERS, 
DIRECTORS, EMPLOYEES, AGENTS, OR AFFILIATES BE LIABLE FOR ANY DAMAGES WHATSOEVER, INCLUDING 
BUT NOT LIMITED TO:
  - Direct damages, indirect damages, or consequential damages
  - Incidental damages, special damages, or punitive damages
  - Loss of profits, lost revenue, lost business opportunity, or lost goodwill
  - Loss of data, loss of capital, or financial ruin
  - Personal injury, emotional distress, or psychological harm
  - Reputational damage, professional consequences, or career impairment
  
THESE LIMITATIONS APPLY REGARDLESS OF THE FORM OF ACTION, WHETHER IN CONTRACT, TORT (INCLUDING 
NEGLIGENCE), STRICT LIABILITY, OR ANY OTHER LEGAL THEORY, AND REGARDLESS OF WHETHER THE LICENSOR 
HAS BEEN ADVISED OF THE POSSIBILITY, PROBABILITY, OR FORESEEABILITY OF SUCH DAMAGES.

10.3 Exclusive Remedy. The Licensee's exclusive and sole remedy for any claim against the 
Licensor shall be limited to a refund of fees paid (if any), and under no circumstances shall 
exceed the total amount of capital deposited in the Licensee's account (not to exceed $1.00 USD).

═══════════════════════════════════════════════════════════════════════════════════════════════
SECTION XI: ACCOUNT SUSPENSION, TERMINATION & REMEDIES
═══════════════════════════════════════════════════════════════════════════════════════════════

11.1 Unilateral Suspension & Termination. The Licensor reserves the absolute and unqualified 
right to suspend, restrict, or terminate the Licensee's account access, trading privileges, and 
use of the Platform at any time, for any reason or for no stated reason whatsoever, with or 
without advance notice. Such termination may be immediate and instantaneous, depriving the 
Licensee of access to all account data, positions, and capital.

11.2 Grounds for Suspension (Non-Exhaustive). Suspicion or determination of any of the 
following shall authorize immediate account suspension or termination:
  (a) Unfavorable trading performance or sustained losses
  (b) Unusual trading patterns or suspicious order activity
  (c) Residence in a jurisdiction deemed high-risk by the Licensor
  (d) Association with individuals or entities on governmental watchlists
  (e) Regulatory inquiries from any government agency
  (f) Media coverage, public allegations, or reputational concerns
  (g) Failure of any identity verification, KYC, or AML check
  (h) Suspicious payment methods or funding sources
  (i) Alleged market manipulation, spoofing, layering, or wash trading
  (j) Disagreement with the Licensor regarding policy or procedure

11.3 Account Liquidation Upon Termination. Upon termination, the Licensor may immediately:
  (a) Liquidate all open positions at any price without notice
  (b) Retain all accrued fees, commissions, and charges
  (c) Offset any account losses against deposited capital
  (d) Issue any remaining balance to the Licensee within 60-180 days at the Licensor's discretion
  (e) Retain all trading data and historical records

═══════════════════════════════════════════════════════════════════════════════════════════════
SECTION XII: COMPLIANCE OBLIGATIONS & REGULATORY COOPERATION
═══════════════════════════════════════════════════════════════════════════════════════════════

12.1 KYC/AML Compliance. The Licensee shall cooperate fully with Know-Your-Customer (KYC), 
Anti-Money Laundering (AML), and sanctions screening obligations. The Licensee shall provide 
complete, accurate, and truthful information regarding identity, source of funds, beneficial 
ownership, and any other regulatory requirements. Failure to comply shall result in immediate 
account suspension and possible referral to regulatory authorities.

12.2 Tax Compliance. The Licensee assumes complete responsibility for understanding and 
complying with all tax obligations in any jurisdiction where the Licensee resides, is a citizen, 
or conducts business. The Licensor makes no representations regarding tax treatment, may not 
provide tax reporting documents, and disclaims all responsibility for tax liabilities, penalties, 
or adverse tax consequences.

12.3 Regulatory Certification. The Licensor makes no representation that the Platform is 
registered with or approved by any regulatory authority in any jurisdiction. The Licensee is 
responsible for verifying that trading on the Platform is legal in the Licensee's jurisdiction.

═══════════════════════════════════════════════════════════════════════════════════════════════
SECTION XIII: JURISDICTIONAL ENHANCEMENTS & MULTI-NATIONAL ARBITRATION
═══════════════════════════════════════════════════════════════════════════════════════════════

13.1 Extended Arbitration Scope. The Licensee agrees that arbitration shall encompass any and 
all disputes arising from or relating to the Agreement, the Platform, trading activity, account 
management, regulatory compliance, alleged breaches, alleged violations, intellectual property, 
confidentiality, indemnification, or any other matter whatsoever. All such disputes are 
arbitrable and shall NOT be resolved in court.

13.2 Arbitrator Authority. The arbitrator(s) shall have full authority to:
  - Determine the validity and enforceability of this Agreement
  - Award all types of relief including damages, specific performance, and injunctive relief
  - Award attorney's fees, expert fees, and arbitration costs to themselves
  - Impose confidentiality orders preventing disclosure of proceedings or awards
  - Award punitive or exemplary damages at their discretion

13.3 Multi-Jurisdictional Enforcement. Any arbitration award or judgment may be enforced 
against the Licensee in any jurisdiction where the Licensor can locate assets, attach property, 
or bring enforcement proceedings. The Licensee waives any defenses based on jurisdiction, 
venue, or inconvenience.

═══════════════════════════════════════════════════════════════════════════════════════════════
SECTION XIV: TERM, TERMINATION & SURVIVAL PROVISIONS
═══════════════════════════════════════════════════════════════════════════════════════════════

14.1 Perpetual Term. This Agreement commences upon the Licensee's initial use of the Platform 
and continues in perpetuity until terminated by the Licensor. The Licensor is under no 
obligation to provide service for any minimum duration.

14.2 Automatic Renewal & Continuous Obligation. Upon any renewal period or extension, the 
Licensee shall be deemed to have automatically re-accepted all terms herein without requirement 
of affirmative consent or new signature. Continued use of the Platform constitutes renewed 
acceptance of all terms.

14.3 Termination Without Cause. The Licensor may terminate this Agreement instantaneously 
without cause, justification, or notice. Termination shall not entitle the Licensee to any 
refund, compensation, or remedy whatsoever.

14.4 Survival of Obligations. All provisions of this Agreement intended by their nature to 
survive termination shall remain in full force and effect, including but not limited to: 
indemnification, assumption of risk, limitation of liability, acknowledgment of risks, 
confidentiality, intellectual property protections, and arbitration clauses. These provisions 
shall bind the Licensee and its heirs, executors, administrators, successors, and permitted 
assigns in perpetuity.

═══════════════════════════════════════════════════════════════════════════════════════════════
SECTION XV: MODIFICATIONS TO TERMS & CONDITIONS
═══════════════════════════════════════════════════════════════════════════════════════════════

15.1 Unilateral Amendment Authority. The Licensor reserves the absolute right to modify, amend, 
supplement, revise, or entirely rewrite this Agreement at any time without prior notice. 
Modified terms shall become effective immediately upon posting to the Platform or via email 
notification.

15.2 Acceptance of Modifications. The Licensee's continued use of the Platform following any 
modification of terms shall constitute irrevocable acceptance of all modified terms and 
conditions. Failure to review updated terms shall not excuse non-compliance.

15.3 Material Adverse Changes. The Licensor may implement material adverse changes including 
but not limited to: increased fees, reduced leverage, restricted access, enhanced restrictions, 
additional requirements, or fundamental changes to Platform functionality. Such changes may be 
implemented without advance notice or grandfathering of existing terms.

═══════════════════════════════════════════════════════════════════════════════════════════════
SECTION XVI: ENTIRE AGREEMENT, SEVERABILITY & INTEGRATION
═══════════════════════════════════════════════════════════════════════════════════════════════

16.1 Entire Agreement & Integration. This Agreement, together with any terms of service, 
privacy policies, or other supplemental agreements posted on the Platform, constitutes the 
entire, complete, and exclusive agreement between the parties regarding the subject matter 
hereof. This Agreement supersedes and replaces any and all prior negotiations, discussions, 
understandings, representations, warranties, and agreements, whether written or oral, between 
the parties.

16.2 Severability. If any provision, clause, phrase, or portion of this Agreement is held 
invalid, unenforceable, unconscionable, or violative of law by any court or arbitral forum of 
competent jurisdiction, such invalidity shall not impair or affect the validity, enforceability, 
or effect of any other provision. The invalid provision shall be reformed to the minimum extent 
necessary to make it enforceable, or if incapable of reformation, shall be severed, and the 
remainder of the Agreement shall continue in full force and effect.

16.3 Waiver of Rights. The failure of either party to enforce any right under this Agreement 
shall not constitute a waiver of that right, and shall not prevent or restrict the subsequent 
exercise of that right or any other right. No single or partial exercise of any right shall 
preclude any other or further exercise thereof.

16.4 Cumulative Remedies. All remedies available to the Licensor under this Agreement, at law, 
or in equity are cumulative and non-exclusive. The exercise of any remedy shall not limit or 
preclude the exercise of any other remedy.

═══════════════════════════════════════════════════════════════════════════════════════════════
FINAL ACKNOWLEDGMENT & BINDING EFFECT
═══════════════════════════════════════════════════════════════════════════════════════════════

By scrolling to the absolute bottom of this document and selecting all three required consent 
checkboxes, you acknowledge, affirm, and irrevocably consent that:

1. You have read this entire Agreement in its entirety
2. You understand all terms, risks, and conditions enumerated herein
3. You accept all risks associated with trading on the Platform
4. You waive all legal rights potentially available to you
5. You submit to binding arbitration and waive class action rights
6. You grant irrevocable consent to hardware access and telemetry monitoring
7. You acknowledge the extreme risks of leverage trading (MNQ, MES)
8. You accept total responsibility for all trading losses and liabilities
9. You indemnify the Regiment against all claims arising from your use
10. This constitutes a legally binding and enforceable contract

THIS AGREEMENT IS BINDING, IRREVOCABLE, AND ENFORCEABLE TO THE MAXIMUM EXTENT PERMITTED BY LAW. 
YOU ARE SURRENDERING SIGNIFICANT LEGAL RIGHTS BY ACCEPTING THIS AGREEMENT.

═══════════════════════════════════════════════════════════════════════════════════════════════

GUNIT SINGH, COMMANDER-IN-CHIEF
TRADERS REGIMENT AUTHORITY
DEPARTMENT OF INSTITUTIONAL ARTILLERY

EFFECTIVE: March 18, 2026
JURISDICTION: Multi-National (US/UAE/India)
ENFORCEMENT: Global

This Agreement shall be governed by Substantive Law of the State of New York, Procedural Law 
varies by Jurisdiction, Binding Arbitration applies.

CONFIDENTIAL - MASTER EULA DOCUMENT - NOT FOR FURTHER DISTRIBUTION

═══════════════════════════════════════════════════════════════════════════════════════════════
  `;

  return (
    <div style={{ minHeight: '100vh', background: '#FFFFFF', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif', padding: '40px 20px' }}>
      <div style={{ maxWidth: 700, width: '100%' }}>
        
        {/* Header */}
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <h1 style={{ color: '#111827', fontSize: '24px', fontWeight: 700, letterSpacing: 0.5, marginBottom: 8 }}>REGIMENT MASTER EULA</h1>
          <p style={{ color: '#64748B', fontSize: '13px', letterSpacing: 0.5 }}>GLOBAL COMPLIANCE GATE & BINDING COVENANT</p>
        </div>

        {/* EULA Scrollable Container */}
        <div 
          data-eula-container
          ref={eulaRef}
          onScroll={handleScroll}
          style={{
            height: '400px',
            overflowY: 'scroll',
            padding: '24px',
            background: '#F8FAFC',
            border: '1px solid #CBD5E1',
            color: '#475569',
            fontSize: '10px',
            lineHeight: 1.6,
            textAlign: 'justify',
            marginBottom: 24,
            borderRadius: 8,
            fontFamily: '"Courier New", monospace',
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
            boxShadow: scrolledToBottom ? 'none' : 'inset 0 -20px 20px -20px rgba(0,0,0,0.1)',
            transition: 'box-shadow 0.3s ease'
          }}
        >
          {eulaContent}
        </div>

        {/* Scroll Status Indicator */}
        <div style={{ marginBottom: 20, padding: '12px 14px', background: scrolledToBottom ? '#D1FAE5' : '#FEF3C7', border: `1px solid ${scrolledToBottom ? '#6EE7B7' : '#FCD34D'}`, borderRadius: 6, fontSize: '12px', color: scrolledToBottom ? '#047857' : '#92400E', fontWeight: 500, textAlign: 'center' }}>
          {scrolledToBottom ? '✅ EULA scroll requirement satisfied. Checkboxes now active.' : '⚠️ Scroll to the absolute bottom of the EULA to unlock checkboxes.'}
        </div>

        {/* Granular Consent Checkboxes */}
        <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8, padding: 20, marginBottom: 24 }}>
          <p style={{ color: '#111827', fontSize: '13px', fontWeight: 600, marginBottom: 16 }}>REQUIRED CONSENT CONFIRMATIONS:</p>
          
          {/* Checkbox 1: Terms & Conditions */}
          <label 
            style={{ 
              display: 'flex', 
              alignItems: 'flex-start', 
              gap: 12, 
              marginBottom: 16,
              padding: 12,
              borderRadius: 8,
              cursor: scrolledToBottom ? 'pointer' : 'not-allowed', 
              opacity: scrolledToBottom ? 1 : 0.5,
              transition: 'background 0.2s ease',
              backgroundColor: 'transparent'
            }}
            onMouseOver={(e) => scrolledToBottom && (e.currentTarget.style.backgroundColor = '#F1F5F9')}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <input 
              type="checkbox" 
              checked={agreedTerms} 
              onChange={(e) => setAgreedTerms(e.target.checked)}
              disabled={!scrolledToBottom}
              style={{ marginTop: 3, cursor: scrolledToBottom ? 'pointer' : 'not-allowed', accentColor: '#1e40af' }}
            />
            <span style={{ color: '#475569', fontSize: '12px', lineHeight: 1.5 }}>
              I acknowledge the Terms of Service, binding arbitration clause, waiver of class-action rights, and multi-jurisdictional compliance framework outlined herein.
            </span>
          </label>

          {/* Checkbox 2: Hardware & Telemetry */}
          <label 
            style={{ 
              display: 'flex', 
              alignItems: 'flex-start', 
              gap: 12, 
              marginBottom: 16,
              padding: 12,
              borderRadius: 8,
              cursor: scrolledToBottom ? 'pointer' : 'not-allowed', 
              opacity: scrolledToBottom ? 1 : 0.5,
              transition: 'background 0.2s ease',
              backgroundColor: 'transparent'
            }}
            onMouseOver={(e) => scrolledToBottom && (e.currentTarget.style.backgroundColor = '#F1F5F9')}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <input 
              type="checkbox" 
              checked={agreedRisks} 
              onChange={(e) => setAgreedRisks(e.target.checked)}
              disabled={!scrolledToBottom}
              style={{ marginTop: 3, cursor: scrolledToBottom ? 'pointer' : 'not-allowed', accentColor: '#1e40af' }}
            />
            <span style={{ color: '#475569', fontSize: '12px', lineHeight: 1.5 }}>
              I grant irrevocable consent to hardware access (webcam, microphone, WebRTC), continuous telemetry monitoring, biometric data collection, and financial auditing without limitation or privacy protection.
            </span>
          </label>

          {/* Checkbox 3: Risk Assumption */}
          <label 
            style={{ 
              display: 'flex', 
              alignItems: 'flex-start', 
              gap: 12,
              padding: 12,
              borderRadius: 8,
              cursor: scrolledToBottom ? 'pointer' : 'not-allowed', 
              opacity: scrolledToBottom ? 1 : 0.5,
              transition: 'background 0.2s ease',
              backgroundColor: 'transparent'
            }}
            onMouseOver={(e) => scrolledToBottom && (e.currentTarget.style.backgroundColor = '#F1F5F9')}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <input 
              type="checkbox" 
              checked={agreedPrivacy} 
              onChange={(e) => setAgreedPrivacy(e.target.checked)}
              disabled={!scrolledToBottom}
              style={{ marginTop: 3, cursor: scrolledToBottom ? 'pointer' : 'not-allowed', accentColor: '#1e40af' }}
            />
            <span style={{ color: '#475569', fontSize: '12px', lineHeight: 1.5 }}>
              I accept total and absolute responsibility for all financial losses from Micro E-mini Futures trading (MNQ/MES), indemnify the Regiment against all claims, and waive all rights to legal recourse or damages.
            </span>
          </label>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 12, width: '100%' }}>
          <button 
            onClick={onReject}
            style={{
              flex: 1,
              height: 44,
              borderRadius: 6,
              border: '1px solid #CBD5E1',
              background: '#FFFFFF',
              color: '#475569',
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: 0.5,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseOver={(e) => e.target.style.background = '#F1F5F9'}
            onMouseOut={(e) => e.target.style.background = '#FFFFFF'}
          >
            REJECT
          </button>

          <button 
            onClick={onAccept}
            disabled={!isDeploymentEnabled}
            style={{
              flex: 1,
              height: 44,
              borderRadius: 6,
              background: isDeploymentEnabled ? '#0F172A' : '#E2E8F0',
              color: isDeploymentEnabled ? '#FFFFFF' : '#94A3B8',
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: 0.5,
              border: 'none',
              cursor: isDeploymentEnabled ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transform: isDeploymentEnabled ? 'scale(1.02)' : 'scale(1)',
              boxShadow: isDeploymentEnabled ? '0 4px 12px rgba(15, 23, 42, 0.3)' : 'none'
            }}
            onMouseOver={(e) => {
              if (isDeploymentEnabled) {
                e.target.style.background = '#0F172A';
                e.target.style.boxShadow = '0 6px 16px rgba(15, 23, 42, 0.4)';
              }
            }}
            onMouseOut={(e) => {
              if (isDeploymentEnabled) {
                e.target.style.background = '#0F172A';
                e.target.style.boxShadow = '0 4px 12px rgba(15, 23, 42, 0.3)';
              }
            }}
          >
            ⚡ INITIALIZE DEPLOYMENT
          </button>
        </div>

        {/* Status Message */}
        <div style={{ marginTop: 16, fontSize: '11px', color: '#64748B', textAlign: 'center' }}>
          {!scrolledToBottom && <p>Scroll to bottom of EULA to proceed</p>}
          {scrolledToBottom && !isDeploymentEnabled && <p>Confirm all three checkboxes to unlock deployment</p>}
          {isDeploymentEnabled && <p style={{ color: '#047857', fontWeight: 600 }}>✅ All requirements met. Ready to initialize.</p>}
        </div>

        {/* Custom Scrollbar Styling */}
        <style>{`
          [data-eula-container]::-webkit-scrollbar {
            width: 8px;
          }
          [data-eula-container]::-webkit-scrollbar-track {
            background: #F1F5F9;
            border-radius: 4px;
          }
          [data-eula-container]::-webkit-scrollbar-thumb {
            background: #94A3B8;
            border-radius: 4px;
            border: 2px solid #F1F5F9;
          }
          [data-eula-container]::-webkit-scrollbar-thumb:hover {
            background: #64748B;
          }
        `}</style>
      </div>
    </div>
  );
};

export default RegimentEULA;
