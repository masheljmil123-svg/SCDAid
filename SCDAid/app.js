// ===============================
// SCDAid - app.js (ED-Ready Algorithm)
// Integrates: Severity + Renal + CPIC (CYP2D6) + Safety flags
// Adds: acetaminophen, NSAIDs, ketorolac, celecoxib, diclofenac, ketamine, oxycodone, codeine, tramadol
// Hard block: meperidine (pethidine)
// Adults only dosing (weight-based for IV opioids + ketamine)
// ===============================

const $ = (id) => document.getElementById(id);

// Reference links (clickable)
const MOH_ACUTE_PAIN_URL =
  "https://www.moh.gov.sa/Ministry/MediaCenter/Publications/Documents/Protocol-001.pdf";
const CPIC_URL = "https://ascpt.onlinelibrary.wiley.com/doi/10.1002/cpt.2149";
const ASH_URL = "https://ashpublications.org/bloodadvances/article/4/12/2656/461665";
const OWSIANY_URL = "https://pmc.ncbi.nlm.nih.gov/articles/PMC6917891/"; // free full text

let lang = "EN";

const TXT = {
  EN: {
    ui: {
      title: "SCDAid",
      subtitle:
        "SCD VOC analgesia decision support (Prototype) — Severity + CPIC (CYP2D6) + Renal/Safety guardrails",
      patientInputs: "Patient Inputs",
      age: "Age (years) *",
      weight: "Weight (kg) *",
      weightHint: "Used to calculate adult starting doses.",
      egfr: "eGFR (ml/min) *",
      egfrHint: "Renal function changes analgesic selection & safety.",
      crises: "Crises/year (optional)",
      crisesHint: "Context only (not used in dosing yet).",
      severity: "VOC pain severity *",
      severityHint: "Drives pathway intensity.",

      genoAvail: "CYP2D6 genotyping",
      genoAvailHint:
        "If genotype is unknown, tool shows clinical clues (informational only).",

      cyp: "CYP2D6 phenotype",
      cypHint: "Applied to codeine/tramadol only (CPIC).",
      safety: "Safety & context",
      opioidTol: "Opioid-tolerant / chronic opioid use",
      sedatives:
        "Concomitant sedatives (benzodiazepines/EtOH/other CNS depressants)",
      morph: "Morphine intolerance/allergy (use alternative)",
      resp: "Respiratory depression risk (OSA/COPD/prior oversedation)",
      acs: "Suspected acute chest syndrome / hypoxia",
      run: "Run Algorithm",
      clear: "Clear",
      empty: "Run the algorithm to see recommendations.",
    },

    sev: { mild: "Mild", moderate: "Moderate (4–6/10)", severe: "Severe" },
    ph: { EM: "EM (Normal)", IM: "IM (Intermediate)", PM: "PM (Poor)", UM: "UM (Ultrarapid)" },

    sections: {
      rec: "Recommendation",
      regimen: "Suggested regimen",
      safety: "Safety alerts",
      dosing: "Starter dosing (Adults, prototype)",
      alternatives: "Alternatives",
      extra: "Additional recommendations",
      avoid: "Avoid / Not recommended",
      refs: "References",
    },

    labels: {
      step: (sev, ph) => `Severity: ${sev} | CYP2D6: ${ph}`,
      pill1: (drug) => `Algorithm-guided: ${drug}`,
      pill2: (risk) => `Overall risk: ${risk}`,
    },

    strings: {
      preferNonOpioid: "Non-opioid multimodal",
      preferredOpioid: "Preferred opioid",
      adjuncts: "Adjuncts",
      acet: "Acetaminophen",
      nsaid: "NSAID",
      ketorolac: "Ketorolac",
      ibuprofen: "Ibuprofen",
      diclofenac: "Diclofenac",
      celecoxib: "Celecoxib",
      ketamine: "Ketamine (low-dose)",
      oxycodone: "Oxycodone (oral transition)",
      codeine: "Codeine",
      tramadol: "Tramadol",
      meperidine: "Meperidine (pethidine)",
    },

    errs: {
      age: "Age is required.",
      weight: "Weight is required.",
      egfr: "eGFR is required.",
      adultsOnly: "This prototype dosing is Adults-only (age ≥ 18).",
    },

    refs: {
      moh: "Saudi MOH Protocol: Acute Pain Management (Protocol-001)",
      cpic: "CPIC Guideline: CYP2D6 & Opioid Therapy (Crews et al., 2021)",
      ash: "ASH Guidelines: Sickle Cell Disease Pain Management (2020)",
      ows: "Owsiany et al.: Opioid Management in CKD (review)",
    },

    geno: {
      title: "If CYP2D6 genotype is unavailable",
      body:
        "Clinical indicators suggestive of altered CYP2D6 activity (informational only):\n\n" +
        "• Possible UM: marked sedation/respiratory depression on small doses of codeine/tramadol.\n" +
        "• Possible PM: no analgesic effect despite adequate doses of codeine/tramadol.\n\n" +
        "If genotype is unknown and codeine/tramadol is being considered, prefer non–CYP2D6-dependent options.",
    },
  },

  AR: {
    ui: {
      title: "SCDAid",
      subtitle: "أداة دعم قرار لألم VOC — الشدة + CPIC (CYP2D6) + الكلى/السلامة",
      patientInputs: "بيانات المريض",
      age: "العمر (سنة) *",
      weight: "الوزن (كجم) *",
      weightHint: "يستخدم لحساب جرعات البالغين.",
      egfr: "eGFR (مل/دقيقة) *",
      egfrHint: "وظائف الكلى تغيّر الاختيار والسلامة.",
      crises: "عدد النوبات/سنة (اختياري)",
      crisesHint: "للسياق فقط.",
      severity: "شدة ألم VOC *",
      severityHint: "تحدد شدة المسار.",

      genoAvail: "توفر تحليل CYP2D6",
      genoAvailHint: "إذا الجين غير متوفر تظهر مؤشرات سريرية (معلومة فقط).",

      cyp: "نمط CYP2D6",
      cypHint: "يطبق على الكودين/ترامادول فقط (CPIC).",
      safety: "السلامة والسياق",
      opioidTol: "متحمل أفيونات / استخدام مزمن",
      sedatives: "مهدئات مصاحبة (بنزوديازيبين/كحول/مثبطات CNS)",
      morph: "تحسس/عدم تحمل المورفين",
      resp: "خطر تثبيط تنفسي (OSA/COPD/تهدئة زائدة سابقاً)",
      acs: "اشتباه ACS/نقص أكسجة",
      run: "تشغيل الخوارزمية",
      clear: "مسح",
      empty: "شغّلي الخوارزمية عشان تطلع التوصية.",
    },

    sev: { mild: "خفيف", moderate: "متوسط (4–6/10)", severe: "شديد" },
    ph: { EM: "EM (طبيعي)", IM: "IM (متوسط)", PM: "PM (ضعيف)", UM: "UM (سريع جدًا)" },

    sections: {
      rec: "التوصية",
      regimen: "الخطة المقترحة",
      safety: "تنبيهات السلامة",
      dosing: "جرعات مبدئية (بالغين فقط)",
      alternatives: "بدائل",
      extra: "توصيات إضافية",
      avoid: "تجنب / غير موصى به",
      refs: "المراجع",
    },

    labels: {
      step: (sev, ph) => `الشدة: ${sev} | CYP2D6: ${ph}`,
      pill1: (drug) => `الموصى به بالخوارزمية: ${drug}`,
      pill2: (risk) => `مستوى الخطورة: ${risk}`,
    },

    strings: {
      preferNonOpioid: "علاج غير أفيوني متعدد الوسائط",
      preferredOpioid: "الأفيون المفضل",
      adjuncts: "العلاجات المساندة",
      acet: "باراسيتامول",
      nsaid: "NSAID",
      ketorolac: "كيتورولاك",
      ibuprofen: "ايبوبروفين",
      diclofenac: "ديكلوفيناك",
      celecoxib: "سيليكوكسيب",
      ketamine: "كيتامين (جرعة منخفضة)",
      oxycodone: "أوكسيكودون (تحويل فموي)",
      codeine: "كودين",
      tramadol: "ترامادول",
      meperidine: "ميبيريدين (بيثيدين)",
    },

    errs: {
      age: "العمر مطلوب.",
      weight: "الوزن مطلوب.",
      egfr: "eGFR مطلوب.",
      adultsOnly: "هذه النسخة للبالغين فقط (العمر ≥ 18).",
    },

    refs: {
      moh: "بروتوكول وزارة الصحة: إدارة الألم الحاد (Protocol-001)",
      cpic: "CPIC: CYP2D6 والأفيونات (Crews et al., 2021)",
      ash: "ASH: إرشادات ألم الأنيميا المنجلية (2020)",
      ows: "Owsiany: مراجعة الأفيونات مع القصور الكلوي",
    },

    geno: {
      title: "إذا تحليل CYP2D6 غير متوفر",
      body:
        "مؤشرات سريرية قد توحي بتغير نشاط CYP2D6 (معلومة فقط):\n\n" +
        "• احتمال UM: خمول/تثبيط تنفسي بعد جرعات بسيطة من الكودين/ترامادول.\n" +
        "• احتمال PM: عدم وجود تسكين رغم جرعات مناسبة من الكودين/ترامادول.\n\n" +
        "إذا الجين غير معروف وكان التفكير بالكودين/الترامادول، يفضل بدائل لا تعتمد على CYP2D6.",
    },
  },
};

