// SCDAid - app.js (Clean rebuild + Phenotype Prediction API)
// - Light UI
// - Weight unit: kg/lb (converted to kg internally)
// - Output dose unit: mg/mcg/g with alternative in parentheses
// - Safety blocks show ONLY for meds that appear in plan + primary opioid
// - Adds phenotype prediction call to local API (FastAPI) and auto-fills CYP2D6 phenotype

const $ = (id) => document.getElementById(id);

let lang = "EN";

const LINKS = {
  MOH: "https://www.moh.gov.sa/Ministry/MediaCenter/Publications/Documents/Protocol-001.pdf",
  CPIC: "https://ascpt.onlinelibrary.wiley.com/doi/10.1002/cpt.2149",
  ASH: "https://ashpublications.org/bloodadvances/article/4/12/2656/461665",
  OWSIANY: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6917891/",
};

// API endpoint (local)
const API_BASE = "http://127.0.0.1:8000";

const TXT = {
  EN: {
    title: "SCDAid",
    subtitle:
      "SCD VOC analgesia decision support — Severity + CPIC (CYP2D6) + Renal & Safety guardrails",
    patientInputsTitle: "Patient Inputs",
    ageLabel: "Age (years) *",
    weightLabel: "Weight *",
    weightHint: "Used to calculate adult starting doses.",
    egfrLabel: "eGFR (mL/min/1.73m²) *",
    egfrHint: "Enter eGFR (mL/min/1.73m²).",
    doseUnitLabel: "Output Dose Unit",
    doseUnitHint: "Controls the unit used when displaying calculated doses.",
    crisesLabel: "Pain crises/year (optional)",
    severityLabel: "Pain severity *",
    genoAvailLabel: "CYP2D6 genotype availability",
    genoAvailHint: "If unknown, tool avoids CYP2D6-dependent opioids.",
    cypLabel: "CYP2D6 phenotype",
    opioidTolLabel: "Opioid tolerant",
    sedativesLabel: "Concurrent sedatives",
    respRiskLabel: "Respiratory risk",
    acsLabel: "Suspected ACS",
    morphineAllergyLabel: "Morphine allergy",
    runBtn: "Run Algorithm",
    resetBtn: "Reset",
    disclaimerText: "Educational prototype only. Not a substitute for clinical judgment.",
    resultsTitle: "Results",
    placeholderText: 'Enter inputs then click "Run Algorithm".',
    refsTitle: "References",

    // NEW
    phenoPredTitle: "Phenotype Prediction (API)",
    phenoPredHint: "Optional: use local API to predict CYP2D6 phenotype and auto-fill the field above.",
    sexLabel: "Sex",
    inhibitorLabel: "CYP2D6 inhibitor",
    inhibitorHint: "Examples: strong CYP2D6 inhibitors may reduce CYP2D6 activity.",
    codeineRespLabel: "Prior codeine response",
    tramadolRespLabel: "Prior tramadol response",
    predictBtn: "Predict Phenotype",
    predictStatusIdle: "API: local only (requires server running).",
    predictLoading: "Predicting…",
    predictApplied: "Applied to CYP2D6 phenotype.",
    predictApiDown: "API not reachable. Keep the terminal server running.",
    predictBad: "Prediction failed. Check API logs.",

    pills: {
      low: "Low renal risk",
      moderate: "Moderate renal risk",
      high: "High renal risk",
      ok: "OK",
      avoid: "Avoid",
    },
    sections: {
      renal: "Renal Stratification",
      dosing: "Adult IV Opioid Starting Dose",
      plan: "Recommended Plan",
      options: "Optional Next Steps",
      monitoring: "General VOC Monitoring",
      safety: "Medication Safety Monitoring",
      avoid: "Avoid / Contraindications",
      stops: "Safety Stops",
    },
    errors: {
      age: "Age is required.",
      weight: "Weight is required.",
      egfr: "eGFR is required.",
    },
  },

  AR: {
    title: "SCDAid",
    subtitle:
      "أداة دعم قرار لألم نوبة الانسداد الوعائي — الشدة + CYP2D6 (CPIC) + اعتبارات الكلى والسلامة",
    patientInputsTitle: "بيانات المريض",
    ageLabel: "العمر (سنة) *",
    weightLabel: "الوزن *",
    weightHint: "يستخدم لحساب جرعات البداية للكبار.",
    egfrLabel: "eGFR (مل/دقيقة/1.73م²) *",
    egfrHint: "ادخل eGFR (مل/دقيقة/1.73م²).",
    doseUnitLabel: "وحدة الجرعة (المخرجات)",
    doseUnitHint: "تحدد وحدة عرض الجرعات المحسوبة.",
    crisesLabel: "عدد النوبات/سنة (اختياري)",
    severityLabel: "شدة الألم *",
    genoAvailLabel: "توفر جينوتايب CYP2D6",
    genoAvailHint: "إذا غير معروف، تتجنب الأداة الخيارات المعتمدة على CYP2D6.",
    cypLabel: "فينوتايب CYP2D6",
    opioidTolLabel: "تحمل للأفيونات",
    sedativesLabel: "مهدئات مصاحبة",
    respRiskLabel: "خطورة تنفسية",
    acsLabel: "اشتباه ACS",
    morphineAllergyLabel: "حساسية مورفين",
    runBtn: "تشغيل الخوارزمية",
    resetBtn: "مسح",
    disclaimerText: "نموذج تعليمي فقط. لا يغني عن الحكم السريري.",
    resultsTitle: "النتائج",
    placeholderText: "ادخل البيانات ثم اضغط تشغيل الخوارزمية.",
    refsTitle: "المراجع",

    // NEW
    phenoPredTitle: "تنبؤ الفينوتايب (API)",
    phenoPredHint: "اختياري: استخدمي الـ API المحلي للتنبؤ بـ CYP2D6 وتعبئة الخانة تلقائيًا.",
    sexLabel: "الجنس",
    inhibitorLabel: "مثبط CYP2D6",
    inhibitorHint: "مثال: بعض المثبطات القوية تقلل نشاط CYP2D6.",
    codeineRespLabel: "استجابة سابقة للكودايين",
    tramadolRespLabel: "استجابة سابقة للترامادول",
    predictBtn: "تنبؤ الفينوتايب",
    predictStatusIdle: "الـ API محلي فقط (لازم السيرفر شغال).",
    predictLoading: "جاري التنبؤ…",
    predictApplied: "تمت تعبئة الفينوتايب في الأعلى.",
    predictApiDown: "الـ API غير متاح. تأكدي السيرفر شغال في الترمنال.",
    predictBad: "فشل التنبؤ. راجعي سجلات الـ API.",

    pills: {
      low: "خطورة كلوية منخفضة",
      moderate: "خطورة كلوية متوسطة",
      high: "خطورة كلوية عالية",
      ok: "مسموح",
      avoid: "تجنب",
    },
    sections: {
      renal: "تصنيف الكلى",
      dosing: "جرعة بداية IV للكبار",
      plan: "الخطة المقترحة",
      options: "خيارات إضافية",
      monitoring: "مراقبة عامة لنوبة VOC",
      safety: "مراقبة سلامة الأدوية",
      avoid: "تجنب / موانع",
      stops: "قواعد الإيقاف",
    },
    errors: {
      age: "العمر مطلوب.",
      weight: "الوزن مطلوب.",
      egfr: "eGFR مطلوب.",
    },
  },
};

