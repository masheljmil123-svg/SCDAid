import { jsPDF, GState } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { COLORS, COPY, PAGE, TYPE, tableTheme } from './reportStyles.js'
import {
  buildFilename,
  buildReportMeta,
  clinicianLabel,
  displayValue,
  eligibilityLabel,
  filledRows,
  getReportImages,
  medicationRows,
  predictedDeltaLabel,
  rankedOpioids,
  tableCell,
  yesNo,
} from './reportHelpers.js'

const CONTENT_WIDTH = PAGE.width - PAGE.marginX * 2
const COL_GAP = 3.2
const COL_WIDTH = (CONTENT_WIDTH - COL_GAP) / 2
const LOGO_H = 11
const LOGO_W = LOGO_H * (1024 / 341)

function rgb(doc, color) {
  doc.setTextColor(...color)
}

function fill(doc, color) {
  doc.setFillColor(...color)
}

function stroke(doc, color) {
  doc.setDrawColor(...color)
}

function pdfFilename(name) {
  const base = String(name || 'SCDAid_Report').replace(/[/\\?%*:|"<>]/g, '-')
  return /\.pdf$/i.test(base) ? base.replace(/\.pdf$/i, '.pdf') : `${base}.pdf`
}

function sectionTitle(doc, title, y, x = PAGE.marginX) {
  rgb(doc, COLORS.burgundy)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(TYPE.section)
  doc.text(title, x, y)
  stroke(doc, COLORS.primary)
  doc.setLineWidth(0.28)
  doc.line(x, y + 1, x + 14, y + 1)
  return y + 4.2
}

function drawHeader(doc, { logo, cells }, subtitle) {
  if (cells) {
    doc.saveGraphicsState()
    doc.setGState(new GState({ opacity: 0.14 }))
    doc.addImage(cells, 'PNG', PAGE.width - 40, 5, 27, 18, undefined, 'FAST')
    doc.restoreGraphicsState()
  }

  if (logo) {
    doc.addImage(logo, 'PNG', PAGE.marginX, 6.5, LOGO_W, LOGO_H, undefined, 'FAST')
  }

  rgb(doc, COLORS.primary)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(TYPE.small)
  doc.text(COPY.kicker, PAGE.marginX, 21.4)

  rgb(doc, COLORS.burgundy)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(TYPE.title)
  doc.text(COPY.title, PAGE.marginX, 26.8)

  rgb(doc, COLORS.primaryDark)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(TYPE.subtitle)
  doc.text(subtitle, PAGE.marginX, 31.4)

  rgb(doc, COLORS.muted)
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(TYPE.small)
  doc.text(COPY.tagline, PAGE.marginX, 35.6)

  stroke(doc, COLORS.border)
  doc.setLineWidth(0.22)
  doc.line(PAGE.marginX, 37.4, PAGE.width - PAGE.marginX, 37.4)
}

function drawMetadataStrip(doc, meta, clinicianName, y) {
  const cells = [
    ['Report ID', meta.reportId],
    ['Date generated', meta.generatedLabel],
    ['Application version', meta.appVersion],
  ]
  if (meta.caseId) cells.push(['Case / Assessment ID', meta.caseId])
  if (clinicianName) cells.push(['Clinician', clinicianName])

  const rows = Math.ceil(cells.length / 3)
  const height = 5.8 * rows + 2.2
  fill(doc, COLORS.blush)
  doc.roundedRect(PAGE.marginX, y, CONTENT_WIDTH, height, 1.2, 1.2, 'F')

  const colW = CONTENT_WIDTH / 3
  cells.forEach((pair, index) => {
    const col = index % 3
    const row = Math.floor(index / 3)
    const x = PAGE.marginX + 3 + col * colW
    const cy = y + 3.1 + row * 5.4
    rgb(doc, COLORS.muted)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(5.9)
    doc.text(pair[0].toUpperCase(), x, cy)
    rgb(doc, COLORS.ink)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.text(String(pair[1]), x, cy + 3)
  })

  return y + height + 4
}

function drawFooter(doc, pageNumber) {
  stroke(doc, COLORS.border)
  doc.setLineWidth(0.18)
  doc.line(PAGE.marginX, PAGE.footerY - 3, PAGE.width - PAGE.marginX, PAGE.footerY - 3)

  rgb(doc, COLORS.muted)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(TYPE.footer)
  doc.text(COPY.footerLeft, PAGE.marginX, PAGE.footerY)
  doc.text(COPY.footerCenter, PAGE.width / 2, PAGE.footerY, { align: 'center' })
  doc.text(`Page ${pageNumber} of 2`, PAGE.width - PAGE.marginX, PAGE.footerY, { align: 'right' })
}

function addTable(doc, startY, head, body, columnStyles = {}, options = {}) {
  const x = options.x ?? PAGE.marginX
  const width = options.width ?? CONTENT_WIDTH
  const rows = body.length
    ? body
    : [head.map((_, index) => (index === 0 ? 'Not provided' : '—'))]

  autoTable(doc, {
    ...tableTheme(),
    startY,
    margin: { left: x, right: PAGE.width - x - width, bottom: 16 },
    tableWidth: width,
    head: [head],
    body: rows,
    columnStyles,
    pageBreak: 'avoid',
    rowPageBreak: false,
    horizontalPageBreak: false,
  })
  return doc.lastAutoTable.finalY + 2.6
}

function kvTable(doc, y, rows, options = {}) {
  const width = options.width ?? CONTENT_WIDTH
  return addTable(
    doc,
    y,
    ['Field', 'Value'],
    rows,
    {
      0: { cellWidth: Math.min(36, width * 0.42), fontStyle: 'bold', textColor: COLORS.burgundy },
      1: { cellWidth: width - Math.min(36, width * 0.42) },
    },
    options,
  )
}

function page1Content(doc, form, result, y) {
  const leftX = PAGE.marginX
  const rightX = PAGE.marginX + COL_WIDTH + COL_GAP
  let leftY = y
  let rightY = y

  leftY = sectionTitle(doc, 'A. Patient & VOC', leftY, leftX)
  leftY = kvTable(
    doc,
    leftY,
    [
      ['Age', form.age === '' || form.age == null ? 'Not provided' : `${form.age} years`],
      ['Sex', displayValue(form.sex)],
      ['Weight', form.weight === '' || form.weight == null ? 'Not provided' : `${form.weight} kg`],
      ['BMI', form.bmi === '' || form.bmi == null ? 'Not provided' : String(form.bmi)],
      [
        'Baseline pain score',
        form.baselinePainScore === '' || form.baselinePainScore == null
          ? 'Not provided'
          : `${form.baselinePainScore} / 10`,
      ],
      ['SCD genotype', displayValue(form.scdGenotype)],
      ['VOC history', displayValue(form.vocHistory)],
      [
        'Relevant comorbidities',
        form.comorbidities?.length ? form.comorbidities.join(', ') : 'Not provided',
      ],
    ],
    { x: leftX, width: COL_WIDTH },
  )

  leftY = sectionTitle(doc, 'B. Relevant Vital Signs', leftY, leftX)
  const vitalRows = filledRows(form.vitalSigns, (row) => [
    tableCell(row.name),
    tableCell(row.value),
    tableCell(row.unit),
  ])
  leftY = addTable(doc, leftY, ['Parameter', 'Value', 'Unit'], vitalRows, {
    0: { cellWidth: COL_WIDTH * 0.42 },
    1: { cellWidth: COL_WIDTH * 0.28 },
    2: { cellWidth: COL_WIDTH * 0.3 },
  }, { x: leftX, width: COL_WIDTH })

  leftY = sectionTitle(doc, 'C. Organ Function', leftY, leftX)
  leftY = kvTable(
    doc,
    leftY,
    [
      [
        'Serum creatinine',
        form.serumCreatinine === '' || form.serumCreatinine == null
          ? 'Not provided'
          : String(form.serumCreatinine),
      ],
      ['Creatinine unit', displayValue(form.creatinineUnit)],
      [
        'eGFR',
        form.egfr === '' || form.egfr == null ? 'Not provided' : `${form.egfr} mL/min/1.73m²`,
      ],
    ],
    { x: leftX, width: COL_WIDTH },
  )
  const liverRows = filledRows(form.liverTests, (row) => [
    tableCell(row.name),
    tableCell(row.value),
    tableCell(row.unit),
  ])
  leftY = addTable(doc, leftY, ['Liver test', 'Value', 'Unit'], liverRows, {
    0: { cellWidth: COL_WIDTH * 0.42 },
    1: { cellWidth: COL_WIDTH * 0.28 },
    2: { cellWidth: COL_WIDTH * 0.3 },
  }, { x: leftX, width: COL_WIDTH })

  rightY = sectionTitle(doc, 'D. Current Medications', rightY, rightX)
  rightY = addTable(
    doc,
    rightY,
    ['Medication', 'Relevant flag'],
    medicationRows(form, result?.pgx),
    {
      0: { cellWidth: COL_WIDTH * 0.46 },
      1: { cellWidth: COL_WIDTH * 0.54 },
    },
    { x: rightX, width: COL_WIDTH },
  )

  rightY = sectionTitle(doc, 'E. Baseline Opioid Therapy', rightY, rightX)
  if (form.noBaselineOpioid) {
    rightY = kvTable(
      doc,
      rightY,
      [['Baseline opioid therapy', 'No baseline opioid therapy']],
      { x: rightX, width: COL_WIDTH },
    )
  } else {
    const baselineRows = filledRows(form.baselineOpioids, (row) => [
      tableCell(row.drug),
      tableCell(row.dose),
      tableCell(row.route),
    ])
    rightY = addTable(doc, rightY, ['Opioid / drug', 'Dose', 'Route'], baselineRows, {
      0: { cellWidth: COL_WIDTH * 0.4 },
      1: { cellWidth: COL_WIDTH * 0.28 },
      2: { cellWidth: COL_WIDTH * 0.32 },
    }, { x: rightX, width: COL_WIDTH })
  }

  rightY = sectionTitle(doc, 'F. Opioid Tolerance', rightY, rightX)
  rightY = kvTable(
    doc,
    rightY,
    [['Opioid tolerance', yesNo(form.opioidTolerance)]],
    { x: rightX, width: COL_WIDTH },
  )

  rightY = sectionTitle(doc, 'G. Previous Opioid Response', rightY, rightX)
  const previousRows = filledRows(form.previousResponses, (row) => [
    tableCell(row.opioid),
    tableCell(row.response),
  ])
  rightY = addTable(doc, rightY, ['Opioid', 'Previous response'], previousRows, {
    0: { cellWidth: COL_WIDTH * 0.42 },
    1: { cellWidth: COL_WIDTH * 0.58 },
  }, { x: rightX, width: COL_WIDTH })

  rightY = sectionTitle(doc, 'H. Allergy / Intolerance', rightY, rightX)
  if (form.noKnownAllergy) {
    rightY = kvTable(
      doc,
      rightY,
      [['Allergy / intolerance', 'No known opioid allergy/intolerance']],
      { x: rightX, width: COL_WIDTH },
    )
  } else {
    const allergyRows = filledRows(form.allergies, (row) => [
      tableCell(row.drug),
      tableCell(row.reaction),
    ])
    rightY = addTable(doc, rightY, ['Drug', 'Reaction'], allergyRows, {
      0: { cellWidth: COL_WIDTH * 0.42 },
      1: { cellWidth: COL_WIDTH * 0.58 },
    }, { x: rightX, width: COL_WIDTH })
  }

  rightY = sectionTitle(doc, 'I. CYP2D6 Pharmacogenomics Inputs', rightY, rightX)
  const pgxRows = [['CYP2D6 genotype available?', yesNo(form.genotypeAvailable)]]
  if (form.genotypeAvailable === 'Yes') {
    pgxRows.push(
      ['Allele 1', displayValue(form.allele1)],
      ['Allele 2', displayValue(form.allele2)],
      ['CNV present?', form.hasCnv ? 'Yes' : 'No'],
    )
    if (form.hasCnv) {
      pgxRows.push(
        ['Copy number', displayValue(form.copyNumber)],
        ['Duplicated allele', displayValue(form.duplicatedAllele)],
      )
    }
  }
  rightY = kvTable(doc, rightY, pgxRows, { x: rightX, width: COL_WIDTH })
  return Math.max(leftY, rightY)
}

function drawTopRankedCard(doc, result, y) {
  const preferred = result?.preferred
  const height = preferred ? 26 : 16
  fill(doc, COLORS.blush)
  doc.roundedRect(PAGE.marginX, y, CONTENT_WIDTH, height, 1.6, 1.6, 'F')
  stroke(doc, [248, 214, 219])
  doc.setLineWidth(0.18)
  doc.roundedRect(PAGE.marginX, y, CONTENT_WIDTH, height, 1.6, 1.6, 'S')

  rgb(doc, COLORS.primary)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(TYPE.small)
  doc.text('Top-Ranked Option', PAGE.marginX + 4, y + 4.6)

  if (!preferred) {
    rgb(doc, COLORS.ink)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(TYPE.body)
    const message = result?.mlError
      ? result.mlError
      : 'No rankable opioid remains after safety review.'
    const lines = doc.splitTextToSize(message, CONTENT_WIDTH - 8)
    doc.text(lines, PAGE.marginX + 4, y + 10)
    return y + height + 3.4
  }

  rgb(doc, COLORS.burgundy)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text(preferred.name, PAGE.marginX + 4, y + 12)

  rgb(doc, COLORS.text)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(TYPE.body)
  doc.text(`Eligibility: ${eligibilityLabel(preferred.eligibility)}`, PAGE.marginX + 4, y + 17.2)

  rgb(doc, COLORS.ink)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(TYPE.small)
  doc.text('Predicted pain reduction at 60 min', PAGE.marginX + 88, y + 9.2)
  doc.setFontSize(13)
  rgb(doc, COLORS.primaryDark)
  doc.text(predictedDeltaLabel(preferred), PAGE.marginX + 88, y + 16)

  rgb(doc, COLORS.muted)
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(6.1)
  doc.text(COPY.predictionNote, PAGE.marginX + 4, y + 22.8)

  return y + height + 3.8
}

function pgxOutputRows(pgx = {}) {
  const rows = []
  if (pgx.genotypeAvailable) {
    if (pgx.activityScore != null && pgx.activityScore !== '') {
      rows.push(['Genotype activity score', tableCell(pgx.activityScore)])
    }
    if (pgx.predictedPhenotype) {
      rows.push(['Genotype-predicted phenotype', pgx.predictedPhenotype])
    }
    if (pgx.inhibitorExposure) {
      rows.push(['CYP2D6 inhibitor exposure', pgx.inhibitorExposure === 'None' ? 'None' : 'Present'])
      rows.push(['Inhibitor strength', tableCell(pgx.inhibitorExposure)])
    }
    if (pgx.inhibitorAgents?.length) {
      rows.push(['Inhibitor agent(s)', pgx.inhibitorAgents.join(', ')])
    }
    if (pgx.adjustedScore != null && pgx.adjustedScore !== '') {
      rows.push(['Adjusted activity score', tableCell(pgx.adjustedScore)])
    }
    if (pgx.functionalPhenotype) {
      rows.push(['Functional phenotype', pgx.functionalPhenotype])
    }
    if (pgx.genotypeAvailable && (pgx.phenoconversion === true || pgx.phenoconversion === false)) {
      rows.push(['Phenoconversion', pgx.phenoconversion ? 'Yes' : 'No'])
    }
    if (pgx.error) rows.push(['PGx interpretation note', pgx.error])
    return rows
  }

  rows.push(['CYP2D6 genotype', 'Not available'])
  if (pgx.inhibitorExposure && pgx.inhibitorExposure !== 'None') {
    rows.push(['CYP2D6 inhibitor exposure', 'Present'])
    rows.push(['Inhibitor strength', pgx.inhibitorExposure])
    if (pgx.inhibitorAgents?.length) {
      rows.push(['Inhibitor agent(s)', pgx.inhibitorAgents.join(', ')])
    }
    if (pgx.inhibitionRisk?.message) {
      rows.push(['Inhibition risk alert', pgx.inhibitionRisk.message])
    }
  } else {
    rows.push(['CYP2D6 inhibitor exposure', tableCell(pgx.inhibitorExposure)])
    rows.push(['Inhibitor strength', tableCell(pgx.inhibitorExposure)])
  }
  return rows
}

function safetyRows(form, result) {
  const safety = result?.safety || {}
  const rows = []
  if (result?.error) {
    rows.push(['Renal safety', 'Cannot be fully assessed', result.error])
  } else if (safety.renal) {
    rows.push(['Renal safety', safety.renal.title, safety.renal.message])
  }
  if (safety.hepatic) {
    rows.push(['Hepatic assessment', safety.hepatic.title, safety.hepatic.message])
  }
  const pgxRestricted = (result?.evaluated || []).filter((item) =>
    (item.safetyFlags || []).some((flag) => flag.type === 'pgx'),
  )
  if (pgxRestricted.length) {
    rows.push([
      'CYP2D6-related restriction',
      pgxRestricted.map((item) => `${item.name}: ${eligibilityLabel(item.eligibility)}`).join('; '),
      pgxRestricted
        .map(
          (item) =>
            item.reasons?.find((reason) => /CYP2D6|metabolizer|inhibition/i.test(reason)) ||
            item.note ||
            '—',
        )
        .join(' '),
    ])
  }
  if (safety.interaction) {
    rows.push(['CNS depressant warning', safety.interaction.title, safety.interaction.message])
  }
  if (safety.allergy) {
    rows.push(['Allergy / intolerance', safety.allergy.title, safety.allergy.message])
  }
  const previous = (form.previousResponses || []).filter((row) => row.opioid && row.response)
  if (previous.length) {
    const finding = result?.explanation?.findings?.find((item) =>
      /previous responses|previous opioid/i.test(item),
    )
    rows.push([
      'Previous opioid response',
      previous.map((row) => `${row.opioid}: ${row.response}`).join('; '),
      finding || '—',
    ])
  }
  return rows
}

function page2Content(doc, form, result, y) {
  y = drawTopRankedCard(doc, result, y)

  y = sectionTitle(doc, 'Ranked Opioid Strategies', y)
  const ranked = rankedOpioids(result).map((item, index) => [
    String(index + 1),
    item.name,
    eligibilityLabel(item.eligibility),
    predictedDeltaLabel(item),
    item.note || (item.reasons?.length ? item.reasons.join(' ') : '—'),
  ])

  autoTable(doc, {
    ...tableTheme(),
    startY: y,
    margin: { left: PAGE.marginX, right: PAGE.marginX, bottom: 16 },
    tableWidth: CONTENT_WIDTH,
    head: [['Rank', 'Opioid', 'Eligibility', 'Predicted dPain60', 'Key clinical notes']],
    body: ranked,
    pageBreak: 'avoid',
    rowPageBreak: false,
    horizontalPageBreak: false,
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 30 },
      2: { cellWidth: 22 },
      3: { cellWidth: 32 },
      4: { cellWidth: CONTENT_WIDTH - 96 },
    },
    didParseCell: (data) => {
      if (data.section !== 'body' || data.column.index !== 2) return
      const status = data.cell.raw
      if (status === 'Eligible') {
        data.cell.styles.textColor = COLORS.eligible
        data.cell.styles.fillColor = COLORS.eligibleBg
        data.cell.styles.fontStyle = 'bold'
      } else if (status === 'Caution') {
        data.cell.styles.textColor = COLORS.caution
        data.cell.styles.fillColor = COLORS.cautionBg
        data.cell.styles.fontStyle = 'bold'
      } else if (status === 'Avoid') {
        data.cell.styles.textColor = COLORS.avoid
        data.cell.styles.fillColor = COLORS.avoidBg
        data.cell.styles.fontStyle = 'bold'
      }
    },
  })
  y = doc.lastAutoTable.finalY + 3.2

  y = sectionTitle(doc, 'Dose Guidance', y)
  fill(doc, [252, 250, 249])
  doc.roundedRect(PAGE.marginX, y - 2, CONTENT_WIDTH, 7.6, 1.1, 1.1, 'F')
  rgb(doc, COLORS.ink)
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(TYPE.body)
  doc.text(COPY.doseStatement, PAGE.marginX + 3, y + 2.6)
  y += 8.6

  y = sectionTitle(doc, 'Pharmacogenomic Findings', y)
  y = kvTable(doc, y, pgxOutputRows(result?.pgx || {}))

  y = sectionTitle(doc, 'Safety Findings', y)
  y = addTable(doc, y, ['Category', 'Finding', 'Clinical interpretation'], safetyRows(form, result), {
    0: { cellWidth: 36 },
    1: { cellWidth: 46 },
    2: { cellWidth: CONTENT_WIDTH - 82 },
  })

  y = sectionTitle(doc, 'Rule-Based Findings', y)
  const findings = result?.explanation?.findings || []
  const findingRows = findings.length
    ? findings.map((finding, index) => [String(index + 1), finding])
    : [['—', 'No rule-based findings were returned for this assessment.']]
  y = addTable(doc, y, ['#', 'Finding'], findingRows, {
    0: { cellWidth: 9, halign: 'center' },
    1: { cellWidth: CONTENT_WIDTH - 9 },
  })

  const lines = doc.splitTextToSize(COPY.disclaimer, CONTENT_WIDTH - 8)
  const boxH = Math.min(18, 5.2 + lines.length * 2.85)
  const boxTop = Math.max(y, PAGE.contentBottom - boxH)
  fill(doc, COLORS.blush)
  doc.roundedRect(PAGE.marginX, boxTop, CONTENT_WIDTH, boxH, 1.2, 1.2, 'F')
  rgb(doc, COLORS.burgundy)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.2)
  doc.text('DISCLAIMER', PAGE.marginX + 3, boxTop + 3.3)
  rgb(doc, COLORS.ink)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.2)
  doc.text(lines, PAGE.marginX + 3, boxTop + 6.8)
  return boxTop + boxH
}

export function createScdaidPdfDoc({ form, result, user } = {}) {
  if (!result) {
    throw new Error('No assessment result is available to export.')
  }

  const images = getReportImages()
  const meta = buildReportMeta(form || {}, result)
  const clinicianName = clinicianLabel(user)
  const filename = pdfFilename(buildFilename(meta))

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })

  drawHeader(doc, images, COPY.page1Subtitle)
  let y = drawMetadataStrip(doc, meta, clinicianName, 39)
  page1Content(doc, form || {}, result, y)
  drawFooter(doc, 1)

  doc.addPage('a4', 'portrait')
  drawHeader(doc, images, COPY.page2Subtitle)
  y = drawMetadataStrip(doc, meta, clinicianName, 39)
  page2Content(doc, form || {}, result, y)
  drawFooter(doc, 2)

  const pageCount = doc.getNumberOfPages()
  if (pageCount > 2) {
    throw new Error(
      `SCDAid report overflowed to ${pageCount} pages. The official report must stay on two A4 pages.`,
    )
  }

  return { doc, filename, pageCount, meta }
}

export function generateScdaidReport(opts = {}) {
  const { doc, filename, pageCount } = createScdaidPdfDoc(opts)
  doc.save(filename)
  return { filename, pageCount, doc }
}
