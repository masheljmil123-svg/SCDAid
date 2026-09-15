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
const LOGO_H = 11
const LOGO_W = LOGO_H * (1024 / 341)
const SECTION_BLOCK_MIN = 28

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

function sectionSubtitle(section) {
  return section === 'outputs' ? COPY.page2Subtitle : COPY.page1Subtitle
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
  doc.text(COPY.kicker, PAGE.marginX, 20.6)

  rgb(doc, COLORS.burgundy)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(TYPE.title)
  doc.text(COPY.title, PAGE.marginX, 27.6)

  rgb(doc, COLORS.primaryDark)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(TYPE.subtitle)
  doc.text(subtitle, PAGE.marginX, 33.4)

  rgb(doc, COLORS.muted)
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(TYPE.small)
  doc.text(COPY.tagline, PAGE.marginX, 38.4)

  stroke(doc, COLORS.border)
  doc.setLineWidth(0.22)
  doc.line(PAGE.marginX, PAGE.headerBottom, PAGE.width - PAGE.marginX, PAGE.headerBottom)
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
  const height = 6.4 * rows + 2.6
  fill(doc, COLORS.blush)
  doc.roundedRect(PAGE.marginX, y, CONTENT_WIDTH, height, 1.2, 1.2, 'F')

  const colW = CONTENT_WIDTH / 3
  cells.forEach((pair, index) => {
    const col = index % 3
    const row = Math.floor(index / 3)
    const x = PAGE.marginX + 3 + col * colW
    const cy = y + 3.4 + row * 5.8
    rgb(doc, COLORS.muted)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.text(pair[0].toUpperCase(), x, cy)
    rgb(doc, COLORS.ink)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(TYPE.meta)
    doc.text(String(pair[1]), x, cy + 3.3)
  })

  return y + height + 5
}

function drawFooter(doc, pageNumber, totalPages) {
  stroke(doc, COLORS.border)
  doc.setLineWidth(0.18)
  doc.line(PAGE.marginX, PAGE.footerY - 3, PAGE.width - PAGE.marginX, PAGE.footerY - 3)

  rgb(doc, COLORS.muted)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(TYPE.footer)
  doc.text(COPY.footerLeft, PAGE.marginX, PAGE.footerY)
  doc.text(COPY.footerCenter, PAGE.width / 2, PAGE.footerY, { align: 'center' })
  doc.text(`Page ${pageNumber} of ${totalPages}`, PAGE.width - PAGE.marginX, PAGE.footerY, {
    align: 'right',
  })
}

function decorateCurrentPage(ctx) {
  const page = ctx.doc.internal.getCurrentPageInfo().pageNumber
  if (ctx.decorated.has(page)) return
  ctx.decorated.add(page)
  drawHeader(ctx.doc, ctx.images, sectionSubtitle(ctx.section))
}

function addReportPage(ctx) {
  ctx.doc.addPage('a4', 'portrait')
  decorateCurrentPage(ctx)
  return PAGE.contentStartY
}

function ensureSpace(ctx, y, needed) {
  if (y + needed <= PAGE.contentBottom) return y
  return addReportPage(ctx)
}

function sectionTitle(ctx, title, y) {
  y = ensureSpace(ctx, y, SECTION_BLOCK_MIN)
  const { doc } = ctx
  rgb(doc, COLORS.burgundy)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(TYPE.section)
  doc.text(title, PAGE.marginX, y)
  stroke(doc, COLORS.primary)
  doc.setLineWidth(0.3)
  doc.line(PAGE.marginX, y + 1.2, PAGE.marginX + 16, y + 1.2)
  return y + 6
}

function tableMargins() {
  return {
    left: PAGE.marginX,
    right: PAGE.marginX,
    top: PAGE.contentStartY,
    bottom: 20,
  }
}

