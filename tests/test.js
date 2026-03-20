const { chromium } = require('playwright');
const path = require('path');
const root = path.resolve(__dirname, '..');
const base = 'file://' + root;
const screenshotsDir = path.join(__dirname, 'screenshots');

// ── Helpers ──────────────────────────────────────────────
function pass(msg) { console.log('  ✓', msg); }
function fail(msg) { console.log('  ✗', msg); }
function info(msg) { console.log('  ·', msg); }
function check(cond, msg) { cond ? pass(msg) : fail(msg); return cond; }

async function setSlider(page, id, value) {
  await page.evaluate(({ id, value }) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, { id, value });
}

async function setInput(page, id, value) {
  await page.evaluate(({ id, value }) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, { id, value });
}

async function setSelect(page, id, value) {
  await page.evaluate(({ id, value }) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = value;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, { id, value });
}

async function getMeter(page, id = 'meterKg') {
  return page.evaluate(id => {
    const el = document.getElementById(id);
    return el ? parseFloat(el.textContent.replace(',', '.')) : null;
  }, id);
}

async function getText(page, id) {
  return page.evaluate(id => {
    const el = document.getElementById(id);
    return el ? el.textContent.trim() : null;
  }, id);
}

async function getInputValue(page, id) {
  return page.evaluate(id => {
    const el = document.getElementById(id);
    return el ? parseFloat(el.value) : null;
  }, id);
}

