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

    await page.screenshot({ path: path.join(screenshotsDir, 'empresarial-filled.png') });
    info('Screenshot: tests/screenshots/empresarial-filled.png');
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
