/* AWS D17.1 Table 7.1 — Acceptance Criteria Calculator (inches) */

let weldClass = '';

/* ─── Class selector ─── */
function setClass(cls) {
    weldClass = cls;
    document.querySelectorAll('.cls-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.class === cls);
    });
    evaluate();
}

/* ─── Dynamic input fields ─── */
function updateFields() {
    const defect = document.getElementById('defectType').value;
    const container = document.getElementById('dynamicFields');

    if (!defect) {
        container.innerHTML = '<p class="hint">Select a defect type above to enter measurements.</p>';
        showEmpty();
        return;
    }

    const autoReject = ['cracks', 'overlap', 'incomplete-fusion', 'incomplete-penetration'];
    if (autoReject.includes(defect)) {
        container.innerHTML = `<div class="info-pill">
            <span>&#9888;</span>
            <span>This discontinuity is <strong>Not Allowed</strong> under all classes. No measurements required.</span>
        </div>`;
        evaluate();
        return;
    }

    if (defect === 'arc-strikes') {
        container.innerHTML = `<div class="info-pill">
            <span>&#9888;</span>
            <span>Arc Strikes / Gouge Marks are <strong>Not Allowed</strong> for Class A &amp; B.<br>
            Class C has <strong>no stated requirement</strong>.</span>
        </div>`;
        evaluate();
        return;
    }

    let html = '<div class="dyn-field">';

    if (['porosity-surface', 'porosity-subsurface', 'inclusions'].includes(defect)) {
        html += field('indSize',     'Individual discontinuity size (in)',              '0.0001', 'e.g. 0.0200');
        html += field('adjSize',     'Nearest adjacent discontinuity size (in)',        '0.0001', 'e.g. 0.0150');
        html += field('spacing',     'Actual spacing to nearest adjacent (in)',         '0.0001', 'e.g. 0.1500');
        html += field('accumulated', 'Accumulated length in any 3 in of weld (in)',     '0.0001', 'e.g. 0.0800');
    }

    if (['undercut', 'underfill'].includes(defect)) {
        html += field('fullLengthDepth', 'Full-length average depth (in)',               '0.0001', 'e.g. 0.0015');
        html += field('indDepth',        'Individual discontinuity max depth (in)',      '0.0001', 'e.g. 0.0080');
        html += field('accumulated',     'Accumulated length in any 3 in of weld (in)', '0.0001', 'e.g. 0.1500');
    }

    if (defect === 'craters') {
        html += field('craterDepth',  'Crater depth (in)',  '0.0001', 'e.g. 0.0200');
        html += field('craterLength', 'Crater length (in)', '0.0001', 'e.g. 0.1200');
    }

    html += '</div>';
    container.innerHTML = html;
    container.querySelectorAll('input').forEach(i => i.addEventListener('input', evaluate));
    evaluate();
}

function field(id, labelText, step, placeholder) {
    return `<div>
        <label for="${id}">${labelText}</label>
        <input type="number" id="${id}" min="0" step="${step}" placeholder="${placeholder}">
    </div>`;
}

/* ─── Helpers ─── */
function getNum(id) {
    const el = document.getElementById(id);
    if (!el) return null;
    const v = parseFloat(el.value);
    return isNaN(v) || v < 0 ? null : v;
}

function ins(v) {
    return v.toFixed(4) + ' in';
}

function defectName(d) {
    const names = {
        'cracks':                 'Cracks',
        'overlap':                'Overlap (Cold Lap)',
        'incomplete-fusion':      'Incomplete Fusion',
        'incomplete-penetration': 'Incomplete Penetration',
        'porosity-surface':       'Porosity — Surface',
        'porosity-subsurface':    'Porosity — Subsurface',
        'inclusions':             'Inclusions',
        'undercut':               'Undercut',
        'underfill':              'Face or Root Underfill',
        'craters':                'Craters',
        'arc-strikes':            'Arc Strikes / Gouge Marks'
    };
    return names[d] || d;
}

