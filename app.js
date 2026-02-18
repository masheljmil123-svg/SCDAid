// ===============================
// SCDAid - app.js
// Adults VOC analgesia decision support (Prototype)
// Adds: weight unit input (kg/lb), output dose unit (mg/mcg/g) with alternate unit in parentheses
// Safety blocks: shown ONLY for meds included in the recommended plan + avoid list
// ===============================

const $ = (id) => document.getElementById(id);

// Reference links (clickable)
const MOH_ACUTE_PAIN_URL =
  "https://www.moh.gov.sa/Ministry/MediaCenter/Publications/Documents/Protocol-001.pdf";
const CPIC_URL = "https://ascpt.onlinelibrary.wiley.com/doi/10.1002/cpt.2149";
const ASH_URL = "https://ashpublications.org/bloodadvances/article/4/12/2656/461665";
const OWSIANY_URL = "https://pmc.ncbi.nlm.nih.gov/articles/PMC6917891/";

let lang = "EN";

const TXT = {
  EN: {
    ui: {
      title: "SCDAid",
      subtitle:
        "SCD VOC analgesia decision support (Prototype) — Severity + CPIC (CYP2D6) + Renal/Safety guardrails",
      patientInputs: "Patient Inputs",
      age: "Age (years) *",
      weight: "Weight *",
      weightHint: "Used to calculate adult starting doses.",
      egfr: "eGFR (mL/min/1.73m²) *",
      egfrHint: "Enter eGFR (mL/min/1.73m²).",
      doseUnit: "Output Dose Unit",
      doseUnitHint: "Controls the unit used when displaying calculated doses.",
      crises: "Pain crises/year (optional)",
      severity: "Pain severity *",
      genoAvail: "CYP2D6 genotype availability",
      genoAvailHint: "If unknown, tool avoids CYP2D6-dependent opioids.",
      cyp: "CYP2D6 phenotype",
      opioidTol: "Opioid tolerant",
      sedatives: "Concurrent sedatives",
      respRisk: "Respiratory risk",
      acs: "Suspected ACS",
      morphineAllergy: "Morphine allergy",
      run: "Run Algorithm",
      reset: "Reset",
      disclaimer: "Educational prototype only. Not a substitute for clinical judgment.",
      results: "Results",
      placeholder: 'Enter inputs then click "Run Algorithm".',
      refs: "References",
      monitoringTitle: "General VOC Monitoring",
      safetyTitle: "Medication Safety Monitoring",
      planTitle: "Recommended Plan",
      avoidTitle: "Avoid / Contraindications",
      dosingTitle: "Adult IV Opioid Starting Dose",
      optionsTitle: "Optional Next Steps",
    },
    errs: {
      age: "Age is required.",
      weight: "Weight is required.",
      egfr: "eGFR is required.",
    },
    pills: {
      high: "High risk",
      moderate: "Moderate risk",
      low: "Low risk",
      ok: "OK",
      caution: "Caution",
      avoid: "Avoid",
    },
    sections: {
      renal: "Renal Risk Stratification",
      opioid: "Opioid Selection",
      adjuncts: "Adjuncts",
      safety: "Safety Stops",
      geno: "Genotype logic",
    },
  },

  AR: {
    ui: {
      title: "SCDAid",
      subtitle:
        "أداة دعم قرار لألم نوبة الانسداد الوعائي (نموذج أولي) — الشدة + CYP2D6 (CPIC) + اعتبارات الكلى والسلامة",
      patientInputs: "بيانات المريض",
      age: "العمر (سنة) *",
      weight: "الوزن *",
      weightHint: "يستخدم لحساب جرعات البداية للكبار.",
      egfr: "eGFR (مل/دقيقة/1.73م²) *",
      egfrHint: "ادخل eGFR (مل/دقيقة/1.73م²).",
      doseUnit: "وحدة الجرعة (المخرجات)",
      doseUnitHint: "تحدد وحدة عرض الجرعات المحسوبة.",
      crises: "عدد النوبات بالسنة (اختياري)",
      severity: "شدة الألم *",
      genoAvail: "توفر جينوتايب CYP2D6",
      genoAvailHint: "إذا غير معروف، تتجنب الأداة الأفيونات المعتمدة على CYP2D6.",
      cyp: "فينوتايب CYP2D6",
      opioidTol: "تحمل للأفيونات",
      sedatives: "مهدئات مصاحبة",
      respRisk: "خطورة تنفسية",
      acs: "اشتباه ACS",
      morphineAllergy: "حساسية مورفين",
      run: "تشغيل الخوارزمية",
      reset: "مسح",
      disclaimer: "نموذج تعليمي فقط. لا يغني عن الحكم السريري.",
      results: "النتائج",
      placeholder: "ادخل البيانات ثم اضغط تشغيل الخوارزمية.",
      refs: "المراجع",
      monitoringTitle: "مراقبة عامة لنوبة VOC",
      safetyTitle: "مراقبة السلامة للأدوية",
      planTitle: "الخطة المقترحة",
      avoidTitle: "تجنب / موانع",
      dosingTitle: "جرعة بداية IV للكبار",
      optionsTitle: "خيارات إضافية",
    },
    errs: {
      age: "العمر مطلوب.",
      weight: "الوزن مطلوب.",
      egfr: "eGFR مطلوب.",
    },
    pills: {
      high: "خطورة عالية",
      moderate: "خطورة متوسطة",
      low: "خطورة منخفضة",
      ok: "مناسب",
      caution: "حذر",
      avoid: "تجنب",
    },
    sections: {
      renal: "تصنيف خطورة الكلى",
      opioid: "اختيار الأفيون",
      adjuncts: "علاجات مساعدة",
      safety: "قواعد الإيقاف",
      geno: "منطق الجينوتايب",
    },
  },
};