function addTable(ctx, startY, head, body, columnStyles = {}) {
  const rows = body.length
    ? body
    : [head.map((_, index) => (index === 0 ? 'Not provided' : '—'))]

  autoTable(ctx.doc, {
    ...tableTheme(),
    startY,
    margin: tableMargins(),
    tableWidth: CONTENT_WIDTH,
    head: [head],
    body: rows,
    columnStyles,
    pageBreak: 'auto',
    rowPageBreak: false,
    horizontalPageBreak: false,
    showHead: 'everyPage',
    willDrawPage: () => {
      decorateCurrentPage(ctx)
    },
    didDrawPage: () => {
      decorateCurrentPage(ctx)
    },
  })
  return ctx.doc.lastAutoTable.finalY + 4
}

function kvTable(ctx, y, rows) {
  return addTable(ctx, y, ['Field', 'Value'], rows, {
    0: { cellWidth: 62, fontStyle: 'bold', textColor: COLORS.burgundy },
    1: { cellWidth: CONTENT_WIDTH - 62 },
  })
}

function drawInputSections(ctx, form, result, y) {
  y = sectionTitle(ctx, 'A. Patient & VOC', y)
  y = kvTable(ctx, y, [
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
  ])

  y = sectionTitle(ctx, 'B. Relevant Vital Signs', y)
  const vitalRows = filledRows(form.vitalSigns, (row) => [
    tableCell(row.name),
    tableCell(row.value),
    tableCell(row.unit),
  ])
  y = addTable(ctx, y, ['Parameter', 'Value', 'Unit'], vitalRows, {
    0: { cellWidth: 70 },
    1: { cellWidth: 50 },
    2: { cellWidth: CONTENT_WIDTH - 120 },
  })

  y = sectionTitle(ctx, 'C. Organ Function', y)
  y = kvTable(ctx, y, [
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
  ])
  const liverRows = filledRows(form.liverTests, (row) => [
    tableCell(row.name),
    tableCell(row.value),
    tableCell(row.unit),
  ])
  y = addTable(ctx, y, ['Liver test', 'Value', 'Unit'], liverRows, {
    0: { cellWidth: 70 },
    1: { cellWidth: 50 },
    2: { cellWidth: CONTENT_WIDTH - 120 },
  })

  y = sectionTitle(ctx, 'D. Current Medications', y)
  y = addTable(ctx, y, ['Medication', 'Relevant flag'], medicationRows(form, result?.pgx), {
    0: { cellWidth: 78 },
    1: { cellWidth: CONTENT_WIDTH - 78 },
  })

  y = sectionTitle(ctx, 'E. Baseline Opioid Therapy', y)
  if (form.noBaselineOpioid) {
    y = kvTable(ctx, y, [['Baseline opioid therapy', 'No baseline opioid therapy']])
  } else {
    const baselineRows = filledRows(form.baselineOpioids, (row) => [
      tableCell(row.drug),
      tableCell(row.dose),
      tableCell(row.route),
    ])
    y = addTable(ctx, y, ['Opioid / drug', 'Dose', 'Route'], baselineRows, {
      0: { cellWidth: 70 },
      1: { cellWidth: 50 },
      2: { cellWidth: CONTENT_WIDTH - 120 },
    })
  }

  y = sectionTitle(ctx, 'F. Opioid Tolerance', y)
  y = kvTable(ctx, y, [['Opioid tolerance', yesNo(form.opioidTolerance)]])

  y = sectionTitle(ctx, 'G. Previous Opioid Response', y)
  const previousRows = filledRows(form.previousResponses, (row) => [
    tableCell(row.opioid),
    tableCell(row.response),
  ])
  y = addTable(ctx, y, ['Opioid', 'Previous response'], previousRows, {
    0: { cellWidth: 78 },
    1: { cellWidth: CONTENT_WIDTH - 78 },
  })

  y = sectionTitle(ctx, 'H. Allergy / Intolerance', y)
  if (form.noKnownAllergy) {
    y = kvTable(ctx, y, [['Allergy / intolerance', 'No known opioid allergy/intolerance']])
  } else {
    const allergyRows = filledRows(form.allergies, (row) => [
      tableCell(row.drug),
      tableCell(row.reaction),
    ])
    y = addTable(ctx, y, ['Drug', 'Reaction'], allergyRows, {
      0: { cellWidth: 78 },
      1: { cellWidth: CONTENT_WIDTH - 78 },
    })
  }

  y = sectionTitle(ctx, 'I. CYP2D6 Pharmacogenomics Inputs', y)
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
  return kvTable(ctx, y, pgxRows)
}

