// ==UserScript==
// @name         Kiper Helper - Full Domain + No-F5 (Maps + Copy/Open + Status + Reboot + Provision Modal) v7.2
// @namespace    https://monitoring.cloud.kiper.com.br/
// @version      7.2
// @description  Roda no domínio inteiro, re-injeta em navegação SPA (sem F5): Maps, Copy/Open, Status contínuo, Reboot e Modal Provision (Etapa 1/2/Reset/Log/Print) para Kiper Access Veicular.
// @author       Matheus Benites
// @match        https://monitoring.cloud.kiper.com.br/*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @connect      10.0.0.0/8
// @connect      10.*
// @connect      *
// ==/UserScript==

(function () {
  'use strict';

  // ===========================
  //  UI / UTILS
  // ===========================
  const LABELS = { endereco: 'Endereço', numero: 'Número', bairro: 'Bairro', cidade: 'Cidade', estado: 'Estado', cep: 'CEP' };
  const EVENT_ICON_SIZE_PX = 22;
  const EVENT_ICON_GAP_PX = 6;
  const EVENT_ICON_GUTTER_PX = EVENT_ICON_SIZE_PX + EVENT_ICON_GAP_PX;
  const EVENT_ICON_SVGS = {
    doorClosed: `<svg xmlns="http://www.w3.org/2000/svg" width="${EVENT_ICON_SIZE_PX}" height="${EVENT_ICON_SIZE_PX}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 12h.01"/><path d="M18 20V6a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v14"/><path d="M2 20h20"/></svg>`,
    doorOpen: `<svg xmlns="http://www.w3.org/2000/svg" width="${EVENT_ICON_SIZE_PX}" height="${EVENT_ICON_SIZE_PX}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20H2"/><path d="M11 4.562v16.157a1 1 0 0 0 1.242.97L19 20V5.562a2 2 0 0 0-1.515-1.94l-4-1A2 2 0 0 0 11 4.561z"/><path d="M11 4H8a2 2 0 0 0-2 2v14"/><path d="M14 12h.01"/><path d="M22 20h-3"/></svg>`,
    logout: `<svg xmlns="http://www.w3.org/2000/svg" width="${EVENT_ICON_SIZE_PX}" height="${EVENT_ICON_SIZE_PX}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/></svg>`,
    shieldCheck: `<svg xmlns="http://www.w3.org/2000/svg" width="${EVENT_ICON_SIZE_PX}" height="${EVENT_ICON_SIZE_PX}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>`,
    tag: `<svg xmlns="http://www.w3.org/2000/svg" width="${EVENT_ICON_SIZE_PX}" height="${EVENT_ICON_SIZE_PX}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/></svg>`,
    octagonAlert: `<svg xmlns="http://www.w3.org/2000/svg" width="${EVENT_ICON_SIZE_PX}" height="${EVENT_ICON_SIZE_PX}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16h.01"/><path d="M12 8v4"/><path d="M15.312 2a2 2 0 0 1 1.414.586l4.688 4.688A2 2 0 0 1 22 8.688v6.624a2 2 0 0 1-.586 1.414l-4.688 4.688a2 2 0 0 1-1.414.586H8.688a2 2 0 0 1-1.414-.586l-4.688-4.688A2 2 0 0 1 2 15.312V8.688a2 2 0 0 1 .586-1.414l4.688-4.688A2 2 0 0 1 8.688 2z"/></svg>`
  };

  const BTN_STYLE = `
    display:inline-block;
    margin-left:6px;
    padding:4px 8px;
    font-size:12px;
    border-radius:6px;
    border:1px solid rgba(0,0,0,0.12);
    color:white;
    cursor:pointer;
    box-shadow:0 1px 3px rgba(0,0,0,0.12);
  `;

  function makeButton(label, title, color = '#1976d2') {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.innerText = label;
    btn.title = title || label;
    btn.style.cssText = BTN_STYLE + `background:${color};`;
    return btn;
  }

  const wait = (ms) => new Promise((res) => setTimeout(res, ms));

  function findLabelSpanPair(labelText) {
    const labels = Array.from(document.querySelectorAll('label'));
    for (const lab of labels) {
      if (lab.textContent.trim() === labelText) {
        let sibling = lab.nextElementSibling;
        while (sibling && sibling.nodeType !== Node.ELEMENT_NODE) sibling = sibling.nextSibling;
        if (sibling && sibling.tagName && sibling.tagName.toLowerCase() === 'span') return sibling;

        const container = lab.parentElement;
        if (container) {
          const span = container.querySelector('span');
          if (span) return span;
        }
      }
    }
    return null;
  }

  function buildAddress() {
    const e = findLabelSpanPair(LABELS.endereco);
    const n = findLabelSpanPair(LABELS.numero);
    const b = findLabelSpanPair(LABELS.bairro);
    const c = findLabelSpanPair(LABELS.cidade);
    const s = findLabelSpanPair(LABELS.estado);
    const cep = findLabelSpanPair(LABELS.cep);

    const parts = [];
    if (e?.textContent.trim()) parts.push(e.textContent.trim());
    if (n?.textContent.trim()) parts.push(n.textContent.trim());
    if (b?.textContent.trim()) parts.push(b.textContent.trim());
    if (c?.textContent.trim()) parts.push(c.textContent.trim());
    if (s?.textContent.trim()) parts.push(s.textContent.trim());

    if (parts.length === 0 && cep?.textContent.trim()) return cep.textContent.trim();
    return parts.join(', ');
  }

  function getEventIconForText(text) {
    const t = (text || '').toUpperCase();
    if (!t) return null;
    if (t.includes('PORTA FECHOU')) return { key: 'doorClosed', svg: EVENT_ICON_SVGS.doorClosed };
    if (t.includes('PORTA ABRIU')) return { key: 'doorOpen', svg: EVENT_ICON_SVGS.doorOpen };
    if (t.includes('BOTOEIRA DE SAIDA')) return { key: 'logout', svg: EVENT_ICON_SVGS.logout };
    if (t.includes('112 - NÃO ABRIU')) return { key: 'octagonAlert', svg: EVENT_ICON_SVGS.octagonAlert, color: '#dc2626' };
    if (t.includes('703 - USUÁRIO NÃO CADASTRADO [FACIAL]')) return { key: 'octagonAlert', svg: EVENT_ICON_SVGS.octagonAlert, color: '#dc2626' };
    if (t.includes('161 - COMANDO RECUSADO [BASE]')) return { key: 'octagonAlert', svg: EVENT_ICON_SVGS.octagonAlert, color: '#dc2626' };
    if (t.includes('144 - USUÁRIO NÃO CADASTRADO [CONTROLE]')) return { key: 'octagonAlert', svg: EVENT_ICON_SVGS.octagonAlert, color: '#dc2626' };
    if (t.includes('127 - ACESSO USUÁRIO [CONTROLE]')) return { key: 'tagBlue', svg: EVENT_ICON_SVGS.tag, color: '#2563eb' };
    if (t.includes('701 - ACESSO USUÁRIO [FACIAL]')) return { key: 'shieldCheckGreen', svg: EVENT_ICON_SVGS.shieldCheck, color: '#16a34a' };
    if (t.includes('311 - ACESSO VIA COMANDO APLICATIVO')) return { key: 'shieldCheckBlue', svg: EVENT_ICON_SVGS.shieldCheck, color: '#2563eb' };
    return null;
  }

  function isEventsReportPage() {
    return location.pathname.includes('/reports/eventsReport');
  }

  function applyEventIconToContainer(container, icon) {
    if (!container || container.dataset.tmEventIconContainer) return;
    const spans = Array.from(container.querySelectorAll('span'))
      .filter((s) => (s.textContent || '').trim().length > 0);
    if (spans.length === 0) return;

    const iconWrap = document.createElement('span');
    iconWrap.innerHTML = icon.svg;
    const iconColor = icon.color || '#111827';
    iconWrap.style.cssText = `display:inline-flex;align-items:center;color:${iconColor};flex:0 0 auto;align-self:center;`;
    iconWrap.setAttribute('aria-hidden', 'true');

    const textWrap = document.createElement('div');
    textWrap.style.cssText = 'display:flex;flex-direction:column;gap:2px;';

    spans.forEach((s) => textWrap.appendChild(s));

    container.textContent = '';
    container.style.setProperty('display', 'flex', 'important');
    container.style.setProperty('flex-direction', 'row', 'important');
    container.style.setProperty('align-items', 'flex-start', 'important');
    container.style.setProperty('gap', `${EVENT_ICON_GAP_PX}px`, 'important');
    container.appendChild(iconWrap);
    container.appendChild(textWrap);
    container.dataset.tmEventIconContainer = icon.key;
  }

  function applyEventNoIconPadding(container) {
    if (!container || container.dataset.tmEventNoIconPad) return;
    container.style.setProperty('padding-left', `${EVENT_ICON_GUTTER_PX}px`, 'important');
    container.dataset.tmEventNoIconPad = '1';
  }

  const STATUS_LABEL = {
    background: '#fef3c7',
    border: '#fcd34d',
    text: '#92400e',
  };

  function shouldHighlightStatusLabel(text) {
    const t = (text || '').toUpperCase();
    return t.includes('ONLINE') || t.includes('OFFLINE');
  }

  function applyStatusLabelHighlight(row, container, text) {
    if (!row || !container || !shouldHighlightStatusLabel(text)) return;
    if (container.dataset.tmEventStatusHighlight) return;

    container.dataset.tmEventStatusHighlight = '1';
    row.dataset.tmEventStatusHighlight = '1';

    container.style.setProperty('background-color', STATUS_LABEL.background, 'important');
    container.style.setProperty('border-radius', '10px', 'important');
    container.style.setProperty('padding', '6px 12px', 'important');
    container.style.setProperty('box-shadow', `0 0 0 1px ${STATUS_LABEL.border} inset`, 'important');
    container.style.setProperty('color', STATUS_LABEL.text, 'important');

    row.style.setProperty('background-color', STATUS_LABEL.background, 'important');
    row.style.setProperty('box-shadow', `0 0 0 1px ${STATUS_LABEL.border} inset`, 'important');
    row.style.setProperty('border-radius', '12px', 'important');
    row.style.setProperty('overflow', 'hidden', 'important');
  }

  function injectEventIcons() {
    if (!isEventsReportPage()) return;
    if (injectEventIcons._running) return;
    injectEventIcons._running = true;

    try {
      const rows = document.querySelectorAll('table tbody tr');
      rows.forEach((row) => {
        const cells = row.querySelectorAll('td');
        const eventCell = cells[1];
        if (!eventCell) return;

        const container =
          eventCell.querySelector('div[class*="DataContainer"]') ||
          eventCell.querySelector('div');
        if (!container) return;

        const firstLine = container.querySelector('span');
        const text = (firstLine?.textContent || '').trim();
        if (!text) return;

        applyStatusLabelHighlight(row, container, text);

        const icon = getEventIconForText(text);
        if (!icon) {
          applyEventNoIconPadding(container);
          return;
        }

        applyEventIconToContainer(container, icon);
      });
    } finally {
      injectEventIcons._running = false;
    }
  }

  // ===========================
  //  USER IFRAME MODAL (REPORT)
  // ===========================
  const USER_MODAL = {
    ID: 'tmUserIframeModal',
    BACKDROP_ID: 'tmUserIframeModal-backdrop'
  };

  function ensureUserIframeModal() {
    if (document.getElementById(USER_MODAL.ID)) return;

    const style = document.createElement('style');
    style.textContent = `
      #${USER_MODAL.BACKDROP_ID}{
        position:fixed; inset:0; background:rgba(0,0,0,.55);
        z-index:999999; display:none; align-items:center; justify-content:center;
        padding:16px;
      }
      #${USER_MODAL.ID}{
        width:min(1100px, 96vw);
        height:min(78vh, 860px);
        background:#0b1020; color:#e5e7eb;
        border:1px solid rgba(148,163,184,.25);
        border-radius:14px;
        box-shadow:0 20px 80px rgba(0,0,0,.55);
        overflow:hidden;
        display:flex; flex-direction:column;
        font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
      }
      #${USER_MODAL.ID} header{
        display:flex; align-items:center; justify-content:space-between;
        gap:10px;
        padding:10px 14px; background:rgba(2,6,23,.75);
        border-bottom:1px solid rgba(148,163,184,.18);
        font-size:13px; font-weight:700;
      }
      #${USER_MODAL.ID} header .tm-actions{
        display:flex; gap:8px; align-items:center;
      }
      #${USER_MODAL.ID} header a{
        color:#93c5fd; text-decoration:none; font-weight:600;
      }
      #${USER_MODAL.ID} header a:hover{ text-decoration:underline; }
      #${USER_MODAL.ID} header .tm-close{
        appearance:none; border:none; background:transparent; color:#94a3b8;
        font-size:18px; cursor:pointer; padding:6px 8px; border-radius:10px;
      }
      #${USER_MODAL.ID} header .tm-close:hover{ background:rgba(148,163,184,.12); color:#e2e8f0; }
      #${USER_MODAL.ID} iframe{
        width:100%; height:100%; border:0; background:white;
      }
      #${USER_MODAL.ID} .tm-loading{
        padding:12px 14px; font-size:12px; color:#cbd5e1;
        border-bottom:1px solid rgba(148,163,184,.18);
      }
    `;
    document.head.appendChild(style);

    const backdrop = document.createElement('div');
    backdrop.id = USER_MODAL.BACKDROP_ID;
    backdrop.innerHTML = `
      <div id="${USER_MODAL.ID}" role="dialog" aria-modal="true">
        <header>
          <div id="tmUserIframeTitle">Usuário</div>
          <div class="tm-actions">
            <a id="tmUserIframeOpenTab" target="_blank" rel="noopener">Abrir em nova aba</a>
            <button class="tm-close" title="Fechar" aria-label="Fechar">✕</button>
          </div>
        </header>
        <div class="tm-loading" id="tmUserIframeLoading">Carregando…</div>
        <iframe id="tmUserIframe" loading="lazy"></iframe>
      </div>
    `;
    document.body.appendChild(backdrop);

    const closeBtn = backdrop.querySelector('.tm-close');
    closeBtn.addEventListener('click', () => hideUserIframeModal());
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) hideUserIframeModal(); });
  }

  function showUserIframeModal(url, title) {
    ensureUserIframeModal();
    const bd = document.getElementById(USER_MODAL.BACKDROP_ID);
    const iframe = document.getElementById('tmUserIframe');
    const loading = document.getElementById('tmUserIframeLoading');
    const titleEl = document.getElementById('tmUserIframeTitle');
    const openTab = document.getElementById('tmUserIframeOpenTab');

    titleEl.textContent = title || 'Usuário';
    openTab.href = url;
    loading.style.display = 'block';
    iframe.onload = () => { loading.style.display = 'none'; };
    iframe.src = url;

    bd.style.display = 'flex';
  }

  function hideUserIframeModal() {
    const bd = document.getElementById(USER_MODAL.BACKDROP_ID);
    if (!bd) return;
    bd.style.display = 'none';
    const iframe = document.getElementById('tmUserIframe');
    if (iframe) iframe.src = 'about:blank';
  }

  function interceptUserLinksForModal() {
    if (!isEventsReportPage()) return;
    const userLinks = document.querySelectorAll('a[href^="/users/"]');
    userLinks.forEach((a) => {
      if (a.dataset.tmUserModalBound) return;
      a.dataset.tmUserModalBound = '1';
      a.addEventListener('click', (e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        const href = a.getAttribute('href');
        const title = a.textContent.trim();
        showUserIframeModal(href, title);
      });
    });
  }

  // ===========================
  //  MAPS
  // ===========================
  function insertMapsButton() {
    const enderecoSpan = findLabelSpanPair(LABELS.endereco);
    if (!enderecoSpan || enderecoSpan.dataset.mapsButtonAttached) return;
    enderecoSpan.dataset.mapsButtonAttached = '1';

    const wrapper = document.createElement('span');
    wrapper.style.display = 'inline-flex';
    wrapper.style.alignItems = 'center';

    const btnG = makeButton('Maps', 'Abrir no Google Maps');
    btnG.addEventListener('click', () => {
      const addr = buildAddress();
      if (!addr) { alert('Endereço não encontrado.'); return; }
      const q = encodeURIComponent(addr);
      window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, '_blank');
    });

    wrapper.appendChild(btnG);
    enderecoSpan.parentElement.appendChild(wrapper);
  }

  // ===========================
  //  STATUS (PING)
  // ===========================
  function checkOnline(ip, callback) {
    const img = new Image();
    let done = false;
    const start = performance.now();

    const timer = setTimeout(() => {
      if (!done) { done = true; callback(false, null); }
    }, 5000);

    img.onload = img.onerror = () => {
      if (!done) {
        done = true;
        const latency = Math.round(performance.now() - start);
        clearTimeout(timer);
        callback(true, latency);
      }
    };

    img.src = `http://${ip}/favicon.ico?_=${Date.now()}`;
  }

  // ===========================
  //  GM_xmlhttpRequest
  // ===========================
  function gmRequest({ method, url, data, headers, timeoutMs = 12000 }) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method,
        url,
        data,
        timeout: timeoutMs,
        headers: headers || {},
        onload: (resp) => resolve(resp),
        ontimeout: () => reject(new Error('Timeout')),
        onerror: () => reject(new Error('Network error')),
      });
    });
  }

  // ===========================
  //  REBOOT (GM)
  // ===========================
  const REBOOT_CONFIG = {
    port: 8085,
    loginPass: 'k1p3rBR',
    attempts: 3,
    delayAfterLoginMs: 900,
    attemptDelayMs: 800,
  };

  async function rebootDevice(ip, btnReboot) {
    btnReboot.disabled = true;
    const originalText = btnReboot.innerText;

    const base = `http://${ip}:${REBOOT_CONFIG.port}`;
    const loginCmd = `login:${REBOOT_CONFIG.loginPass}`;
    const loginUrl = `${base}/?web_cmd=${loginCmd}`;
    const rstUrl = `${base}/?web_cmd=rst`;

    for (let attempt = 1; attempt <= REBOOT_CONFIG.attempts; attempt++) {
      try {
        btnReboot.textContent = `Logando... (${attempt}/${REBOOT_CONFIG.attempts})`;
        btnReboot.style.background = '#fbc02d';

        const loginResp = await gmRequest({
          method: 'POST',
          url: loginUrl,
          data: `web_cmd=${loginCmd}`,
          timeoutMs: 12000,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Origin': base,
            'Referer': `${base}/`,
            'Accept': '*/*',
            'Cache-Control': 'no-cache',
          }
        });

        if (loginResp.status !== 200) throw new Error(`Login HTTP ${loginResp.status}`);
        await wait(REBOOT_CONFIG.delayAfterLoginMs);

        btnReboot.textContent = 'Reiniciando...';

        try {
          const rstResp = await gmRequest({
            method: 'POST',
            url: rstUrl,
            data: `web_cmd=rst`,
            timeoutMs: 12000,
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Origin': base,
              'Referer': `${base}/`,
              'Accept': '*/*',
              'Cache-Control': 'no-cache',
            }
          });

          if (rstResp.status === 200) {
            btnReboot.textContent = 'Sucesso ✅';
            btnReboot.style.background = '#2e7d32';
            await wait(2500);
            break;
          } else {
            throw new Error(`RST HTTP ${rstResp.status}`);
          }
        } catch (e) {
          btnReboot.textContent = 'Enviado ✅';
          btnReboot.style.background = '#2e7d32';
          await wait(2500);
          break;
        }

      } catch (err) {
        console.error('[reboot] erro', attempt, err);
        btnReboot.textContent = `Erro (${attempt}) ❌`;
        btnReboot.style.background = '#d32f2f';
        if (attempt < REBOOT_CONFIG.attempts) {
          await wait(REBOOT_CONFIG.attemptDelayMs);
          btnReboot.textContent = 'Tentando...';
          btnReboot.style.background = '#fbc02d';
        }
      }
    }

    btnReboot.textContent = originalText;
    btnReboot.style.background = '#f44336';
    btnReboot.disabled = false;
  }

  // ===========================
  //  IP BUTTONS
  // ===========================
  const DEVICE_ACCESS_SHORT = 'Kiper Access Veicular';
  const DEVICE_CONTROLLER = '[KIPER] Controladora Veicular';

  function isAccessByText(text) {
    const t = (text || '').toLowerCase();
    return t.includes(DEVICE_ACCESS_SHORT.toLowerCase());
  }

  function insertIpButtons() {
    const ipSpans = Array.from(document.querySelectorAll('span'))
      .filter(span => /^\d{1,3}(\.\d{1,3}){3}$/.test(span.textContent.trim()));

    ipSpans.forEach(span => {
      if (span.dataset.ipButtonsAttached) return;
      span.dataset.ipButtonsAttached = '1';
      const ip = span.textContent.trim();

      const li = span.closest('li');
      const liText = li?.innerText || '';
      const isAccess = isAccessByText(liText);

      const wrapper = document.createElement('span');
      wrapper.style.display = 'inline-flex';
      wrapper.style.alignItems = 'center';
      wrapper.style.gap = '6px';
      wrapper.style.marginLeft = '6px';

      const btnOpen = makeButton('Open', 'Abrir interface web', '#0288d1');
      btnOpen.addEventListener('click', () => {
        if (isAccess || liText.includes(DEVICE_CONTROLLER)) {
          window.open(`http://${ip}:8085`, '_blank');
        } else {
          window.open(`https://${ip}`, '_blank');
        }
      });

      const btnCopy = makeButton('Copy', 'Copiar IP', '#388e3c');
      btnCopy.addEventListener('click', () => {
        navigator.clipboard.writeText(ip).then(() => {
          const old = btnCopy.innerText;
          btnCopy.innerText = 'Copiado!';
          setTimeout(() => (btnCopy.innerText = old), 1500);
        });
      });

      const btnStatus = makeButton('Verificando...', 'Status do IP', '#f57c00');

      let btnReboot = null;
      if (isAccess) {
        btnReboot = makeButton('Reiniciar', 'Reiniciar dispositivo', '#f44336');
        btnReboot.addEventListener('click', async () => {
          if (!confirm(`Deseja realmente reiniciar ${DEVICE_ACCESS_SHORT} (${ip}) ?`)) return;
          await rebootDevice(ip, btnReboot);
        });
      }

      wrapper.appendChild(btnOpen);
      wrapper.appendChild(btnCopy);
      wrapper.appendChild(btnStatus);
      if (btnReboot) wrapper.appendChild(btnReboot);

      span.parentElement.appendChild(wrapper);

      (function continuousPing() {
        const startTime = Date.now();
        checkOnline(ip, (online, latency) => {
          if (online) { btnStatus.textContent = `ONLINE (${latency} ms)`; btnStatus.style.background = '#2e7d32'; }
          else { btnStatus.textContent = 'OFFLINE (timeout)'; btnStatus.style.background = '#d32f2f'; }
          const elapsed = Date.now() - startTime;
          const nextDelay = Math.max(200, 1000 - elapsed);
          setTimeout(continuousPing, nextDelay);
        });
      })();
    });
  }

  // ===========================
  //  PROVISION MODAL (Etapa 1/2/Reset/Log/Provisionamento MK)
  // ===========================
  const PROVISION = {
    DEVICE_PORT: 8085,
    DEVICE_LOGIN_PASS: 'k1p3rBR',
    STEP_DELAY_MS: 900,
    RENEW_CERT_TIMEOUT_MS: 35000,
    LOG_FILE: 'kLog.txt',
    LOG_MAX_CHARS: 20000,
    BTN_MARK: 'tm-open-provision-modal',
    MODAL_ID: 'tmProvisionModal',
    ONLY_DEVICE_NAME: 'Kiper Access Veicular',
    STORAGE_KEY: 'tmProvisionDraft.v1',
    GO_SSH_BASE_URL: 'http://10.255.255.101:8090',
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function extractIPv4(text) {
    const m = text.match(/\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/);
    return m ? m[0] : null;
  }

  function getDeviceIpFromLi(li) {
    return extractIPv4(li?.innerText || '');
  }

  function computeGateway(ip) {
    const p = (ip || '').trim().split('.');
    if (p.length !== 4) return '';
    return `${p[0]}.${p[1]}.${p[2]}.1`;
  }

  function base(deviceIp) {
    return `http://${deviceIp}:${PROVISION.DEVICE_PORT}`;
  }

  function isKiperAccessVeicular(li) {
    const t = (li?.innerText || '').toLowerCase();
    return t.includes(PROVISION.ONLY_DEVICE_NAME.toLowerCase());
  }

  function gmPostRaw(deviceIp, cmd, timeoutMs = 12000) {
    const url = `${base(deviceIp)}/?web_cmd=${cmd}`;
    const data = `web_cmd=${cmd}`;
    return gmRequest({
      method: 'POST',
      url,
      data,
      timeoutMs,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Origin': base(deviceIp),
        'Referer': `${base(deviceIp)}/`,
        'Accept': '*/*',
        'Cache-Control': 'no-cache',
      }
    });
  }

  function gmGet(deviceIp, pathWithQuery, timeoutMs = 12000) {
    const url = `${base(deviceIp)}${pathWithQuery}`;
    return gmRequest({
      method: 'GET',
      url,
      timeoutMs,
      headers: {
        'Accept': '*/*',
        'Cache-Control': 'no-cache',
        'Referer': `${base(deviceIp)}/`,
        'Upgrade-Insecure-Requests': '1',
      }
    });
  }

  function tryParseJson(text) {
    try {
      return JSON.parse(text || '{}');
    } catch (_e) {
      return null;
    }
  }

  function getProvisionDraftFromInputs() {
    return {
      newIp: document.getElementById('tmNewIp')?.value?.trim() || '',
      email: document.getElementById('tmEmail')?.value?.trim() || '',
      pass: document.getElementById('tmPass')?.value ?? '',
      usermk: document.getElementById('tmUserMk')?.value?.trim() || '',
      passmk: document.getElementById('tmPassMk')?.value ?? '',
      portmk: document.getElementById('tmPortMk')?.value?.trim() || '',
      apikey: document.getElementById('tmApiKey')?.value?.trim() || '',
    };
  }

  function saveProvisionDraft() {
    try {
      const draft = getProvisionDraftFromInputs();
      localStorage.setItem(PROVISION.STORAGE_KEY, JSON.stringify(draft));
    } catch (e) {
      console.warn('[provision] falha ao salvar draft', e);
    }
  }

  function loadProvisionDraft() {
    try {
      const raw = localStorage.getItem(PROVISION.STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed;
    } catch (e) {
      console.warn('[provision] falha ao carregar draft', e);
      return null;
    }
  }

  function applyProvisionDraftToInputs(draft) {
    if (!draft) return;

    const setIfPresent = (id, key) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (typeof draft[key] === 'string' && draft[key] !== '') {
        el.value = draft[key];
      }
    };

    setIfPresent('tmNewIp', 'newIp');
    setIfPresent('tmEmail', 'email');
    setIfPresent('tmPass', 'pass');
    setIfPresent('tmUserMk', 'usermk');
    setIfPresent('tmPassMk', 'passmk');
    setIfPresent('tmPortMk', 'portmk');
    setIfPresent('tmApiKey', 'apikey');
  }

  function ensureModal() {
    if (document.getElementById(PROVISION.MODAL_ID)) return;

    const style = document.createElement('style');
    style.textContent = `
      #${PROVISION.MODAL_ID}-backdrop{
        position:fixed; inset:0; background:rgba(0,0,0,.55);
        z-index:999999; display:none; align-items:center; justify-content:center;
        padding:16px;
      }
      #${PROVISION.MODAL_ID}{
        width:min(1040px, 100%);
        max-height:calc(100vh - 32px);
        background:#0f172a; color:#e2e8f0;
        border:1px solid rgba(148,163,184,.25);
        border-radius:14px;
        box-shadow:0 20px 80px rgba(0,0,0,.55);
        overflow:hidden;
        display:flex;
        flex-direction:column;
        font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
      }
      #${PROVISION.MODAL_ID} header{
        display:flex; align-items:center; justify-content:space-between;
        gap:10px;
        padding:14px 16px; background:rgba(2,6,23,.7);
        border-bottom:1px solid rgba(148,163,184,.18);
      }
      #${PROVISION.MODAL_ID} header h3{
        margin:0; font-size:16px; font-weight:700; letter-spacing:.2px;
      }
      #${PROVISION.MODAL_ID} header .tm-close{
        appearance:none; border:none; background:transparent; color:#94a3b8;
        font-size:18px; cursor:pointer; padding:6px 8px; border-radius:10px;
      }
      #${PROVISION.MODAL_ID} header .tm-close:hover{ background:rgba(148,163,184,.12); color:#e2e8f0; }
      #${PROVISION.MODAL_ID} .body{
        padding:16px;
        overflow:auto;
        min-height:0;
      }
      #${PROVISION.MODAL_ID} .outer-layout{
        display:grid;
        grid-template-columns: 290px 1fr;
        gap:14px;
        align-items:start;
      }
      #${PROVISION.MODAL_ID} .main-panel{
        border:1px solid rgba(148,163,184,.22);
        border-radius:12px;
        background:rgba(2,6,23,.38);
        padding:12px;
        display:grid;
        gap:12px;
      }
      #${PROVISION.MODAL_ID} .main-col{
        display:grid;
        gap:12px;
      }
      #${PROVISION.MODAL_ID} .action-card{
        border:1px solid rgba(148,163,184,.22);
        border-radius:12px;
        background:rgba(2,6,23,.45);
        padding:12px;
        display:grid;
        gap:8px;
      }
      #${PROVISION.MODAL_ID} .danger-footer{
        margin-top:14px;
        border:1px solid rgba(220,38,38,.35);
        border-radius:12px;
        background:rgba(127,29,29,.18);
        padding:10px;
        display:flex;
        justify-content:flex-end;
        align-items:center;
      }
      #${PROVISION.MODAL_ID} .danger-footer .btn{
        min-width:180px;
      }
      #${PROVISION.MODAL_ID} .action-card-title{
        font-size:12px;
        font-weight:800;
        color:#93c5fd;
        letter-spacing:.3px;
        text-transform:uppercase;
        margin-bottom:4px;
      }
      #${PROVISION.MODAL_ID} .action-card .btn{
        width:100%;
        text-align:left;
      }
      #${PROVISION.MODAL_ID} .action-row{
        display:grid;
        grid-template-columns: 1fr 28px;
        gap:8px;
        align-items:center;
      }
      #${PROVISION.MODAL_ID} .action-result{
        width:26px;
        height:26px;
        border-radius:8px;
        border:1px solid rgba(148,163,184,.35);
        display:flex;
        align-items:center;
        justify-content:center;
        font-weight:800;
        font-size:14px;
        color:#94a3b8;
        background:rgba(15,23,42,.55);
      }
      #${PROVISION.MODAL_ID} .action-result.ok{
        border-color:#16a34a;
        color:#16a34a;
        background:rgba(22,163,74,.12);
      }
      #${PROVISION.MODAL_ID} .action-result.err{
        border-color:#dc2626;
        color:#dc2626;
        background:rgba(220,38,38,.12);
      }
      #${PROVISION.MODAL_ID} .grid{
        display:grid; gap:10px;
        grid-template-columns: 1fr 1fr;
      }
      #${PROVISION.MODAL_ID} label{ font-size:12px; color:#cbd5e1; display:block; margin-bottom:6px; }
      #${PROVISION.MODAL_ID} input{
        width:100%; padding:10px 10px;
        border-radius:10px;
        border:1px solid rgba(148,163,184,.22);
        background:rgba(2,6,23,.55);
        color:#e2e8f0;
        outline:none;
      }
      #${PROVISION.MODAL_ID} input:focus{ border-color:rgba(56,189,248,.65); box-shadow:0 0 0 3px rgba(56,189,248,.15); }
      #${PROVISION.MODAL_ID} .row{ display:flex; gap:10px; flex-wrap:wrap; align-items:center; }
      #${PROVISION.MODAL_ID} .btn{
        appearance:none; border:none; cursor:pointer;
        padding:10px 12px; border-radius:12px; font-weight:700; font-size:13px;
      }
      #${PROVISION.MODAL_ID} .btn-primary{ background:#2563eb; color:white; }
      #${PROVISION.MODAL_ID} .btn-primary:hover{ background:#1d4ed8; }
      #${PROVISION.MODAL_ID} .btn-secondary{ background:rgba(148,163,184,.16); color:#e2e8f0; }
      #${PROVISION.MODAL_ID} .btn-secondary:hover{ background:rgba(148,163,184,.22); }
      #${PROVISION.MODAL_ID} .btn-danger{ background:#dc2626; color:white; }
      #${PROVISION.MODAL_ID} .btn-danger:hover{ background:#b91c1c; }
      #${PROVISION.MODAL_ID} .hint{
        color:#94a3b8; font-size:12px; line-height:1.4;
      }
      #${PROVISION.MODAL_ID} .status{
        border:1px solid rgba(148,163,184,.18);
        border-radius:12px;
        padding:10px;
        background:rgba(2,6,23,.4);
      }
      #${PROVISION.MODAL_ID} pre{
        margin:0;
        max-height:190px; overflow:auto;
        font-size:12px; line-height:1.35;
        color:#d1d5db;
        white-space:pre-wrap;
      }
      #${PROVISION.MODAL_ID} .logbox{
        border:1px solid rgba(148,163,184,.18);
        border-radius:12px;
        padding:10px;
        background:rgba(2,6,23,.25);
      }
      #${PROVISION.MODAL_ID} textarea{
        width:100%;
        min-height:220px;
        max-height:320px;
        resize:vertical;
        border-radius:12px;
        border:1px solid rgba(148,163,184,.22);
        background:rgba(2,6,23,.55);
        color:#e2e8f0;
        padding:10px;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
        font-size:12px;
        line-height:1.35;
        outline:none;
      }
      #${PROVISION.MODAL_ID} textarea:focus{ border-color:rgba(56,189,248,.65); box-shadow:0 0 0 3px rgba(56,189,248,.12); }
      #${PROVISION.MODAL_ID} .pill{
        font-size:12px;
        color:#0f172a;
        background:#a7f3d0;
        padding:4px 8px;
        border-radius:999px;
        font-weight:800;
      }
      #${PROVISION.MODAL_ID} .pill-warn{ background:#fde68a; }
      @media (max-width: 980px){
        #${PROVISION.MODAL_ID} .outer-layout{ grid-template-columns: 1fr; }
      }
    `;
    document.head.appendChild(style);

    const backdrop = document.createElement('div');
    backdrop.id = `${PROVISION.MODAL_ID}-backdrop`;
    backdrop.innerHTML = `
      <div id="${PROVISION.MODAL_ID}" role="dialog" aria-modal="true">
        <header>
          <h3>Provisionamento Kiper Access <span class="pill pill-warn" id="tmStepPill">Manual</span></h3>
          <button class="tm-close" title="Fechar" aria-label="Fechar">✕</button>
        </header>
        <div class="body">
          <div class="outer-layout">
            <aside class="action-card">
              <div class="action-card-title">Fluxo Provisionamento</div>
              <div class="action-row">
                <button class="btn btn-secondary" id="tmProvisionMk">1-ATIVAR PROVISIONAMENTO MK</button>
                <span id="tmProvisionMkResult" class="action-result" title="Sem execução">•</span>
              </div>
              <div class="action-row">
                <button class="btn btn-secondary" id="tmRunStep1">2-RODAR ETAPA 1</button>
                <span id="tmRunStep1Result" class="action-result" title="Sem execução">•</span>
              </div>
              <div class="action-row">
                <button class="btn btn-secondary" id="tmDisableProvisionMk">3-DESABILITAR PROVISIONAMENTO MK</button>
                <span id="tmDisableProvisionMkResult" class="action-result" title="Sem execução">•</span>
              </div>
              <div class="action-row">
                <button class="btn btn-secondary" id="tmRunStep2">4-RODAR ETAPA 2</button>
                <span id="tmRunStep2Result" class="action-result" title="Sem execução">•</span>
              </div>
              <button class="btn btn-secondary" id="tmGetLog">VER LOG</button>
            </aside>
            <section class="main-panel">
              <div class="grid">
                <div>
                  <label>IP atual do device</label>
                  <input id="tmCurrentIp" placeholder="ex: 10.0.128.36" disabled />
                </div>
                <div>
                  <label>Novo IP</label>
                  <input id="tmNewIp" placeholder="ex: 10.0.50.36" />
                </div>
                <div>
                  <label>Gateway (auto .1) / Host MikroTik</label>
                  <input id="tmGateway" placeholder="ex: 10.0.50.1" />
                </div>
                <div>
                  <label>Email-monitoring (api_user_name)</label>
                  <input id="tmEmail" placeholder="ex: nome@porter.com.br" />
                </div>
                <div style="grid-column: 1 / -1;">
                  <label>Senha-monitoring (api_password)</label>
                  <input id="tmPass" type="password" placeholder="••••••••" />
                </div>
                <div>
                  <label>User MK</label>
                  <input id="tmUserMk" placeholder="ex: admin" />
                </div>
                <div>
                  <label>Pass MK</label>
                  <input id="tmPassMk" type="password" placeholder="••••••••" />
                </div>
                <div>
                  <label>Port MK</label>
                  <input id="tmPortMk" type="number" placeholder="ex: 22" />
                </div>
                <div>
                  <label>API Key</label>
                  <input id="tmApiKey" placeholder="ex: sua-chave-api" />
                </div>
              </div>
              <div class="hint">
                Etapa 1 faz rede + credenciais MQTT + <b>reboot</b>. Depois, quando o device estiver online e NAT ok,
                você roda a Etapa 2 para <b>renovar certificado</b> (demora ~30s).
              </div>
              <div class="main-col">
                <div class="status">
                  <pre id="tmStatus"></pre>
                </div>
                <div class="logbox">
                  <label>kLog.txt (visualização)</label>
                  <textarea id="tmLogText" placeholder="Clique em 'Ver Log' para carregar..."></textarea>
                </div>
                <div class="row">
                  <button class="btn btn-secondary" id="tmClearLog">Limpar status</button>
                  <button class="btn btn-danger" id="tmClose">Fechar</button>
                </div>
              </div>
            </section>
          </div>
          <div class="danger-footer">
            <button class="btn btn-danger" id="tmRunReset">RESET ACESS</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);

    const closeBtns = [backdrop.querySelector('.tm-close'), backdrop.querySelector('#tmClose')].filter(Boolean);
    closeBtns.forEach((b) => b.addEventListener('click', () => hideModal()));
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) hideModal(); });

    const newIpEl = backdrop.querySelector('#tmNewIp');
    const gwEl = backdrop.querySelector('#tmGateway');
    newIpEl.addEventListener('input', () => {
      gwEl.value = computeGateway(newIpEl.value.trim());
      saveProvisionDraft();
    });

    ['tmEmail', 'tmPass', 'tmUserMk', 'tmPassMk', 'tmPortMk', 'tmApiKey'].forEach((id) => {
      const el = backdrop.querySelector(`#${id}`);
      if (el) el.addEventListener('input', saveProvisionDraft);
    });

    backdrop.querySelector('#tmClearLog').addEventListener('click', () => {
      setStatus('', false);
      const area = document.getElementById('tmLogText');
      if (area) area.value = '';
    });
  }

  function showModal() {
    ensureModal();
    document.getElementById(`${PROVISION.MODAL_ID}-backdrop`).style.display = 'flex';
  }

  function hideModal() {
    const bd = document.getElementById(`${PROVISION.MODAL_ID}-backdrop`);
    if (bd) bd.style.display = 'none';
  }

  function setPill(text, warn = false) {
    const pill = document.getElementById('tmStepPill');
    if (!pill) return;
    pill.textContent = text;
    pill.classList.toggle('pill-warn', !!warn);
  }

  function setStatus(text, append = true) {
    const pre = document.getElementById('tmStatus');
    if (!pre) return;
    pre.textContent = append ? (pre.textContent + text) : text;
    pre.scrollTop = pre.scrollHeight;
  }

  function setActionIndicator(buttonId, markerId, state) {
    const btn = document.getElementById(buttonId);
    const marker = document.getElementById(markerId);
    if (!btn || !marker) return;

    marker.classList.remove('ok', 'err');
    btn.style.boxShadow = '';
    btn.style.border = '';

    if (state === 'ok') {
      marker.textContent = '✓';
      marker.title = 'Sucesso';
      marker.classList.add('ok');
      btn.style.border = '1px solid #16a34a';
      btn.style.boxShadow = '0 0 0 2px rgba(22,163,74,.25)';
      return;
    }
    if (state === 'err') {
      marker.textContent = '✕';
      marker.title = 'Erro';
      marker.classList.add('err');
      btn.style.border = '1px solid #dc2626';
      btn.style.boxShadow = '0 0 0 2px rgba(220,38,38,.25)';
      return;
    }
    if (state === 'running') {
      marker.textContent = '…';
      marker.title = 'Executando';
      return;
    }

    marker.textContent = '•';
    marker.title = 'Sem execução';
  }

  function setProvisionMkIndicator(state) {
    setActionIndicator('tmProvisionMk', 'tmProvisionMkResult', state);
  }

  function setStep1Indicator(state) {
    setActionIndicator('tmRunStep1', 'tmRunStep1Result', state);
  }

  function setDisableProvisionMkIndicator(state) {
    setActionIndicator('tmDisableProvisionMk', 'tmDisableProvisionMkResult', state);
  }

  function setStep2Indicator(state) {
    setActionIndicator('tmRunStep2', 'tmRunStep2Result', state);
  }

  function getModalValues() {
    const currentIp = document.getElementById('tmCurrentIp')?.value?.trim();
    const newIp = document.getElementById('tmNewIp')?.value?.trim();
    const gw = document.getElementById('tmGateway')?.value?.trim();
    const email = document.getElementById('tmEmail')?.value?.trim();
    const pass = document.getElementById('tmPass')?.value ?? '';

    const usermk = document.getElementById('tmUserMk')?.value?.trim() || '';
    const passmk = document.getElementById('tmPassMk')?.value ?? '';
    const portmk = document.getElementById('tmPortMk')?.value?.trim() || '';
    const apikey = document.getElementById('tmApiKey')?.value?.trim() || '';

    if (!currentIp) return { ok: false, msg: 'IP atual vazio.' };
    if (!newIp) return { ok: false, msg: 'Novo IP vazio.' };
    if (!gw) return { ok: false, msg: 'Gateway inválido.' };
    if (!email) return { ok: false, msg: 'Email-monitoring vazio.' };
    if (!pass) return { ok: false, msg: 'Senha-monitoring vazia.' };

    const mkHost = gw;
    return { ok: true, currentIp, newIp, gw, mkHost, email, pass, usermk, passmk, portmk, apikey };
  }

  function disableModalButtons(disabled) {
    const ids = ['tmRunStep1', 'tmRunStep2', 'tmRunReset', 'tmClearLog', 'tmGetLog', 'tmProvisionMk', 'tmDisableProvisionMk'];
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.disabled = disabled;
    });
  }

  async function step(deviceIp, label, cmd, timeoutMs = 12000) {
    setStatus(`\n• ${label}\n`, true);
    const resp = await gmPostRaw(deviceIp, cmd, timeoutMs);

    setStatus(`  cmd=${cmd}\n  status=${resp.status}\n`, true);
    const body = (resp.responseText || '').trim();
    if (body) setStatus(`  body=${body.slice(0, 180)}\n`, true);

    if (resp.status !== 200) throw new Error(`${label} (HTTP ${resp.status})`);
    await sleep(PROVISION.STEP_DELAY_MS);
  }

  async function runReset() {
    const currentIp = document.getElementById('tmCurrentIp')?.value?.trim();
    if (!currentIp) return alert('IP atual vazio.');

    const ok = confirm(
      `Confirmar RESET:\n\n` +
      `IP do device: ${currentIp}\n\n` +
      `Vai executar:\n` +
      `login → restore → rst\n\n` +
      `Continuar?`
    );
    if (!ok) return;

    disableModalButtons(true);
    setPill('Reset', true);

    try {
      setStatus(`\n=== RESET INÍCIO ===\n`, true);
      await step(currentIp, 'Login (Reset)...', `login:${PROVISION.DEVICE_LOGIN_PASS}`);
      await step(currentIp, 'Restore (reset)...', 'restore');

      setStatus(`\n• Reboot (rst)...\n`, true);
      try {
        const resp = await gmPostRaw(currentIp, 'rst', 12000);
        setStatus(`  status=${resp.status}\n`, true);
      } catch (e) {
        setStatus(`  (device pode ter caído rápido: ${e.message})\n`, true);
      }

      setStatus(`\n=== RESET FINALIZADO ===\n`, true);
      alert('Reset enviado ✅ (login → restore → rst).');
    } catch (e) {
      console.error(e);
      setStatus(`\nERRO: ${e.message}\n`, true);
      alert(`Erro no Reset: ${e.message}`);
    } finally {
      setPill('Manual', true);
      disableModalButtons(false);
    }
  }

  async function runStep1() {
    const v = getModalValues();
    if (!v.ok) return alert(v.msg);

    const { currentIp, newIp, gw, email, pass } = v;

    const ok = confirm(
      `Confirmar ETAPA 1:\n\n` +
      `IP atual: ${currentIp}\n` +
      `IP novo: ${newIp}\n` +
      `GW: ${gw}\n` +
      `Email-monitoring: ${email}\n\n` +
      `A Etapa 1 vai REINICIAR o device.\nContinuar?`
    );
    if (!ok) return;

    disableModalButtons(true);
    setPill('Etapa 1', true);
    setStep1Indicator('running');

    try {
      setStatus(`\n=== ETAPA 1 INÍCIO ===\n`, true);

      await step(currentIp, 'Login...', `login:${PROVISION.DEVICE_LOGIN_PASS}`);
      await step(currentIp, 'Set IP...', `dbw:disp,el,ip_address,${newIp}`);
      await step(currentIp, 'Set Gateway...', `dbw:disp,el,ip_gateway,${gw}`);
      await step(currentIp, 'Salvar rede (scfg)...', 'scfg');

      await step(currentIp, 'Set Email (MQTT)...', `dbw:kcv,el,api_user_name,${email}`);
      await step(currentIp, 'Set Senha (MQTT)...', `dbw:kcv,el,api_password,${pass}`);
      await step(currentIp, 'Salvar MQTT (scfg)...', 'scfg');

      setStatus(`\n• Reboot (rst)...\n`, true);
      try {
        const resp = await gmPostRaw(currentIp, 'rst', 12000);
        setStatus(`  status=${resp.status}\n`, true);
      } catch (e) {
        setStatus(`  (device pode ter caído rápido: ${e.message})\n`, true);
      }

      setStatus(`\n=== ETAPA 1 FINALIZADA ===\n`, true);
      setStep1Indicator('ok');
      alert(
        `Etapa 1 enviada.\n\n` +
        `Agora confirme manualmente:\n` +
        `- Device online no IP novo (${newIp})\n` +
        `- NAT/rota ok\n\n` +
        `Depois clique em "Rodar Etapa 2".`
      );
    } catch (e) {
      console.error(e);
      setStatus(`\nERRO: ${e.message}\n`, true);
      setStep1Indicator('err');
      alert(`Erro na Etapa 1: ${e.message}`);
    } finally {
      setPill('Manual', true);
      disableModalButtons(false);
    }
  }

  async function runStep2() {
    const v = getModalValues();
    if (!v.ok) return alert(v.msg);

    const { newIp } = v;

    const ok = confirm(
      `Confirmar ETAPA 2:\n\n` +
      `IP do device (já online): ${newIp}\n\n` +
      `Vai executar:\n` +
      `login → renew_certificates_chg,true (pode demorar ~30s)\n\n` +
      `Continuar?`
    );
    if (!ok) return;

    disableModalButtons(true);
    setPill('Etapa 2', true);
    setStep2Indicator('running');

    try {
      setStatus(`\n=== ETAPA 2 INÍCIO ===\n`, true);
      await step(newIp, 'Login (Etapa 2)...', `login:${PROVISION.DEVICE_LOGIN_PASS}`);
      await step(
        newIp,
        'Renovando certificados (aguarde ~30s)...',
        'dbw:kcv,el,renew_certificates_chg,true',
        PROVISION.RENEW_CERT_TIMEOUT_MS
      );

      setStatus(`\n=== ETAPA 2 FINALIZADA (200 OK) ===\n`, true);
      setStep2Indicator('ok');
      alert('Etapa 2 finalizada ✅ (renew_certificates retornou 200 OK).');
    } catch (e) {
      console.error(e);
      setStatus(`\nERRO: ${e.message}\n`, true);
      setStep2Indicator('err');
      alert(`Erro na Etapa 2: ${e.message}`);
    } finally {
      setPill('Manual', true);
      disableModalButtons(false);
    }
  }

  async function runGetLog() {
    const cur = document.getElementById('tmCurrentIp')?.value?.trim();
    const nw = document.getElementById('tmNewIp')?.value?.trim();
    const ip = nw || cur;

    if (!ip) return alert('Sem IP para buscar log.');

    disableModalButtons(true);
    setPill('Log', true);

    try {
      setStatus(`\n=== LOG: GET ${PROVISION.LOG_FILE} (${ip}) ===\n`, true);
      setStatus(`\n• GET /?dw_file=${PROVISION.LOG_FILE}\n`, true);

      const resp = await gmGet(ip, `/?dw_file=${PROVISION.LOG_FILE}`, 12000);

      setStatus(`  status=${resp.status}\n`, true);
      if (resp.status !== 200) throw new Error(`GET log (HTTP ${resp.status})`);

      let txt = resp.responseText || '';
      if (txt.length > PROVISION.LOG_MAX_CHARS) txt = txt.slice(txt.length - PROVISION.LOG_MAX_CHARS);

      const area = document.getElementById('tmLogText');
      if (area) area.value = txt;

      const tail = txt.slice(Math.max(0, txt.length - 280)).trim();
      if (tail) setStatus(`\n--- tail ---\n${tail}\n------------\n`, true);
    } catch (e) {
      console.error(e);
      setStatus(`\nERRO: ${e.message}\n`, true);
      alert(`Erro ao buscar log: ${e.message}`);
    } finally {
      setPill('Manual', true);
      disableModalButtons(false);
    }
  }

  async function runProvisionMk() {
    const v = getModalValues();
    if (!v.ok) return alert(v.msg);
    if (!v.newIp) return alert('Novo IP vazio.');
    if (!v.usermk) return alert('User MK vazio.');
    if (!v.passmk) return alert('Pass MK vazia.');

    const mkPort = Number.parseInt(v.portmk, 10) || 22;
    const baseUrl = PROVISION.GO_SSH_BASE_URL;
    const cmd = [
      '/ip address remove [find where address="10.15.15.1/24"]',
      '/ip address add address=10.15.15.1/24 interface=LAN comment=KIPER-PROVISORIO',
      '/ip firewall nat remove [find where comment="KIPER-ACCESS-PROVISORIO"]',
      `/ip firewall nat add chain=dstnat dst-address=${v.newIp} action=dst-nat to-addresses=10.15.15.70 comment=KIPER-ACCESS-PROVISORIO`,
    ].join('; ');

    disableModalButtons(true);
    setPill('Provision MK', true);
    setProvisionMkIndicator('running');

    try {
      setStatus(`\n=== PROVISIONAMENTO MK INÍCIO ===\n`, true);
      setStatus(`Host: ${v.mkHost}:${mkPort}\nNovo IP: ${v.newIp}\n`, true);
      setStatus(`Aplicando regras provisórias (IP + NAT)...\n`, true);

      const execResp = await gmRequest({
        method: 'POST',
        url: `${baseUrl}/exec`,
        timeoutMs: 15000,
        headers: {
          'Content-Type': 'application/json',
          ...(v.apikey ? { 'X-API-Key': v.apikey } : {}),
        },
        data: JSON.stringify({
          host: v.mkHost,
          port: mkPort,
          user: v.usermk,
          pass: v.passmk,
          command: cmd,
          timeout_seconds: 12,
        }),
      });

      if (execResp.status < 200 || execResp.status > 299) {
        throw new Error(`Exec HTTP ${execResp.status}`);
      }

      const execJson = tryParseJson(execResp.responseText);
      const jobId = execJson?.job_id;
      if (!jobId) throw new Error('Resposta sem job_id no /exec');
      setStatus(`job_id=${jobId}\n`, true);

      let finalJob = null;
      for (let i = 0; i < 20; i++) {
        await sleep(500);
        const stResp = await gmRequest({
          method: 'GET',
          url: `${baseUrl}/status/${encodeURIComponent(jobId)}`,
          timeoutMs: 10000,
          headers: v.apikey ? { 'X-API-Key': v.apikey } : {},
        });
        if (stResp.status !== 200) continue;
        const stJson = tryParseJson(stResp.responseText);
        if (!stJson) continue;

        const st = (stJson.status || '').toLowerCase();
        if (st === 'done' || st === 'canceled') {
          finalJob = stJson;
          break;
        }
      }

      if (!finalJob) throw new Error('Timeout aguardando status do job');
      const hostRes = finalJob.hosts && Object.values(finalJob.hosts)[0] ? Object.values(finalJob.hosts)[0] : null;
      const ok = !!hostRes?.success;
      const out = (hostRes?.output || '').trim();
      const err = (hostRes?.error || '').trim();
      const benignAlreadyExists = err.toLowerCase().includes('failure: already have such address');

      setStatus(`status_final=${finalJob.status}\n`, true);
      if (out) setStatus(`output=${out}\n`, true);
      if (err && !benignAlreadyExists) setStatus(`error=${err}\n`, true);

      if (!ok && benignAlreadyExists) {
        setStatus(`output=${err}\n`, true);
        setStatus(`=== PROVISIONAMENTO MK OK (com aviso) ===\n`, true);
        setProvisionMkIndicator('ok');
        alert('Provisionamento MK aplicado (com aviso de endereço já existente).');
        return;
      }

      if (!ok) throw new Error(err || 'Falha ao ativar provisionamento no MikroTik');
      setStatus(`=== PROVISIONAMENTO MK OK ===\n`, true);
      setProvisionMkIndicator('ok');
      alert('Provisionamento MK ativado com sucesso.');
    } catch (e) {
      setStatus(`ERRO PROVISIONAMENTO MK: ${e.message}\n`, true);
      setProvisionMkIndicator('err');
      alert(`Erro no Provisionamento MK: ${e.message}`);
    } finally {
      setPill('Manual', true);
      disableModalButtons(false);
    }
  }

  async function runDisableProvisionMk() {
    const v = getModalValues();
    if (!v.ok) return alert(v.msg);
    if (!v.usermk) return alert('User MK vazio.');
    if (!v.passmk) return alert('Pass MK vazia.');

    const mkPort = Number.parseInt(v.portmk, 10) || 22;
    const baseUrl = PROVISION.GO_SSH_BASE_URL;
    const cmd = '/ip firewall nat remove [find where comment="KIPER-ACCESS-PROVISORIO"]';

    disableModalButtons(true);
    setPill('Disable MK', true);
    setDisableProvisionMkIndicator('running');

    try {
      setStatus(`\n=== DESABILITAR PROVISIONAMENTO MK INÍCIO ===\n`, true);
      setStatus(`Host: ${v.mkHost}:${mkPort}\n`, true);
      setStatus(`Removendo NAT KIPER-ACCESS-PROVISORIO...\n`, true);

      const execResp = await gmRequest({
        method: 'POST',
        url: `${baseUrl}/exec`,
        timeoutMs: 15000,
        headers: {
          'Content-Type': 'application/json',
          ...(v.apikey ? { 'X-API-Key': v.apikey } : {}),
        },
        data: JSON.stringify({
          host: v.mkHost,
          port: mkPort,
          user: v.usermk,
          pass: v.passmk,
          command: cmd,
          timeout_seconds: 12,
        }),
      });

      if (execResp.status < 200 || execResp.status > 299) {
        throw new Error(`Exec HTTP ${execResp.status}`);
      }

      const execJson = tryParseJson(execResp.responseText);
      const jobId = execJson?.job_id;
      if (!jobId) throw new Error('Resposta sem job_id no /exec');
      setStatus(`job_id=${jobId}\n`, true);

      let finalJob = null;
      for (let i = 0; i < 20; i++) {
        await sleep(500);
        const stResp = await gmRequest({
          method: 'GET',
          url: `${baseUrl}/status/${encodeURIComponent(jobId)}`,
          timeoutMs: 10000,
          headers: v.apikey ? { 'X-API-Key': v.apikey } : {},
        });
        if (stResp.status !== 200) continue;
        const stJson = tryParseJson(stResp.responseText);
        if (!stJson) continue;
        const st = (stJson.status || '').toLowerCase();
        if (st === 'done' || st === 'canceled') {
          finalJob = stJson;
          break;
        }
      }

      if (!finalJob) throw new Error('Timeout aguardando status do job');
      const hostRes = finalJob.hosts && Object.values(finalJob.hosts)[0] ? Object.values(finalJob.hosts)[0] : null;
      const ok = !!hostRes?.success;
      const out = (hostRes?.output || '').trim();
      const err = (hostRes?.error || '').trim();

      setStatus(`status_final=${finalJob.status}\n`, true);
      if (out) setStatus(`output=${out}\n`, true);
      if (err) setStatus(`error=${err}\n`, true);

      if (!ok) throw new Error(err || 'Falha ao desabilitar provisionamento no MikroTik');
      setStatus(`=== DESABILITAR PROVISIONAMENTO MK OK ===\n`, true);
      setDisableProvisionMkIndicator('ok');
      alert('Provisionamento MK desabilitado com sucesso.');
    } catch (e) {
      setStatus(`ERRO DESABILITAR PROVISIONAMENTO MK: ${e.message}\n`, true);
      setDisableProvisionMkIndicator('err');
      alert(`Erro ao desabilitar Provisionamento MK: ${e.message}`);
    } finally {
      setPill('Manual', true);
      disableModalButtons(false);
    }
  }

  function createOpenModalButton(li) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-dark btn-sm ml-1';
    btn.textContent = 'Provisionar (ACCESS V1)';
    btn.setAttribute('data-tm', PROVISION.BTN_MARK);

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      ensureModal();

      const currentIp = getDeviceIpFromLi(li) || '';
      const curEl = document.getElementById('tmCurrentIp');
      const newIpEl = document.getElementById('tmNewIp');
      const gwEl = document.getElementById('tmGateway');

      curEl.value = currentIp;
      applyProvisionDraftToInputs(loadProvisionDraft());
      if (!newIpEl.value) newIpEl.value = currentIp;
      gwEl.value = computeGateway(newIpEl.value.trim());

      const step1Btn = document.getElementById('tmRunStep1');
      const step2Btn = document.getElementById('tmRunStep2');
      const resetBtn = document.getElementById('tmRunReset');
      const logBtn = document.getElementById('tmGetLog');
      const provisionMkBtn = document.getElementById('tmProvisionMk');
      const disableProvisionMkBtn = document.getElementById('tmDisableProvisionMk');

      if (!step1Btn.dataset.bound) { step1Btn.dataset.bound = '1'; step1Btn.addEventListener('click', runStep1); }
      if (!step2Btn.dataset.bound) { step2Btn.dataset.bound = '1'; step2Btn.addEventListener('click', runStep2); }
      if (resetBtn && !resetBtn.dataset.bound) { resetBtn.dataset.bound = '1'; resetBtn.addEventListener('click', runReset); }
      if (!logBtn.dataset.bound) { logBtn.dataset.bound = '1'; logBtn.addEventListener('click', runGetLog); }
      if (provisionMkBtn && !provisionMkBtn.dataset.bound) { provisionMkBtn.dataset.bound = '1'; provisionMkBtn.addEventListener('click', runProvisionMk); }
      if (disableProvisionMkBtn && !disableProvisionMkBtn.dataset.bound) { disableProvisionMkBtn.dataset.bound = '1'; disableProvisionMkBtn.addEventListener('click', runDisableProvisionMk); }
      setProvisionMkIndicator('idle');
      setStep1Indicator('idle');
      setDisableProvisionMkIndicator('idle');
      setStep2Indicator('idle');

      showModal();
    });

    return btn;
  }

  function injectProvisionButtons() {
    document.querySelectorAll('li.list-group-item').forEach((li) => {
      if (!isKiperAccessVeicular(li)) return;

      const actions = li.querySelector('.device-actions');
      if (!actions) return;
      if (actions.querySelector(`[data-tm="${PROVISION.BTN_MARK}"]`)) return;

      actions.appendChild(createOpenModalButton(li));
    });
  }

  // ===========================
  //  SPA: SEM F5 (URL CHANGE HOOK)
  // ===========================
  function onUrlChange(cb) {
    let last = location.href;

    const fire = () => {
      const now = location.href;
      if (now !== last) {
        last = now;
        cb(now);
      }
    };

    const _push = history.pushState;
    history.pushState = function (...args) {
      const ret = _push.apply(this, args);
      setTimeout(fire, 0);
      return ret;
    };

    const _replace = history.replaceState;
    history.replaceState = function (...args) {
      const ret = _replace.apply(this, args);
      setTimeout(fire, 0);
      return ret;
    };

    window.addEventListener('popstate', () => setTimeout(fire, 0));

    setInterval(fire, 800);
  }

  // ===========================
  //  INIT / OBSERVERS
  // ===========================
  function refreshAll() {
    insertMapsButton();
    insertIpButtons();
    injectProvisionButtons();
    injectEventIcons();
    interceptUserLinksForModal();
  }

  function observeDOM() {
    const observer = new MutationObserver(() => refreshAll());
    observer.observe(document.body, { childList: true, subtree: true });
  }

  refreshAll();
  observeDOM();

  onUrlChange(() => {
    setTimeout(refreshAll, 250);
    setTimeout(refreshAll, 1200);
  });

})();