// ---------- helpers ----------
function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function renalCategory(eGFR) {
  if (eGFR === null) return "unknown";
  if (eGFR < 30) return "severe";
  if (eGFR < 60) return "moderate";
  return "normal";
}

function setTheme(overallRisk) {
  const box = $("resultBox");
  if (!box) return;
  box.classList.remove("theme-green", "theme-yellow", "theme-red");
  if (overallRisk === "High") box.classList.add("theme-red");
  else if (overallRisk === "Moderate") box.classList.add("theme-yellow");
  else box.classList.add("theme-green");
}

function computeOverallRisk({ eGFR, suspectedACS, respRisk, phenotype, genoAvail, sedatives }) {
  const r = renalCategory(eGFR);

  if (suspectedACS || respRisk) return "High";
  if (sedatives) return "High";
  if (r === "severe") return "High";

  // CPIC phenotype risk only if known
  if (genoAvail !== "unknown" && (phenotype === "UM" || phenotype === "PM")) return "High";

  if (r === "moderate") return "Moderate";
  return "Low";
}

// CPIC: whether codeine/tramadol are allowed
function cpicAllowsCodeineTramadol({ genoAvail, phenotype }) {
  if (genoAvail === "unknown") return false; // conservative
  if (phenotype === "PM" || phenotype === "UM") return false;
  return true; // EM / IM
}