// ---------- Helpers ----------
function num(x) {
  if (x === null || x === undefined) return null;
  const v = Number(String(x).trim());
  return Number.isFinite(v) ? v : null;
}

function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}

function fmt(x, digits = 0) {
  if (x === null || x === undefined) return "-";
  return Number(x).toFixed(digits);
}

function riskStratRenal(eGFR) {
  if (eGFR === null) return "unknown";
  if (eGFR < 30) return "high";
  if (eGFR < 60) return "moderate";
  return "low";
}

function pillClassFromRisk(risk) {
  if (risk === "high") return "danger";
  if (risk === "moderate") return "warn";
  if (risk === "low") return "ok";
  return "info";
}

// ---------- Unit conversions ----------
function lbToKg(lb) { return lb * 0.45359237; }
function mgToMcg(mg) { return mg * 1000; }
function mcgToMg(mcg) { return mcg / 1000; }
function mgToG(mg) { return mg / 1000; }

// Output dose in selected unit + alternate unit in parentheses
function formatDoseMultiFromMg(mgValue) {
  const unitSel = $("doseUnit")?.value || "mg";
  if (!isFinite(mgValue)) return "-";

  if (unitSel === "mcg") {
    const mcg = mgToMcg(mgValue);
    return `${mcg.toFixed(0)} mcg (${mgValue.toFixed(3)} mg)`;
  }
  if (unitSel === "g") {
    const g = mgToG(mgValue);
    return `${g.toFixed(3)} g (${mgValue.toFixed(0)} mg)`;
  }

  // mg default
  const alt = mgValue < 2 ? ` (${mgToMcg(mgValue).toFixed(0)} mcg)` : "";
  return `${mgValue.toFixed(2)} mg${alt}`;
}

// ---------- Clinical text blocks ----------
function generalVOCMonitoringLines() {
  return [
    "Vital signs BP HR RR SpO2 Temp q15 to 30 min initially then q1 to 2 h once stable.",
    "Pain score Sedation scale RASS PASS Urine output q1 to 2 h.",
    "Labs CBC Cr eGFR LFT baseline then q12 to 24 h. If SpO2 <95 give O2.",
    "Watch for ACS chest pain hypoxia fever. Watch compartment syndrome. Watch neuro changes.",
  ];
}