// ---------- Utils ----------
function num(v) {
  const x = Number(String(v ?? "").trim());
  return Number.isFinite(x) ? x : null;
}

function lbToKg(lb) {
  return lb * 0.45359237;
}

function riskRenal(eGFR) {
  if (eGFR === null) return "unknown";
  if (eGFR < 30) return "high";
  if (eGFR < 60) return "moderate";
  return "low";
}

function pillClass(risk) {
  if (risk === "high") return "danger";
  if (risk === "moderate") return "warn";
  return "ok";
}

function roundTo(x, step) {
  return Math.round(x / step) * step;
}

function mgToMcg(mg) { return mg * 1000; }
function mgToG(mg) { return mg / 1000; }
function mcgToMg(mcg) { return mcg / 1000; }

function formatDoseMultiFromMg(mg) {
  const unit = $("doseUnit")?.value || "mg";
  if (!Number.isFinite(mg)) return "-";

  if (unit === "mcg") {
    const mcg = mgToMcg(mg);
    return `${mcg.toFixed(0)} mcg (${mg.toFixed(3)} mg)`;
  }

  if (unit === "g") {
    const g = mgToG(mg);
    return `${g.toFixed(3)} g (${mg.toFixed(0)} mg)`;
  }

  // mg default
  if (mg < 2) return `${mg.toFixed(2)} mg (${mgToMcg(mg).toFixed(0)} mcg)`;
  return `${mg.toFixed(2)} mg`;
}