// NSAID eligibility (simple safety gate)
function nsaidAllowed({ eGFR, suspectedACS }) {
  const r = renalCategory(eGFR);
  if (r !== "normal") return false; // avoid if eGFR < 60
  if (suspectedACS) return false;   // conservative: avoid during suspected ACS/hypoxia
  return true;
}

// Select primary opioid for moderate/severe when opioid is needed
function selectPrimaryOpioid({ eGFR, morphineAllergy, suspectedACS, respRisk }) {
  const r = renalCategory(eGFR);

  // Safety override: ACS/resp risk → fentanyl titration preferred
  if (suspectedACS || respRisk) return "Fentanyl";

  if (morphineAllergy) return "Fentanyl";
  if (r === "severe") return "Fentanyl";
  if (r === "moderate") return "Hydromorphone";
  // normal renal: morphine is first-line
  return "Morphine";
}

// Adults-only weight-based dosing (prototype)
function roundTo(x, step) {
  return Math.round(x / step) * step;
}

function doseAdultIVOpioid({ drug, severity, weightKg }) {
  if (!weightKg || weightKg <= 0) return null;

  if (drug === "Morphine") {
    const mgPerKg = severity === "severe" ? 0.1 : severity === "mild" ? 0.03 : 0.05;
    const maxMg = severity === "severe" ? 10 : severity === "mild" ? 4 : 6;
    let mg = mgPerKg * weightKg;
    mg = Math.min(mg, maxMg);
    mg = roundTo(mg, 0.5);
    return `Morphine IV: ${mg.toFixed(1)} mg (≈ ${mgPerKg} mg/kg, max ${maxMg} mg) q2–4h PRN`;
  }

  if (drug === "Hydromorphone") {
    const mgPerKg = severity === "severe" ? 0.015 : severity === "mild" ? 0.005 : 0.01;
    const maxMg = severity === "severe" ? 1.5 : severity === "mild" ? 0.8 : 1.0;
    let mg = mgPerKg * weightKg;
    mg = Math.min(mg, maxMg);
    mg = roundTo(mg, 0.1);
    return `Hydromorphone IV: ${mg.toFixed(1)} mg (≈ ${mgPerKg} mg/kg, max ${maxMg} mg) q2–4h PRN`;
  }

  if (drug === "Fentanyl") {
    const mcgPerKg = severity === "severe" ? 1.5 : severity === "mild" ? 0.5 : 1.0;
    const maxMcg = 100;
    let mcg = mcgPerKg * weightKg;
    mcg = Math.min(mcg, maxMcg);
    mcg = roundTo(mcg, 5);
    return `Fentanyl IV: ${mcg.toFixed(0)} mcg (≈ ${mcgPerKg} mcg/kg, max ${maxMcg} mcg) q1–2h PRN`;
  }

  return null;
}