function drugSafetyLines({ drug, eGFR, phenotype, genoAvail }) {
  const renalRisk = riskStratRenal(eGFR);

  const blocks = {
    Acetaminophen: [
      "Must monitor ALT AST and Cr eGFR.",
      "Renal: safe short term if eGFR >30. If eGFR <30 use caution and monitor Cr rise.",
      "Hepatic: avoid >3 g per day if risk factors. Contra severe liver disease.",
      "Interactions: warfarin INR. Alcohol increases toxicity.",
      "Stop: ALT >2x ULN or Cr rise >=0.3 mg per dL or no pain relief.",
    ],

    NSAIDs: [
      "Must monitor Cr eGFR urine output BP platelets and bleeding.",
      "Renal: avoid if eGFR <30 or AKI risk.",
      "CV: fluid retention and HTN risk.",
      "Interactions: ACEi ARB diuretics anticoagulants.",
      "Contra: eGFR <30 active PUD platelets <50K.",
      "Stop: Cr rise >25 percent or urine output <0.5 mL per kg per h or BP rises.",
    ],

    Ketorolac: [
      "Must monitor Cr eGFR urine output and GI bleed signs.",
      "Renal: contraindicated if eGFR <30. Single dose ok if eGFR >30 with close monitoring.",
      "Stop: any Cr rise or urine output drop or abdominal pain.",
    ],

    Morphine: [
      "Must monitor RR SpO2 sedation q15 min initially then per stability. Watch constipation.",
      "Renal: M6G accumulates if eGFR <60. Prefer alternatives if renal risk.",
      "Resp: high risk. If RR <12 hold. If RR <10 or oversedation give naloxone.",
      "CV: hypotension risk.",
    ],

    Hydromorphone: [
      "Must monitor RR SpO2 sedation q15 min initially then per stability.",
      "Renal: less accumulation than morphine but monitor closely if eGFR <60.",
      "Resp: high potency. If RR <12 hold.",
    ],

    Fentanyl: [
      "Continuous RR SpO2 sedation monitoring.",
      "Renal: minimal accumulation and preferred if eGFR <30.",
      "Resp: high potency. Risk chest wall rigidity at higher IV doses.",
      "CV: bradycardia possible.",
    ],

    Oxycodone: [
      "Must monitor RR sedation constipation.",
      "Renal: avoid or very low dose if eGFR <30.",
      "Interactions: CYP3A4 and CYP2D6 inhibitors can increase levels.",
      "VOC: mainly for oral transition. Personalize with CYP2D6 if available.",
    ],

    Codeine: [
      "Non recommended in VOC due to CYP2D6 variability and unpredictable efficacy and toxicity.",
      "Avoid if CYP2D6 unknown PM UM or if eGFR <30.",
    ],

    Tramadol: [
      "Must monitor RR sedation serotonin syndrome and seizures.",
      "Renal: avoid if eGFR <30 or reduce significantly.",
      "Avoid with SSRIs due to serotonin syndrome risk.",
      "VOC: avoid severe pain. Weak opioid.",
    ],

    Meperidine: [
      "Strongly non recommended. Neurotoxicity and seizures due to normeperidine accumulation.",
      "Avoid especially if eGFR <60. No repeat dosing.",
    ],

    Ketamine: [
      "Must monitor BP HR and emergence reactions.",
      "Renal: no adjustment usually required.",
      "Contra: uncontrolled HTN or psychosis history.",
      "VOC: opioid sparing adjuvant in refractory or opioid tolerant cases.",
      "Stop: BP >180 110 or intolerable hallucinations.",
    ],
  };

  let lines = blocks[drug] ? [...blocks[drug]] : [];

  // Dynamic add-ons
  if ((drug === "NSAIDs" || drug === "Ketorolac") && renalRisk === "high") {
    lines.unshift("RENAL HIGH RISK: avoid NSAIDs when eGFR <30 or AKI suspected.");
  }
  if (drug === "Morphine" && (renalRisk === "moderate" || renalRisk === "high")) {
    lines.unshift("Renal caution: consider hydromorphone or fentanyl instead of morphine.");
  }
  if ((drug === "Codeine" || drug === "Tramadol") &&
      (genoAvail === "unknown" || phenotype === "PM" || phenotype === "UM")) {
    lines.unshift("CYP2D6 risk: avoid codeine and tramadol when genotype unknown or PM UM.");
  }

  return lines;
}