function drawTopRankedCard(ctx, result, y) {
  const preferred = result?.preferred
  const height = preferred ? 32 : 20
  y = ensureSpace(ctx, y, height + 4)
  const { doc } = ctx

  fill(doc, COLORS.blush)
  doc.roundedRect(PAGE.marginX, y, CONTENT_WIDTH, height, 1.6, 1.6, 'F')
  stroke(doc, [248, 214, 219])
  doc.setLineWidth(0.18)
  doc.roundedRect(PAGE.marginX, y, CONTENT_WIDTH, height, 1.6, 1.6, 'S')

  rgb(doc, COLORS.primary)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(TYPE.small)
  doc.text('Top-Ranked Option', PAGE.marginX + 4, y + 5.4)

  if (!preferred) {
    rgb(doc, COLORS.ink)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(TYPE.body)
    const message = result?.mlError
      ? result.mlError
      : 'No rankable opioid remains after safety review.'
    const lines = doc.splitTextToSize(message, CONTENT_WIDTH - 8)
    doc.text(lines, PAGE.marginX + 4, y + 12)
    return y + height + 5
  }

  rgb(doc, COLORS.burgundy)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text(preferred.name, PAGE.marginX + 4, y + 14.2)

  rgb(doc, COLORS.text)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(TYPE.body)
  doc.text(`Eligibility: ${eligibilityLabel(preferred.eligibility)}`, PAGE.marginX + 4, y + 20.4)

  rgb(doc, COLORS.ink)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(TYPE.small)
  doc.text('Predicted pain reduction at 60 min', PAGE.marginX + 92, y + 10.4)
  doc.setFontSize(14)
  rgb(doc, COLORS.primaryDark)
  doc.text(predictedDeltaLabel(preferred), PAGE.marginX + 92, y + 18)

  rgb(doc, COLORS.muted)
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(TYPE.small)
  doc.text(COPY.predictionNote, PAGE.marginX + 4, y + 27.2)

  return y + height + 5
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

function drawOutputSections(ctx, form, result, y) {
  y = drawTopRankedCard(ctx, result, y)

  y = sectionTitle(ctx, 'Ranked Opioid Strategies', y)
  const ranked = rankedOpioids(result).map((item, index) => [
    String(index + 1),
    item.name,
    eligibilityLabel(item.eligibility),
    predictedDeltaLabel(item),
    item.note || (item.reasons?.length ? item.reasons.join(' ') : '—'),
  ])

  autoTable(ctx.doc, {
    ...tableTheme(),
    startY: y,
    margin: tableMargins(),
    tableWidth: CONTENT_WIDTH,
    head: [['Rank', 'Opioid', 'Eligibility', 'Predicted dPain60', 'Key clinical notes']],
    body: ranked,
    pageBreak: 'auto',
    rowPageBreak: false,
    horizontalPageBreak: false,
    showHead: 'everyPage',
    columnStyles: {
      0: { cellWidth: 14, halign: 'center' },
      1: { cellWidth: 32 },
      2: { cellWidth: 24 },
      3: { cellWidth: 34 },
      4: { cellWidth: CONTENT_WIDTH - 104 },
    },
    willDrawPage: () => {
      decorateCurrentPage(ctx)
    },
    didDrawPage: () => {
      decorateCurrentPage(ctx)
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
  y = ctx.doc.lastAutoTable.finalY + 5

  y = sectionTitle(ctx, 'Dose Guidance', y)
  const doseHeight = 10
  y = ensureSpace(ctx, y, doseHeight + 2)
  fill(ctx.doc, [252, 250, 249])
  ctx.doc.roundedRect(PAGE.marginX, y - 2.2, CONTENT_WIDTH, doseHeight, 1.1, 1.1, 'F')
  rgb(ctx.doc, COLORS.ink)
  ctx.doc.setFont('helvetica', 'italic')
  ctx.doc.setFontSize(TYPE.body)
  ctx.doc.text(COPY.doseStatement, PAGE.marginX + 3.2, y + 3.6)
  y += doseHeight + 4

  y = sectionTitle(ctx, 'Pharmacogenomic Findings', y)
  y = kvTable(ctx, y, pgxOutputRows(result?.pgx || {}))

  y = sectionTitle(ctx, 'Safety Findings', y)
  y = addTable(
    ctx,
    y,
    ['Category', 'Finding', 'Clinical interpretation'],
    safetyRows(form, result),
    {
      0: { cellWidth: 40 },
      1: { cellWidth: 48 },
      2: { cellWidth: CONTENT_WIDTH - 88 },
    },
  )

  y = sectionTitle(ctx, 'Rule-Based Findings', y)
  const findings = result?.explanation?.findings || []
  const findingRows = findings.length
    ? findings.map((finding, index) => [String(index + 1), finding])
    : [['—', 'No rule-based findings were returned for this assessment.']]
  y = addTable(ctx, y, ['#', 'Finding'], findingRows, {
    0: { cellWidth: 12, halign: 'center' },
    1: { cellWidth: CONTENT_WIDTH - 12 },
  })

  const { doc } = ctx
  const lines = doc.splitTextToSize(COPY.disclaimer, CONTENT_WIDTH - 8)
  const boxH = 8 + lines.length * 3.6
  y = ensureSpace(ctx, y, boxH + 2)
  fill(doc, COLORS.blush)
  doc.roundedRect(PAGE.marginX, y, CONTENT_WIDTH, boxH, 1.2, 1.2, 'F')
  rgb(doc, COLORS.burgundy)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(TYPE.small)
  doc.text('DISCLAIMER', PAGE.marginX + 3.2, y + 4.2)
  rgb(doc, COLORS.ink)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(TYPE.small)
  doc.text(lines, PAGE.marginX + 3.2, y + 8.4)
  return y + boxH
}

function stampAllFooters(doc) {
  const total = doc.getNumberOfPages()
  for (let page = 1; page <= total; page += 1) {
    doc.setPage(page)
    drawFooter(doc, page, total)
  }
}

function validatePages(doc) {
  const total = doc.getNumberOfPages()
  if (total < 1) {
    throw new Error('SCDAid report did not generate any pages.')
  }

  for (let page = 1; page <= total; page += 1) {
    doc.setPage(page)
    const size = doc.internal.pageSize
    const width = Number(size.getWidth())
    const height = Number(size.getHeight())
    if (Math.abs(width - PAGE.width) > 0.4 || Math.abs(height - PAGE.height) > 0.4) {
      throw new Error(
        `SCDAid report page ${page} is ${width.toFixed(1)}×${height.toFixed(1)} mm; A4 portrait is required.`,
      )
    }
    if (width > height) {
      throw new Error(`SCDAid report page ${page} is landscape; portrait A4 is required.`)
    }
  }
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
  const ctx = {
    doc,
    images,
    meta,
    clinicianName,
    section: 'inputs',
    decorated: new Set(),
  }

  decorateCurrentPage(ctx)
  let y = drawMetadataStrip(doc, meta, clinicianName, 43.2)
  drawInputSections(ctx, form || {}, result, y)

  ctx.section = 'outputs'
  doc.addPage('a4', 'portrait')
  decorateCurrentPage(ctx)
  y = drawMetadataStrip(doc, meta, clinicianName, 43.2)
  drawOutputSections(ctx, form || {}, result, y)

  stampAllFooters(doc)
  validatePages(doc)

  return { doc, filename, pageCount: doc.getNumberOfPages(), meta }
}

export function generateScdaidReport(opts = {}) {
  const { doc, filename, pageCount } = createScdaidPdfDoc(opts)
  doc.save(filename)
  return { filename, pageCount, doc }
}