function doseAdjunctsAdults({ eGFR, weightKg, severity, allowNSAID }) {
  const out = [];

  // Acetaminophen (default adjunct)
  out.push("Acetaminophen: 1 g PO/IV q6–8h (max 4 g/day; consider ≤3 g/day if liver risk)");

  if (allowNSAID) {
    // Choose one default NSAID route suggestion
    if (severity === "severe" || severity === "moderate") {
      out.push("Ketorolac: 15–30 mg IV q6h PRN (max 5 days)");
    } else {
      out.push("Ibuprofen: 400–600 mg PO q6–8h PRN (avoid if renal/GI risk)");
    }
    // optional alternatives shown later
  } else {
    // no NSAID dosing if not allowed
  }

  // Ketamine (only if opioid-tolerant or refractory; add separately in plan)
  if (weightKg && weightKg > 0) {
    const mgPerKg = 0.15; // conservative midpoint
    let mg = mgPerKg * weightKg;
    mg = roundTo(mg, 1);
    out.push(`Ketamine (low-dose): ${mg.toFixed(0)} mg IV (≈ ${mgPerKg} mg/kg) slow IV/short infusion; consider infusion 0.1–0.3 mg/kg/hr if refractory`);
  }

  // Oral transition
  out.push("Oxycodone (oral transition when improving/discharge): 5–10 mg PO q4–6h PRN");

  return out;
}

function doseCPICOralsAdults({ allowCodeineTramadol }) {
  const out = [];
  if (!allowCodeineTramadol) return out;

  // Only mild/moderate step-down (not first-line VOC severe)
  out.push("Codeine: 30–60 mg PO q4–6h PRN (mild pain only; avoid in CYP2D6 PM/UM)");
  out.push("Tramadol: 50–100 mg PO q6h PRN (max 400 mg/day; avoid in CYP2D6 PM/UM)");
  return out;
}