// ---------- Clinical blocks ----------
function generalMonitoring() {
  return [
    "Vital signs BP HR RR SpO2 Temp q15 to 30 min initially then q1 to 2 h once stable.",
    "Pain score + Sedation scale RASS PASS + Urine output q1 to 2 h.",
    "Labs CBC + Cr eGFR + LFT baseline then q12 to 24 h. SpO2 <95 prompts O2.",
    "Watch for ACS chest pain hypoxia fever. Watch compartment syndrome. Watch neuro changes.",
  ];
}

function safetyLines(drug, inputs) {
  const eGFR = inputs.eGFR;
  const renal = riskRenal(eGFR);
  const genoUnknown = inputs.genoAvail === "unknown";
  const ph = inputs.phenotype;

  const map = {
    Acetaminophen: [
      "Monitor ALT AST and Cr eGFR.",
      "Renal: safe short term if eGFR >30. If eGFR <30 use caution and monitor Cr rise.",
      "Hepatic: avoid >3 g/day if risk factors. Contra severe liver disease.",
      "Interactions: warfarin INR. Alcohol increases toxicity.",
      "Stop: ALT >2x ULN or Cr rise >=0.3 mg/dL or no pain relief.",
    ],
    NSAIDs: [
      "Monitor Cr eGFR urine output BP platelets and bleeding.",
      "Renal: avoid if eGFR <30 or AKI risk.",
      "CV: fluid retention and HTN risk.",
      "Interactions: ACEi ARB diuretics anticoagulants.",
      "Stop: Cr rise >25 percent or urine output <0.5 mL/kg/h.",
    ],
    Ketorolac: [
      "Monitor Cr eGFR urine output and GI bleed signs.",
      "Renal: contraindicated if eGFR <30. Single dose ok if eGFR >30 with close monitoring.",
      "Stop: any Cr rise or urine output drop or abdominal pain.",
    ],
    Morphine: [
      "Monitor RR SpO2 sedation frequently (q15 min initially). Watch constipation.",
      "Renal: active metabolite accumulates if eGFR <60. Consider alternatives if renal risk.",
      "Resp: if RR <12 hold opioid. If RR <10 or oversedation give naloxone.",
      "CV: hypotension risk.",
    ],
    Hydromorphone: [
      "Monitor RR SpO2 sedation frequently (q15 min initially).",
      "Renal: less accumulation than morphine but monitor closely if eGFR <60.",
      "Resp: if RR <12 hold opioid.",
    ],
    Fentanyl: [
      "Continuous RR SpO2 sedation monitoring.",
      "Renal: minimal accumulation and preferred if eGFR <30.",
      "Resp: high potency. Chest wall rigidity possible at higher IV doses.",
      "CV: bradycardia possible.",
    ],
    Ketamine: [
      "Monitor BP HR and emergence reactions.",
      "Renal: no adjustment usually required.",
      "Contra: uncontrolled HTN or psychosis history.",
      "Stop: BP >180/110 or intolerable hallucinations.",
    ],
    Oxycodone: [
      "Monitor RR sedation constipation.",
      "Renal: avoid or very low dose if eGFR <30.",
      "Interactions: CYP3A4 and CYP2D6 inhibitors can increase levels.",
      "Clinical: use as PO transition when stable and tolerating PO.",
    ],
  };

  let lines = map[drug] ? [...map[drug]] : [];

  // Dynamic cautions
  if ((drug === "NSAIDs" || drug === "Ketorolac") && renal === "high") {
    lines.unshift("RENAL HIGH RISK: avoid NSAIDs when eGFR <30 or AKI suspected.");
  }
  if (drug === "Morphine" && (renal === "moderate" || renal === "high")) {
    lines.unshift("Renal caution: consider hydromorphone or fentanyl instead of morphine.");
  }
  if (drug === "Oxycodone" && (genoUnknown || ph === "PM" || ph === "UM")) {
    lines.unshift("CYP2D6 variability may affect efficacy and toxicity. Use caution if genotype unknown or PM UM.");
  }

  return lines;
}

