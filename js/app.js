/* Anatomia: Revisão
 * App de página única sem dependências. Os dados vêm de dados-teoria.js e dados-alfinetes.js.
 * O progresso é salvo no localStorage do navegador.
 */
(function () {
  "use strict";

  const SIS = window.SISTEMAS;
  const SIS_IDS = Object.keys(SIS);
  const IMAGENS = window.DADOS_ALFINETES || [];
  const app = document.getElementById("app");

  // ───────────────────────── Utilidades ─────────────────────────
  const $ = (sel, el = document) => el.querySelector(sel);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const embaralhar = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const hash = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
  const agora = () => Date.now();
  const MIN = 60 * 1000;

  // Normalização para corrigir respostas digitadas
  function norm(s) {
    return String(s).toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[-–—/]/g, " ")
      .replace(/[^a-z0-9 ]/g, " ")
      .replace(/\b(o|a|os|as|do|da|dos|das|de|e)\b/g, " ")
      .split(/\s+/).filter(Boolean)
      .map((w) => (w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w))
      .join(" ");
  }
  function lev(a, b) {
    if (a === b) return 0;
    const m = a.length, n = b.length;
    if (!m) return n; if (!n) return m;
    let prev = Array.from({ length: n + 1 }, (_, i) => i);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[n];
  }
  function variantes(pin) {
    const v = new Set();
    const add = (s) => { const n = norm(s); if (n) v.add(n); };
    add(pin.a);
    add(pin.a.replace(/\(.*?\)/g, ""));                 // sem o parêntese
    const par = pin.a.match(/\((.*?)\)/); if (par) add(par[1]); // só o parêntese
    (pin.alts || []).forEach(add);
    Array.from(v).forEach((x) => { // aceita sem "nervo", "musculo", "glandula"
      const sem = x.replace(/^(nervo|musculo|glandula|celula)\s+/, ""); if (sem && sem !== x) v.add(sem);
    });
    return Array.from(v);
  }
  // Retorna "certo", "quase" (erro de grafia) ou "errado"
  function corrigir(digitado, pin) {
    const d = norm(digitado);
    if (!d) return "errado";
    const vs = variantes(pin);
    if (vs.includes(d)) return "certo";
    const semPrefixo = d.replace(/^(nervo|musculo|glandula|celula)\s+/, "");
    if (vs.includes(semPrefixo)) return "certo";
    for (const v of vs) if (parecido(d, v) || parecido(semPrefixo, v)) return "quase";
    return "errado";
  }
  // Termos que mudam o sentido: precisam estar escritos exatamente (sem tolerância)
  const CRITICAS = new Set(["direito", "direita", "esquerdo", "esquerda", "superior", "inferior", "medio", "anterior", "posterior",
    "lateral", "medial", "interno", "interna", "externo", "externa", "maior", "menor", "aferente", "eferente", "proximal", "distal",
    "parietal", "visceral", "ascendente", "descendente", "pre", "po", "pos", "alfa", "beta", "fibroso", "seroso"]);
  // Erro de grafia: mesmo número de palavras, cada palavra com até 1 ou 2 letras diferentes
  function parecido(d, v) {
    const a = d.split(" "), b = v.split(" ");
    if (a.length !== b.length) return false;
    return b.every((w, k) => {
      if (CRITICAS.has(w) || CRITICAS.has(a[k])) return w === a[k];
      const tol = w.length <= 4 ? 0 : w.length <= 7 ? 1 : 2;
      return lev(a[k], w) <= tol;
    });
  }

  // ───────────────────────── Progresso (localStorage) ─────────────────────────
  const CHAVE = "anatomia-revisao-v1";
  let estado = { sel: SIS_IDS.slice(), itens: {} };
  try { const s = JSON.parse(localStorage.getItem(CHAVE)); if (s && s.itens) estado = Object.assign(estado, s); } catch (e) { /* sem storage */ }
  estado.sel = (estado.sel || []).filter((s) => SIS[s]);
  if (!estado.sel.length) estado.sel = SIS_IDS.slice();
  function salvar() { try { localStorage.setItem(CHAVE, JSON.stringify(estado)); } catch (e) { /* ignora */ } }

  // Caixas de Leitner: intervalo até a próxima revisão
  const INTERVALOS = [0, 2 * MIN, 15 * MIN, 2 * 60 * MIN, 12 * 60 * MIN, 36 * 60 * MIN];
  function item(k) { return estado.itens[k] || null; }
  function registrar(k, nota) { // nota: 0 errei, 1 difícil, 2 acertei/fácil
    const it = estado.itens[k] || { b: 0, ok: 0, err: 0, d: 0 };
    if (nota === 0) { it.b = 1; it.err++; }
    else if (nota === 1) { it.b = Math.max(1, it.b); it.ok++; }
    else { it.b = Math.min(5, it.b + 1); it.ok++; }
    it.d = agora() + INTERVALOS[it.b];
    it.t = agora();
    estado.itens[k] = it;
    salvar();
  }
  const dominado = (k) => { const it = item(k); return it && it.b >= 3; };

  // ───────────────────────── Itens de estudo ─────────────────────────
  const PINS = [];
  IMAGENS.forEach((img) => img.pins.forEach((p) => PINS.push({ k: "p:" + img.id + ":" + p.n, img, pin: p, s: img.sys })));
  const CARDS = window.CARDS.map((c) => Object.assign({ k: "c:" + hash(c.q) }, c));
  const VFS = window.VF.map((v) => Object.assign({ k: "v:" + hash(v.t) }, v));
  const SEQS = window.SEQUENCIAS.map((v) => Object.assign({ k: "s:" + hash(v.t) }, v));
  const LIGS = window.LIGAR.map((v) => Object.assign({ k: "l:" + hash(v.t) }, v));
  const sel = (arr) => arr.filter((x) => estado.sel.includes(x.s));

  // Escolhe os próximos itens: primeiro os vencidos (mais errados antes), depois os novos, depois o resto.
  function escolher(lista, n) {
    const t = agora();
    const vencidos = [], novos = [], resto = [];
    lista.forEach((x) => { const it = item(x.k); if (!it) novos.push(x); else if (it.d <= t) vencidos.push(x); else resto.push(x); });
    vencidos.sort((a, b) => (item(a.k).b - item(b.k).b) || (item(b.k).err - item(a.k).err));
    resto.sort((a, b) => item(a.k).d - item(b.k).d);
    return vencidos.concat(embaralhar(novos), resto).slice(0, n);
  }

  // ───────────────────────── Filtro de sistemas ─────────────────────────
  function desenharFiltro(visivel) {
    const f = document.getElementById("filtro");
    if (!visivel) { f.innerHTML = ""; return; }
    f.innerHTML = '<span class="rot">Sistemas:</span>' + SIS_IDS.map((id) =>
      `<button class="chip ${estado.sel.includes(id) ? "on" : ""}" data-s="${id}" style="--c:${SIS[id].cor}"><span class="bola"></span>${SIS[id].nome}</button>`
    ).join("") + '<button class="chip" data-s="*" style="--c:var(--muted)">todos</button>';
    f.onclick = (e) => {
      const b = e.target.closest("[data-s]"); if (!b) return;
      const id = b.dataset.s;
      if (id === "*") estado.sel = SIS_IDS.slice();
      else if (estado.sel.includes(id)) { if (estado.sel.length > 1) estado.sel = estado.sel.filter((x) => x !== id); }
      else estado.sel.push(id);
      salvar(); rota();
    };
  }
  const chipSis = (s) => `<span class="chip mini on" style="--c:${SIS[s].cor}"><span class="bola"></span>${SIS[s].nome}</span>`;

  // ───────────────────────── Roteamento ─────────────────────────
  let limpar = null; // remove listeners de teclado da tela anterior
  function rota() {
    if (limpar) { limpar(); limpar = null; }
    const [r, arg] = (location.hash.slice(1) || "inicio").split("/");
    document.querySelectorAll("#menu a").forEach((a) => a.classList.toggle("ativo", a.dataset.r === r));
    const telas = { inicio, aprender, alfinete, explorar, flash, quiz, simulado, erros };
    const fn = telas[r] || inicio;
    const resto = location.hash.slice(1).split("/").slice(1).map(decodeURIComponent);
    desenharFiltro(!(r === "aprender" && resto.length > 1));
    fn(arg ? decodeURIComponent(arg) : undefined, resto[1]);
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", rota);
  function teclas(fn) { document.addEventListener("keydown", fn); limpar = () => document.removeEventListener("keydown", fn); }

  // ───────────────────────── INÍCIO ─────────────────────────
  function inicio() {
    const linhas = SIS_IDS.map((s) => {
      const ks = PINS.filter((p) => p.s === s).map((p) => p.k).concat(CARDS.filter((c) => c.s === s).map((c) => c.k));
      const pct = ks.length ? Math.round(100 * ks.filter(dominado).length / ks.length) : 0;
      return `<span>${SIS[s].nome}</span><div class="barra" style="--c:${SIS[s].cor}"><i style="width:${pct}%"></i></div><b>${pct}%</b>`;
    }).join("");
    const totErros = Object.values(estado.itens).filter((i) => i.err > i.ok / 2 && i.err > 0).length;
    const nSel = sel(PINS).length, cSel = sel(CARDS).length;
    app.innerHTML = `
      <h1>Bora revisar anatomia</h1>
      <p class="sub">${PINS.length} alfinetes em ${IMAGENS.length} imagens · ${CARDS.length} flashcards · ${VFS.length} pegadinhas V/F · ${SEQS.length} sequências · ${LIGS.length} exercícios de ligar.
      Use os botões de sistema acima para escolher o que estudar (agora: ${nSel} alfinetes e ${cSel} cards).</p>
      <div class="grade">
        <a class="cartao modo destaque" href="#aprender"><span class="ico">📖</span><b>Aprender (comece aqui)</b><span>Aulas curtas por tema: resumo + macete, tour guiado na imagem e 3 perguntas para checar. ${pctAprendido()}% concluído.</span></a>
        <a class="cartao modo" href="#alfinete"><span class="ico">📍</span><b>Modo Alfinete</b><span>Como na prova prática: a legenda some e você digita o nome da estrutura.</span></a>
        <a class="cartao modo" href="#explorar"><span class="ico">🗺️</span><b>Atlas</b><span>Veja cada imagem, clique nas tarjas para revelar e teste uma imagem específica.</span></a>
        <a class="cartao modo" href="#flash"><span class="ico">🃏</span><b>Flashcards</b><span>Repetição espaçada: o que você erra volta mais vezes, o que é fácil some.</span></a>
        <a class="cartao modo" href="#quiz"><span class="ico">🧠</span><b>Quiz</b><span>Múltipla escolha, verdadeiro ou falso (pegadinhas), sequências e ligar colunas.</span></a>
        <a class="cartao modo" href="#simulado"><span class="ico">📝</span><b>Simulado</b><span>Mistura de alfinetes, múltipla escolha e V/F com nota no final.</span></a>
        <a class="cartao modo" href="#erros"><span class="ico">🎯</span><b>Meus erros</b><span>${totErros ? totErros + " itens para reforçar." : "Tudo que você errar aparece aqui."}</span></a>
      </div>
      <div class="duas mt">
        <div class="cartao">
          <h2>Seu domínio por sistema</h2>
          <p class="muted peq">Conta como dominado o alfinete ou card que você acertou 3 vezes seguidas.</p>
          <div class="prog-sis">${linhas}</div>
        </div>
        <div class="cartao">
          <h2>Plano para 3 dias</h2>
          <ol class="plano">
            <li><b>Dia 1:</b> modo Aprender em todos os sistemas (cada aula leva uns 5 min) + uma rodada de flashcards.</li>
            <li><b>Dia 2:</b> Modo Alfinete, um sistema por vez, + Quiz de V/F (pegadinhas) e ligar colunas.</li>
            <li><b>Dia 3:</b> "Meus erros" até zerar + 2 simulados com todos os sistemas.</li>
          </ol>
          <p class="muted peq">Dica: na prática, escreva o nome completo e com o lado (ex.: "artéria subclávia <u>esquerda</u>").</p>
        </div>
      </div>
      <div class="linha mt">
        <span class="espaco"></span>
        <button class="btn sm" id="zerar">Zerar meu progresso</button>
      </div>`;
    $("#zerar").onclick = () => {
      if (confirm("Apagar todo o progresso salvo neste navegador?")) { estado.itens = {}; estado.aprendido = {}; salvar(); rota(); }
    };
  }

  // ───────────────────────── APRENDER ─────────────────────────
  const AULAS = window.APRENDER || {};
  if (!estado.aprendido) estado.aprendido = {};
  const totalAulas = () => SIS_IDS.reduce((n, s) => n + (AULAS[s] || []).length, 0);
  const pctAprendido = () => { const t = totalAulas(); return t ? Math.round(100 * Object.keys(estado.aprendido).length / t) : 0; };
  function cardsDaAula(s, aula) {
    const kws = (aula.kw || []).map(norm).filter(Boolean);
    const achados = CARDS.filter((c) => c.s === s && kws.some((k) => (" " + norm(c.q) + " ").includes(" " + k)));
    return embaralhar(achados.length >= 3 ? achados : achados.concat(embaralhar(CARDS.filter((c) => c.s === s && !achados.includes(c))))).slice(0, 3);
  }

  function aprender(s, idx) {
    if (!s || !AULAS[s]) {
      app.innerHTML = `<h1>📖 Aprender</h1>
        <p class="sub">Antes de testar, aprenda. Cada aula tem 3 passos: <b>1) Entender</b> (resumo do slide + macete), <b>2) Ver na imagem</b> (os nomes aparecem um por um na figura) e <b>3) Checar</b> (3 perguntas rápidas). Leva uns 5 minutos.</p>` +
        SIS_IDS.filter((x) => estado.sel.includes(x) && AULAS[x]).map((x) => {
          const aulas = AULAS[x]; const feitas = aulas.filter((_, k) => estado.aprendido[x + ":" + k]).length;
          const prox = aulas.findIndex((_, k) => !estado.aprendido[x + ":" + k]);
          return `<div class="cartao mt">
            <div class="linha"><h2 style="margin:0;color:${SIS[x].cor}">${SIS[x].nome}</h2><span class="muted peq">Aula ${SIS[x].aula} · ${feitas}/${aulas.length} concluídas</span><span class="espaco"></span>
              <a class="btn sm pri" href="#aprender/${x}/${prox >= 0 ? prox : 0}">${feitas === 0 ? "Começar" : prox >= 0 ? "Continuar" : "Rever"}</a></div>
            <div class="barra mt" style="--c:${SIS[x].cor}"><i style="width:${Math.round(100 * feitas / aulas.length)}%"></i></div>
            <ol class="aulas">${aulas.map((a, k) => `<li class="${estado.aprendido[x + ":" + k] ? "feita" : ""}"><a href="#aprender/${x}/${k}">${esc(a.t)}</a>${estado.aprendido[x + ":" + k] ? " ✓" : ""}</li>`).join("")}</ol>
          </div>`;
        }).join("");
      return;
    }
    const aulas = AULAS[s];
    const i = Math.min(Math.max(0, +idx || 0), aulas.length - 1);
    const aula = aulas[i];
    const img = aula.img ? IMAGENS.find((x) => x.id === aula.img) : null;
    const PASSOS = img ? ["Entender", "Ver na imagem", "Checar"] : ["Entender", "Checar"];
    let passo = 0, tour = -1;

    function moldura(corpo) {
      app.innerHTML = `
        <div class="linha" style="margin-bottom:8px"><a class="btn sm" href="#aprender">← Aulas</a>${chipSis(s)}<span class="muted peq">Etapa ${i + 1} de ${aulas.length}</span></div>
        <h1>${esc(aula.t)}</h1>
        <div class="passos">${PASSOS.map((p, k) => `<button class="passo ${k === passo ? "on" : ""} ${k < passo ? "ok" : ""}" data-p="${k}"><span>${k + 1}</span>${p}</button>`).join("")}</div>
        ${corpo}`;
      app.querySelectorAll(".passo").forEach((b) => (b.onclick = () => { passo = +b.dataset.p; desenha(); }));
    }
    function desenha() {
      const nome = PASSOS[passo];
      if (nome === "Entender") {
        moldura(`<div class="cartao aula-texto"><ul>${aula.p.map((x) => `<li>${x}</li>`).join("")}</ul>
          <div class="macete"><b>💡 Macete:</b> ${aula.m}</div></div>
          <div class="linha mt"><span class="espaco"></span><button class="btn pri" id="seg">${img ? "Ver na imagem →" : "Checar →"}</button></div>`);
        $("#seg").onclick = () => { passo++; desenha(); };
      } else if (nome === "Ver na imagem") {
        moldura(`<p class="muted">Clique em <b>Próximo nome</b> para ir revelando as estruturas uma a uma. Depois esconda tudo e tente lembrar clicando nas tarjas.</p>
          <div class="linha" style="margin-bottom:10px">
            <button class="btn sm" id="ant">◀ Anterior</button><button class="btn sm pri" id="prox">Próximo nome ▶</button>
            <span class="muted peq" id="cont"></span><span class="espaco"></span>
            <button class="btn sm" id="todos">Revelar todos</button><button class="btn sm" id="esconder">Esconder e tentar lembrar</button></div>
          ${htmlFigura(img)}
          <div class="fb ok mt" id="nomeAtual" style="display:none"></div>
          <div class="linha mt"><button class="btn" id="volta">← Resumo</button><span class="espaco"></span><button class="btn pri" id="seg">Checar →</button></div>`);
        const fig = $(".figura");
        const mostra = () => {
          fig.querySelectorAll(".pin").forEach((el) => { el.classList.remove("atual", "revelado"); el.querySelector(".txt").textContent = ""; });
          img.pins.forEach((p, k) => { if (k <= tour) revelar(pinEl(fig, p.n), p.a); });
          const atual = img.pins[tour];
          $("#cont").textContent = tour >= 0 ? `${tour + 1}/${img.pins.length}` : `${img.pins.length} estruturas`;
          const na = $("#nomeAtual");
          if (atual) { const el = pinEl(fig, atual.n); el.classList.add("atual"); el.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" }); na.style.display = ""; na.innerHTML = `${atual.n}. ${esc(atual.a)}`; }
          else na.style.display = "none";
          $("#ant").disabled = tour < 0; $("#prox").disabled = tour >= img.pins.length - 1;
        };
        $("#prox").onclick = () => { tour = Math.min(img.pins.length - 1, tour + 1); mostra(); };
        $("#ant").onclick = () => { tour = Math.max(-1, tour - 1); mostra(); };
        $("#todos").onclick = () => { tour = img.pins.length - 1; mostra(); fig.querySelector(".atual") && fig.querySelector(".atual").classList.remove("atual"); };
        $("#esconder").onclick = () => { tour = -1; mostra(); };
        fig.addEventListener("click", (e) => {
          const p = e.target.closest(".pin"); if (!p) return;
          const pin = img.pins.find((x) => x.n === +p.dataset.n);
          if (p.classList.contains("revelado")) { p.classList.remove("revelado", "atual"); p.querySelector(".txt").textContent = ""; } else revelar(p, pin.a);
        });
        $("#volta").onclick = () => { passo--; desenha(); };
        $("#seg").onclick = () => { passo++; desenha(); };
        mostra();
      } else {
        const qs = cardsDaAula(s, aula);
        let q = 0, acertos = 0;
        const telaQ = () => {
          if (q >= qs.length) {
            estado.aprendido[s + ":" + i] = true; salvar();
            const temProx = i + 1 < aulas.length;
            moldura(`<div class="cartao"><h2>${acertos === qs.length ? "Mandou bem! 🎉" : "Etapa concluída"}</h2>
              <p>Você acertou <b>${acertos}/${qs.length}</b>. ${acertos < qs.length ? "Se quiser, releia o resumo antes de seguir." : ""}</p>
              <div class="linha mt"><button class="btn" id="rever">Rever resumo</button><span class="espaco"></span>
              ${temProx ? `<a class="btn pri" href="#aprender/${s}/${i + 1}">Próxima etapa →</a>` : `<a class="btn pri" href="#alfinete">Terminei ${SIS[s].nome}: ir para os alfinetes →</a>`}</div></div>`);
            $("#rever").onclick = () => { passo = 0; desenha(); };
            return;
          }
          const c = qs[q]; const ops = geraMC(c);
          moldura(`<div class="cartao"><p class="muted peq">Pergunta ${q + 1} de ${qs.length}</p><div class="pergunta">${esc(c.q)}</div>
            <div class="opcoes mt">${ops.map((o, k) => `<button class="opcao" data-k="${k}"><b>${"ABCD"[k]})</b> ${esc(o)}</button>`).join("")}</div><div id="fb" class="mt"></div></div>`);
          app.querySelectorAll(".opcao").forEach((b) => (b.onclick = () => {
            const certo = ops[+b.dataset.k] === c.a;
            app.querySelectorAll(".opcao").forEach((x) => { x.disabled = true; if (ops[+x.dataset.k] === c.a) x.classList.add("certa"); });
            if (!certo) b.classList.add("errada"); else acertos++;
            registrar(c.k, certo ? 2 : 0);
            $("#fb").innerHTML = `<button class="btn pri" id="pq">Continuar →</button>`;
            $("#pq").onclick = () => { q++; telaQ(); };
          }));
        };
        telaQ();
      }
    }
    desenha();
  }

  // ───────────────────────── Figura com tarjas ─────────────────────────
  function htmlFigura(img, opts = {}) {
    const masks = img.masks.map((m) => `<div class="mask" style="left:${m[0]}%;top:${m[1]}%;width:${m[2]}%;height:${m[3]}%"></div>`).join("");
    const pins = img.pins.map((p) => {
      const b = p.box;
      return `<div class="pin" data-n="${p.n}" style="left:${b[0]}%;top:${b[1]}%;width:${b[2]}%;height:${b[3]}%" title="Alfinete ${p.n}"><span class="num">${p.n}</span><span class="txt"></span></div>`;
    }).join("");
    return `<div class="figura-scroll"><div class="figura ${opts.zoom ? "zoom" : ""}"><img src="${img.img}" alt="${esc(img.t)}" width="${img.w}" height="${img.h}">${masks}${pins}</div></div>`;
  }
  function pinEl(root, n) { return root.querySelector(`.pin[data-n="${n}"]`); }
  function revelar(el, texto, classe) {
    el.querySelector(".txt").textContent = texto;
    el.classList.add("revelado"); if (classe) el.classList.add(classe);
  }

  // ───────────────────────── MODO ALFINETE ─────────────────────────
  let tamSessao = 20;
  function alfinete(arg) {
    let fila;
    let titulo = "Modo Alfinete";
    if (arg && arg.startsWith("img:")) {
      const id = arg.slice(4);
      fila = embaralhar(PINS.filter((p) => p.img.id === id));
      titulo = "Testando: " + (fila[0] ? fila[0].img.t : "");
    } else if (arg === "erros") {
      fila = embaralhar(PINS.filter((p) => { const it = item(p.k); return it && it.err > 0 && it.b < 3; }));
      titulo = "Treinando meus erros";
    } else {
      const disp = sel(PINS);
      if (!disp.length) { app.innerHTML = `<div class="vazio">Nenhum alfinete nos sistemas escolhidos.</div>`; return; }
      app.innerHTML = `
        <h1>📍 Modo Alfinete</h1>
        <p class="sub">Igual à prova prática: aparece uma imagem com as legendas escondidas e um alfinete piscando em vermelho. Digite o nome da estrutura.
        A correção ignora acentos e maiúsculas, e avisa quando é só erro de grafia.</p>
        <div class="cartao">
          <h3>Quantos alfinetes nesta rodada?</h3>
          <div class="seg" id="tam">${[10, 20, 40, 80].map((n) => `<button data-n="${n}" class="${n === tamSessao ? "on" : ""}">${n}</button>`).join("")}</div>
          <p class="muted peq mt">Disponíveis nos sistemas escolhidos: ${disp.length} alfinetes em ${new Set(disp.map((p) => p.img.id)).size} imagens.
          Os que você errou e os que estão vencidos vêm primeiro.</p>
          <button class="btn pri mt" id="comecar">Começar</button>
        </div>`;
      $("#tam").onclick = (e) => { const b = e.target.closest("button"); if (!b) return; tamSessao = +b.dataset.n; $("#tam").querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b)); };
      $("#comecar").onclick = () => sessaoAlfinete(escolher(disp, tamSessao), "Modo Alfinete");
      return;
    }
    if (!fila.length) { app.innerHTML = `<div class="vazio">Nada para treinar aqui ainda. 🎉</div>`; return; }
    sessaoAlfinete(fila, titulo);
  }

  function sessaoAlfinete(fila, titulo, aoFim) {
    let i = 0, certos = 0, quase = 0, errados = 0, zoom = false, respondido = false;
    const erros = [];
    function tela() {
      const atual = fila[i];
      const img = atual.img;
      respondido = false;
      app.innerHTML = `
        <div class="linha" style="margin-bottom:10px">
          <h2 style="margin:0">${esc(titulo)}</h2> ${chipSis(img.sys)}
          <span class="espaco"></span>
          <div class="placar"><span><b>${i + 1}</b>/${fila.length}</span><span>✓ <b>${certos}</b></span><span>≈ <b>${quase}</b></span><span>✗ <b>${errados}</b></span></div>
        </div>
        <div class="alf-wrap">
          <div>
            ${htmlFigura(img, { zoom })}
            <div class="linha mt peq muted"><span>${esc(img.t)} · Aula ${img.id.split("_")[0]}, slide ${+img.id.split("_")[1]}</span><span class="espaco"></span>
              <button class="btn sm" id="zoom">${zoom ? "Reduzir" : "Ampliar"}</button></div>
          </div>
          <div class="painel">
            <div class="cartao">
              <div class="pergunta">Qual estrutura está no alfinete <span style="color:#dc2626">${atual.pin.n}</span>?</div>
              <input class="resposta-input mt" id="resp" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Digite o nome…">
              <div class="linha mt">
                <button class="btn pri" id="ok">Responder</button>
                <button class="btn" id="naosei">Não sei</button>
              </div>
              <div id="fb" class="mt"></div>
              <p class="kbd mt"><kbd>Enter</kbd> responde e avança</p>
            </div>
            <button class="btn sm" id="sair">Encerrar rodada</button>
          </div>
        </div>`;
      const fig = $(".figura");
      const el = pinEl(fig, atual.pin.n);
      el.classList.add("atual");
      setTimeout(() => el.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" }), 50);
      const inp = $("#resp"); inp.focus({ preventScroll: true });
      $("#ok").onclick = () => responder(inp.value);
      $("#naosei").onclick = () => responder("");
      $("#zoom").onclick = () => { zoom = !zoom; fig.classList.toggle("zoom", zoom); $("#zoom").textContent = zoom ? "Reduzir" : "Ampliar"; };
      $("#sair").onclick = () => fim();
      fig.addEventListener("click", (e) => { // depois de responder, clicar revela os outros
        const p = e.target.closest(".pin"); if (!p || !respondido) return;
        const pin = img.pins.find((x) => x.n === +p.dataset.n); revelar(p, pin.a);
      });
    }
    function responder(txt) {
      if (respondido) { proximo(); return; }
      respondido = true;
      const atual = fila[i];
      const r = corrigir(txt, atual.pin);
      const el = pinEl($(".figura"), atual.pin.n);
      el.classList.remove("atual");
      const fb = $("#fb");
      if (r === "certo") { certos++; registrar(atual.k, 2); revelar(el, atual.pin.a, "certo"); fb.innerHTML = `<div class="fb ok">✓ Correto!<small>${esc(atual.pin.a)}</small></div>`; }
      else if (r === "quase") { quase++; registrar(atual.k, 1); revelar(el, atual.pin.a, "certo"); fb.innerHTML = `<div class="fb warn">≈ Quase! Confira a grafia:<small><b>${esc(atual.pin.a)}</b> (você escreveu "${esc(txt)}")</small></div>`; }
      else { errados++; registrar(atual.k, 0); erros.push({ p: atual, txt }); revelar(el, atual.pin.a, "errado"); fb.innerHTML = `<div class="fb bad">✗ ${txt ? "Errado" : "Resposta"}: ${esc(atual.pin.a)}${txt ? `<small>Você escreveu "${esc(txt)}"</small>` : ""}</div>`; }
      $("#ok").textContent = i + 1 < fila.length ? "Próximo →" : "Ver resultado";
      $("#naosei").disabled = true;
      $("#resp").disabled = true;
      fb.insertAdjacentHTML("beforeend", `<p class="muted peq">Dica: clique nas outras tarjas para revelar.</p>`);
      $("#ok").focus({ preventScroll: true });
    }
    function proximo() { i++; if (i < fila.length) tela(); else fim(); }
    function fim() {
      if (aoFim) { aoFim({ certos, quase, errados, erros }); return; }
      const total = certos + quase + errados;
      const pct = total ? Math.round(100 * (certos + quase) / total) : 0;
      app.innerHTML = `
        <div class="cartao" style="max-width:760px;margin:0 auto">
          <h1>Fim da rodada</h1>
          <div class="linha"><div class="resultado-num">${pct}%</div><div class="muted">✓ ${certos} certos · ≈ ${quase} quase · ✗ ${errados} errados</div></div>
          ${erros.length ? `<h3 class="mt">Revise estes:</h3><div class="lista-erros">${erros.map((e) => `
            <div class="erro-item"><img src="${e.p.img.img}" alt=""><div class="det"><b>${esc(e.p.pin.a)}</b><span class="muted peq">${esc(e.p.img.t)} · alfinete ${e.p.pin.n}${e.txt ? ` · você: "${esc(e.txt)}"` : ""}</span></div></div>`).join("")}</div>` : `<p class="mt">Nenhum erro, mandou bem! 🎉</p>`}
          <div class="linha mt"><a class="btn pri" href="#alfinete" id="denovo">Nova rodada</a>${erros.length ? `<a class="btn" href="#alfinete/erros">Treinar meus erros</a>` : ""}<a class="btn" href="#inicio">Início</a></div>
        </div>`;
      $("#denovo").onclick = (e) => { e.preventDefault(); if (location.hash === "#alfinete") rota(); else location.hash = "#alfinete"; };
    }
    teclas((e) => {
      if (e.key === "Enter") { e.preventDefault(); if (!document.getElementById("resp")) return; responder($("#resp").value); }
    });
    tela();
  }

  // ───────────────────────── ATLAS ─────────────────────────
  function explorar(id) {
    if (id) {
      const img = IMAGENS.find((x) => x.id === id);
      if (!img) { location.hash = "#explorar"; return; }
      app.innerHTML = `
        <div class="linha" style="margin-bottom:10px"><a href="#explorar" class="btn sm">← Atlas</a><h2 style="margin:0">${esc(img.t)}</h2>${chipSis(img.sys)}</div>
        <div class="linha" style="margin-bottom:10px">
          <button class="btn sm" id="todas">Revelar todas</button>
          <button class="btn sm" id="nenhuma">Esconder todas</button>
          <a class="btn sm pri" href="#alfinete/img:${img.id}">Testar esta imagem (${img.pins.length})</a>
          <span class="espaco"></span><span class="muted peq">Clique numa tarja para revelar ou esconder.</span>
        </div>
        ${htmlFigura(img)}
        <div class="cartao mt"><h3>Legendas desta imagem</h3><ol class="peq" style="columns:2;margin:0">${img.pins.map((p) => `<li>${esc(p.a)}</li>`).join("")}</ol></div>`;
      const fig = $(".figura");
      fig.onclick = (e) => {
        const p = e.target.closest(".pin"); if (!p) return;
        const pin = img.pins.find((x) => x.n === +p.dataset.n);
        if (p.classList.contains("revelado")) { p.classList.remove("revelado"); p.querySelector(".txt").textContent = ""; }
        else revelar(p, pin.a);
      };
      $("#todas").onclick = () => img.pins.forEach((p) => revelar(pinEl(fig, p.n), p.a));
      $("#nenhuma").onclick = () => fig.querySelectorAll(".pin").forEach((p) => { p.classList.remove("revelado"); p.querySelector(".txt").textContent = ""; });
      return;
    }
    const lista = IMAGENS.filter((x) => estado.sel.includes(x.sys));
    app.innerHTML = `<h1>🗺️ Atlas</h1><p class="sub">Todas as imagens com legendas escondidas. Abra uma para estudar e depois teste só ela.</p>` +
      SIS_IDS.filter((s) => estado.sel.includes(s)).map((s) => {
        const imgs = lista.filter((x) => x.sys === s);
        if (!imgs.length) return "";
        return `<h2 class="mt" style="color:${SIS[s].cor}">${SIS[s].nome}</h2><div class="thumbs">${imgs.map((x) => {
          const dom = x.pins.filter((p) => dominado("p:" + x.id + ":" + p.n)).length;
          return `<a class="cartao thumb" href="#explorar/${x.id}"><img loading="lazy" src="${x.img}" alt=""><div>${esc(x.t)}<br><small>${x.pins.length} alfinetes · ${dom} dominados</small></div></a>`;
        }).join("")}</div>`;
      }).join("");
  }

  // ───────────────────────── FLASHCARDS ─────────────────────────
  function flash(arg) {
    const base = arg === "erros" ? CARDS.filter((c) => { const it = item(c.k); return it && it.err > 0 && it.b < 3; }) : sel(CARDS);
    if (!base.length) { app.innerHTML = `<div class="vazio">Nenhum card para mostrar.</div>`; return; }
    const t = agora();
    const nVenc = base.filter((c) => { const it = item(c.k); return it && it.d <= t; }).length;
    const nNovos = base.filter((c) => !item(c.k)).length;
    let fila = arg === "erros" ? embaralhar(base) : escolher(base, 25);
    let i = 0, mostrando = false;
    const conta = { 0: 0, 1: 0, 2: 0 };
    function tela() {
      if (i >= fila.length) {
        app.innerHTML = `<div class="flash cartao"><h1>Rodada concluída!</h1><p>Errei: <b>${conta[0]}</b> · Difícil: <b>${conta[1]}</b> · Fácil: <b>${conta[2]}</b></p>
          <p class="muted">Os cards em que você errou voltam em poucos minutos; os fáceis só daqui a horas.</p>
          <div class="linha mt"><button class="btn pri" id="mais">Mais 25 cards</button><a class="btn" href="#inicio">Início</a></div></div>`;
        $("#mais").onclick = () => rota();
        return;
      }
      const c = fila[i];
      app.innerHTML = `
        <div class="flash">
          <div class="linha" style="margin-bottom:10px"><h2 style="margin:0">🃏 Flashcards</h2>${chipSis(c.s)}<span class="espaco"></span>
            <span class="muted peq">${i + 1}/${fila.length} · ${nVenc} para revisar · ${nNovos} novos</span></div>
          <div class="cartao fcard" id="fc">
            <div class="q">${esc(c.q)}</div>
            ${mostrando ? `<div class="a">${esc(c.a)}</div>` : ""}
          </div>
          <div class="mt">
            ${mostrando ? `<div class="notas">
              <button class="btn bad" data-n="0">Errei<small>volta logo</small></button>
              <button class="btn warn" data-n="1">Difícil<small>em ~15 min</small></button>
              <button class="btn ok" data-n="2">Fácil<small>mais tarde</small></button></div>
              <p class="kbd mt" style="text-align:center"><kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> para avaliar</p>`
            : `<button class="btn pri" style="width:100%;padding:14px" id="mostrar">Mostrar resposta</button><p class="kbd mt" style="text-align:center"><kbd>Espaço</kbd> mostra</p>`}
          </div>
        </div>`;
      if (!mostrando) { $("#mostrar").onclick = () => { mostrando = true; tela(); }; $("#fc").onclick = () => { mostrando = true; tela(); }; }
      else app.querySelectorAll(".notas .btn").forEach((b) => (b.onclick = () => nota(+b.dataset.n)));
    }
    function nota(n) {
      const c = fila[i];
      registrar(c.k, n); conta[n]++;
      if (n === 0) fila.splice(Math.min(fila.length, i + 4), 0, c); // reaparece daqui a pouco
      i++; mostrando = false; tela();
    }
    teclas((e) => {
      if (e.target.tagName === "INPUT") return;
      if (!mostrando && (e.key === " " || e.key === "Enter")) { e.preventDefault(); if (i < fila.length) { mostrando = true; tela(); } }
      else if (mostrando && ["1", "2", "3"].includes(e.key)) nota(+e.key - 1);
    });
    tela();
  }

  // ───────────────────────── QUIZ ─────────────────────────
  function geraMC(card) {
    let pool = CARDS.filter((c) => c.tp === card.tp && c.a !== card.a && c.s === card.s);
    if (pool.length < 3) pool = pool.concat(CARDS.filter((c) => c.tp === card.tp && c.a !== card.a && c.s !== card.s));
    if (pool.length < 3) pool = pool.concat(CARDS.filter((c) => c.a !== card.a));
    // Alternativas mais parecidas primeiro: mesma 1ª palavra (ex.: "Lobo …") e tamanho parecido
    const prim = (s) => norm(s).split(" ")[0];
    const nota = (c) => (prim(c.a) === prim(card.a) ? 3 : 0) + (c.s === card.s ? 1 : 0) - Math.abs(c.a.length - card.a.length) / 40 + Math.random();
    pool = pool.map((c) => ({ c, n: nota(c) })).sort((x, y) => y.n - x.n).map((x) => x.c);
    const distr = [];
    for (const c of pool) { if (!distr.includes(c.a) && c.a !== card.a) distr.push(c.a); if (distr.length === 3) break; }
    return embaralhar([card.a].concat(distr));
  }

  function quiz(tipo) {
    if (!tipo) {
      app.innerHTML = `<h1>🧠 Quiz</h1><p class="sub">Escolha o tipo de exercício. Todos usam os sistemas marcados acima.</p>
        <div class="grade">
          <a class="cartao modo" href="#quiz/mc"><span class="ico">🔘</span><b>Múltipla escolha</b><span>${sel(CARDS).length} perguntas com alternativas parecidas.</span></a>
          <a class="cartao modo" href="#quiz/vf"><span class="ico">⚖️</span><b>Verdadeiro ou falso</b><span>${sel(VFS).length} pegadinhas comuns de prova, com explicação.</span></a>
          <a class="cartao modo" href="#quiz/seq"><span class="ico">🔢</span><b>Sequências</b><span>${sel(SEQS).length} ordens para montar (caminho do ar, da urina, do sangue…).</span></a>
          <a class="cartao modo" href="#quiz/lig"><span class="ico">🔗</span><b>Ligar colunas</b><span>${sel(LIGS).length} exercícios: hormônio ↔ glândula, lobo ↔ função…</span></a>
        </div>`;
      return;
    }
    if (tipo === "mc") return quizMC(escolher(sel(CARDS), 15));
    if (tipo === "vf") return quizVF(escolher(sel(VFS), 15));
    if (tipo === "seq") return quizSeq(embaralhar(sel(SEQS)));
    if (tipo === "lig") return quizLig(embaralhar(sel(LIGS)));
    location.hash = "#quiz";
  }

  function cabecalho(t, i, n, s, acertos) {
    return `<div class="linha" style="margin-bottom:10px"><a class="btn sm" href="#quiz">←</a><h2 style="margin:0">${t}</h2>${s ? chipSis(s) : ""}<span class="espaco"></span><span class="muted peq">${i + 1}/${n} · ✓ ${acertos}</span></div>`;
  }
  function telaFim(titulo, acertos, total, voltar) {
    app.innerHTML = `<div class="cartao flash"><h1>${titulo}</h1><div class="linha"><div class="resultado-num">${acertos}/${total}</div></div>
      <div class="linha mt"><button class="btn pri" id="denovo">De novo</button><a class="btn" href="#quiz">Outros exercícios</a></div></div>`;
    $("#denovo").onclick = voltar;
  }

  function quizMC(fila) {
    if (!fila.length) { app.innerHTML = `<div class="vazio">Sem perguntas.</div>`; return; }
    let i = 0, acertos = 0;
    function tela() {
      if (i >= fila.length) return telaFim("Múltipla escolha concluída", acertos, fila.length, () => quiz("mc"));
      const c = fila[i]; const ops = geraMC(c);
      app.innerHTML = `<div class="flash">${cabecalho("🔘 Múltipla escolha", i, fila.length, c.s, acertos)}
        <div class="cartao"><div class="pergunta">${esc(c.q)}</div><div class="opcoes mt">${ops.map((o, k) => `<button class="opcao" data-k="${k}"><b>${"ABCD"[k]})</b> ${esc(o)}</button>`).join("")}</div>
        <div id="fb" class="mt"></div></div></div>`;
      app.querySelectorAll(".opcao").forEach((b) => (b.onclick = () => {
        const escolha = ops[+b.dataset.k], certo = escolha === c.a;
        app.querySelectorAll(".opcao").forEach((x) => { x.disabled = true; if (ops[+x.dataset.k] === c.a) x.classList.add("certa"); });
        if (!certo) b.classList.add("errada"); else acertos++;
        registrar(c.k, certo ? 2 : 0);
        $("#fb").innerHTML = `<button class="btn pri" id="prox">Próxima →</button>`;
        $("#prox").onclick = () => { i++; tela(); }; $("#prox").focus();
      }));
    }
    teclas((e) => {
      const k = "1234".indexOf(e.key); const ab = "abcd".indexOf(e.key.toLowerCase());
      const idx = k >= 0 ? k : ab; const bts = app.querySelectorAll(".opcao");
      if (idx >= 0 && bts[idx] && !bts[idx].disabled) bts[idx].click();
      else if (e.key === "Enter" && document.getElementById("prox")) { e.preventDefault(); $("#prox").click(); }
    });
    tela();
  }

  function quizVF(fila) {
    if (!fila.length) { app.innerHTML = `<div class="vazio">Sem afirmações.</div>`; return; }
    let i = 0, acertos = 0;
    function tela() {
      if (i >= fila.length) return telaFim("Verdadeiro ou falso concluído", acertos, fila.length, () => quiz("vf"));
      const v = fila[i];
      app.innerHTML = `<div class="flash">${cabecalho("⚖️ Verdadeiro ou falso", i, fila.length, v.s, acertos)}
        <div class="cartao"><div class="pergunta" style="font-size:20px">${esc(v.t)}</div>
        <div class="vf mt"><button class="btn ok" data-v="1">Verdadeiro <span class="kbd">(V)</span></button><button class="btn bad" data-v="0">Falso <span class="kbd">(F)</span></button></div>
        <div id="fb" class="mt"></div></div></div>`;
      app.querySelectorAll(".vf .btn").forEach((b) => (b.onclick = () => resp(b.dataset.v === "1")));
    }
    function resp(r) {
      if (document.getElementById("prox")) return;
      const v = fila[i], certo = r === v.v;
      if (certo) acertos++;
      registrar(v.k, certo ? 2 : 0);
      app.querySelectorAll(".vf .btn").forEach((b) => (b.disabled = true));
      $("#fb").innerHTML = `<div class="fb ${certo ? "ok" : "bad"}">${certo ? "✓ Acertou" : "✗ Errou"}: é ${v.v ? "VERDADEIRO" : "FALSO"}<small>${esc(v.e)}</small></div>
        <button class="btn pri mt" id="prox">Próxima →</button>`;
      $("#prox").onclick = () => { i++; tela(); }; $("#prox").focus();
    }
    teclas((e) => {
      if (e.key.toLowerCase() === "v") resp(true);
      else if (e.key.toLowerCase() === "f") resp(false);
      else if (e.key === "Enter" && document.getElementById("prox")) { e.preventDefault(); $("#prox").click(); }
    });
    tela();
  }

  function quizSeq(fila) {
    if (!fila.length) { app.innerHTML = `<div class="vazio">Sem sequências.</div>`; return; }
    let i = 0, acertos = 0;
    function tela() {
      if (i >= fila.length) return telaFim("Sequências concluídas", acertos, fila.length, () => quiz("seq"));
      const sq = fila[i];
      let pool = embaralhar(sq.itens.map((t, k) => ({ t, k })));
      while (sq.itens.length > 1 && pool.every((p, k) => p.k === k)) pool = embaralhar(pool);
      const resp = [];
      function desenha(corrigido) {
        app.innerHTML = `<div class="flash">${cabecalho("🔢 Sequências", i, fila.length, sq.s, acertos)}
          <div class="cartao"><div class="pergunta">${esc(sq.t)}</div><p class="muted peq">Clique nos itens na ordem certa. Clique num item da sua ordem para devolver.</p>
          <div class="duas mt">
            <div><h3>Itens</h3><div class="seq-lista" id="pool">${pool.map((p, k) => `<button class="seq-item" data-k="${k}"><span class="n">·</span>${esc(p.t)}</button>`).join("") || `<span class="muted peq">Todos usados.</span>`}</div></div>
            <div><h3>Sua ordem</h3><div class="seq-lista" id="resp">${resp.map((p, k) => {
              const cl = corrigido ? (p.k === k ? "certa" : "errada") : "";
              return `<button class="seq-item ${cl}" data-k="${k}"><span class="n">${k + 1}</span>${esc(p.t)}</button>`;
            }).join("") || `<span class="muted peq">Comece clicando no primeiro.</span>`}</div></div>
          </div>
          <div id="fb" class="mt"></div>
          <div class="linha mt">${corrigido ? `<button class="btn pri" id="prox">Próxima →</button>` : `<button class="btn pri" id="ver" ${pool.length ? "disabled" : ""}>Verificar</button>`}</div>
          </div></div>`;
        if (corrigido) {
          const ok = resp.every((p, k) => p.k === k);
          $("#fb").innerHTML = ok ? `<div class="fb ok">✓ Ordem perfeita!</div>` : `<div class="fb bad">✗ Ordem correta:<small>${sq.itens.map((t, k) => `${k + 1}. ${esc(t)}`).join("<br>")}</small></div>`;
          $("#prox").onclick = () => { i++; tela(); };
          return;
        }
        $("#pool").onclick = (e) => { const b = e.target.closest("[data-k]"); if (!b) return; resp.push(pool.splice(+b.dataset.k, 1)[0]); desenha(false); };
        $("#resp").onclick = (e) => { const b = e.target.closest("[data-k]"); if (!b) return; pool.push(resp.splice(+b.dataset.k, 1)[0]); desenha(false); };
        $("#ver").onclick = () => { const ok = resp.every((p, k) => p.k === k); if (ok) acertos++; registrar(sq.k, ok ? 2 : 0); desenha(true); };
      }
      desenha(false);
    }
    tela();
  }

  function quizLig(fila) {
    if (!fila.length) { app.innerHTML = `<div class="vazio">Sem exercícios.</div>`; return; }
    const CORES = ["#2563eb", "#db2777", "#16a34a", "#ea580c", "#7c3aed", "#0891b2", "#ca8a04", "#dc2626", "#4f46e5", "#059669"];
    let i = 0, acertos = 0;
    function tela() {
      if (i >= fila.length) return telaFim("Ligar colunas concluído", acertos, fila.length, () => quiz("lig"));
      const ex = fila[i];
      const esq = ex.pares.map((p, k) => ({ t: p[0], k }));
      const dir = embaralhar(ex.pares.map((p, k) => ({ t: p[1], k })));
      const lig = {}; // índice esquerda -> índice (em dir)
      let selE = null, corrigido = false;
      function desenha() {
        const usadoDir = {}; Object.entries(lig).forEach(([e, d]) => (usadoDir[d] = +e));
        app.innerHTML = `<div class="flash" style="max-width:900px">${cabecalho("🔗 Ligar colunas", i, fila.length, ex.s, acertos)}
          <div class="cartao"><div class="pergunta">${esc(ex.t)}</div><p class="muted peq">Clique num item da esquerda e depois no par dele na direita.</p>
          <div class="duas mt">
            <div class="lig-col">${esq.map((x, k) => {
              const d = lig[k]; const cl = corrigido ? (d !== undefined && dir[d].k === x.k ? "certa" : "errada") : (selE === k ? "sel" : "");
              return `<button class="lig ${cl}" data-e="${k}"><span class="tag" style="background:${CORES[k % CORES.length]}">${k + 1}</span>${esc(x.t)}</button>`;
            }).join("")}</div>
            <div class="lig-col">${dir.map((x, k) => {
              const e = usadoDir[k];
              return `<button class="lig" data-d="${k}">${e !== undefined ? `<span class="tag" style="background:${CORES[e % CORES.length]}">${e + 1}</span>` : `<span class="tag" style="background:var(--line)"></span>`}${esc(x.t)}</button>`;
            }).join("")}</div>
          </div>
          <div id="fb" class="mt"></div>
          <div class="linha mt">${corrigido ? `<button class="btn pri" id="prox">Próximo →</button>` : `<button class="btn pri" id="ver" ${Object.keys(lig).length < esq.length ? "disabled" : ""}>Verificar</button>`}</div>
          </div></div>`;
        if (corrigido) {
          const nOk = esq.filter((x, k) => lig[k] !== undefined && dir[lig[k]].k === x.k).length;
          $("#fb").innerHTML = nOk === esq.length ? `<div class="fb ok">✓ Tudo certo!</div>` :
            `<div class="fb bad">${nOk}/${esq.length} certos. Pares corretos:<small>${ex.pares.map((p) => `<b>${esc(p[0])}</b> → ${esc(p[1])}`).join("<br>")}</small></div>`;
          $("#prox").onclick = () => { i++; tela(); };
          return;
        }
        app.querySelectorAll("[data-e]").forEach((b) => (b.onclick = () => { selE = +b.dataset.e; desenha(); }));
        app.querySelectorAll("[data-d]").forEach((b) => (b.onclick = () => {
          if (selE === null) return;
          const d = +b.dataset.d;
          Object.keys(lig).forEach((e) => { if (lig[e] === d) delete lig[e]; });
          lig[selE] = d;
          const prox = esq.findIndex((_, k) => lig[k] === undefined);
          selE = prox >= 0 ? prox : null;
          desenha();
        }));
        $("#ver").onclick = () => {
          corrigido = true;
          const ok = esq.every((x, k) => dir[lig[k]].k === x.k);
          if (ok) acertos++; registrar(ex.k, ok ? 2 : 0);
          desenha();
        };
      }
      selE = 0; desenha();
    }
    tela();
  }

  // ───────────────────────── SIMULADO ─────────────────────────
  function simulado() {
    app.innerHTML = `<h1>📝 Simulado</h1><p class="sub">Prova mista com os sistemas marcados: primeiro os alfinetes (prática), depois as questões teóricas (múltipla escolha e V/F). Nota no final.</p>
      <div class="cartao"><h3>Tamanho</h3>
        <div class="seg" id="tam"><button data-n="15">Curto (15+15)</button><button data-n="25" class="on">Médio (25+25)</button><button data-n="40">Longo (40+40)</button></div>
        <div class="mt"><button class="btn pri" id="ir">Começar simulado</button></div></div>`;
    let n = 25;
    $("#tam").onclick = (e) => { const b = e.target.closest("button"); if (!b) return; n = +b.dataset.n; $("#tam").querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b)); };
    $("#ir").onclick = () => {
      const pins = embaralhar(sel(PINS)).slice(0, n);
      const t0 = agora();
      if (!pins.length) return teorico({ certos: 0, quase: 0, errados: 0, erros: [] });
      sessaoAlfinete(pins, "Simulado: parte prática", (r) => teorico(r));
      function teorico(pratica) {
        const nMc = Math.ceil(n * 0.6), nVf = n - nMc;
        const qs = embaralhar(embaralhar(sel(CARDS)).slice(0, nMc).map((c) => ({ tipo: "mc", c, ops: geraMC(c) }))
          .concat(embaralhar(sel(VFS)).slice(0, nVf).map((v) => ({ tipo: "vf", v }))));
        let i = 0, acertos = 0; const errosT = [];
        function tela() {
          if (i >= qs.length) return resultado();
          const q = qs[i];
          const corpo = q.tipo === "mc"
            ? `<div class="pergunta">${esc(q.c.q)}</div><div class="opcoes mt">${q.ops.map((o, k) => `<button class="opcao" data-k="${k}"><b>${"ABCD"[k]})</b> ${esc(o)}</button>`).join("")}</div>`
            : `<div class="pergunta">V ou F: ${esc(q.v.t)}</div><div class="vf mt"><button class="opcao" data-v="1">Verdadeiro</button><button class="opcao" data-v="0">Falso</button></div>`;
          app.innerHTML = `<div class="flash"><div class="linha" style="margin-bottom:10px"><h2 style="margin:0">Simulado: parte teórica</h2>${chipSis(q.tipo === "mc" ? q.c.s : q.v.s)}<span class="espaco"></span><span class="muted peq">${i + 1}/${qs.length}</span></div>
            <div class="cartao">${corpo}</div><p class="muted peq mt">No simulado a correção só aparece no final.</p></div>`;
          app.querySelectorAll(".opcao").forEach((b) => (b.onclick = () => {
            let certo, sua, correta, enun;
            if (q.tipo === "mc") { sua = q.ops[+b.dataset.k]; certo = sua === q.c.a; correta = q.c.a; enun = q.c.q; registrar(q.c.k, certo ? 2 : 0); }
            else { const r = b.dataset.v === "1"; certo = r === q.v.v; sua = r ? "Verdadeiro" : "Falso"; correta = (q.v.v ? "Verdadeiro" : "Falso") + ". " + q.v.e; enun = q.v.t; registrar(q.v.k, certo ? 2 : 0); }
            if (certo) acertos++; else errosT.push({ enun, sua, correta });
            i++; tela();
          }));
        }
        function resultado() {
          const totP = pratica.certos + pratica.quase + pratica.errados;
          const notaP = totP ? (pratica.certos + pratica.quase) / totP : 0;
          const notaT = qs.length ? acertos / qs.length : 0;
          const partes = (totP ? 1 : 0) + (qs.length ? 1 : 0);
          const nota = partes ? ((totP ? notaP : 0) + (qs.length ? notaT : 0)) / partes * 10 : 0;
          const min = Math.round((agora() - t0) / MIN);
          app.innerHTML = `<div class="cartao" style="max-width:820px;margin:0 auto">
            <h1>Resultado do simulado</h1>
            <div class="linha"><div class="resultado-num">${nota.toFixed(1).replace(".", ",")}</div><div class="muted">de 10 · ${min} min</div></div>
            <p class="mt">Prática (alfinetes): <b>${pratica.certos + pratica.quase}/${totP}</b> · Teórica: <b>${acertos}/${qs.length}</b></p>
            ${pratica.erros.length ? `<h3 class="mt">Alfinetes que você errou</h3><div class="lista-erros">${pratica.erros.map((e) => `
              <div class="erro-item"><img src="${e.p.img.img}" alt=""><div class="det"><b>${esc(e.p.pin.a)}</b><span class="muted peq">${esc(e.p.img.t)} · alfinete ${e.p.pin.n}${e.txt ? ` · você: "${esc(e.txt)}"` : ""}</span></div></div>`).join("")}</div>` : ""}
            ${errosT.length ? `<h3 class="mt">Questões teóricas que você errou</h3><div class="lista-erros">${errosT.map((e) => `
              <div class="cartao" style="padding:12px"><b>${esc(e.enun)}</b><div class="peq"><span style="color:var(--bad)">Você: ${esc(e.sua)}</span><br><span style="color:var(--ok)">Certo: ${esc(e.correta)}</span></div></div>`).join("")}</div>` : ""}
            <div class="linha mt"><a class="btn pri" href="#erros">Ver todos os meus erros</a><button class="btn" id="outro">Outro simulado</button></div></div>`;
          $("#outro").onclick = () => rota();
        }
        tela();
      }
    };
  }

  // ───────────────────────── MEUS ERROS ─────────────────────────
  function erros(aba) {
    aba = aba || "pins";
    const errou = (k) => { const it = item(k); return it && it.err > 0 && it.b < 3; };
    const ord = (a, b) => item(b.k).err - item(a.k).err;
    const ep = sel(PINS).filter((x) => errou(x.k)).sort(ord);
    const ec = sel(CARDS).filter((x) => errou(x.k)).sort(ord);
    const ev = sel(VFS).filter((x) => errou(x.k)).sort(ord);
    const es = sel(SEQS.concat(LIGS)).filter((x) => errou(x.k)).sort(ord);
    const tab = (id, nome, n) => `<a class="btn sm ${aba === id ? "pri" : ""}" href="#erros/${id}">${nome} (${n})</a>`;
    let corpo = "";
    if (aba === "pins") corpo = ep.length ? `<a class="btn pri" href="#alfinete/erros">Treinar estes alfinetes</a><div class="lista-erros mt">${ep.map((x) => `
        <a class="erro-item cartao" style="padding:10px;text-decoration:none;color:inherit" href="#explorar/${x.img.id}"><img src="${x.img.img}" alt=""><div class="det"><b>${esc(x.pin.a)}</b><span class="muted peq">${esc(x.img.t)} · alfinete ${x.pin.n}</span></div><span class="contagem">✗ ${item(x.k).err}</span></a>`).join("")}</div>` : "";
    if (aba === "cards") corpo = ec.length ? `<a class="btn pri" href="#flash/erros">Treinar estes cards</a><div class="lista-erros mt">${ec.map((x) => `
        <div class="cartao erro-item" style="padding:12px"><div class="det"><b>${esc(x.q)}</b><span class="peq" style="color:var(--ok)">${esc(x.a)}</span></div><span class="contagem">✗ ${item(x.k).err}</span></div>`).join("")}</div>` : "";
    if (aba === "vf") corpo = ev.length ? `<div class="lista-erros">${ev.map((x) => `
        <div class="cartao erro-item" style="padding:12px"><div class="det"><b>${esc(x.t)}</b><span class="peq"><b>${x.v ? "Verdadeiro" : "Falso"}</b>. ${esc(x.e)}</span></div><span class="contagem">✗ ${item(x.k).err}</span></div>`).join("")}</div>` : "";
    if (aba === "seq") corpo = es.length ? `<div class="lista-erros">${es.map((x) => `
        <div class="cartao" style="padding:12px"><b>${esc(x.t)}</b><div class="peq muted">${x.itens ? x.itens.map((t, k) => `${k + 1}. ${esc(t)}`).join(" → ") : x.pares.map((p) => `${esc(p[0])} → ${esc(p[1])}`).join(" · ")}</div></div>`).join("")}</div>` : "";
    app.innerHTML = `<h1>🎯 Meus erros</h1><p class="sub">Tudo que você errou e ainda não acertou 3 vezes seguidas. Quando dominar, o item sai da lista sozinho.</p>
      <div class="tabs">${tab("pins", "Alfinetes", ep.length)}${tab("cards", "Flashcards", ec.length)}${tab("vf", "V/F", ev.length)}${tab("seq", "Sequências e ligar", es.length)}</div>
      ${corpo || `<div class="vazio">Nada aqui. Ou você está mandando muito bem, ou ainda não treinou esta parte. 😉</div>`}`;
  }

  rota();
})();