// ---------- Dosing helpers ----------
function roundTo(x, step) {
  return Math.round(x / step) * step;
}

// IV opioid starting dose (adult prototype)
function doseAdultIVOpioid({ drug, severity, weightKg }) {
  if (!weightKg || weightKg <= 0) return null;

  if (drug === "Morphine") {
    const mgPerKg = severity === "severe" ? 0.1 : severity === "mild" ? 0.03 : 0.05;
    const maxMg = severity === "severe" ? 10 : severity === "mild" ? 4 : 6;
    let mg = mgPerKg * weightKg;
    mg = Math.min(mg, maxMg);
    mg = roundTo(mg, 0.5);
    return `Morphine IV: ${formatDoseMultiFromMg(mg)} (≈ ${mgPerKg} mg/kg, max ${maxMg} mg) q20 to 30 min titrate`;
  }

  if (drug === "Hydromorphone") {
    const mgPerKg = severity === "severe" ? 0.015 : severity === "mild" ? 0.005 : 0.01;
    const maxMg = severity === "severe" ? 1.5 : severity === "mild" ? 0.8 : 1.0;
    let mg = mgPerKg * weightKg;
    mg = Math.min(mg, maxMg);
    mg = roundTo(mg, 0.1);
    return `Hydromorphone IV: ${formatDoseMultiFromMg(mg)} (≈ ${mgPerKg} mg/kg, max ${maxMg} mg) q15 to 30 min titrate`;
  }

  if (drug === "Fentanyl") {
    const mcgPerKg = severity === "severe" ? 1.0 : severity === "mild" ? 0.5 : 0.5;
    const maxMcg = 100;
    let mcg = mcgPerKg * weightKg;
    mcg = Math.min(mcg, maxMcg);
    mcg = roundTo(mcg, 5);
    const mg = mcgToMg(mcg);
    return `Fentanyl IV: ${formatDoseMultiFromMg(mg)} (≈ ${mcgPerKg} mcg/kg, max ${maxMcg} mcg) q5 to 10 min titrate`;
  }

  return null;
}

// ---------- Decision logic ----------
function choosePrimaryOpioid({ renalRisk, morphineAllergy }) {
  if (morphineAllergy) return "Hydromorphone";
  if (renalRisk === "high") return "Fentanyl";
  if (renalRisk === "moderate") return "Hydromorphone";
  return "Morphine";
}

function allowNSAID({ renalRisk, respRisk, suspectedACS }) {
  const renalOk = renalRisk === "low" || renalRisk === "moderate";
  return renalOk && !respRisk && !suspectedACS;
}

function chooseNSAID({ severity }) {
  // Mild: prefer ibuprofen; moderate/severe: ketorolac (ED adjunct)
  if (severity === "mild") return "NSAIDs";
  return "Ketorolac";
}

function canSuggestOxycodone({ renalRisk, respRisk, suspectedACS }) {
  // Keep it conservative
  if (renalRisk === "high") return false;
  if (respRisk || suspectedACS) return false;
  return true;
}

function cyp2d6AvoidWeakOpioids({ genoAvail, phenotype }) {
  return (genoAvail === "unknown" || phenotype === "PM" || phenotype === "UM");
}