// ---------- Dosing ----------
function doseIVOpioid(opioid, severity, weightKg) {
  if (!weightKg || weightKg <= 0) return "-";

  if (opioid === "Morphine") {
    const mgPerKg = severity === "severe" ? 0.1 : severity === "mild" ? 0.03 : 0.05;
    const max = severity === "severe" ? 10 : severity === "mild" ? 4 : 6;
    let mg = mgPerKg * weightKg;
    mg = Math.min(mg, max);
    mg = roundTo(mg, 0.5);
    return `Morphine IV: ${formatDoseMultiFromMg(mg)} (≈ ${mgPerKg} mg/kg, max ${max} mg) q20–30 min titrate`;
  }

  if (opioid === "Hydromorphone") {
    const mgPerKg = severity === "severe" ? 0.015 : severity === "mild" ? 0.005 : 0.01;
    const max = severity === "severe" ? 1.5 : severity === "mild" ? 0.8 : 1.0;
    let mg = mgPerKg * weightKg;
    mg = Math.min(mg, max);
    mg = roundTo(mg, 0.1);
    return `Hydromorphone IV: ${formatDoseMultiFromMg(mg)} (≈ ${mgPerKg} mg/kg, max ${max} mg) q15–30 min titrate`;
  }

  if (opioid === "Fentanyl") {
    const mcgPerKg = severity === "severe" ? 1.0 : 0.5;
    const maxMcg = 100;
    let mcg = mcgPerKg * weightKg;
    mcg = Math.min(mcg, maxMcg);
    mcg = roundTo(mcg, 5);
    const mg = mcgToMg(mcg);
    return `Fentanyl IV: ${formatDoseMultiFromMg(mg)} (≈ ${mcgPerKg} mcg/kg, max ${maxMcg} mcg) q5–10 min titrate`;
  }

  return "-";
}

// ---------- Decision logic ----------
function chooseOpioid(renalRisk, morphineAllergy) {
  if (morphineAllergy) return "Hydromorphone";
  if (renalRisk === "high") return "Fentanyl";
  if (renalRisk === "moderate") return "Hydromorphone";
  return "Morphine";
}

function allowNSAID(inputs, renalRisk) {
  const renalOk = renalRisk === "low" || renalRisk === "moderate";
  return renalOk && !inputs.respRisk && !inputs.suspectedACS;
}

function chooseNSAIDName(severity) {
  return severity === "mild" ? "NSAIDs" : "Ketorolac";
}

