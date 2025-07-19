/****************************************************
 * Queso o Mentira – v0.4.4-a
 *  • Estilo pulp-militar 🪖
 *  • IA básica / experta / tramposa
 *  • Regla opcional de 1-comodín
 *  • Sonidos (ronda, eliminación, victoria)
 *  • Diálogo de apuesta con clase .qm-dialog
 *  • Sin advertencias de AudioHelper (compat. V11/V12)
 ****************************************************/

/* ---------- 0 · Parámetros ---------- */
const DEFAULT_ONES_WILD = true;

/* Rutas de sonido (coloca .ogg/.mp3 aquí) */
const PATH      = "modules/queso-mentira/assets/sounds/";
const SND_ROLL  = `${PATH}roll.ogg`;
const SND_ELIM  = `${PATH}ding.ogg`;
const SND_WIN   = `${PATH}fanfare.ogg`;

/* AudioHelper compatible (V11 y V12+) */
const AH = (foundry?.audio?.AudioHelper) ?? globalThis.AudioHelper;
const playSound = (src, vol = 0.8) =>
  AH.play({ src, volume: vol, autoplay: true, loop: false }, true);

/* ---------- 1 · Helpers ---------- */
function getOwnerUsers(actor) {
  if (!actor) return [];
  if (typeof actor.testUserPermission === "function") {
    const LVL = CONST.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ??
                CONST.DOCUMENT_PERMISSION_LEVELS?.OWNER ?? 3;
    return game.users.filter(u => actor.testUserPermission(u, LVL));
  }
  const perm = actor.permission ?? actor.data?.permission ?? {};
  return game.users.filter(u => (perm[u.id] ?? perm.default ?? 0) >= 3);
}

function binomTail(k, n, p) { /* P(X ≥ k) para X~Bin(n,p) */
  let comb = 1, term = (1 - p) ** n, prob = 0;
  for (let i = 0; i < k; i++) {
    comb = comb * (n - i) / (i + 1);
    term = term / (1 - p) * p;
  }
  for (let i = k; i <= n; i++) {
    prob += comb * term;
    comb = comb * (n - i) / (i + 1);
    term = term / p * (1 - p);
  }
  return prob;
}

const stars  = n => "★".repeat(n);
const status = S =>
  `<div class="qm-status"><b>📊 Situación actual</b><br>${
    S.jugadores
      .map(j => `${j.type === "humano" ? "🐭" : "🤖"} <b>${j.name}</b> | ${stars(j.dadosRestantes)}`)
      .join("<br>")
  }</div>`;

/* ---------- 2 · Botón de escena ---------- */
Hooks.on("getSceneControlButtons", controls => {
  const tok = controls.find(c => c.name === "token");
  if (!tok || tok.tools.some(t => t.name === "queso-mentira")) return;
  tok.tools.push({
    name: "queso-mentira",
    title: "Queso o Mentira",
    icon: "fas fa-cheese",
    button: true,
    onClick: () => PlayerSelectApp.singleton.render(true)
  });
});

/* ---------- 3 · Ventana de selección ---------- */
class PlayerSelectApp extends FormApplication {
  static get singleton() { if (!this._inst) this._inst = new this(); return this._inst; }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "qm-select",
      title: "Queso o Mentira – Participantes",
      template: "modules/queso-mentira/templates/select-actors.html",
      width: 550
    });
  }

  getData() {
    return {
      actors: game.actors.contents.sort((a, b) => a.name.localeCompare(b.name)),
      defaultWild: DEFAULT_ONES_WILD
    };
  }

  async _updateObject(_ev, fd) {
    const jugadores = [];
    for (const [k, v] of Object.entries(fd)) {
      if (!v || k === "qm-ones-wild") continue;
      const [, id] = k.match(/actor-(.+)-mode/);
      const actor  = game.actors.get(id);
      if (!actor) continue;
      jugadores.push({
        name : actor.name,
        type : v === "humano" ? "humano" : "ia",
        level: v.startsWith("ia-") ? v.replace("ia-", "") : null,
        actorId: id,
        dadosRestantes: 5,
        dados: []
      });
    }

    if (jugadores.length < 2) {
      ui.notifications.warn("Mínimo dos jugadores.");
      return;
    }

    game.quesoMentira.session = {
      jugadores,
      ronda : 0,
      turno : 0,
      apuesta : null,
      onesWild: !!fd["qm-ones-wild"]
    };

    ChatMessage.create({
      content: `<h2 class="qm-msg">¡Comienza Queso o Mentira!</h2>
        <p class="qm-msg">${game.quesoMentira.session.onesWild ? "Regla" : "Sin regla"} de 1-comodín</p>`,
      classes: ["qm-msg"]
    });

    await QM.startRound();
  }
}
window.PlayerSelectApp = PlayerSelectApp;