// Build the actual algorithm plan (what to recommend)
function buildPlan(inputs) {
  const t = TXT[lang];
  const r = renalCategory(inputs.eGFR);
  const allowNSAID = nsaidAllowed({ eGFR: inputs.eGFR, suspectedACS: inputs.suspectedACS });
  const allowCPICOrals = cpicAllowsCodeineTramadol({ genoAvail: inputs.genoAvail, phenotype: inputs.phenotype });

  const safetyAlerts = [];
  const avoidList = [];
  const regimen = [];
  const dosing = [];
  const alternatives = [];

  // Adults-only policy (as you requested)
  if (inputs.age !== null && inputs.age < 18) {
    safetyAlerts.push(t.errs.adultsOnly);
  }

  // HARD BLOCK: Meperidine
  avoidList.push(`${t.strings.meperidine}: HARD BLOCK (neurotoxicity/seizure risk; worse in renal impairment)`);

  // Renal / NSAID safety
  if (r === "severe") {
    safetyAlerts.push(
      lang === "AR"
        ? "قصور كلوي شديد (<30): تجنب NSAIDs وتجنب/قلل المورفين بسبب تراكم النواتج."
        : "Severe renal impairment (<30): avoid NSAIDs and avoid/limit morphine due to metabolite accumulation."
    );
  } else if (r === "moderate") {
    safetyAlerts.push(
      lang === "AR"
        ? "قصور كلوي متوسط (30–59): تجنب NSAIDs وراقبي التهدئة/التنفس."
        : "Moderate renal impairment (30–59): avoid NSAIDs; monitor sedation/respirations."
    );
  }

  if (!allowNSAID) {
    avoidList.push(`${t.strings.nsaid}: avoid if eGFR <60, AKI risk, or suspected ACS/hypoxia`);
  } else {
    alternatives.push(`${t.strings.diclofenac}: consider if appropriate (GI/renal cautions)`);
    alternatives.push(`${t.strings.celecoxib}: consider if appropriate (CV risk; not for severe acute VOC as sole agent)`);
  }

  // CPIC: Codeine/Tramadol warnings
  if (inputs.genoAvail !== "unknown" && (inputs.phenotype === "PM" || inputs.phenotype === "UM")) {
    safetyAlerts.push(
      lang === "AR"
        ? "CPIC (CYP2D6 PM/UM): تجنبي الكودين والترامادول (فشل تسكين أو سُمّية)."
        : "CPIC (CYP2D6 PM/UM): avoid codeine and tramadol (nonresponse or toxicity)."
    );
    avoidList.push(`${t.strings.codeine}: avoid in CYP2D6 PM/UM`);
    avoidList.push(`${t.strings.tramadol}: avoid in CYP2D6 PM/UM`);
  } else if (inputs.genoAvail === "unknown") {
    avoidList.push(`${t.strings.codeine}/${t.strings.tramadol}: avoid if genotype unknown (conservative)`);
  }

  // Respiratory / sedatives
  if (inputs.respRisk || inputs.sedatives) {
    safetyAlerts.push(
      lang === "AR"
        ? "خطر تثبيط تنفسي/مهدئات: استخدمي جرعات صغيرة وتدريجية + مراقبة RR/O2."
        : "Respiratory risk/sedatives: use small titrated doses + close RR/O2 monitoring."
    );
  }
  if (inputs.suspectedACS) {
    safetyAlerts.push(
      lang === "AR"
        ? "اشتباه ACS/نقص أكسجة: أولوية للتقييم والمراقبة، وتجنب NSAIDs."
        : "Suspected ACS/hypoxia: prioritize workup/monitoring; avoid NSAIDs."
    );
  }

  // ---- Severity pathway ----
  let primary = t.strings.preferNonOpioid;

  if (inputs.severity === "mild") {
    // Mild: non-opioid multimodal
    regimen.push(`${t.strings.acet} + ${allowNSAID ? t.strings.nsaid : "(no NSAID)"}`);
    primary = t.strings.preferNonOpioid;

    // dosing: acet + NSAID (if allowed)
    dosing.push("Acetaminophen: 1 g PO q6–8h (max 4 g/day)");
    if (allowNSAID) dosing.push("Ibuprofen: 400–600 mg PO q6–8h PRN");
    // codeine/tramadol only as step-down if allowed
    if (allowCPICOrals) alternatives.push(`${t.strings.codeine}/${t.strings.tramadol}: only for mild pain; not preferred for VOC severe`);
  }

  if (inputs.severity === "moderate" || inputs.severity === "severe") {
    // Moderate/Severe: opioid + multimodal
    const opioid = selectPrimaryOpioid({
      eGFR: inputs.eGFR,
      morphineAllergy: inputs.morphineAllergy,
      suspectedACS: inputs.suspectedACS,
      respRisk: inputs.respRisk,
    });

    primary = opioid;

    regimen.push(`${t.strings.preferredOpioid}: ${opioid}`);
    regimen.push(`${t.strings.adjuncts}: ${t.strings.acet}${allowNSAID ? ` + ${t.strings.nsaid}` : ""}`);

    // Primary opioid dosing (adults-only)
    const opioidDose = doseAdultIVOpioid({ drug: opioid, severity: inputs.severity, weightKg: inputs.weight });
    if (opioidDose) dosing.push(opioidDose);

    // Adjunct dosing (acet + nsaid + ketamine suggestion + oxy transition)
    const adjunctDoses = doseAdjunctsAdults({
      eGFR: inputs.eGFR,
      weightKg: inputs.weight,
      severity: inputs.severity,
      allowNSAID,
    });

    // For moderate/severe, keep ketamine line ONLY if opioid-tolerant or severe pain
    adjunctDoses.forEach((line) => {
      if (line.startsWith("Ketamine")) {
        if (inputs.opioidTol || inputs.severity === "severe") dosing.push(line);
        else alternatives.push("Ketamine (low-dose): consider if opioid-refractory or opioid-tolerant");
      } else if (line.startsWith("Oxycodone")) {
        // always show as transition suggestion
        alternatives.push(line);
      } else {
        dosing.push(line);
      }
    });

    // CPIC oral options are not preferred for severe VOC, keep as alternatives if allowed and moderate
    if (inputs.severity === "moderate") {
      doseCPICOralsAdults({ allowCodeineTramadol: allowCPICOrals }).forEach((x) => alternatives.push(x));
    }

    // Morphine allergy note
    if (inputs.morphineAllergy) {
      safetyAlerts.push(
        lang === "AR" ? "تحسس/عدم تحمل المورفين: تم اختيار بديل." : "Morphine intolerance/allergy: alternative selected."
      );
    }
  }

  // Add hard avoid statement for meperidine regardless
  // done above

  // Additional recommendations (always)
  const extra = [];
  extra.push(
    lang === "AR"
      ? "يفضل علاج متعدد الوسائط + إعادة التقييم المتكرر وتعديل الجرعات تدريجيًا."
      : "Prefer multimodal analgesia + frequent reassessment and titration."
  );
  extra.push(
    lang === "AR"
      ? "إذا احتاج المريض جرعات متكررة أو أكسجة منخفضة: شددي المراقبة وفكري باستشارة مختص."
      : "If frequent dosing or hypoxia: increase monitoring and consider specialist input."
  );

  return { primary, regimen, safetyAlerts, dosing, alternatives, avoidList, extra };
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
  if ($("crisesLabel")) $("crisesLabel").textContent = t.ui.crises;
  if ($("crisesHint")) $("crisesHint").textContent = t.ui.crisesHint;
  if ($("severityLabel")) $("severityLabel").textContent = t.ui.severity;
  if ($("severityHint")) $("severityHint").textContent = t.ui.severityHint;

  if ($("genoAvailLabel")) $("genoAvailLabel").textContent = t.ui.genoAvail;
  if ($("genoAvailHint")) $("genoAvailHint").textContent = t.ui.genoAvailHint;

  if ($("cypLabel")) $("cypLabel").textContent = t.ui.cyp;
  if ($("cypHint")) $("cypHint").textContent = t.ui.cypHint;

  if ($("safetyTitle")) $("safetyTitle").textContent = t.ui.safety;
  if ($("opioidTolLabel")) $("opioidTolLabel").textContent = t.ui.opioidTol;
  if ($("sedativesLabel")) $("sedativesLabel").textContent = t.ui.sedatives;
  if ($("morphineAllergyLabel")) $("morphineAllergyLabel").textContent = t.ui.morph;
  if ($("respRiskLabel")) $("respRiskLabel").textContent = t.ui.resp;
  if ($("acsLabel")) $("acsLabel").textContent = t.ui.acs;

  if ($("runAlgoBtn")) $("runAlgoBtn").textContent = t.ui.run;
  if ($("clearBtn")) $("clearBtn").textContent = t.ui.clear;
  if ($("emptyResult")) $("emptyResult").textContent = t.ui.empty;

  // select options
  if ($("sevMild")) $("sevMild").textContent = t.sev.mild;
  if ($("sevModerate")) $("sevModerate").textContent = t.sev.moderate;
  if ($("sevSevere")) $("sevSevere").textContent = t.sev.severe;

  if ($("phEM")) $("phEM").textContent = t.ph.EM;
  if ($("phIM")) $("phIM").textContent = t.ph.IM;
  if ($("phPM")) $("phPM").textContent = t.ph.PM;
  if ($("phUM")) $("phUM").textContent = t.ph.UM;
}