function canOfferOxycodone(inputs, renalRisk) {
  if (renalRisk === "high") return false;
  if (inputs.respRisk || inputs.suspectedACS) return false;
  return inputs.severity !== "severe";
}

function buildPlan(inputs) {
  const renalRisk = riskRenal(inputs.eGFR);
  const meds = [];
  const options = [];
  const avoid = [];

  // Adjunct acetaminophen
  meds.push({
    name: "Acetaminophen",
    text: "Acetaminophen: 650–1000 mg PO q6–8 h (or 1 g IV q6 h). Max 3–4 g/day.",
  });

  // NSAID if allowed
  const nsaidAllowed = allowNSAID(inputs, renalRisk);
  if (nsaidAllowed) {
    const n = chooseNSAIDName(inputs.severity);
    if (n === "Ketorolac") {
      meds.push({
        name: "Ketorolac",
        text: "Ketorolac ED adjunct: 15–30 mg IV (use 15 mg if eGFR 30–59). Avoid if eGFR <30.",
      });
    } else {
      meds.push({
        name: "NSAIDs",
        text: "Ibuprofen: 400–600 mg PO q6–8 h PRN (short-term). Avoid if renal/bleeding risk.",
      });
    }
  } else {
    meds.push({
      name: "NSAIDs",
      text: "NSAIDs: avoid due to renal/ACS/respiratory risk.",
    });
  }

  // Ketamine for severe + opioid tolerant
  if (inputs.severity === "severe" && inputs.opioidTol) {
    meds.push({
      name: "Ketamine",
      text: "Low-dose ketamine: 0.1–0.3 mg/kg IV bolus or 0.1–0.3 mg/kg/hr infusion (monitor BP + emergence).",
    });
  }

  // PO transition option
  if (canOfferOxycodone(inputs, renalRisk)) {
    options.push("If stable and tolerating PO: consider oxycodone IR 5–10 mg PO q4–6 h (avoid/very low dose if eGFR <30).");
  }

  avoid.push("Meperidine: strongly not recommended due to neurotoxicity (normeperidine accumulation).");
  avoid.push("Codeine & tramadol: not recommended in acute VOC due to CYP2D6 variability and unpredictable efficacy/safety. Consider only if no IV options and genotype known.");
  if (renalRisk === "high") {
    avoid.push("Renal high risk (eGFR <30 or AKI suspected): avoid NSAIDs and avoid morphine metabolite accumulation.");
  }

  return { renalRisk, meds, options, avoid, nsaidAllowed };
}

function safetyStops(eGFR) {
  const lines = [];
  lines.push("If RR <12 hold opioid. If RR <10 or oversedation give naloxone.");
  lines.push("If SpO2 <92 or suspected ACS urgent evaluation and oxygen.");
  lines.push("If creatinine rises >=0.3 mg/dL within 48 h stop NSAIDs.");
  if (eGFR !== null && eGFR < 30) {
    lines.push("Renal: avoid NSAIDs and avoid morphine. Prefer fentanyl or hydromorphone.");
  }
  return lines;
}

// ---------- Inputs / Validation ----------
function readInputs() {
  const age = num($("ageInput")?.value);
  let weight = num($("weightInput")?.value);
  const unit = $("weightUnit")?.value || "kg";
  if (weight !== null && unit === "lb") weight = lbToKg(weight);

  const eGFR = num($("gfrInput")?.value);

  const genoAvail = $("genoAvail")?.value || "known";
  const phenotype = genoAvail === "unknown" ? "EM" : ($("cyp2d6Input")?.value || "EM");

  return {
    age,
    weightKg: weight,
    eGFR,
    crises: num($("crisesInput")?.value),
    severity: $("severityInput")?.value || "moderate",
    genoAvail,
    phenotype,
    opioidTol: !!$("opioidTol")?.checked,
    sedatives: !!$("sedatives")?.checked,
    respRisk: !!$("respRisk")?.checked,
    suspectedACS: !!$("suspectedACS")?.checked,
    morphineAllergy: !!$("morphineAllergy")?.checked,
  };
}