/* ---------- 4 · Botones en el chat ---------- */
Hooks.on("renderChatMessage", (msg, html) => {
  if (!msg.flags.qmButtons) return;
  html.find(".qm-btn").each((_, btn) => {
    const auth = btn.dataset.uid;
    if (auth && auth !== game.user.id && !game.user.isGM) { btn.style.display = "none"; return; }
    btn.addEventListener("click", ev => {
      const act = ev.currentTarget.dataset.action;
      const ix  = Number(ev.currentTarget.dataset.ix);
      (act === "raise") ? QM.promptRaise(ix) : QM.callLie(ix);
    });
  });
});

/* ---------- 5 · Motor ---------- */
const QM = {

  /* -- inicia ronda -- */
  async startRound() {
    const S = game.quesoMentira.session;
    if (!S) return;

    playSound(SND_ROLL, 0.6);

    for (const j of S.jugadores) {
      const roll = new Roll(`${j.dadosRestantes}d6`);
      await roll.evaluate({});
      j.dados = roll.dice[0].results.map(r => r.result).sort((a, b) => a - b);

      const recip = new Set(ChatMessage.getWhisperRecipients("GM"));
      if (j.type === "humano")
        getOwnerUsers(game.actors.get(j.actorId)).forEach(u => recip.add(u));

      ChatMessage.create({
        content: `<p><b>Tus dados:</b> ${j.dados.join(", ")}</p>`,
        whisper: [...recip]
      });
    }

    S.totalDados = S.jugadores.reduce((t, j) => t + j.dadosRestantes, 0);
    S.turno      = Math.floor(Math.random() * S.jugadores.length);
    S.apuesta    = null;
    S.ronda++;

    ChatMessage.create({
      content: `<i class="qm-msg">Ronda ${S.ronda}. Empieza <b>${S.jugadores[S.turno].name}</b></i>`,
      classes: ["qm-msg"]
    });
    ChatMessage.create({ content: status(S) });

    this.promptTurn();
  },

  promptTurn() {
    const S = game.quesoMentira.session;
    if (!S) return;
    const j = S.jugadores[S.turno];

    if (j.type === "humano") { this.promptRaise(S.turno, true); return; }

    switch (j.level) {
      case "experta":  this.aiExpert(j);  break;
      case "tramposa": this.aiCheater(j); break;
      default        : this.aiBasic(j);
    }
  },

  /* ---------- diálogo militar ---------- */
  promptRaise(ix, allowLie = false) {
    const S = game.quesoMentira.session;
    if (!S) { ui.notifications.warn("No hay partida activa."); return; }

    const p    = S.apuesta;
    const minC = p ? p.cantidad + 1 : 1;

    const data = {
      title  : `Apuesta de ${S.jugadores[ix].name}`,
      content: `<form class="flexcol">
        <label>Cantidad (${minC}-${S.totalDados}):
          <input id="c" type="number" value="${minC}" min="${minC}" max="${S.totalDados}">
        </label>
        <label>Valor (1–6):
          <input id="v" type="number" value="1" min="1" max="6">
        </label>
      </form>`,
      buttons: {
        apostar: {
          label : "Apostar",
          icon  : '<i class="fas fa-check"></i>',
          classes: ["qm-btn"],
          callback: h => this.registerBet({
            cantidad : +h.find("#c").val(),
            valor    : +h.find("#v").val(),
            jugadorIx: ix
          })
        },
        ...(allowLie && p ? {
          mentira: {
            label   : "¡Mentira!",
            classes : ["qm-btn"],
            callback: () => this.callLie(ix)
          }
        } : {})
      },
      default: "apostar"
    };

    new Dialog(data, { classes: ["qm-dialog"] }).render(true);
  },

  /* ---------- registrar apuesta ---------- */
  registerBet({ cantidad, valor, jugadorIx }) {
    const S = game.quesoMentira.session;
    if (!S) { ui.notifications.warn("La partida ya terminó."); return; }

    const p   = S.apuesta;
    const ok  = !p || cantidad > p.cantidad || (cantidad === p.cantidad && valor > p.valor);
    if (cantidad < 1 || cantidad > S.totalDados || !ok) {
      ui.notifications.warn("Apuesta no válida."); return;
    }
    S.apuesta = { cantidad, valor, jugadorIx };

    const nextIx   = (S.turno + 1) % S.jugadores.length;
    const next     = S.jugadores[nextIx];
    const showBtns = next.type === "humano";
    let uid = null;
    if (showBtns) {
      const own = getOwnerUsers(game.actors.get(next.actorId));
      uid = own[0]?.id || game.users.find(u => u.isGM)?.id;
    }

    ChatMessage.create({
      content:
        `<b>${S.jugadores[jugadorIx].name}</b> apuesta <b>${cantidad} × ${valor}</b>` +
        (showBtns ? `<div class="flexrow" style="gap:.5rem">
          <button class="qm-btn" data-action="raise" data-ix="${nextIx}" data-uid="${uid}">Subir</button>
          <button class="qm-btn" data-action="lie"  data-ix="${nextIx}" data-uid="${uid}">¡Mentira!</button>
        </div>` : ""),
      flags: { qmButtons: showBtns }
    });

    S.turno = nextIx;
    if (!showBtns) this.promptTurn();
  },

  /* ---------- IA Básica ---------- */
  aiBasic(j) {
    const S = game.quesoMentira.session, p = S.apuesta;
    let c, v;
    if (!p)                 { c = 1; v = Math.ceil(Math.random() * 6); }
    else if (p.cantidad < S.totalDados) { c = p.cantidad + 1; v = p.valor; }
    else if (p.valor < 6)   { c = p.cantidad; v = p.valor + 1; }
    else { this.callLie(S.turno); return; }

    this.registerBet({ cantidad: c, valor: v, jugadorIx: S.turno });
  },

  /* ---------- IA Experta ---------- */
  aiExpert(j) {
    const S = game.quesoMentira.session, p = S.apuesta;
    const own = j.dados.reduce((o, d) => ((o[d] = (o[d] || 0) + 1), o), {});
    if (S.onesWild)
      for (const d of [2,3,4,5,6]) own[d] = (own[d] || 0) + (own[1] || 0);

    const rest = S.totalDados - j.dadosRestantes;
    const pDie = v => (v === 1 || !S.onesWild) ? 1/6 : 2/6;

    if (p) {
      const need = p.cantidad - (own[p.valor] || 0);
      if (need > 0 && binomTail(need, rest, pDie(p.valor)) < 0.3) {
        this.callLie(S.turno); return;
      }
    }

    for (let c = (p ? p.cantidad + 1 : 1); c <= S.totalDados; c++) {
      for (let v = 1; v <= 6; v++) {
        const need = c - (own[v] || 0);
        if (need >= 0 && binomTail(need, rest, pDie(v)) >= 0.3) {
          this.registerBet({ cantidad: c, valor: v, jugadorIx: S.turno });
          return;
        }
      }
    }
    this.callLie(S.turno);
  },

  /* ---------- IA Tramposa ---------- */
  aiCheater(j) {
    const S = game.quesoMentira.session, p = S.apuesta;
    const counts = {};
    S.jugadores.forEach(pl => pl.dados.forEach(d => counts[d] = (counts[d] || 0) + 1));
    const wild = v =>
      v === 1 || !S.onesWild
        ? counts[v] || 0
        : (counts[v] || 0) + (counts[1] || 0);

    if (p && wild(p.valor) < p.cantidad) { this.callLie(S.turno); return; }

    let bestV = 1, bestC = wild(1);
    for (let v = 2; v <= 6; v++) {
      const c = wild(v);
      if (c > bestC) { bestC = c; bestV = v; }
    }

    let c = bestC, v = bestV;
    if (p) {
      if (c <= p.cantidad) c = p.cantidad + 1;
      if (c === p.cantidad && v <= p.valor) { c = p.cantidad; v = p.valor + 1; }
    }
    if (c > S.totalDados) c = S.totalDados;

    this.registerBet({ cantidad: c, valor: v, jugadorIx: S.turno });
  },

  /* ---------- ¡Mentira! ---------- */
  callLie(callerIx) {
    const S = game.quesoMentira.session;
    if (!S || !S.apuesta) { ui.notifications.warn("No hay partida activa."); return; }
    const p = S.apuesta;

    const total = S.jugadores
      .flatMap(j => j.dados)
      .filter(d => d === p.valor || (S.onesWild && p.valor !== 1 && d === 1))
      .length;

    const mentira = total < p.cantidad;
    const perdIx  = mentira ? p.jugadorIx : callerIx;
    const perd    = S.jugadores[perdIx];
    perd.dadosRestantes--;

    if (perd.dadosRestantes === 0) playSound(SND_ELIM, 0.8);

    const comodinTxt = S.onesWild && p.valor !== 1 ? " (incluye unos comodín)" : "";
    const valorTxt   = p.valor === 1 ? "unos" : `× ${p.valor}`;

    ChatMessage.create({
      content: `<h3 class="qm-msg">¡Se revela!</h3>
        <p class="qm-msg">Había ${total} ${valorTxt}${comodinTxt}.</p>
        <p class="qm-msg"><b>${perd.name}</b> pierde un dado (le quedan ${perd.dadosRestantes}).</p>`,
      classes: ["qm-msg"]
    });

    if (perd.dadosRestantes === 0) {
      ChatMessage.create({ content: `<b>${perd.name}</b> queda eliminado.` });
      S.jugadores.splice(perdIx, 1);
      if (S.turno > perdIx) S.turno--;
    }

    /* victoria */
    if (S.jugadores.length === 1) {
      playSound(SND_WIN, 1);
      ChatMessage.create({
        content: `<h2 class="qm-msg">¡${S.jugadores[0].name} gana la partida!</h2>`,
        classes: ["qm-msg"]
      });
      game.quesoMentira.session = null;
      ui.chat.element.find(".qm-btn").remove();
      return;
    }

    ChatMessage.create({ content: status(S) });
    this.startRound();
  }
};
window.QM = QM;

/* ---------- init ---------- */
Hooks.once("ready", () => {
  if (!game.quesoMentira) game.quesoMentira = {};
});