// ---------- Adjunct plan ----------
function buildPlan({ inputs, renalRisk }) {
  const planMeds = [];
  const options = [];
  const avoid = [];

  // Always recommend acetaminophen adjunct
  planMeds.push({
    name: "Acetaminophen",
    line: "Acetaminophen: 650 to 1000 mg PO q6 to 8 h (or 1 g IV q6 h) Max 3 to 4 g per day",
  });

  // NSAID pathway if allowed
  const nsaidAllowed = allowNSAID({ renalRisk, respRisk: inputs.respRisk, suspectedACS: inputs.suspectedACS });
  if (nsaidAllowed) {
    const choice = chooseNSAID({ severity: inputs.severity });
    if (choice === "Ketorolac") {
      planMeds.push({
        name: "Ketorolac",
        line: "Ketorolac ED adjunct: 15 to 30 mg IV (use 15 mg if eGFR 30 to 59). Avoid if eGFR <30.",
      });
    } else {
      planMeds.push({
        name: "NSAIDs",
        line: "Ibuprofen: 400 to 600 mg PO q6 to 8 h PRN. Avoid if renal or bleeding risk.",
      });
    }
  } else {
    planMeds.push({
      name: "NSAIDs",
      line: "NSAIDs: avoid due to renal or ACS or respiratory risk.",
    });
  }

  // Ketamine option (severe and opioid tolerant)
  if (inputs.severity === "severe" && inputs.opioidTol) {
    planMeds.push({
      name: "Ketamine",
      line: "Low dose ketamine adjuvant: 0.1 to 0.3 mg/kg IV bolus or infusion 0.1 to 0.3 mg/kg/hr (monitor BP and emergence).",
    });
  }

  // Optional PO transition
  if (inputs.severity !== "severe" && canSuggestOxycodone({ renalRisk, respRisk: inputs.respRisk, suspectedACS: inputs.suspectedACS })) {
    options.push("If stable and tolerating PO: consider oxycodone IR 5 to 10 mg PO q4 to 6 h (avoid or very low dose if eGFR <30).");
  }

  // Avoid list (always show meperidine)
  avoid.push("Meperidine: strongly non recommended due to neurotoxicity.");
  if (cyp2d6AvoidWeakOpioids({ genoAvail: inputs.genoAvail, phenotype: inputs.phenotype })) {
    avoid.push("Avoid codeine and tramadol when CYP2D6 genotype unknown or PM UM.");
  } else {
    avoid.push("Codeine and tramadol are not preferred in VOC (variable efficacy and safety).");
  }
  if (renalRisk === "high") {
    avoid.push("Avoid NSAIDs when eGFR <30 or AKI suspected. Avoid morphine due to metabolite accumulation.");
  }

  return { planMeds, options, avoid, nsaidAllowed };
}

// Safety stops (general)
function safetyStops({ eGFR }) {
  const lines = [];
  lines.push("If RR <12 hold opioid. If RR <10 or oversedation give naloxone.");
  lines.push("If SpO2 <92 or suspected ACS urgent evaluation and oxygen.");
  if (eGFR !== null && eGFR < 30) {
    lines.push("Renal: avoid NSAIDs and avoid morphine. Prefer fentanyl or hydromorphone.");
  }
  lines.push("If creatinine rises >=0.3 mg/dL in 48 h stop NSAIDs.");
  return lines;
}

// ---------- Inputs ----------
function readInputs() {
  const genoAvail = $("genoAvail")?.value || "known";
  const phenotype = genoAvail === "unknown" ? "EM" : ($("cyp2d6Input")?.value || "EM");

  return {
    age: num($("ageInput")?.value),
    weight: (function () {
      let w = num($("weightInput")?.value);
      const u = $("weightUnit")?.value || "kg";
      if (w !== null && u === "lb") w = lbToKg(w);
      return w;
    })(),
    eGFR: num($("gfrInput")?.value),
    crises: num($("crisesInput")?.value),
    severity: $("severityInput")?.value || "moderate",

    genoAvail,
    phenotype,

    opioidTol: !!$("opioidTol")?.checked,
    sedatives: !!$("sedatives")?.checked,
    morphineAllergy: !!$("morphineAllergy")?.checked,
    respRisk: !!$("respRisk")?.checked,
    suspectedACS: !!$("suspectedACS")?.checked,
  };
}

function validate(inputs) {
  const e = [];
  const t = TXT[lang];
  if (inputs.age === null) e.push(t.errs.age);
  if (inputs.weight === null) e.push(t.errs.weight);
  if (inputs.eGFR === null) e.push(t.errs.egfr);
  return e;
}

