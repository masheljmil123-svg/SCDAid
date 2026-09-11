/** SCDAid PDF visual tokens — match the live website light theme. */

export const COLORS = {
  primary: [200, 30, 58],
  primaryDark: [157, 23, 48],
  blush: [253, 236, 238],
  burgundy: [58, 16, 24],
  ink: [28, 18, 22],
  text: [92, 86, 96],
  muted: [147, 135, 139],
  border: [231, 233, 238],
  white: [255, 255, 255],
  eligible: [23, 148, 92],
  eligibleBg: [232, 246, 238],
  caution: [217, 119, 6],
  cautionBg: [255, 246, 232],
  avoid: [180, 35, 54],
  avoidBg: [253, 236, 238],
}

export const PAGE = {
  width: 210,
  height: 297,
  marginX: 13,
  marginTop: 8,
  footerY: 287,
  contentBottom: 281,
}

export const TYPE = {
  title: 12.4,
  subtitle: 9.2,
  section: 8.2,
  body: 7,
  small: 6.4,
  meta: 6.4,
  footer: 6.2,
}

export const COPY = {
  kicker: 'CLINICAL DECISION SUPPORT',
  title: 'SCDAid Clinical Recommendation Report',
  tagline: 'Smarter Opioid Decisions. Better Care for Sickle Cell.',
  footerLeft: 'SAFER DECISIONS. STRONGER TOMORROWS.',
  footerCenter: 'SCDAid — Clinical Decision Support',
  page1Subtitle: 'Patient Assessment Inputs',
  page2Subtitle: 'Recommendation Outputs',
  doseStatement: 'Dose guidance has not yet been implemented in this version of SCDAid.',
  predictionNote: 'Simulation-based proof-of-concept prediction; not clinically validated.',
  disclaimer:
    'SCDAid is a clinical decision-support research tool. Machine-learning predictions in this version are based on evidence-informed synthetic simulation data and are not yet clinically validated. Outputs should be interpreted together with the full clinical picture, institutional protocols, and clinician judgment.',
}

export function tableTheme() {
  return {
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: TYPE.body,
      textColor: COLORS.ink,
      lineColor: COLORS.border,
      lineWidth: 0.12,
      cellPadding: { top: 0.85, bottom: 0.85, left: 1.35, right: 1.35 },
      overflow: 'linebreak',
      valign: 'middle',
      minCellHeight: 4.4,
    },
    headStyles: {
      fillColor: COLORS.blush,
      textColor: COLORS.burgundy,
      fontStyle: 'bold',
      fontSize: TYPE.small,
      cellPadding: { top: 0.9, bottom: 0.9, left: 1.35, right: 1.35 },
    },
    alternateRowStyles: {
      fillColor: [252, 250, 249],
    },
  }
}
