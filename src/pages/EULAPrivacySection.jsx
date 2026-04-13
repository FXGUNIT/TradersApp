/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════════
 * EULA — PRIVACY POLICY SECTION
 * ═══════════════════════════════════════════════════════════════════════════════════════════════
 *
 * Component: EULAPrivacySection
 * Purpose: Privacy Policy legal text — Tab 3 of RegimentEULA
 * Regulation Compliance: GDPR, CCPA, LGPD, DFSA, SEBI
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════════
 */

import React from 'react';

const EULAPrivacySection = React.forwardRef(({ content, styleProps }, ref) => {
  return (
    <div
      ref={ref}
      data-eula-section="privacy"
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

EULAPrivacySection.displayName = 'EULAPrivacySection';

export default EULAPrivacySection;

export const PRIVACY_POLICY_CONTENT = \`
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
\`;