// ─────────────────────────────────────────────────────────
(async () => {
  const browser = await chromium.launch();
  let totalPassed = 0, totalFailed = 0;

  function tally(result) { result ? totalPassed++ : totalFailed++; }

  // ══════════════════════════════════════════════════════
  // PESSOAL.HTML
  // ══════════════════════════════════════════════════════
  console.log('\n══════════════════════════════════════');
  console.log('  pessoal.html — Calculadora Pessoal');
  console.log('══════════════════════════════════════');
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const jsErrors = [];
    page.on('pageerror', e => jsErrors.push(e.message));
    await page.goto(base + '/pessoal.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    // ── 1. Estado zero (todos sliders em 0) ──
    console.log('\n  [1] Estado zero');
    const meterZero = await getMeter(page);
    // com defaults, o meter não é zero — é calculado a partir dos defaults
    info(`Meter com defaults: ${meterZero} tCO₂`);
    tally(check(meterZero !== null, 'Meter existe e tem valor'));

    // ── 2. Transporte — carro ──
    console.log('\n  [2] Transporte: 300 km/mês, carro gasolina');
    await setSlider(page, 's-carro', 300);
    await setSelect(page, 'tipo-carro', 'gas');
    await page.waitForTimeout(200);
    const meterCar = await getMeter(page);
    // 300 km/mês × 12 × 0.171 kg/km = 615.6 kg/ano = 0.616 tCO₂
    // + outros campos defaults
    info(`Meter após carro 300km: ${meterCar} tCO₂`);
    tally(check(meterCar > 0, 'Meter aumentou com entrada de carro'));

    // ── 3. Energia ──
    console.log('\n  [3] Energia: 200 kWh/mês luz, 5 kg GLP/mês');
    await setSlider(page, 's-luz', 200);
    await setSlider(page, 's-gas', 5);
    await page.waitForTimeout(200);
    const meterEnergy = await getMeter(page);
    info(`Meter após energia: ${meterEnergy} tCO₂`);
    tally(check(meterEnergy > meterCar, 'Meter aumentou ao adicionar energia'));

    // ── 4. Dieta carnívora (valor select = '3200') ──
    console.log('\n  [4] Dieta carnívora');
    await setSelect(page, 'dieta', '3200');
    await page.waitForTimeout(200);
    const meterMeat = await getMeter(page);
    info(`Meter com dieta carnívora: ${meterMeat} tCO₂`);
    tally(check(meterMeat > meterEnergy, 'Dieta carnívora aumenta emissões'));

    // ── 5. Dieta vegana reduz vs carnívora (valor select = '650') ──
    console.log('\n  [5] Dieta vegana reduz vs carnívora');
    await setSelect(page, 'dieta', '650');
    await page.waitForTimeout(200);
    const meterVegan = await getMeter(page);
    info(`Meter com dieta vegana: ${meterVegan} tCO₂`);
    tally(check(meterVegan < meterMeat, 'Dieta vegana < carnívora'));

    // ── 6. Avião ──
    console.log('\n  [6] 10h de voo/mês');
    await setSlider(page, 's-aviao', 10);
    await page.waitForTimeout(200);
    const meterFlight = await getMeter(page);
    info(`Meter com 10h voo: ${meterFlight} tCO₂`);
    tally(check(meterFlight > meterVegan, 'Voos aumentam emissões'));

    // ── 7. Valor máximo não quebra ──
    console.log('\n  [7] Valores extremos');
    await setSlider(page, 's-carro', 1000);
    await setSlider(page, 's-aviao', 200);
    await setSlider(page, 's-luz', 1000);
    await page.waitForTimeout(300);
    const meterMax = await getMeter(page);
    info(`Meter em máximo: ${meterMax} tCO₂`);
    tally(check(Number.isFinite(meterMax) && meterMax > 0, 'Máximos não quebram o cálculo'));

    // ── 8. Cor do meter muda conforme intensidade ──
    console.log('\n  [8] Cor do meter');
    const meterColor = await page.evaluate(() => document.getElementById('meterKg').style.color);
    info(`Cor atual: ${meterColor}`);
    tally(check(meterColor !== '', 'Meter tem cor dinâmica aplicada'));

    // ── 9. Mensagem de status atualiza ──
    console.log('\n  [9] Mensagem de status');
    const statusMsg = await getText(page, 'meterStatus');
    info(`Status: "${statusMsg}"`);
    tally(check(statusMsg && statusMsg !== 'Preencha abaixo', 'Status message atualizado'));

    // ── 10. Toggle tema ──
    console.log('\n  [10] Tema claro/escuro');
    await page.locator('#themeToggle').click();
    await page.waitForTimeout(300);
    const isLight = await page.evaluate(() => document.documentElement.getAttribute('data-theme') === 'light');
    tally(check(isLight, 'Mudou para light'));
    const saved = await page.evaluate(() => localStorage.getItem('cmTheme'));
    tally(check(saved === 'light', 'Preferência salva no localStorage'));
    await page.locator('#themeToggle').click();
    await page.waitForTimeout(200);

    // ── 11. Erros JS ──
    console.log('\n  [11] Erros de JavaScript');
    tally(check(jsErrors.length === 0, jsErrors.length ? 'Erros: ' + jsErrors.join(' | ') : 'Sem erros JS'));

    // ── 12. Sync input numérico ↔ slider ──
    console.log('\n  [12] Sync input numérico ↔ slider (pessoal)');

    // 12a. Digitar no input numérico atualiza o slider
    await setInput(page, 'n-carro', 400);
    await page.waitForTimeout(200);
    const sliderCarroAfterNum = await getInputValue(page, 's-carro');
    tally(check(sliderCarroAfterNum === 400, `Digitar n-carro=400 → slider s-carro=${sliderCarroAfterNum}`));

    // 12b. Mover o slider atualiza o input numérico
    await setSlider(page, 's-moto', 150);
    await page.waitForTimeout(200);
    const numMotoAfterSlider = await getInputValue(page, 'n-moto');
    tally(check(numMotoAfterSlider === 150, `Mover s-moto=150 → n-moto=${numMotoAfterSlider}`));

    // 12c. Digitar no input numérico atualiza o gauge
    const meterBeforeNumInput = await getMeter(page);
    await setInput(page, 'n-luz', 500);
    await page.waitForTimeout(200);
    const meterAfterNumInput = await getMeter(page);
    tally(check(meterAfterNumInput !== meterBeforeNumInput, `Digitar n-luz=500 atualiza o gauge (${meterBeforeNumInput} → ${meterAfterNumInput})`));

    // 12d. Valor acima do máximo é clampado no slider E no input numérico
    await setInput(page, 'n-carro', 9999);
    await page.waitForTimeout(200);
    const sliderCarroClamped = await getInputValue(page, 's-carro');
    const numCarroClamped   = await getInputValue(page, 'n-carro');
    tally(check(sliderCarroClamped <= 1000, `Valor acima do max clampado no slider: s-carro=${sliderCarroClamped} (max=1000)`));
    tally(check(numCarroClamped <= 1000,    `Valor acima do max corrigido no input:  n-carro=${numCarroClamped} (max=1000)`));

    // 12d2. Valor negativo é clampado para 0 no slider E no input numérico
    await setInput(page, 'n-moto', -50);
    await page.waitForTimeout(200);
    const sliderMotoClamped = await getInputValue(page, 's-moto');
    const numMotoClamped    = await getInputValue(page, 'n-moto');
    tally(check(sliderMotoClamped >= 0, `Valor negativo clampado no slider: s-moto=${sliderMotoClamped} (min=0)`));
    tally(check(numMotoClamped >= 0,    `Valor negativo corrigido no input:  n-moto=${numMotoClamped} (min=0)`));

    // 12e. Slider e input numérico produzem o mesmo resultado no gauge
    await setSlider(page, 's-luz', 200);
    await page.waitForTimeout(200);
    const meterViaSlider = await getMeter(page);
    await setInput(page, 'n-luz', 200);
    await page.waitForTimeout(200);
    const meterViaNumInput = await getMeter(page);
    tally(check(meterViaSlider === meterViaNumInput, `Gauge idêntico via slider (${meterViaSlider}) e via input numérico (${meterViaNumInput})`));

    // 12f. Todos os inputs numéricos existem no DOM
    const numInputIds = ['n-carro','n-moto','n-aviao','n-onibus','n-luz','n-gas','n-local','n-roupas','n-eletro'];
    const allExist = await page.evaluate(ids => ids.every(id => !!document.getElementById(id)), numInputIds);
    tally(check(allExist, 'Todos os 9 inputs numéricos existem no DOM'));

    // screenshots
    await page.screenshot({ path: path.join(screenshotsDir, 'pessoal-filled.png') });
    info('Screenshot: tests/screenshots/pessoal-filled.png');
    await page.close();
  }

  // ══════════════════════════════════════════════════════
  // EMPRESARIAL.HTML
  // ══════════════════════════════════════════════════════
  console.log('\n══════════════════════════════════════');
  console.log('  empresarial.html — GHG Protocol');
  console.log('══════════════════════════════════════');
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const jsErrors = [];
    page.on('pageerror', e => jsErrors.push(e.message));
    await page.goto(base + '/empresarial.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    // ── 1. Identificação da empresa ──
    console.log('\n  [1] Identificação da empresa');
    await setInput(page, 'empresa-nome', 'Empresa Teste Ltda.');
    await page.waitForTimeout(200);
    const headerEmpresa = await getText(page, 'h-empresa');
    tally(check(headerEmpresa === 'Empresa Teste Ltda.', `Header mostra: "${headerEmpresa}"`));

    // ── 2. Número de colaboradores ──
    console.log('\n  [2] Colaboradores: 100');
    await setInput(page, 'num-func', 100);
    await page.waitForTimeout(200);
    const meterAfterFunc = await getMeter(page);
    info(`Meter com 100 colaboradores: ${meterAfterFunc} tCO₂e`);
    tally(check(meterAfterFunc !== null, 'Meter existe'));

    // ── 3. Escopo 1 — Frota ──
    console.log('\n  [3] Escopo 1 — Frota: 10 carros, 1500 km/mês');
    const meterBefore = await getMeter(page);
    await setInput(page, 'f-carros-qtd', 10);
    await setInput(page, 'f-carros-km', 1500);
    await page.waitForTimeout(300);
    const meterAfterFleet = await getMeter(page);
    // 10 × 1500 × 12 × 0.171 = 30780 kg = 30,78 tCO₂
    const expectedFleet = (10 * 1500 * 12 * 0.171) / 1000;
    info(`Esperado (só frota): ~${expectedFleet.toFixed(1)} t | Meter total: ${meterAfterFleet} t`);
    tally(check(meterAfterFleet > meterBefore, 'Escopo 1 (frota) aumenta total'));

    // Escopo 1 badge
    const s1Text = await getText(page, 'em-s1');
    info(`Badge Escopo 1: "${s1Text}"`);
    tally(check(s1Text && s1Text !== '0,0 tCO₂e', 'Badge Escopo 1 atualizado'));

    // ── 4. Escopo 2 — Eletricidade ──
    console.log('\n  [4] Escopo 2 — 5000 kWh/mês, Sudeste/Sul');
    await setInput(page, 'eletric', 5000);
    await setSelect(page, 'regiao', '0.082');
    await page.waitForTimeout(300);
    const meterAfterElec = await getMeter(page);
    // 5000 × 12 × 0.082 = 4920 kg = 4,92 tCO₂
    info(`Meter após eletricidade: ${meterAfterElec} tCO₂e`);
    tally(check(meterAfterElec > meterAfterFleet, 'Escopo 2 (energia) aumenta total'));

    const s2Text = await getText(page, 'em-s2');
    info(`Badge Escopo 2: "${s2Text}"`);
    tally(check(s2Text && s2Text !== '0,0 tCO₂e', 'Badge Escopo 2 atualizado'));

    // ── 5. Escopo 3 — Commuting (zeramos primeiro, depois adicionamos) ──
    console.log('\n  [5] Escopo 3 — Commuting: 0 → 20km/dia, 22 dias/mês, carro');
    await setInput(page, 'comm-dist', 0); // zera commuting (default era 20)
    await page.waitForTimeout(200);
    const meterNoComm = await getMeter(page);
    await setInput(page, 'comm-dist', 20);
    await setInput(page, 'comm-dias', 22);
    await setSelect(page, 'comm-modal', '0.171');
    await page.waitForTimeout(300);
    const meterAfterComm = await getMeter(page);
    // 100 func × 20 km × 22 dias × 12 meses × 0.171 = 90288 kg = 90.3 tCO₂
    info(`Commuting: sem=${meterNoComm} → com=${meterAfterComm} tCO₂e`);
    tally(check(meterAfterComm > meterNoComm, 'Escopo 3 (commuting) aumenta total'));

    const s3Text = await getText(page, 'em-s3');
    info(`Badge Escopo 3: "${s3Text}"`);
    tally(check(s3Text && s3Text !== '0,0 tCO₂e', 'Badge Escopo 3 atualizado'));

    // ── 6. Intensidade por colaborador ──
    console.log('\n  [6] Intensidade por colaborador');
    const intVal = await getText(page, 'int-val');
    const totalVal = await getText(page, 'int-total');
    info(`Intensidade: ${intVal} tCO₂e/colab | Total: ${totalVal} tCO₂e`);
    tally(check(parseFloat((intVal||'0').replace(',','.')) > 0, 'Intensidade calculada'));

    // ── 7. Resultado na seção de resultados ──
    console.log('\n  [7] Seção de resultados');
    const r_s1 = await getText(page, 'r-s1');
    const r_s2 = await getText(page, 'r-s2');
    const r_s3 = await getText(page, 'r-s3');
    info(`Resultados: E1=${r_s1} | E2=${r_s2} | E3=${r_s3}`);
    tally(check(parseFloat((r_s3||'0').replace(',','.')) > 0, 'Resultado Escopo 3 preenchido'));

    // ── 8. Voos corporativos ──
    console.log('\n  [8] Viagens: 4h voo dom/mês, 2h voo int/mês');
    await setInput(page, 'voo-dom', 4);
    await setInput(page, 'voo-int', 2);
    await page.waitForTimeout(200);
    const meterAfterFlights = await getMeter(page);
    tally(check(meterAfterFlights > meterAfterComm, 'Voos corporativos aumentam emissões'));

    // ── 9. Abatimento por renováveis ──
    console.log('\n  [9] I-REC 50% → reduz Escopo 2');
    const s2Before = parseFloat((await getText(page, 'r-s2')||'0').replace(',','.'));
    await setSlider(page, 's-irec', 50);
    await page.waitForTimeout(200);
    const s2After = parseFloat((await getText(page, 'r-s2')||'0').replace(',','.'));
    info(`Escopo 2: ${s2Before} → ${s2After} tCO₂e (após 50% I-REC)`);
    tally(check(s2After < s2Before, 'I-REC reduz Escopo 2'));

    // ── 10. Botão PDF existe ──
    console.log('\n  [10] Botão exportar PDF');
    const pdfBtn = await page.locator('#btnPdf').count();
    tally(check(pdfBtn > 0, 'Botão PDF presente'));

    // ── 11. Valores extremos / zero ──
    console.log('\n  [11] Reset para zeros — cálculo continua sem erros');
    await setInput(page, 'f-carros-qtd', 0);
    await setInput(page, 'eletric', 0);
    await setInput(page, 'comm-dist', 0);
    await page.waitForTimeout(300);
    const meterReset = await getMeter(page);
    tally(check(Number.isFinite(meterReset), `Meter após reset: ${meterReset} — sem NaN/Infinity`));

    // ── 12. Erros JS ──
    console.log('\n  [12] Erros de JavaScript');
    tally(check(jsErrors.length === 0, jsErrors.length ? 'Erros: ' + jsErrors.join(' | ') : 'Sem erros JS'));

    // ── 13. Sync input numérico ↔ slider (empresarial) ──
    console.log('\n  [13] Sync input numérico ↔ slider (empresarial)');

    // 13a. Digitar em n-irec atualiza slider s-irec
    await setInput(page, 'n-irec', 60);
    await page.waitForTimeout(200);
    const sliderIrecAfterNum = await getInputValue(page, 's-irec');
    tally(check(sliderIrecAfterNum === 60, `Digitar n-irec=60 → slider s-irec=${sliderIrecAfterNum}`));

    // 13b. Mover slider s-solar atualiza n-solar
    await setSlider(page, 's-solar', 40);
    await page.waitForTimeout(200);
    const numSolarAfterSlider = await getInputValue(page, 'n-solar');
    tally(check(numSolarAfterSlider === 40, `Mover s-solar=40 → n-solar=${numSolarAfterSlider}`));

    // 13c. n-irec=100 reduz Escopo 2 ao máximo (abatimento total)
    await setInput(page, 'eletric', 5000);
    await setSelect(page, 'regiao', '0.082');
    // reset abatimento antes de medir baseline
    await setInput(page, 'n-irec', 0);
    await setInput(page, 'n-solar', 0);
    await page.waitForTimeout(200);
    const s2WithoutAbate = parseFloat((await getText(page, 'r-s2') || '0').replace(',', '.'));
    await setInput(page, 'n-irec', 100);
    await page.waitForTimeout(200);
    const s2FullAbate = parseFloat((await getText(page, 'r-s2') || '0').replace(',', '.'));
    tally(check(s2FullAbate < s2WithoutAbate, `n-irec=100% abate Escopo 2: ${s2WithoutAbate} → ${s2FullAbate} tCO₂e`));

    // 13d. Mover slider s-aterro atualiza n-aterro
    await setSlider(page, 's-aterro', 80);
    await page.waitForTimeout(200);
    const numAterroAfterSlider = await getInputValue(page, 'n-aterro');
    tally(check(numAterroAfterSlider === 80, `Mover s-aterro=80 → n-aterro=${numAterroAfterSlider}`));

    // 13e. Digitar em n-aterro atualiza o gauge
    await setInput(page, 'res-total', 1000);
    await page.waitForTimeout(200);
    const meterBeforeAterro = await getMeter(page);
    await setInput(page, 'n-aterro', 0);
    await page.waitForTimeout(200);
    const meterAfterAterro = await getMeter(page);
    tally(check(meterAfterAterro !== meterBeforeAterro, `Digitar n-aterro=0 altera gauge (${meterBeforeAterro} → ${meterAfterAterro})`));

    // 13f2. Valor acima do máximo clampado no slider E no input (n-irec max=100)
    await setInput(page, 'n-irec', 999);
    await page.waitForTimeout(200);
    const sliderIrecClamped = await getInputValue(page, 's-irec');
    const numIrecClamped    = await getInputValue(page, 'n-irec');
    tally(check(sliderIrecClamped <= 100, `Valor acima do max clampado no slider: s-irec=${sliderIrecClamped} (max=100)`));
    tally(check(numIrecClamped <= 100,    `Valor acima do max corrigido no input:  n-irec=${numIrecClamped} (max=100)`));

    // 13f3. Valor negativo clampado para 0 (n-solar min=0)
    await setInput(page, 'n-solar', -20);
    await page.waitForTimeout(200);
    const sliderSolarClamped = await getInputValue(page, 's-solar');
    const numSolarClamped    = await getInputValue(page, 'n-solar');
    tally(check(sliderSolarClamped >= 0, `Valor negativo clampado no slider: s-solar=${sliderSolarClamped} (min=0)`));
    tally(check(numSolarClamped >= 0,    `Valor negativo corrigido no input:  n-solar=${numSolarClamped} (min=0)`));

    // 13f. Todos os inputs numéricos dos sliders existem no DOM
    const empNumIds = ['n-irec','n-solar','n-aterro','n-recicl','n-comp'];
    const allEmpExist = await page.evaluate(ids => ids.every(id => !!document.getElementById(id)), empNumIds);
    tally(check(allEmpExist, 'Todos os 5 inputs numéricos de sliders existem no DOM'));

    await page.screenshot({ path: path.join(screenshotsDir, 'empresarial-filled.png') });
    info('Screenshot: tests/screenshots/empresarial-filled.png');
    await page.close();
  }

  // ══════════════════════════════════════════════════════
  // PESSOAL.HTML — CTA + LOCALSTORAGE
  // ══════════════════════════════════════════════════════
  console.log('\n══════════════════════════════════════');
  console.log('  pessoal.html — CTA + localStorage');
  console.log('══════════════════════════════════════');
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const jsErrors = [];
    page.on('pageerror', e => jsErrors.push(e.message));
    await page.goto(base + '/pessoal.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    // A. #btnCalcular existe no DOM
    console.log('\n  [A1] Botão #btnCalcular existe');
    const btnExists = await page.evaluate(() => !!document.getElementById('btnCalcular'));
    tally(check(btnExists, '#btnCalcular existe no DOM'));

    // A. Clicar no botão salva cm_pessoal_result (síncrono, antes do redirect 2.5s)
    console.log('\n  [A2] Click salva cm_pessoal_result no localStorage');
    // Configura alguns valores antes de clicar
    await setSlider(page, 's-carro', 120);
    await setSelect(page, 'tipo-carro', '0.171');
    await setSlider(page, 's-aviao', 2);
    await page.waitForTimeout(200);

    // Intercepta o click: salva e impede o redirect
    await page.evaluate(() => {
      window._origLocation = window.location.href;
      // Evita redirect durante o teste sobrescrevendo temporariamente
      const origAssign = Object.getOwnPropertyDescriptor(window.location, 'href');
      Object.defineProperty(window, '_redirectCalled', { value: false, writable: true });
    });

    // Chama saveAndRedirect() via JS para capturar resultado sem navegar
    await page.evaluate(() => {
      // Patch para evitar redirect real durante o teste
      const origSetTimeout = window.setTimeout;
      window.setTimeout = function(fn, delay, ...args) {
        if (delay >= 2000) {
          // Substitui o redirect por um noop
          return origSetTimeout(() => {}, 99999);
        }
        return origSetTimeout(fn, delay, ...args);
      };
      saveAndRedirect();
    });
    await page.waitForTimeout(300);

    const saved = await page.evaluate(() => {
      try { return JSON.parse(localStorage.getItem('cm_pessoal_result')); } catch(e) { return null; }
    });
    tally(check(saved !== null, 'cm_pessoal_result salvo no localStorage'));

    // Campos obrigatórios
    tally(check(saved && typeof saved.total === 'number', 'Campo total é número'));
    tally(check(saved && typeof saved.totalT === 'number', 'Campo totalT é número'));
    tally(check(saved && saved.emis && typeof saved.emis.t === 'number', 'emis.t presente'));
    tally(check(saved && saved.emis && typeof saved.emis.e === 'number', 'emis.e presente'));
    tally(check(saved && saved.emis && typeof saved.emis.a === 'number', 'emis.a presente'));
    tally(check(saved && saved.emis && typeof saved.emis.c === 'number', 'emis.c presente'));
    tally(check(saved && typeof saved.color === 'string' && saved.color.startsWith('#'), 'color é hex válido'));
    tally(check(saved && typeof saved.statusTxt === 'string' && saved.statusTxt.length > 0, 'statusTxt preenchido'));
    tally(check(saved && saved.inputs && typeof saved.inputs.carro === 'number', 'inputs.carro presente'));

    console.log('\n  [A3] Erros de JavaScript');
    tally(check(jsErrors.length === 0, jsErrors.length ? 'Erros: ' + jsErrors.join(' | ') : 'Sem erros JS'));

    await page.screenshot({ path: path.join(screenshotsDir, 'pessoal-cta.png') });
    info('Screenshot: tests/screenshots/pessoal-cta.png');
    await page.close();
  }

  // ══════════════════════════════════════════════════════
  // PESSOAL-RESULTADO.HTML — RENDER + LEAD + PDF
  // ══════════════════════════════════════════════════════
  console.log('\n══════════════════════════════════════');
  console.log('  pessoal-resultado.html — Resultado');
  console.log('══════════════════════════════════════');
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const jsErrors = [];
    page.on('pageerror', e => jsErrors.push(e.message));

    // Seed localStorage com dados de teste
    const seedData = {
      total: 3140, totalT: 3.14,
      emis: { t: 980, e: 420, a: 1340, c: 400 },
      pct:  { t: 31,  e: 13,  a: 43,   c: 13  },
      color: '#c8882e',
      statusTxt: 'Entre Brasil e média mundial',
      inputs: { carro: 120, tipoCarro: '0.171', moto: 0, aviao: 2, onibus: 0,
                luz: 150, gas: 5, pessoas: '4', solar: '1', dieta: '2400',
                local: 0, desp: 1.0, roupas: 5, eletro: 1, consumo: '550', delivery: '40' },
      savedAt: new Date().toISOString(),
    };

    await page.goto(base + '/pessoal-resultado.html', { waitUntil: 'networkidle' });
    await page.evaluate((data) => {
      localStorage.setItem('cm_pessoal_result', JSON.stringify(data));
    }, seedData);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(600);

    // B1. Gauge mostra valor correto
    console.log('\n  [B1] Gauge mostra valor correto');
    const gaugeVal = await page.evaluate(() => {
      const el = document.getElementById('resMeterKg');
      return el ? el.textContent.trim() : null;
    });
    info(`Gauge: "${gaugeVal}"`);
    tally(check(gaugeVal === '3,1', `Gauge mostra "3,1" (got: "${gaugeVal}")`));

    // B2. Status text correto
    console.log('\n  [B2] Status text');
    const statusVal = await page.evaluate(() => {
      const el = document.getElementById('resMeterStatus');
      return el ? el.textContent.trim() : null;
    });
    info(`Status: "${statusVal}"`);
    tally(check(statusVal === 'Entre Brasil e média mundial', `Status correto`));

    // B3. Equivalências contém "árvores"
    console.log('\n  [B3] Equivalências preenchidas');
    const equivText = await page.evaluate(() => {
      const el = document.getElementById('equivContent');
      return el ? el.textContent : '';
    });
    tally(check(equivText.includes('árvores'), 'Equivalências contém "árvores"'));

    // B4. Maior alavanca renderizada
    console.log('\n  [B4] Maior alavanca');
    const alavancaCat = await page.evaluate(() => {
      const el = document.getElementById('alavancaCat');
      return el ? el.textContent.trim() : '';
    });
    info(`Alavanca: "${alavancaCat}"`);
    tally(check(alavancaCat.length > 0, 'Alavanca não vazia'));

    // B5. Metas climáticas
    console.log('\n  [B5] Metas climáticas');
    const metaMsg = await page.evaluate(() => {
      const el = document.getElementById('metaMsg');
      return el ? el.textContent.trim() : '';
    });
    info(`Meta msg: "${metaMsg.substring(0,60)}..."`);
    tally(check(metaMsg.length > 0, 'Mensagem de meta preenchida'));

    // B6. Submit lead → cm_leads com entrada correta
    console.log('\n  [B6] Submit lead');
    await page.fill('#leadNome', 'Teste Silva');
    await page.fill('#leadEmail', 'teste@example.com');
    await page.click('form button[type="submit"]');
    await page.waitForTimeout(300);

    const leads = await page.evaluate(() => {
      try { return JSON.parse(localStorage.getItem('cm_leads')); } catch(e) { return null; }
    });
    tally(check(leads && leads.length === 1, 'cm_leads tem 1 entrada'));
    tally(check(leads && leads[0] && leads[0].nome === 'Teste Silva', 'nome correto no lead'));
    tally(check(leads && leads[0] && leads[0].email === 'teste@example.com', 'email correto no lead'));

    // B7. Estado de obrigado visível
    console.log('\n  [B7] Estado de obrigado');
    const thanksVisible = await page.evaluate(() => {
      const el = document.getElementById('leadThanks');
      return el ? el.style.display !== 'none' : false;
    });
    tally(check(thanksVisible, 'Estado de obrigado visível após submit'));

    // B8. Botão #btnPdf presente
    console.log('\n  [B8] Botão PDF');
    const pdfBtn = await page.locator('#btnPdf').count();
    tally(check(pdfBtn > 0, 'Botão #btnPdf presente'));

    // B9. Sem erros JS
    console.log('\n  [B9] Erros de JavaScript');
    tally(check(jsErrors.length === 0, jsErrors.length ? 'Erros: ' + jsErrors.join(' | ') : 'Sem erros JS'));

    await page.screenshot({ path: path.join(screenshotsDir, 'pessoal-resultado.png') });
    info('Screenshot: tests/screenshots/pessoal-resultado.png');
    await page.close();
  }

  // ══════════════════════════════════════════════════════
  // TEMA PERSISTE ENTRE PÁGINAS
  // ══════════════════════════════════════════════════════
  console.log('\n══════════════════════════════════════');
  console.log('  Tema persiste entre páginas');
  console.log('══════════════════════════════════════');
  {
    const ctx = await browser.newContext();
    const p1 = await ctx.newPage();
    await p1.goto(base + '/index.html', { waitUntil: 'networkidle' });
    await p1.locator('#themeToggle').click();
    await p1.waitForTimeout(300);
    const themeAfterToggle = await p1.evaluate(() => localStorage.getItem('cmTheme'));
    tally(check(themeAfterToggle === 'light', 'Tema salvo como light na landing'));
    await p1.close();

    const p2 = await ctx.newPage();
    await p2.goto(base + '/pessoal.html', { waitUntil: 'networkidle' });
    await p2.waitForTimeout(300);
    const themeOnPessoal = await p2.evaluate(() => document.documentElement.getAttribute('data-theme'));
    tally(check(themeOnPessoal === 'light', `Tema light mantido ao navegar para pessoal: "${themeOnPessoal}"`));
    await p2.close();

    const p3 = await ctx.newPage();
    await p3.goto(base + '/empresarial.html', { waitUntil: 'networkidle' });
    await p3.waitForTimeout(300);
    const themeOnEmp = await p3.evaluate(() => document.documentElement.getAttribute('data-theme'));
    tally(check(themeOnEmp === 'light', `Tema light mantido ao navegar para empresarial: "${themeOnEmp}"`));
    await p3.close();

    await ctx.close();
  }

  // ══════════════════════════════════════════════════════
  // EMPRESARIAL.HTML — CTA + LOCALSTORAGE
  // ══════════════════════════════════════════════════════
  console.log('\n══════════════════════════════════════');
  console.log('  empresarial.html — CTA + localStorage');
  console.log('══════════════════════════════════════');
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const jsErrors = [];
    page.on('pageerror', e => jsErrors.push(e.message));
    await page.goto(base + '/empresarial.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    // C1. Botão #btnCalcular existe
    console.log('\n  [C1] Botão #btnCalcular existe');
    const btnCalcExists = await page.evaluate(() => !!document.getElementById('btnCalcular'));
    tally(check(btnCalcExists, '#btnCalcular existe no DOM'));

    // C2. Loading overlay existe e começa oculto
    console.log('\n  [C2] Loading overlay');
    const overlayHidden = await page.evaluate(() => {
      const el = document.getElementById('calcOverlay');
      return el && el.style.display !== 'flex';
    });
    tally(check(overlayHidden, 'calcOverlay existe e começa oculto'));

    // C3. calcular() salva cm_empresa_result no localStorage
    console.log('\n  [C3] calcular() salva dados no localStorage');
    await setInput(page, 'num-func', 100);
    await setInput(page, 'empresa-nome', 'Empresa Teste');
    await setInput(page, 'eletric', 8000);
    await page.waitForTimeout(200);

    // Chama calcular() evitando o redirect real (patch setTimeout longo)
    await page.evaluate(() => {
      const origSetTimeout = window.setTimeout;
      window.setTimeout = function(fn, delay, ...args) {
        if (delay >= 2000) return origSetTimeout(() => {}, 99999);
        return origSetTimeout(fn, delay, ...args);
      };
      calcular();
    });
    await page.waitForTimeout(300);

    const saved = await page.evaluate(() => {
      try { return JSON.parse(localStorage.getItem('cm_empresa_result')); } catch(e) { return null; }
    });
    tally(check(saved !== null, 'cm_empresa_result salvo no localStorage'));
    tally(check(saved && typeof saved.total === 'number', 'Campo total é número'));
    tally(check(saved && typeof saved.totalT === 'number', 'Campo totalT é número'));
    tally(check(saved && typeof saved.intensity === 'number', 'Campo intensity é número'));
    tally(check(saved && typeof saved.nFunc === 'number' && saved.nFunc === 100, 'nFunc correto (100)'));
    tally(check(saved && saved.empresa === 'Empresa Teste', 'empresa correto'));
    tally(check(saved && saved.emis && typeof saved.emis.s1 === 'number', 'emis.s1 presente'));
    tally(check(saved && saved.emis && typeof saved.emis.s2 === 'number', 'emis.s2 presente'));
    tally(check(saved && saved.emis && typeof saved.emis.s3 === 'number', 'emis.s3 presente'));
    tally(check(saved && saved.pct && typeof saved.pct.s1 === 'number', 'pct.s1 presente'));
    tally(check(saved && typeof saved.color === 'string', 'color presente'));
    tally(check(saved && typeof saved.statusTxt === 'string' && saved.statusTxt.length > 0, 'statusTxt preenchido'));

    // C4. Eletricidade > 0 → s2 > 0 no payload
    tally(check(saved && saved.emis && saved.emis.s2 > 0, 'eletricidade (8000 kWh/mês) gera s2 > 0'));

    // C5. Sem erros JS
    console.log('\n  [C5] Erros de JavaScript');
    tally(check(jsErrors.length === 0, jsErrors.length ? 'Erros: ' + jsErrors.join(' | ') : 'Sem erros JS'));

    await page.screenshot({ path: path.join(screenshotsDir, 'empresa-cta.png') });
    info('Screenshot: tests/screenshots/empresa-cta.png');
    await page.close();
  }

  // ══════════════════════════════════════════════════════
  // EMPRESA-RESULTADO.HTML — RENDER + LEAD + PDF
  // ══════════════════════════════════════════════════════
  console.log('\n══════════════════════════════════════');
  console.log('  empresa-resultado.html — Resultado');
  console.log('══════════════════════════════════════');
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const jsErrors = [];
    page.on('pageerror', e => jsErrors.push(e.message));

    // Seed com dados representativos (empresa de 50 func, ~180t no total)
    const seedEmpresa = {
      total: 180000, totalT: 180.0, intensity: 3.6, nFunc: 50,
      empresa: 'Acme S.A.', setor: 'Serviços / Tecnologia', anoBase: '2024',
      color: 'var(--ember)', statusTxt: 'Abaixo do benchmark',
      emis: {
        s1: 30000, s2: 60000, s3: 90000,
        fleet: 20000, comb: 5000, ref: 3000, proc: 2000,
        eletric: 60000,
        comm: 40000, viag: 25000, frete: 10000, res: 8000, agua: 7000,
      },
      pct: { s1: 17, s2: 33, s3: 50 },
      savedAt: new Date().toISOString(),
    };

    await page.goto(base + '/empresa-resultado.html', { waitUntil: 'networkidle' });
    await page.evaluate((data) => {
      localStorage.setItem('cm_empresa_result', JSON.stringify(data));
    }, seedEmpresa);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(600);

    // D1. Gauge mostra 180,0
    console.log('\n  [D1] Gauge mostra valor correto');
    const gaugeVal = await page.evaluate(() => {
      const el = document.getElementById('resMeterKg');
      return el ? el.textContent.trim() : null;
    });
    info(`Gauge: "${gaugeVal}"`);
    tally(check(gaugeVal === '180,0', `Gauge mostra "180,0" (got: "${gaugeVal}")`));

    // D2. Status pill preenchido
    console.log('\n  [D2] Status pill');
    const pill = await page.evaluate(() => {
      const el = document.getElementById('heroStatusPill');
      return el ? el.textContent.trim() : '';
    });
    info(`Pill: "${pill}"`);
    tally(check(pill === 'Abaixo do benchmark', 'Status pill correto'));

    // D3. Hero mostra os 3 escopos
    console.log('\n  [D3] Hero exibe Escopo 1, 2, 3');
    const s1txt = await getText(page, 'heroS1');
    const s2txt = await getText(page, 'heroS2');
    const s3txt = await getText(page, 'heroS3');
    info(`S1="${s1txt}" S2="${s2txt}" S3="${s3txt}"`);
    tally(check(s1txt && s1txt.includes('30,0'), 'Hero Escopo 1 contém 30,0 t'));
    tally(check(s2txt && s2txt.includes('60,0'), 'Hero Escopo 2 contém 60,0 t'));
    tally(check(s3txt && s3txt.includes('90,0'), 'Hero Escopo 3 contém 90,0 t'));

    // D4. Breakdown de escopos preenchido
    console.log('\n  [D4] Breakdown de escopos');
    const bdS1 = await getText(page, 'bd-val-s1');
    const bdS2 = await getText(page, 'bd-val-s2');
    const bdS3 = await getText(page, 'bd-val-s3');
    info(`bd S1="${bdS1}" S2="${bdS2}" S3="${bdS3}"`);
    tally(check(bdS1 && bdS1.includes('30,0'), 'Breakdown S1 correto'));
    tally(check(bdS2 && bdS2.includes('60,0'), 'Breakdown S2 correto'));
    tally(check(bdS3 && bdS3.includes('90,0'), 'Breakdown S3 correto'));

    // D5. Sub-itens do breakdown preenchidos
    console.log('\n  [D5] Sub-itens do breakdown');
    const bdFleet = await getText(page, 'bd-fleet');
    const bdEletric = await getText(page, 'bd-eletric');
    const bdComm = await getText(page, 'bd-comm');
    tally(check(bdFleet && bdFleet.includes('20,0'), `Frota: "${bdFleet}"`));
    tally(check(bdEletric && bdEletric.includes('60,0'), `Eletricidade: "${bdEletric}"`));
    tally(check(bdComm && bdComm.includes('40,0'), `Commuting: "${bdComm}"`));

    // D6. Equivalências preenchidas (escala corporativa)
    console.log('\n  [D6] Equivalências corporativas');
    const arvores = await getText(page, 'equivArvores');
    const voos    = await getText(page, 'equivVoos');
    const casas   = await getText(page, 'equivCasas');
    info(`Árvores=${arvores}, Voos=${voos}, Casas=${casas}`);
    tally(check(arvores && parseInt(arvores.replace(/\D/g,'')) > 0, 'equivArvores > 0'));
    tally(check(voos    && parseInt(voos.replace(/\D/g,''))    > 0, 'equivVoos > 0'));
    tally(check(casas   && parseInt(casas.replace(/\D/g,''))   > 0, 'equivCasas > 0'));

    // D7. Maior alavanca: deve ser Escopo 3 (90t)
    console.log('\n  [D7] Maior alavanca = Escopo 3');
    const alavancaCat = await getText(page, 'alavancaCat');
    info(`Alavanca: "${alavancaCat}"`);
    tally(check(alavancaCat && alavancaCat.includes('Escopo 3'), `Maior alavanca é Escopo 3 (got: "${alavancaCat}")`));

    // D8. Metas SBTi preenchidas
    console.log('\n  [D8] Metas SBTi');
    const metaMsg = await getText(page, 'metaMsg');
    info(`Meta: "${(metaMsg||'').substring(0,60)}..."`);
    tally(check(metaMsg && metaMsg.length > 0, 'metaMsg preenchido'));

    // D9. Comparação total (3 barras renderizadas)
    console.log('\n  [D9] Comparação total');
    const cmpUserVal = await getText(page, 'res-cmp-user-val');
    info(`Comparação user: "${cmpUserVal}"`);
    tally(check(cmpUserVal && cmpUserVal.includes('3,6'), `Intensidade 3,6 t/func na comparação (got: "${cmpUserVal}")`));

    // D10. Fallback #noData oculto quando há dados
    console.log('\n  [D10] noData oculto com dados presentes');
    const noDataVisible = await page.evaluate(() => {
      const el = document.getElementById('noData');
      return el ? window.getComputedStyle(el).display !== 'none' : false;
    });
    tally(check(!noDataVisible, '#noData oculto quando há dados'));

    // D11. #mainContent visível
    const mainVisible = await page.evaluate(() => {
      const el = document.getElementById('mainContent');
      return el ? window.getComputedStyle(el).display !== 'none' : false;
    });
    tally(check(mainVisible, '#mainContent visível com dados'));

    // D12. Submit lead → cm_leads_empresa
    console.log('\n  [D12] Submit lead corporativo');
    await page.fill('#leadNome', 'Maria Responsável');
    await page.fill('#leadEmail', 'maria@empresa.com.br');
    await page.click('form button[type="submit"]');
    await page.waitForTimeout(300);

    const leads = await page.evaluate(() => {
      try { return JSON.parse(localStorage.getItem('cm_leads_empresa')); } catch(e) { return null; }
    });
    tally(check(leads && leads.length === 1, 'cm_leads_empresa tem 1 entrada'));
    tally(check(leads && leads[0] && leads[0].nome === 'Maria Responsável', 'nome correto no lead empresa'));
    tally(check(leads && leads[0] && leads[0].email === 'maria@empresa.com.br', 'email correto no lead empresa'));

    // D13. Estado de obrigado visível
    console.log('\n  [D13] Estado de obrigado');
    const thanksVisible = await page.evaluate(() => {
      const el = document.getElementById('leadThanks');
      return el ? el.style.display !== 'none' : false;
    });
    tally(check(thanksVisible, 'Estado de obrigado visível após submit'));

    // D14. #btnPdf existe (aparece pós-lead)
    console.log('\n  [D14] Botão PDF corporativo');
    const pdfBtn = await page.locator('#btnPdf').count();
    tally(check(pdfBtn > 0, 'Botão #btnPdf presente'));

    // D15. Fallback quando sem dados
    console.log('\n  [D15] Fallback sem dados');
    const pageFb = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const jsFbErrors = [];
    pageFb.on('pageerror', e => jsFbErrors.push(e.message));
    await pageFb.goto(base + '/empresa-resultado.html', { waitUntil: 'networkidle' });
    await pageFb.evaluate(() => localStorage.removeItem('cm_empresa_result'));
    await pageFb.reload({ waitUntil: 'networkidle' });
    await pageFb.waitForTimeout(400);
    const noDataShown = await pageFb.evaluate(() => {
      const el = document.getElementById('noData');
      return el ? window.getComputedStyle(el).display !== 'none' : false;
    });
    tally(check(noDataShown, '#noData visível sem dados'));
    tally(check(jsFbErrors.length === 0, jsFbErrors.length ? 'Erros no fallback: ' + jsFbErrors.join(' | ') : 'Sem erros JS no fallback'));
    await pageFb.close();

    // D16. Sem erros JS
    console.log('\n  [D16] Erros de JavaScript');
    tally(check(jsErrors.length === 0, jsErrors.length ? 'Erros: ' + jsErrors.join(' | ') : 'Sem erros JS'));

    await page.screenshot({ path: path.join(screenshotsDir, 'empresa-resultado.png') });
    info('Screenshot: tests/screenshots/empresa-resultado.png');
    await page.close();
  }

  // ══════════════════════════════════════════════════════
  // TEMA PERSISTE — EMPRESA-RESULTADO
  // ══════════════════════════════════════════════════════
  console.log('\n══════════════════════════════════════');
  console.log('  Tema persiste — empresa-resultado');
  console.log('══════════════════════════════════════');
  {
    const ctx = await browser.newContext();
    const p1 = await ctx.newPage();
    await p1.goto(base + '/index.html', { waitUntil: 'networkidle' });
    await p1.locator('#themeToggle').click();
    await p1.waitForTimeout(200);
    await p1.close();

    const p2 = await ctx.newPage();
    await p2.goto(base + '/empresa-resultado.html', { waitUntil: 'networkidle' });
    await p2.waitForTimeout(300);
    const themeOnEmpRes = await p2.evaluate(() => document.documentElement.getAttribute('data-theme'));
    tally(check(themeOnEmpRes === 'light', `Tema light mantido em empresa-resultado: "${themeOnEmpRes}"`));
    await p2.close();
    await ctx.close();
  }

  // ══════════════════════════════════════════════════════
  // RESULTADO FINAL
  // ══════════════════════════════════════════════════════
  console.log('\n══════════════════════════════════════');
  const total = totalPassed + totalFailed;
  console.log(`  Resultado: ${totalPassed}/${total} testes passaram`);
  if (totalFailed > 0) console.log(`  ✗ ${totalFailed} falha(s)`);
  else console.log('  Todos os testes passaram.');
  console.log('══════════════════════════════════════\n');

  await browser.close();
  process.exit(totalFailed > 0 ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