function validate(inputs) {
  const t = TXT[lang];
  const errs = [];
  if (inputs.age === null) errs.push(t.errors.age);
  if (inputs.weightKg === null) errs.push(t.errors.weight);
  if (inputs.eGFR === null) errs.push(t.errors.egfr);
  return errs;
}

// ---------- Phenotype Prediction (API) ----------
function setPredictStatus({ predicted, confidence, probabilities, note, mode }) {
  const el = $("predictStatus");
  if (!el) return;

  if (mode === "loading") {
    el.innerHTML = `<span class="tag info">${TXT[lang].predictLoading}</span>`;
    return;
  }

  if (mode === "error") {
    el.innerHTML = `<span class="tag low">${note || TXT[lang].predictBad}</span>`;
    return;
  }

  if (mode === "idle") {
    el.innerHTML = `<span class="small">${TXT[lang].predictStatusIdle}</span>`;
    return;
  }

  // success
  const confClass = confidence === "high" ? "high" : (confidence === "medium" ? "medium" : "low");
  const probsText = probabilities
    ? `PM ${Math.round((probabilities.PM || 0) * 100)}% · IM ${Math.round((probabilities.IM || 0) * 100)}% · NM ${Math.round((probabilities.NM || 0) * 100)}% · UM ${Math.round((probabilities.UM || 0) * 100)}%`
    : "";

  el.innerHTML = `
    <span class="tag info">Predicted: ${predicted}</span>
    <span class="tag ${confClass}">Confidence: ${confidence}</span>
    ${probsText ? `<span class="small">${probsText}</span>` : ""}
    ${note ? `<span class="small">${note}</span>` : ""}
  `;
}

async function predictPhenotype() {
  const t = TXT[lang];

  const age = num($("ageInput")?.value);
  let weightKg = num($("weightInput")?.value);
  const unit = $("weightUnit")?.value || "kg";
  if (weightKg !== null && unit === "lb") weightKg = lbToKg(weightKg);

  const egfr = num($("gfrInput")?.value);

  const errs = [];
  if (age === null) errs.push(t.errors.age);
  if (weightKg === null) errs.push(t.errors.weight);
  if (egfr === null) errs.push(t.errors.egfr);

  if (errs.length) {
    alert(errs.join("\n"));
    return;
  }

  const payload = {
    age,
    weight: weightKg,
    egfr,
    sex: $("sexInput")?.value || "F",
    cyp2d6_inhibitor: $("inhibitorInput")?.value || "no",
    prior_codeine_response: $("codeineRespInput")?.value || "ineffective",
    prior_tramadol_response: $("tramadolRespInput")?.value || "ineffective",
  };

  $("predictBtn").disabled = true;
  setPredictStatus({ mode: "loading" });

  try {
    const res = await fetch(`${API_BASE}/predict_phenotype`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      setPredictStatus({ mode: "error", note: t.predictBad });
      $("predictBtn").disabled = false;
      return;
    }

    const out = await res.json();

    // Apply to tool:
    // - set genotype availability to Known
    // - enable phenotype select
    // - set predicted value
    $("genoAvail").value = "known";
    $("cyp2d6Input").disabled = false;
    if (["PM", "IM", "NM", "UM", "EM"].includes(out.predicted)) {
      // tool uses EM label, API returns NM -> map NM to EM
      const mapped = out.predicted === "NM" ? "EM" : out.predicted;
      $("cyp2d6Input").value = mapped;
    }

    setPredictStatus({
      mode: "success",
      predicted: out.predicted,
      confidence: out.confidence,
      probabilities: out.probabilities,
      note: t.predictApplied,
    });
  } catch (e) {
    setPredictStatus({ mode: "error", note: t.predictApiDown });
  } finally {
    $("predictBtn").disabled = false;
  }
}