// ---------- Algorithm ----------
function runAlgo(inputs) {
  const renalRisk = riskStratRenal(inputs.eGFR);

  const opioid = choosePrimaryOpioid({ renalRisk, morphineAllergy: inputs.morphineAllergy });
  const ivDose = doseAdultIVOpioid({
    drug: opioid,
    severity: inputs.severity,
    weightKg: inputs.weight,
  });

  const plan = buildPlan({ inputs, renalRisk });

  // Safety blocks ONLY for meds included in plan + primary opioid + avoid meds mentioned
  const medsForSafety = new Set();
  medsForSafety.add(opioid);
  plan.planMeds.forEach(m => medsForSafety.add(m.name));

  // Always include avoid meds as safety blocks? (No: only show as avoid list)
  // We'll include only if they appear in planMeds or primary opioid, so it's clean.

  const safetyBlocks = Array.from(medsForSafety).map((name) => {
    return {
      drug: name,
      lines: drugSafetyLines({ drug: name, eGFR: inputs.eGFR, phenotype: inputs.phenotype, genoAvail: inputs.genoAvail }),
    };
  });

  const stopRules = safetyStops({ eGFR: inputs.eGFR });

  return {
    renalRisk,
    opioid,
    ivDose,
    planMeds: plan.planMeds,
    options: plan.options,
    avoid: plan.avoid,
    monitoring: generalVOCMonitoringLines(),
    safetyBlocks,
    stopRules,
    nsaidAllowed: plan.nsaidAllowed,
  };
}

// ---------- Rendering ----------
function renderList(lines) {
  if (!lines || !lines.length) return "<div class='hint'>-</div>";
  return `<ul style="margin:8px 0 0 18px;">${lines.map((x) => `<li>${x}</li>`).join("")}</ul>`;
}

function renderSafetyBlocks(blocks) {
  if (!blocks || !blocks.length) return "";
  return blocks
    .map((b) => `<div class="box"><h3>${b.drug}</h3>${renderList(b.lines)}</div>`)
    .join("");
}

function renderPlanMeds(planMeds) {
  if (!planMeds || !planMeds.length) return "<div class='hint'>-</div>";
  return `<ul style="margin:8px 0 0 18px;">${planMeds.map((m) => `<li>${m.line}</li>`).join("")}</ul>`;
}

function renderResults(model) {
  const t = TXT[lang];

  const renalPill = `<span class="pill ${pillClassFromRisk(model.renalRisk)}">${t.pills[model.renalRisk] || model.renalRisk}</span>`;
  const nsaidPill = model.nsaidAllowed
    ? `<span class="pill ok">${t.pills.ok}</span>`
    : `<span class="pill danger">${t.pills.avoid}</span>`;

  const html = `
    <div class="box">
      <h3>${t.sections.renal}</h3>
      <div class="pills">${renalPill}<span class="pill info">NSAID: </span>${nsaidPill}</div>
      <div class="hint" style="margin-top:8px;">eGFR: ${fmt($("gfrInput")?.value, 0)}</div>
    </div>

    <div class="box">
      <h3>${t.ui.dosingTitle}</h3>
      <div>${model.ivDose || "-"}</div>
      <div class="hint" style="margin-top:8px;">Primary opioid: <b>${model.opioid}</b></div>
    </div>

    <div class="box">
      <h3>${t.ui.planTitle}</h3>
      ${renderPlanMeds(model.planMeds)}
    </div>

    <div class="box">
      <h3>${t.ui.optionsTitle}</h3>
      ${renderList(model.options)}
    </div>

    <div class="box">
      <h3>${t.ui.monitoringTitle}</h3>
      ${renderList(model.monitoring)}
    </div>

    <div class="box">
      <h3>${t.ui.safetyTitle}</h3>
      ${renderSafetyBlocks(model.safetyBlocks)}
    </div>

    <div class="box">
      <h3>${t.ui.avoidTitle}</h3>
      ${renderList(model.avoid)}
    </div>

    <div class="box">
      <h3>${t.sections.safety}</h3>
      ${renderList(model.stopRules)}
    </div>
  `;

  const el = $("results");
  if (el) el.innerHTML = html;
}