/* ─── Criteria tables (all values in inches) ─── */
function porosityCriteria(defect, cls, T) {
    const table = {
        'porosity-surface': {
            A: { kInd: 0.25, capInd: 0.030, spaceMult: 8, kAcc: 1.00, capAcc: 0.12 },
            B: { kInd: 0.33, capInd: 0.060, spaceMult: 4, kAcc: 1.33, capAcc: 0.24 },
            C: { kInd: 0.50, capInd: 0.090, spaceMult: 2, kAcc: 2.00, capAcc: 0.36 }
        },
        'porosity-subsurface': {
            A: { kInd: 0.33, capInd: 0.060, spaceMult: 4, kAcc: 1.33, capAcc: 0.24 },
            B: { kInd: 0.50, capInd: 0.090, spaceMult: 2, kAcc: 2.00, capAcc: 0.36 }
        },
        'inclusions': {
            A: { kInd: 0.33, capInd: 0.060, spaceMult: 4, kAcc: 1.33, capAcc: 0.24 },
            B: { kInd: 0.50, capInd: 0.090, spaceMult: 2, kAcc: 2.00, capAcc: 0.36 }
        }
    };
    const c = table[defect][cls];
    return {
        indMax:     Math.min(c.kInd * T, c.capInd),
        indFormula: `min(${c.kInd}×T, ${c.capInd} in)`,
        spaceMult:  c.spaceMult,
        accMax:     Math.min(c.kAcc * T, c.capAcc),
        accFormula: `min(${c.kAcc}×T, ${c.capAcc} in)`
    };
}

function linearCriteria(defect, cls, T) {
    const isUndercut = defect === 'undercut';

    const kInd   = cls === 'A' ? 0.07  : cls === 'B' ? 0.10  : 0.20;
    const capInd = cls === 'A' ? 0.030 : cls === 'B' ? 0.050 : 0.070;
    const accMax = cls === 'A' ? 0.20  : cls === 'B' ? 0.60  : 1.00;

    // Full-length depth limits differ between undercut and underfill
    const fixedFL    = isUndercut ? 0.002  : 0.005;
    const fixedLabel = isUndercut ? '0.002' : '0.005';

    let fullLengthMax, fullLengthFormula;
    if (cls === 'A') {
        fullLengthMax     = fixedFL;
        fullLengthFormula = `Fixed: ${fixedLabel} in`;
    } else {
        const kFL         = cls === 'B' ? 0.015 : 0.025;
        fullLengthMax     = Math.max(kFL * T, fixedFL);
        fullLengthFormula = `max(${kFL}×T, ${fixedLabel} in)`;
    }

    return {
        fullLengthMax, fullLengthFormula,
        indMax:     Math.min(kInd * T, capInd),
        indFormula: `min(${kInd}×T, ${capInd} in)`,
        accMax,
        accFormula: 'Fixed per class'
    };
}

function craterCriteria(cls, T) {
    const capDepth = cls === 'A' ? 0.03 : 0.05;
    const kLen     = cls === 'C' ? 2.0  : 1.0;
    return {
        depthMax:     Math.min(0.20 * T, capDepth),
        depthFormula: `min(0.20×T, ${capDepth} in)`,
        lenMax:       kLen * T,
        lenFormula:   `${kLen}×T`
    };
}