function setGenoHintVisibility() {
  const sel = $("genoAvail");
  const box = $("genoHintBox");
  const cypSelect = $("cyp2d6Input");
  const t = TXT[lang];

  if (!sel || !box) return;

  const isUnknown = sel.value === "unknown";
  box.classList.toggle("hidden", !isUnknown);

  if (cypSelect) cypSelect.disabled = isUnknown;

  if (isUnknown) {
    const bodyHtml = t.geno.body.replace(/\n/g, "<br>");
    box.innerHTML = `<h3 style="margin:0 0 8px 0;">${t.geno.title}</h3><div>${bodyHtml}</div>`;
  } else {
    box.innerHTML = "";
  }
}

// ---------- Inputs ----------
function readInputs() {
  const genoAvail = $("genoAvail")?.value || "known";
  // If genotype unknown → force phenotype EM (avoid falsely assigning PM/UM)
  const phenotype = genoAvail === "unknown" ? "EM" : ($("cyp2d6Input")?.value || "EM");

  return {
    age: num($("ageInput")?.value),
    weight: num($("weightInput")?.value),
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

// ---------- Render ----------
function renderResult(inputs) {
  const t = TXT[lang];

  const overall = computeOverallRisk({
    eGFR: inputs.eGFR,
    suspectedACS: inputs.suspectedACS,
    respRisk: inputs.respRisk,
    phenotype: inputs.phenotype,
    genoAvail: inputs.genoAvail,
    sedatives: inputs.sedatives,
  });

  const plan = buildPlan(inputs);

  setTheme(overall);

  $("emptyResult")?.classList.add("hidden");
  $("resultBox")?.classList.remove("hidden");

  $("stepLine").textContent = t.labels.step(
    t.sev[inputs.severity] || inputs.severity,
    t.ph[inputs.phenotype] || inputs.phenotype
  );
  $("preferredPill").textContent = t.labels.pill1(plan.primary);
  $("riskPill").textContent = t.labels.pill2(overall);

  let html = "";

  // Recommendation
  html += `<h3>${t.sections.rec}</h3><ul>`;
  html += `<li><b>${lang === "AR" ? "المخرجات:" : "Output:"}</b> ${plan.primary}</li>`;
  html += `</ul>`;

  // Regimen
  if (plan.regimen.length) {
    html += `<h3>${t.sections.regimen}</h3><ul>`;
    plan.regimen.forEach((x) => (html += `<li>${x}</li>`));
    html += `</ul>`;
  }

  // Safety alerts
  if (plan.safetyAlerts.length) {
    html += `<h3>${t.sections.safety}</h3><ul>`;
    plan.safetyAlerts.forEach((x) => (html += `<li>${x}</li>`));
    html += `</ul>`;
  }

  // Dosing
  if (plan.dosing.length) {
    html += `<h3>${t.sections.dosing}</h3><ul>`;
    plan.dosing.forEach((x) => (html += `<li>${x}</li>`));
    html += `</ul>`;
  }

  // Alternatives
  if (plan.alternatives.length) {
    html += `<h3>${t.sections.alternatives}</h3><ul>`;
    plan.alternatives.forEach((x) => (html += `<li>${x}</li>`));
    html += `</ul>`;
  }

  // Avoid list
  if (plan.avoidList.length) {
    html += `<h3>${t.sections.avoid}</h3><ul>`;
    plan.avoidList.forEach((x) => (html += `<li>${x}</li>`));
    html += `</ul>`;
  }

  // Extra recommendations
  if (plan.extra.length) {
    html += `<h3>${t.sections.extra}</h3><ul>`;
    plan.extra.forEach((x) => (html += `<li>${x}</li>`));
    html += `</ul>`;
  }

  // References (clickable)
  html += `<h3>${t.sections.refs}</h3><ul>`;
  html += `<li><a href="${MOH_ACUTE_PAIN_URL}" target="_blank" rel="noopener">${t.refs.moh}</a></li>`;
  html += `<li><a href="${CPIC_URL}" target="_blank" rel="noopener">${t.refs.cpic}</a></li>`;
  html += `<li><a href="${ASH_URL}" target="_blank" rel="noopener">${t.refs.ash}</a></li>`;
  html += `<li><a href="${OWSIANY_URL}" target="_blank" rel="noopener">${t.refs.ows}</a></li>`;
  html += `</ul>`;

  $("resultHtml").innerHTML = html;
}

// ---------- Clear ----------
function clearAll() {
  if ($("ageInput")) $("ageInput").value = "";
  if ($("weightInput")) $("weightInput").value = "";
  if ($("gfrInput")) $("gfrInput").value = "";
  if ($("crisesInput")) $("crisesInput").value = "";

  if ($("severityInput")) $("severityInput").value = "moderate";

  if ($("genoAvail")) $("genoAvail").value = "known";
  if ($("cyp2d6Input")) $("cyp2d6Input").value = "EM";
  if ($("cyp2d6Input")) $("cyp2d6Input").disabled = false;

  if ($("genoHintBox")) {
    $("genoHintBox").classList.add("hidden");
    $("genoHintBox").innerHTML = "";
  }

  if ($("opioidTol")) $("opioidTol").checked = false;
  if ($("sedatives")) $("sedatives").checked = false;
  if ($("morphineAllergy")) $("morphineAllergy").checked = false;
  if ($("respRisk")) $("respRisk").checked = false;
  if ($("suspectedACS")) $("suspectedACS").checked = false;

  if ($("formMsg")) $("formMsg").textContent = "";

  $("resultBox")?.classList.add("hidden");
  $("emptyResult")?.classList.remove("hidden");
}

// ---------- init ----------
document.addEventListener("DOMContentLoaded", () => {
  applyLanguageToUI();
  setGenoHintVisibility();

  $("genoAvail")?.addEventListener("change", () => {
    setGenoHintVisibility();
    if ($("resultBox") && !$("resultBox").classList.contains("hidden")) {
      const inputs = readInputs();
      const errs = validate(inputs);
      if (!errs.length) renderResult(inputs);
    }
  });

  $("langToggle")?.addEventListener("click", () => {
    lang = lang === "AR" ? "EN" : "AR";
    applyLanguageToUI();
    setGenoHintVisibility();

    if ($("resultBox") && !$("resultBox").classList.contains("hidden")) {
      const inputs = readInputs();
      const errs = validate(inputs);
      if (!errs.length) renderResult(inputs);
    }
  });

  $("runAlgoBtn")?.addEventListener("click", () => {
    const inputs = readInputs();
    const errs = validate(inputs);

    if (errs.length) {
      $("formMsg").textContent = errs.join(" ");
      $("resultBox")?.classList.add("hidden");
      $("emptyResult")?.classList.remove("hidden");
      return;
    }

    $("formMsg").textContent = "";
    renderResult(inputs);
  });

  $("clearBtn")?.addEventListener("click", clearAll);
});