// ---------- Render ----------
function ul(lines) {
  return `<ul>${lines.map(x => `<li>${x}</li>`).join("")}</ul>`;
}

function render(model) {
  const t = TXT[lang];

  const renalPill = `<span class="pill ${pillClass(model.renalRisk)}">${t.pills[model.renalRisk]}</span>`;
  const nsaidPill = model.nsaidAllowed
    ? `<span class="pill ok">${t.pills.ok}</span>`
    : `<span class="pill danger">${t.pills.avoid}</span>`;

  const safetyBlocksHtml = model.safetyBlocks.map(b => `
    <div class="box">
      <h3>${b.name}</h3>
      ${ul(b.lines)}
    </div>
  `).join("");

  const html = `
    <div class="box">
      <h3>${t.sections.renal}</h3>
      <div class="pills">${renalPill}<span class="pill info">NSAID</span>${nsaidPill}</div>
      <div class="hint" style="margin-top:8px;">eGFR: <b>${model.eGFR}</b> mL/min/1.73m²</div>
    </div>

    <div class="box">
      <h3>${t.sections.dosing}</h3>
      <div>${model.ivDose}</div>
      <div class="hint" style="margin-top:8px;">Primary opioid: <b>${model.opioid}</b></div>
    </div>

    <div class="box">
      <h3>${t.sections.plan}</h3>
      ${ul(model.planMeds.map(m => m.text))}
    </div>

    <div class="box">
      <h3>${t.sections.options}</h3>
      ${model.options.length ? ul(model.options) : `<div class="hint">-</div>`}
    </div>

    <div class="box">
      <h3>${t.sections.monitoring}</h3>
      ${ul(model.monitoring)}
    </div>

    <div class="box">
      <h3>${t.sections.safety}</h3>
      ${safetyBlocksHtml || `<div class="hint">-</div>`}
    </div>

    <div class="box">
      <h3>${t.sections.avoid}</h3>
      ${ul(model.avoid)}
    </div>

    <div class="box">
      <h3>${t.sections.stops}</h3>
      ${ul(model.stops)}
    </div>
  `;

  $("results").innerHTML = html;
}

// ---------- Language ----------
function setLang(newLang) {
  lang = newLang;
  const t = TXT[lang];

  document.documentElement.dir = lang === "AR" ? "rtl" : "ltr";
  document.documentElement.lang = lang === "AR" ? "ar" : "en";

  $("titleText").textContent = t.title;
  $("subtitleText").textContent = t.subtitle;

  $("patientInputsTitle").textContent = t.patientInputsTitle;
  $("ageLabel").textContent = t.ageLabel;
  $("weightLabel").textContent = t.weightLabel;
  $("weightHint").textContent = t.weightHint;
  $("egfrLabel").textContent = t.egfrLabel;
  $("egfrHint").textContent = t.egfrHint;
  $("doseUnitLabel").textContent = t.doseUnitLabel;
  $("doseUnitHint").textContent = t.doseUnitHint;
  $("crisesLabel").textContent = t.crisesLabel;
  $("severityLabel").textContent = t.severityLabel;

  $("genoAvailLabel").textContent = t.genoAvailLabel;
  $("genoAvailHint").textContent = t.genoAvailHint;
  $("cypLabel").textContent = t.cypLabel;

  $("opioidTolLabel").textContent = t.opioidTolLabel;
  $("sedativesLabel").textContent = t.sedativesLabel;
  $("respRiskLabel").textContent = t.respRiskLabel;
  $("acsLabel").textContent = t.acsLabel;
  $("morphineAllergyLabel").textContent = t.morphineAllergyLabel;

  $("runBtn").textContent = t.runBtn;
  $("resetBtn").textContent = t.resetBtn;
  $("disclaimerText").textContent = t.disclaimerText;

  $("resultsTitle").textContent = t.resultsTitle;
  $("refsTitle").textContent = t.refsTitle;

  // NEW labels
  $("phenoPredTitle").textContent = t.phenoPredTitle;
  $("phenoPredHint").textContent = t.phenoPredHint;
  $("sexLabel").textContent = t.sexLabel;
  $("inhibitorLabel").textContent = t.inhibitorLabel;
  $("inhibitorHint").textContent = t.inhibitorHint;
  $("codeineRespLabel").textContent = t.codeineRespLabel;
  $("tramadolRespLabel").textContent = t.tramadolRespLabel;
  $("predictBtn").textContent = t.predictBtn;

  // If results are empty, refresh placeholder
  if ($("results").querySelector(".placeholder")) {
    $("placeholderText").textContent = t.placeholderText;
  }

  $("langToggle").textContent = lang === "AR" ? "EN" : "AR";

  // refresh predict status text
  setPredictStatus({ mode: "idle" });
}

