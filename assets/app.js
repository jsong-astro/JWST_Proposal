(function () {
  const dataset = window.JWST_PROPOSALS || { proposals: [] };
  const proposals = dataset.proposals || [];
  const byKey = new Map(proposals.map((item) => [item.key, item]));
  const PROGRAM_ORDER = ["GO", "DDT", "ERS", "Joint"];
  const PROGRAM_LABELS = {
    GO: "General Observer",
    DDT: "Director's Discretionary Time",
    ERS: "Early Release Science",
    Joint: "Joint Observing Programs",
  };

  function params() {
    return new URLSearchParams(window.location.search);
  }

  function encode(value) {
    return encodeURIComponent(value || "");
  }

  function detailUrl(itemOrSelection) {
    const program = itemOrSelection.program || "GO";
    const cycle = itemOrSelection.cycle || "";
    const category = itemOrSelection.category || "";
    const key = itemOrSelection.key || "";
    const id = itemOrSelection.id || "";
    return `detail.html?program=${encode(program)}&cycle=${encode(cycle)}&category=${encode(category)}${key ? `&key=${encode(key)}` : id ? `&id=${encode(id)}` : ""}`;
  }

  function allUrl(selection) {
    const suffix = selection ? `?program=${encode(selection.program)}&cycle=${encode(selection.cycle)}&category=${encode(selection.category)}` : "";
    return `all.html${suffix}`;
  }

  function externalUrl(item) {
    return item.url || `https://www.stsci.edu/jwst/science-execution/program-information?id=${item.id}`;
  }

  function pdfUrl(item) {
    return item.pdfPath || "";
  }

  function programClass(program) {
    return String(program || "").toLowerCase();
  }

  function countBy(list, key) {
    const map = new Map();
    list.forEach((item) => {
      const value = item[key] || "Unspecified";
      map.set(value, (map.get(value) || 0) + 1);
    });
    return map;
  }

  function uniqueSorted(list, key) {
    return Array.from(new Set(list.map((item) => item[key] || "Unspecified"))).sort((a, b) => {
      const ac = Number(String(a).replace(/[^0-9]/g, ""));
      const bc = Number(String(b).replace(/[^0-9]/g, ""));
      if (!Number.isNaN(ac) && !Number.isNaN(bc) && ac !== bc) return ac - bc;
      return String(a).localeCompare(String(b));
    });
  }

  function selectedFromUrl() {
    const q = params();
    return {
      program: q.get("program") || "GO",
      cycle: q.get("cycle") || "Cycle 1",
      category: q.get("category") || "Galaxies",
      id: q.get("id") || "",
      key: q.get("key") || "",
    };
  }

  function normalizeSelection(selection) {
    const programItems = proposals.filter((item) => item.program === selection.program);
    if (!programItems.length) selection.program = "GO";
    const cycles = uniqueSorted(proposals.filter((item) => item.program === selection.program), "cycle");
    if (!cycles.includes(selection.cycle)) selection.cycle = cycles[0] || "";
    const cats = uniqueSorted(
      proposals.filter((item) => item.program === selection.program && item.cycle === selection.cycle),
      "category"
    );
    if (!cats.includes(selection.category)) selection.category = cats[0] || "";
    const list = filteredBySelection(selection);
    if (selection.key && !list.some((item) => item.key === selection.key)) selection.key = "";
    if (selection.id && !list.some((item) => item.id === selection.id)) selection.id = "";
    return selection;
  }

  function filteredBySelection(selection) {
    return proposals.filter(
      (item) =>
        item.program === selection.program &&
        item.cycle === selection.cycle &&
        item.category === selection.category
    );
  }

  function textMatch(item, query) {
    if (!query) return true;
    const haystack = `${item.id} ${item.title} ${item.pi} ${item.instrument} ${item.program} ${item.cycle} ${item.category}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  }

  function renderMetrics() {
    const total = proposals.length;
    const counts = countBy(proposals, "program");
    const root = document.querySelector("[data-metrics]");
    if (!root) return;
    root.innerHTML = `
      <div class="metric total"><div class="metric-number">${total}</div><div class="metric-label">Total</div></div>
      <div class="metric go"><div class="metric-number">${counts.get("GO") || 0}</div><div class="metric-label">GO · General Observer</div></div>
      <div class="metric ddt"><div class="metric-number">${counts.get("DDT") || 0}</div><div class="metric-label">DDT · Director's Discretionary</div></div>
      <div class="metric ers"><div class="metric-number">${counts.get("ERS") || 0}</div><div class="metric-label">ERS · Early Release Science</div></div>
      <div class="metric joint"><div class="metric-number">${counts.get("Joint") || 0}</div><div class="metric-label">Joint · Observing Programs</div></div>
    `;
  }

  function optionRow(label, count, active, onClick, strongPrefix) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `option-row${active ? " active" : ""}`;
    const title = document.createElement("span");
    title.className = "option-title";
    if (strongPrefix) {
      title.innerHTML = `<strong>${strongPrefix}</strong> ${label.replace(strongPrefix, "").trim()}`;
    } else {
      title.textContent = label;
    }
    const pill = document.createElement("span");
    pill.className = "count-pill";
    pill.textContent = count;
    const chevron = document.createElement("span");
    chevron.className = "chevron";
    chevron.textContent = "▶";
    button.append(title, pill, chevron);
    button.addEventListener("click", onClick);
    return button;
  }

  function renderSelector(selection, onChange) {
    const programList = document.querySelector("[data-program-list]");
    const cycleList = document.querySelector("[data-cycle-list]");
    const categoryList = document.querySelector("[data-category-list]");
    if (!programList || !cycleList || !categoryList) return;
    programList.innerHTML = "";
    cycleList.innerHTML = "";
    categoryList.innerHTML = "";

    const programCounts = countBy(proposals, "program");
    PROGRAM_ORDER.forEach((program) => {
      programList.append(
        optionRow(
          `${program} ${PROGRAM_LABELS[program]}`,
          programCounts.get(program) || 0,
          selection.program === program,
          () => {
            selection.program = program;
            selection.cycle = "";
            selection.category = "";
            normalizeSelection(selection);
            onChange();
          },
          program
        )
      );
    });

    const programItems = proposals.filter((item) => item.program === selection.program);
    const cycleCounts = countBy(programItems, "cycle");
    uniqueSorted(programItems, "cycle").forEach((cycle) => {
      cycleList.append(
        optionRow(cycle, cycleCounts.get(cycle) || 0, selection.cycle === cycle, () => {
          selection.cycle = cycle;
          selection.category = "";
          normalizeSelection(selection);
          onChange();
        })
      );
    });

    const cycleItems = programItems.filter((item) => item.cycle === selection.cycle);
    const categoryCounts = countBy(cycleItems, "category");
    uniqueSorted(cycleItems, "category").forEach((category) => {
      categoryList.append(
        optionRow(category, categoryCounts.get(category) || 0, selection.category === category, () => {
          selection.category = category;
          onChange();
        })
      );
    });
  }

  function renderCrumbs(selection) {
    const root = document.querySelector("[data-crumbs]");
    if (!root) return;
    root.innerHTML = `
      <span class="crumb">${selection.program}</span>
      <span class="crumb">${selection.cycle}</span>
      <span class="crumb">${selection.category}</span>
    `;
  }

  function rowHtml(item, includeDetail) {
    const pdf = pdfUrl(item);
    return `
      <tr>
        <td><a class="id-link" href="${externalUrl(item)}" target="_blank" rel="noreferrer">${item.id}</a></td>
        <td>${escapeHtml(item.title)}</td>
        <td>${escapeHtml(item.pi || item.piBlock || "")}</td>
        <td>${escapeHtml(item.instrument || "—")}</td>
        <td>${pdf ? `<a class="pdf-link" href="${pdf}" target="_blank">PDF</a>` : "—"}</td>
        ${includeDetail ? `<td><a class="detail-link" href="${detailUrl(item)}">Detail</a></td>` : ""}
        <td><span class="type-pill ${programClass(item.program)}">${item.program}</span></td>
      </tr>
    `;
  }

  function renderTable(root, list, includeDetail) {
    if (!root) return;
    if (!list.length) {
      root.innerHTML = `<div class="empty-state">No proposals match the current filters.</div>`;
      return;
    }
    root.innerHTML = `
      <table>
        <thead>
          <tr>
            <th style="width:86px">ID</th>
            <th>Title</th>
            <th style="width:260px">PI</th>
            <th style="width:290px">Instrument</th>
            <th style="width:92px">PDF</th>
            ${includeDetail ? `<th style="width:110px">Detail</th>` : ""}
            <th style="width:90px">Type</th>
          </tr>
        </thead>
        <tbody>${list.map((item) => rowHtml(item, includeDetail)).join("")}</tbody>
      </table>
    `;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function initHome() {
    const page = document.querySelector("[data-page='home']");
    if (!page) return;
    renderMetrics();
    const selection = normalizeSelection(selectedFromUrl());
    const search = document.querySelector("[data-search]");
    const count = document.querySelector("[data-result-count]");
    const table = document.querySelector("[data-table]");
    const detailButton = document.querySelector("[data-go-detail]");
    const allButton = document.querySelector("[data-go-all]");

    function refresh() {
      renderSelector(selection, refresh);
      renderCrumbs(selection);
      const query = search ? search.value.trim() : "";
      const list = filteredBySelection(selection).filter((item) => textMatch(item, query));
      if (count) count.textContent = `${list.length} proposals`;
      renderTable(table, list, false);
      if (detailButton) detailButton.href = detailUrl(selection);
      if (allButton) allButton.href = allUrl(selection);
    }

    if (search) search.addEventListener("input", refresh);
    refresh();
  }

  function initDetail() {
    const page = document.querySelector("[data-page='detail']");
    if (!page) return;
    const selection = normalizeSelection(selectedFromUrl());
    const selectedItem =
      (selection.key && byKey.get(selection.key)) ||
      (selection.id && filteredBySelection(selection).find((item) => item.id === selection.id)) ||
      filteredBySelection(selection)[0] ||
      proposals[0];
    if (selectedItem) {
      selection.program = selectedItem.program;
      selection.cycle = selectedItem.cycle;
      selection.category = selectedItem.category;
      selection.id = selectedItem.id;
      selection.key = selectedItem.key;
    }

    const categoryTitle = document.querySelector("[data-category-title]");
    const categoryMeta = document.querySelector("[data-category-meta]");
    const listRoot = document.querySelector("[data-detail-list]");
    const panel = document.querySelector("[data-detail-panel]");
    const back = document.querySelector("[data-back-home]");
    const all = document.querySelector("[data-back-all]");
    if (back) back.href = `index.html?program=${encode(selection.program)}&cycle=${encode(selection.cycle)}&category=${encode(selection.category)}`;
    if (all) all.href = allUrl(selection);

    const list = filteredBySelection(selection);
    if (categoryTitle) categoryTitle.textContent = selection.category;
    if (categoryMeta) categoryMeta.textContent = `${selection.program} · ${selection.cycle} · ${list.length} proposals`;
    if (listRoot) {
      listRoot.innerHTML = list
        .map(
          (item) => `
            <button class="proposal-item${item.key === selection.key ? " active" : ""}" type="button" data-detail-key="${escapeHtml(item.key)}">
              <span class="proposal-item-id">#${item.id}</span>
              <span class="proposal-item-title">${escapeHtml(item.title)}</span>
            </button>
          `
        )
        .join("");
      listRoot.querySelectorAll("[data-detail-key]").forEach((button) => {
        button.addEventListener("click", () => {
          const item = byKey.get(button.getAttribute("data-detail-key"));
          if (item) window.location.href = detailUrl(item);
        });
      });
    }

    if (!selectedItem || !panel) return;
    const pdf = pdfUrl(selectedItem);
    panel.innerHTML = `
      <div class="hero-card">
        <div class="hero-tags">
          <span class="type-pill ${programClass(selectedItem.program)}">${selectedItem.program}</span>
          <span class="small-pill blue">#${selectedItem.id}</span>
          <span class="small-pill">${escapeHtml(selectedItem.cycle)}</span>
        </div>
        <h1 class="detail-title">${escapeHtml(selectedItem.title)}</h1>
        <div class="meta-grid">
          <div class="meta-box"><div class="meta-label">PI / Co-PI</div><div class="meta-value">${escapeHtml(selectedItem.piBlock || selectedItem.pi || "—")}</div></div>
          <div class="meta-box"><div class="meta-label">Instrument</div><div class="meta-value">${escapeHtml(selectedItem.instrument || "—")}</div></div>
          <div class="meta-box"><div class="meta-label">Category</div><div class="meta-value">${escapeHtml(selectedItem.category)}</div></div>
        </div>
      </div>
      <div class="detail-actions">
        <a class="btn green" href="${externalUrl(selectedItem)}" target="_blank" rel="noreferrer">Open JWST Proposal</a>
        ${pdf ? `<a class="btn rose" href="${pdf}" target="_blank">Open Local PDF</a>` : `<span class="btn ghost">PDF unavailable</span>`}
      </div>
      <div class="text-sections">
        <section class="text-card warm"><h3>English Abstract</h3><p>${escapeHtml(selectedItem.abstractEn || "N/A")}</p></section>
        <section class="text-card cool"><h3>中文摘要</h3><p>${escapeHtml(selectedItem.abstractZh || "未提供")}</p></section>
        <section class="text-card warm"><h3>English Observing Description</h3><p>${escapeHtml(selectedItem.observingEn || "N/A")}</p></section>
        <section class="text-card cool"><h3>中文观测描述</h3><p>${escapeHtml(selectedItem.observingZh || "未提供")}</p></section>
      </div>
    `;
  }

  function initAll() {
    const page = document.querySelector("[data-page='all']");
    if (!page) return;
    const q = params();
    const idInput = document.querySelector("[data-id-search]");
    const instrumentSelect = document.querySelector("[data-instrument-filter]");
    const count = document.querySelector("[data-all-count]");
    const table = document.querySelector("[data-all-table]");
    const back = document.querySelector("[data-home-link]");
    if (back) {
      const sel = selectedFromUrl();
      back.href = `index.html?program=${encode(sel.program)}&cycle=${encode(sel.cycle)}&category=${encode(sel.category)}`;
    }

    const instruments = Array.from(
      new Set(
        proposals
          .flatMap((item) => String(item.instrument || "").split(/\s+/))
          .map((item) => item.trim())
          .filter(Boolean)
      )
    ).sort();
    if (instrumentSelect) {
      instrumentSelect.innerHTML = `<option value="">All instruments</option>${instruments
        .map((instrument) => `<option value="${escapeHtml(instrument)}">${escapeHtml(instrument)}</option>`)
        .join("")}`;
    }

    if (idInput && q.get("id")) idInput.value = q.get("id");
    if (instrumentSelect && q.get("instrument")) instrumentSelect.value = q.get("instrument");

    function refresh() {
      const idQuery = idInput ? idInput.value.trim() : "";
      const instrument = instrumentSelect ? instrumentSelect.value : "";
      const list = proposals.filter((item) => {
        const okId = !idQuery || item.id.includes(idQuery) || item.title.toLowerCase().includes(idQuery.toLowerCase());
        const okInst = !instrument || String(item.instrument || "").includes(instrument);
        return okId && okInst;
      });
      if (count) count.textContent = `${list.length} proposals`;
      renderTable(table, list, true);
    }

    if (idInput) idInput.addEventListener("input", refresh);
    if (instrumentSelect) instrumentSelect.addEventListener("change", refresh);
    refresh();
  }

  document.addEventListener("DOMContentLoaded", () => {
    initHome();
    initDetail();
    initAll();
  });
})();