/* ─── Main evaluator ─── */
function evaluate() {
    const T      = parseFloat(document.getElementById('thickness').value);
    const defect = document.getElementById('defectType').value;

    if (!defect)    { showEmpty(); return; }
    if (!weldClass) { showMsg('Select a weld class (A, B, or C).'); return; }

    const autoReject = ['cracks', 'overlap', 'incomplete-fusion', 'incomplete-penetration'];

    if (autoReject.includes(defect)) {
        renderVerdict(false, 'NOT ACCEPTABLE',
            'Not allowed under any weld class per AWS D17.1 Table 7.1.', []);
        return;
    }

    if (defect === 'arc-strikes') {
        if (weldClass === 'C') {
            renderVerdict(null, 'NO STATED REQUIREMENT',
                'AWS D17.1 Table 7.1 states no requirement for Arc Strikes / Gouge Marks in Class C.', []);
        } else {
            renderVerdict(false, 'NOT ACCEPTABLE',
                `Arc Strikes / Gouge Marks are not allowed for Class ${weldClass}.`, []);
        }
        return;
    }

    if (isNaN(T) || T <= 0) {
        showMsg('Enter a valid material thickness (T) to calculate limits.');
        return;
    }

    const checks = [];
    let anyInput = false;

    /* — Porosity / Inclusions — */
    if (['porosity-surface', 'porosity-subsurface', 'inclusions'].includes(defect)) {
        if (defect !== 'porosity-surface' && weldClass === 'C') {
            renderVerdict(null, 'NOT APPLICABLE',
                `${defect === 'inclusions' ? 'Inclusions' : 'Subsurface Porosity'} criteria are not applicable for Class C.`, []);
            return;
        }

        const cr          = porosityCriteria(defect, weldClass, T);
        const indSize     = getNum('indSize');
        const adjSize     = getNum('adjSize');
        const spacing     = getNum('spacing');
        const accumulated = getNum('accumulated');

        if (indSize !== null) {
            anyInput = true;
            checks.push({
                name:     'Individual size maximum',
                formula:  cr.indFormula,
                measured: ins(indSize),
                limit:    `≤ ${ins(cr.indMax)}`,
                pass:     indSize <= cr.indMax
            });
        }

        if (indSize !== null && adjSize !== null && spacing !== null) {
            anyInput = true;
            const larger     = Math.max(indSize, adjSize);
            const spaceLimit = cr.spaceMult * larger;
            checks.push({
                name:     'Spacing minimum',
                formula:  `${cr.spaceMult}× larger adjacent (${ins(larger)})`,
                measured: ins(spacing),
                limit:    `≥ ${ins(spaceLimit)}`,
                pass:     spacing >= spaceLimit
            });
        }

        if (accumulated !== null) {
            anyInput = true;
            checks.push({
                name:     'Accumulated length in any 3 in of weld',
                formula:  cr.accFormula,
                measured: ins(accumulated),
                limit:    `≤ ${ins(cr.accMax)}`,
                pass:     accumulated <= cr.accMax
            });
        }
    }

    /* — Undercut / Underfill — */
    if (['undercut', 'underfill'].includes(defect)) {
        const cr          = linearCriteria(defect, weldClass, T);
        const flDepth     = getNum('fullLengthDepth');
        const indDepth    = getNum('indDepth');
        const accumulated = getNum('accumulated');

        if (flDepth !== null) {
            anyInput = true;
            checks.push({
                name:     'Full-length average depth max',
                formula:  cr.fullLengthFormula,
                measured: ins(flDepth),
                limit:    `≤ ${ins(cr.fullLengthMax)}`,
                pass:     flDepth <= cr.fullLengthMax
            });
        }

        if (indDepth !== null) {
            anyInput = true;
            checks.push({
                name:     'Individual discontinuity depth max',
                formula:  cr.indFormula,
                measured: ins(indDepth),
                limit:    `≤ ${ins(cr.indMax)}`,
                pass:     indDepth <= cr.indMax
            });
        }

        if (accumulated !== null) {
            anyInput = true;
            checks.push({
                name:     'Accumulated length in any 3 in of weld',
                formula:  cr.accFormula,
                measured: ins(accumulated),
                limit:    `≤ ${ins(cr.accMax)}`,
                pass:     accumulated <= cr.accMax
            });
        }
    }

    /* — Craters — */
    if (defect === 'craters') {
        const cr     = craterCriteria(weldClass, T);
        const depth  = getNum('craterDepth');
        const length = getNum('craterLength');

        if (depth !== null) {
            anyInput = true;
            checks.push({
                name:     'Maximum depth',
                formula:  cr.depthFormula,
                measured: ins(depth),
                limit:    `≤ ${ins(cr.depthMax)}`,
                pass:     depth <= cr.depthMax
            });
        }

        if (length !== null) {
            anyInput = true;
            checks.push({
                name:     'Maximum length',
                formula:  cr.lenFormula,
                measured: ins(length),
                limit:    `≤ ${ins(cr.lenMax)}`,
                pass:     length <= cr.lenMax
            });
        }
    }

    if (!anyInput) {
        showMsg('Enter at least one measurement value to evaluate.');
        return;
    }

    const allPass = checks.every(c => c.pass);
    renderVerdict(
        allPass,
        allPass ? 'ACCEPTABLE' : 'NOT ACCEPTABLE',
        allPass
            ? 'All measured values are within the Table 7.1 acceptance criteria.'
            : 'One or more measured values exceed the acceptance criteria.',
        checks
    );
}

