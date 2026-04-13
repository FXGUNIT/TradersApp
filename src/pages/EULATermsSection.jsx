/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════════
 * EULA — TERMS OF SERVICE SECTION
 * ═══════════════════════════════════════════════════════════════════════════════════════════════
 *
 * Component: EULATermsSection
 * Purpose: Terms of Service legal text — Tab 1 of RegimentEULA
 * Regulation Compliance: SEC, CFTC, DFSA, SCA, SEBI
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════════
 */

import React from 'react';

const EULATermsSection = React.forwardRef(({ content, styleProps }, ref) => {
  return (
    <div
      ref={ref}
      data-eula-section="terms"
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

EULATermsSection.displayName = 'EULATermsSection';

export default EULATermsSection;

export const TERMS_OF_SERVICE_CONTENT = `
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
`;