// ---------- Main run ----------
function run() {
  const inputs = readInputs();
  const errs = validate(inputs);
  if (errs.length) {
    alert(errs.join("\n"));
    return;
  }

  const plan = buildPlan(inputs);
  const opioid = chooseOpioid(plan.renalRisk, inputs.morphineAllergy);
  const ivDose = doseIVOpioid(opioid, inputs.severity, inputs.weightKg);

  // Safety blocks only for meds in plan + primary opioid
  const safetyNames = new Set([opioid]);
  plan.meds.forEach(m => safetyNames.add(m.name));

  const safetyBlocks = Array.from(safetyNames).map(name => ({
    name,
    lines: safetyLines(name, inputs),
  }));

  const model = {
    eGFR: inputs.eGFR,
    renalRisk: plan.renalRisk,
    nsaidAllowed: plan.nsaidAllowed,
    opioid,
    ivDose,
    planMeds: plan.meds,
    options: plan.options,
    avoid: plan.avoid,
    monitoring: generalMonitoring(),
    safetyBlocks,
    stops: safetyStops(inputs.eGFR),
  };

  render(model);
}

function reset() {
  ["ageInput","weightInput","gfrInput","crisesInput"].forEach(id => { if ($(id)) $(id).value = ""; });
  $("severityInput").value = "moderate";
  $("weightUnit").value = "kg";
  $("doseUnit").value = "mg";

  $("genoAvail").value = "known";
  $("cyp2d6Input").value = "EM";
  $("cyp2d6Input").disabled = false;

  // NEW reset
  if ($("sexInput")) $("sexInput").value = "F";
  if ($("inhibitorInput")) $("inhibitorInput").value = "no";
  if ($("codeineRespInput")) $("codeineRespInput").value = "ineffective";
  if ($("tramadolRespInput")) $("tramadolRespInput").value = "ineffective";
  setPredictStatus({ mode: "idle" });

  ["opioidTol","sedatives","respRisk","suspectedACS","morphineAllergy"].forEach(id => { if ($(id)) $(id).checked = false; });

  $("results").innerHTML = `<div id="placeholderText" class="placeholder">${TXT[lang].placeholderText}</div>`;
}

function initLinks() {
  $("mohLink").href = LINKS.MOH;
  $("cpicLink").href = LINKS.CPIC;
  $("ashLink").href = LINKS.ASH;
  $("owsianyLink").href = LINKS.OWSIANY;
}

function init() {
  initLinks();
  setLang("EN");

  $("langToggle").addEventListener("click", () => {
    setLang(lang === "EN" ? "AR" : "EN");
  });

  $("runBtn").addEventListener("click", run);
  $("resetBtn").addEventListener("click", reset);

  // NEW: predict button
  $("predictBtn").addEventListener("click", predictPhenotype);

  $("genoAvail").addEventListener("change", () => {
    const v = $("genoAvail").value;
    $("cyp2d6Input").disabled = (v === "unknown");
  });

  setPredictStatus({ mode: "idle" });
}

init();