// ---------- i18n UI ----------
function applyLanguageToUI() {
  const t = TXT[lang];

  document.documentElement.dir = lang === "AR" ? "rtl" : "ltr";
  document.documentElement.lang = lang === "AR" ? "ar" : "en";

  if ($("langToggle")) $("langToggle").textContent = lang === "AR" ? "EN" : "AR";

  if ($("titleText")) $("titleText").textContent = t.ui.title;
  if ($("subtitleText")) $("subtitleText").textContent = t.ui.subtitle;

  if ($("patientInputsTitle")) $("patientInputsTitle").textContent = t.ui.patientInputs;
  if ($("ageLabel")) $("ageLabel").textContent = t.ui.age;
  if ($("weightLabel")) $("weightLabel").textContent = t.ui.weight;
  if ($("weightHint")) $("weightHint").textContent = t.ui.weightHint;
  if ($("egfrLabel")) $("egfrLabel").textContent = t.ui.egfr;
  if ($("egfrHint")) $("egfrHint").textContent = t.ui.egfrHint;

  if ($("doseUnitLabel")) $("doseUnitLabel").textContent = t.ui.doseUnit;
  if ($("doseUnitHint")) $("doseUnitHint").textContent = t.ui.doseUnitHint;

  if ($("crisesLabel")) $("crisesLabel").textContent = t.ui.crises;
  if ($("severityLabel")) $("severityLabel").textContent = t.ui.severity;
  if ($("genoAvailLabel")) $("genoAvailLabel").textContent = t.ui.genoAvail;
  if ($("genoAvailHint")) $("genoAvailHint").textContent = t.ui.genoAvailHint;
  if ($("cypLabel")) $("cypLabel").textContent = t.ui.cyp;

  if ($("opioidTolLabel")) $("opioidTolLabel").textContent = t.ui.opioidTol;
  if ($("sedativesLabel")) $("sedativesLabel").textContent = t.ui.sedatives;
  if ($("respRiskLabel")) $("respRiskLabel").textContent = t.ui.respRisk;
  if ($("acsLabel")) $("acsLabel").textContent = t.ui.acs;
  if ($("morphineAllergyLabel")) $("morphineAllergyLabel").textContent = t.ui.morphineAllergy;

  if ($("runBtn")) $("runBtn").textContent = t.ui.run;
  if ($("resetBtn")) $("resetBtn").textContent = t.ui.reset;
  if ($("disclaimerText")) $("disclaimerText").textContent = t.ui.disclaimer;
  if ($("resultsTitle")) $("resultsTitle").textContent = t.ui.results;
  if ($("placeholderText")) $("placeholderText").textContent = t.ui.placeholder;
  if ($("refsTitle")) $("refsTitle").textContent = t.ui.refs;
}

// ---------- Events ----------
function resetUI() {
  ["ageInput", "weightInput", "gfrInput", "crisesInput"].forEach((id) => {
    if ($(id)) $(id).value = "";
  });
  if ($("severityInput")) $("severityInput").value = "moderate";
  if ($("genoAvail")) $("genoAvail").value = "known";
  if ($("cyp2d6Input")) $("cyp2d6Input").value = "EM";
  if ($("weightUnit")) $("weightUnit").value = "kg";
  if ($("doseUnit")) $("doseUnit").value = "mg";

  ["opioidTol", "sedatives", "respRisk", "suspectedACS", "morphineAllergy"].forEach((id) => {
    if ($(id)) $(id).checked = false;
  });

  if ($("results")) $("results").innerHTML = `<div class="placeholder" id="placeholderText">${TXT[lang].ui.placeholder}</div>`;
}

function attachLinks() {
  if ($("mohLink")) $("mohLink").href = MOH_ACUTE_PAIN_URL;
  if ($("cpicLink")) $("cpicLink").href = CPIC_URL;
  if ($("ashLink")) $("ashLink").href = ASH_URL;
  if ($("owsianyLink")) $("owsianyLink").href = OWSIANY_URL;
}

function init() {
  attachLinks();
  applyLanguageToUI();

  $("langToggle")?.addEventListener("click", () => {
    lang = lang === "EN" ? "AR" : "EN";
    applyLanguageToUI();
  });

  $("runBtn")?.addEventListener("click", () => {
    const inputs = readInputs();
    const errs = validate(inputs);
    if (errs.length) {
      alert(errs.join("\n"));
      return;
    }
    const model = runAlgo(inputs);
    renderResults(model);
  });

  $("resetBtn")?.addEventListener("click", () => resetUI());

  $("genoAvail")?.addEventListener("change", () => {
    const v = $("genoAvail")?.value || "known";
    if ($("cyp2d6Input")) $("cyp2d6Input").disabled = v === "unknown";
  });
}

init();