/* ─── Render functions ─── */
function renderVerdict(pass, label, subtitle, checks) {
    const T      = parseFloat(document.getElementById('thickness').value);
    const defect = document.getElementById('defectType').value;
    const cls    = pass === true ? 'pass' : pass === false ? 'fail' : 'na';
    const icon   = pass === true ? '✓'   : pass === false ? '✗'   : '—';

    let checksHtml = '';
    if (checks.length) {
        checksHtml = `
        <div class="card">
            <div class="card-header">Check Details</div>
            ${checks.map(c => `
            <div class="check-row">
                <div class="check-left">
                    <div class="check-name">${c.name}</div>
                    <div class="check-formula">${c.formula}</div>
                </div>
                <div class="check-right">
                    <div class="check-nums">
                        <div class="check-measured">${c.measured}</div>
                        <div class="check-limit">${c.limit}</div>
                    </div>
                    <span class="badge ${c.pass ? 'pass' : 'fail'}">${c.pass ? 'PASS' : 'FAIL'}</span>
                </div>
            </div>`).join('')}
        </div>`;
    }

    const tStr = isNaN(T) || T <= 0 ? '—' : ins(T);

    document.getElementById('resultsPanel').innerHTML = `
        <div class="verdict-banner ${cls}">
            <div class="verdict-icon">${icon}</div>
            <div>
                <div>${label}</div>
                <div class="verdict-sub">${subtitle}</div>
            </div>
        </div>
        ${checksHtml}
        <div class="card">
            <div class="card-header">Evaluation Parameters</div>
            <div class="params-row">
                <span class="params-label">Material Thickness (T)</span>
                <span class="params-value">${tStr}</span>
            </div>
            <div class="params-row">
                <span class="params-label">Weld Class</span>
                <span class="params-value">Class ${weldClass || '—'}</span>
            </div>
            <div class="params-row">
                <span class="params-label">Discontinuity Type</span>
                <span class="params-value">${defectName(defect)}</span>
            </div>
        </div>
        <p class="footnote">
            Reference: AWS D17.1 Table 7.1 — Acceptance Criteria (in)
            &nbsp;·&nbsp;
            <em>This tool is for reference only. Always verify against the official standard.</em>
        </p>
    `;
}

function showEmpty() {
    document.getElementById('resultsPanel').innerHTML = `
        <div class="empty-state">
            <svg width="52" height="52" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.2"
                    d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0
                       3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946
                       3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138
                       3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806
                       3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438
                       3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/>
            </svg>
            <p>Enter thickness, select a class and defect type,<br>then input measurements to check compliance.</p>
        </div>`;
}

function showMsg(msg) {
    document.getElementById('resultsPanel').innerHTML = `
        <div class="empty-state">
            <p>${msg}</p>
        </div>`;
}
