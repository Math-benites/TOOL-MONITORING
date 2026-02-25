// ==UserScript==
// @name         Kiper Helper - Firmware Button
// @namespace    https://monitoring.cloud.kiper.com.br/
// @version      0.2.0
// @description  Adiciona botão Update Firmware abaixo de Manutenção no modal do dispositivo.
// @author       Matheus Benites
// @match        https://monitoring.cloud.kiper.com.br/*
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const BTN_FLAG = 'tmFirmwareUpdateBtn';
  const BTN_ATTR = 'data-tm-firmware-update-btn';
  const SCREEN_ATTR = 'data-tm-firmware-screen';
  const ORIGINAL_ATTR = 'data-tm-firmware-original';
  const TARGET_MODEL = 'DS-K1T673DX-BR';
  const PASS_STORE_PREFIX = 'tmFirmwarePass.v1';
  const GO_REQUEST_BASE = localStorage.getItem('tmGoRequestBase') || 'http://localhost:18080';
  let injectScheduled = false;
  let isInjecting = false;

  function norm(text) {
    return (text || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }

  function isMaintenanceButton(button) {
    const text = button?.textContent || '';
    return norm(text).includes('manutencao');
  }

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function getInfoValueByLabel(root, labelToFind) {
    const wanted = norm(labelToFind);
    const infoItems = root.querySelectorAll('div[class*="InfoItem"]');

    for (const item of infoItems) {
      const spans = item.querySelectorAll('span');
      if (spans.length < 2) continue;
      const label = norm(spans[0].textContent || '');
      if (label !== wanted) continue;
      return (spans[1].textContent || '').trim();
    }
    return '';
  }

  function getPassStorageKey(ip, user) {
    return `${PASS_STORE_PREFIX}:${ip || 'noip'}:${user || 'nouser'}`;
  }

  function loadSavedPassword(ip, user) {
    try {
      return localStorage.getItem(getPassStorageKey(ip, user)) || '';
    } catch (_e) {
      return '';
    }
  }

  function savePassword(ip, user, pass) {
    try {
      localStorage.setItem(getPassStorageKey(ip, user), pass || '');
    } catch (_e) {
      // noop
    }
  }

  async function tryFillPasswordFromClipboard(passInput, setStatus) {
    if (!passInput || (passInput.value || '').trim()) return;
    if (!window.isSecureContext || !navigator.clipboard?.readText) return;

    try {
      const clip = (await navigator.clipboard.readText() || '').trim();
      if (!clip) return;
      passInput.value = clip;
      setStatus('Senha preenchida automaticamente da área de transferência.');
    } catch (_e) {
      // Sem permissão no clipboard, mantém fluxo normal sem erro.
    }
  }

  async function backendFetchJson(path, options = {}) {
    const timeoutMs = options.timeoutMs || 15000;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(`${GO_REQUEST_BASE}${path}`, {
        method: options.method || 'GET',
        headers: options.headers || { 'Content-Type': 'application/json' },
        body: options.body,
        signal: ctrl.signal,
      });
      let data = null;
      try {
        data = await res.json();
      } catch (_e) {
        data = null;
      }
      if (!res.ok) {
        const msg = (data && (data.message || data.error)) || `HTTP ${res.status}`;
        throw new Error(msg);
      }
      return data;
    } finally {
      clearTimeout(t);
    }
  }

  async function fetchBackendFirmwares() {
    const payload = await backendFetchJson('/api/firmwares');
    return Array.isArray(payload?.items) ? payload.items : [];
  }

  async function startBackendJob({ ip, username, password, firmware }) {
    const payload = await backendFetchJson('/api/jobs', {
      method: 'POST',
      body: JSON.stringify({ ip, username, password, firmware }),
    });
    if (!payload?.job_id) throw new Error('Resposta sem job_id do backend.');
    return payload.job_id;
  }

  async function pollBackendJob({ jobId, setStatus, setProgress, cancelRef, onDone }) {
    const startedAt = Date.now();
    const maxMs = 40 * 60 * 1000;

    while (Date.now() - startedAt < maxMs) {
      if (cancelRef?.cancelled) return;
      const job = await backendFetchJson(`/api/jobs/${encodeURIComponent(jobId)}`, { timeoutMs: 12000 });
      const pct = Number.isFinite(job?.percent) ? Math.max(0, Math.min(100, job.percent)) : 0;
      setProgress(pct);
      setStatus(job?.message || `Status: ${job?.status || 'desconhecido'}`);

      if (job?.status === 'done') {
        setProgress(100);
        setStatus('Atualização concluída.');
        onDone();
        return;
      }
      if (job?.status === 'failed') {
        throw new Error(job?.message || 'Falha no job de atualização.');
      }
      await wait(2500);
    }

    throw new Error('Timeout aguardando job no backend.');
  }

  function renderFirmwareScreen(baseButton) {
    const modalContent = baseButton.closest('div.modal-content');
    if (!modalContent) return;

    const modalBody = modalContent.querySelector('div.modal-body');
    if (!modalBody) return;

    const currentScreen = modalBody.querySelector(`div[${SCREEN_ATTR}="1"]`);
    if (currentScreen) return;

    const modelRaw = (
      modalContent.querySelector('span.lhvXiO')?.textContent ||
      modalContent.querySelector('h5 .Text-sc-idpc2p-0')?.textContent ||
      ''
    ).trim();
    const model = modelRaw.replace(/\[HIKVISION\]/gi, '').trim();
    const ip = getInfoValueByLabel(modalContent, 'IP');
    const user = getInfoValueByLabel(modalContent, 'Usuário');
    const passFromModal = getInfoValueByLabel(modalContent, 'Senha');
    const passLooksMasked = /^\*+$/.test((passFromModal || '').trim());
    const savedPass = loadSavedPassword(ip, user);

    const originalNodes = Array.from(modalBody.children);
    originalNodes.forEach((node) => {
      if (!(node instanceof HTMLElement)) return;
      node.setAttribute(ORIGINAL_ATTR, '1');
      node.style.display = 'none';
    });

    const screen = document.createElement('div');
    screen.setAttribute(SCREEN_ATTR, '1');
    screen.style.cssText = 'display:flex;flex-direction:column;gap:12px;padding:8px 6px;';

    const title = document.createElement('div');
    title.style.cssText = 'font-size:18px;font-weight:700;color:#111827;';
    title.textContent = 'Update Firmware';

    const fieldLabel = document.createElement('label');
    fieldLabel.style.cssText = 'font-size:13px;font-weight:600;color:#111827;';
    fieldLabel.textContent = 'Arquivo de firmware';

    const fileRow = document.createElement('div');
    fileRow.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;';

    const firmwareSelect = document.createElement('select');
    firmwareSelect.style.cssText = 'flex:1;min-width:320px;height:36px;border:1px solid #d1d5db;border-radius:8px;padding:0 10px;font-size:13px;background:#fff;';

    const refreshBtn = document.createElement('button');
    refreshBtn.type = 'button';
    refreshBtn.textContent = 'Atualizar lista';
    refreshBtn.style.cssText = 'height:36px;padding:0 12px;border:1px solid #9ca3af;border-radius:8px;background:#f9fafb;cursor:pointer;';

    const footer = document.createElement('div');
    footer.style.cssText = 'display:flex;align-items:center;gap:8px;justify-content:flex-end;margin-top:4px;';

    const authRow = document.createElement('div');
    authRow.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;';

    const userBadge = document.createElement('div');
    userBadge.style.cssText = 'height:36px;display:inline-flex;align-items:center;padding:0 10px;border:1px solid #d1d5db;border-radius:8px;background:#f9fafb;font-size:13px;color:#111827;';
    userBadge.textContent = `Usuário: ${user || 'N/A'}`;

    const passInput = document.createElement('input');
    passInput.type = 'password';
    passInput.placeholder = 'Senha do dispositivo (salva por IP)';
    passInput.value = passLooksMasked ? (savedPass || '') : (passFromModal || savedPass || '');
    passInput.style.cssText = 'width:240px;height:36px;border:1px solid #d1d5db;border-radius:8px;padding:0 10px;font-size:13px;';

    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.textContent = 'Voltar';
    backBtn.style.cssText = 'height:36px;padding:0 14px;border:1px solid #9ca3af;border-radius:8px;background:#fff;cursor:pointer;';

    const sendBtn = document.createElement('button');
    sendBtn.type = 'button';
    sendBtn.textContent = 'Enviar Firmware';
    sendBtn.disabled = true;
    sendBtn.style.cssText = 'height:36px;padding:0 14px;border:1px solid #29AD71;border-radius:8px;background:#29AD71;color:#fff;cursor:pointer;opacity:0.6;';

    const status = document.createElement('div');
    status.style.cssText = 'font-size:12px;color:#4b5563;';
    status.textContent = 'Carregando lista de firmware do backend...';

    const progressWrap = document.createElement('div');
    progressWrap.style.cssText = 'width:100%;height:10px;border-radius:999px;background:#e5e7eb;overflow:hidden;';

    const progressBar = document.createElement('div');
    progressBar.style.cssText = 'width:0%;height:100%;background:#2563eb;transition:width .2s ease;';
    progressWrap.appendChild(progressBar);

    let sendRunning = false;
    let cancelRef = null;
    function setProgress(value) {
      progressBar.style.width = `${Math.max(0, Math.min(100, value))}%`;
    }
    function setStatus(text) {
      status.textContent = text;
    }

    tryFillPasswordFromClipboard(passInput, setStatus);

    function setBusy(busy) {
      sendRunning = busy;
      refreshBtn.disabled = busy;
      firmwareSelect.disabled = busy;
      passInput.disabled = busy;
      backBtn.disabled = busy;
      sendBtn.disabled = busy || !firmwareSelect.value;
      sendBtn.style.opacity = sendBtn.disabled ? '0.6' : '1';
      sendBtn.textContent = busy ? 'Enviando...' : 'Enviar Firmware';
    }

    async function loadFirmwareOptions() {
      if (sendRunning) return;
      firmwareSelect.innerHTML = '';
      const optLoading = document.createElement('option');
      optLoading.value = '';
      optLoading.textContent = 'Carregando...';
      firmwareSelect.appendChild(optLoading);
      sendBtn.disabled = true;
      sendBtn.style.opacity = '0.6';

      try {
        const items = await fetchBackendFirmwares();
        firmwareSelect.innerHTML = '';
        const first = document.createElement('option');
        first.value = '';
        first.textContent = items.length ? 'Selecione um firmware...' : 'Nenhum firmware encontrado na pasta';
        firmwareSelect.appendChild(first);

        items.forEach((item) => {
          const o = document.createElement('option');
          o.value = item.name;
          o.textContent = `${item.name} (${Math.round((item.size || 0) / 1024)} KB)`;
          firmwareSelect.appendChild(o);
        });

        status.textContent = items.length
          ? `Encontrados ${items.length} firmware(s) no backend.`
          : 'Sem firmware na pasta do backend.';
      } catch (err) {
        firmwareSelect.innerHTML = '';
        const fail = document.createElement('option');
        fail.value = '';
        fail.textContent = 'Erro ao carregar firmware';
        firmwareSelect.appendChild(fail);
        status.textContent = `Erro no backend: ${err.message}`;
      }
    }

    refreshBtn.addEventListener('click', loadFirmwareOptions);
    firmwareSelect.addEventListener('change', () => {
      sendBtn.disabled = sendRunning || !firmwareSelect.value;
      sendBtn.style.opacity = sendBtn.disabled ? '0.6' : '1';
      if (firmwareSelect.value) {
        status.textContent = `Firmware selecionado: ${firmwareSelect.value}`;
      }
    });

    backBtn.addEventListener('click', () => {
      screen.remove();
      if (cancelRef) cancelRef.cancelled = true;
      modalBody.querySelectorAll(`*[${ORIGINAL_ATTR}="1"]`).forEach((el) => {
        if (!(el instanceof HTMLElement)) return;
        el.style.display = '';
        el.removeAttribute(ORIGINAL_ATTR);
      });
      scheduleInject();
    });

    sendBtn.addEventListener('click', () => {
      (async () => {
        const selectedFirmware = firmwareSelect.value || '';
        const authUser = (user || '').trim();
        const authPass = passInput.value || '';

        if (!selectedFirmware) {
          status.textContent = 'Selecione um firmware da lista.';
          return;
        }
        if (!authUser || !authPass) {
          status.textContent = 'Usuário/senha inválidos. Verifique a senha do dispositivo.';
          return;
        }
        if (!ip) {
          status.textContent = 'IP do dispositivo não encontrado no modal.';
          return;
        }
        try {
          savePassword(ip, authUser, authPass);
          setBusy(true);
          setProgress(0);
          setStatus('Iniciando envio e monitoramento...');
          cancelRef = { cancelled: false };

          setStatus('Criando job no backend...');
          const jobId = await startBackendJob({
            ip,
            username: authUser,
            password: authPass,
            firmware: selectedFirmware,
          });

          setStatus(`Job ${jobId} criado. Monitorando...`);
          await pollBackendJob({
            jobId,
            setStatus,
            setProgress,
            onDone: () => setBusy(false),
            cancelRef,
          });
        } catch (err) {
          if (cancelRef) cancelRef.cancelled = true;
          setBusy(false);
          setStatus(`Erro: ${err.message}`);
        }
      })();
    });

    fileRow.appendChild(firmwareSelect);
    fileRow.appendChild(refreshBtn);

    footer.appendChild(backBtn);
    footer.appendChild(sendBtn);

    screen.appendChild(title);
    screen.appendChild(fieldLabel);
    authRow.appendChild(userBadge);
    authRow.appendChild(passInput);
    screen.appendChild(authRow);
    screen.appendChild(fileRow);
    screen.appendChild(progressWrap);
    screen.appendChild(status);
    screen.appendChild(footer);
    modalBody.appendChild(screen);

    loadFirmwareOptions();
  }

  function createFirmwareButtonFrom(baseButton) {
    const btn = baseButton.cloneNode(true);
    btn.dataset[BTN_FLAG] = '1';
    btn.setAttribute(BTN_ATTR, '1');

    const textEl = btn.querySelector('span[class*="ButtonText"]') || btn.querySelector('span');
    if (textEl) textEl.textContent = 'Update Firmware';

    const svg = btn.querySelector('svg');
    if (svg) {
      svg.setAttribute('viewBox', '0 0 16 16');
      svg.setAttribute('width', '32');
      svg.setAttribute('height', '32');
      svg.setAttribute('fill', 'currentColor');
      svg.innerHTML = '<path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5m.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2"/>';
    }

    btn.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      renderFirmwareScreen(btn);
    });

    return btn;
  }

  function injectFirmwareButton() {
    if (isInjecting) return;
    isInjecting = true;
    try {
      const menuGrids = document.querySelectorAll('div[class*="MenuGrid"]');
      if (!menuGrids.length) return;

      menuGrids.forEach((grid) => {
        const existing = grid.querySelector(`button[${BTN_ATTR}="1"]`);
        if (existing) return;

        const buttons = Array.from(grid.querySelectorAll('button'));
        const maintenanceButton = buttons.find(isMaintenanceButton);
        if (!maintenanceButton) return;

        const firmwareBtn = createFirmwareButtonFrom(maintenanceButton);
        maintenanceButton.insertAdjacentElement('afterend', firmwareBtn);
      });
    } finally {
      isInjecting = false;
    }
  }

  function scheduleInject() {
    if (injectScheduled) return;
    injectScheduled = true;
    requestAnimationFrame(() => {
      injectScheduled = false;
      injectFirmwareButton();
    });
  }

  function mutationLooksRelevant(mutation) {
    if (mutation.type === 'attributes') {
      const target = mutation.target;
      if (!(target instanceof Element)) return false;
      return (
        target.matches('div.modal') ||
        target.matches('div[class*="MenuGrid"]') ||
        !!target.querySelector?.('div[class*="MenuGrid"]')
      );
    }

    if (mutation.type !== 'childList') return false;
    if (!mutation.addedNodes || mutation.addedNodes.length === 0) return false;

    for (const node of mutation.addedNodes) {
      if (!(node instanceof Element)) continue;
      if (
        node.matches('div[class*="MenuGrid"]') ||
        node.matches('div.modal') ||
        node.querySelector?.('div[class*="MenuGrid"]')
      ) {
        return true;
      }
    }
    return false;
  }

  function start() {
    scheduleInject();

    const observer = new MutationObserver((mutations) => {
      if (isInjecting) return;
      if (!mutations.some(mutationLooksRelevant)) return;
      scheduleInject();
    });

    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style'],
    });

    // Fallback leve para cenarios SPA onde o modal apenas "aparece" sem childList.
    setInterval(scheduleInject, 1200);

    document.addEventListener('click', () => {
      setTimeout(scheduleInject, 0);
    }, true);
  }

  start();
})();
