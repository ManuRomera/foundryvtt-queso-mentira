// --- INICIO DEL ARCHIVO ---
/****************************************************
 * Queso o Mentira – v1.0.0 (Versión Estable)
 * • CORRECCIÓN CRÍTICA: Solucionado el bug que impedía que la bandeja del GM se actualizara con la apuesta actual, lo que deshabilitaba los botones de acción. La actualización de la UI del GM ahora es directa e inmediata.
 * • CORRECIÓN LÓGICA: Mejorada y robustecida la lógica de validación de apuestas.
 * • CORRECCIÓN TÉCNICA: Eliminadas las advertencias de desuso de `deepClone` para compatibilidad con Foundry v12+.
 ****************************************************/

// ===================================================================================
// 1. DEFINICIÓN DE LAS CLASES DE APLICACIÓN (VENTANAS)
// ===================================================================================

class PlayerSelectApp extends FormApplication {
  static get singleton() { if (!this._inst) this._inst = new this(); return this._inst; }
  static get defaultOptions() { return foundry.utils.mergeObject(super.defaultOptions, { id: "qm-select", title: game.i18n.localize("QM.select.title"), template: `modules/queso-mentira/templates/select-actors.html`, width: 550, height: "auto" }); }
  getData() {
    const actorsMap = new Map();
    canvas.tokens?.placeables.forEach(t => { if (t.actor) actorsMap.set(t.actor.id, t.actor); });
    const actors = Array.from(actorsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    return { 
        actors, 
        startDice: game.settings.get("queso-mentira", "startDice"),
        onesWild: game.settings.get("queso-mentira", "onesWild")
    };
  }
  async _updateObject(event, formData) {
    QuesoMentira.QM.startGame(formData);
  }
}

class DiceTrayApp extends Application {
    constructor(playerData, options = {}) { super(options); this.playerData = playerData; }
    static get defaultOptions() { return foundry.utils.mergeObject(super.defaultOptions, { popOut: true, template: `modules/queso-mentira/templates/dice-tray.html`, width: 450, height: "auto", title: game.i18n.localize("QM.tray.title"), classes: ["qm-dialog", "qm-dice-tray"], resizable: false }); }
    
    get id() { return `qm-dice-tray-${this.playerData.actorId}`; }

    getData() {
        const session = game.settings.get("queso-mentira", "session");
        if (!session) return { player: this.playerData, session: null, isMyTurn: false };
        const me = session.jugadores.find(p => p.actorId === this.playerData.actorId);
        return { player: me, session, isMyTurn: session.jugadores[session.turno]?.actorId === this.playerData.actorId };
    }
    activateListeners(html) {
        super.activateListeners(html);
        html.find(".qm-btn[data-action]").on("click", ev => {
            const action = ev.currentTarget.dataset.action;
            const S = game.settings.get("queso-mentira", "session");
            const myIndex = S.jugadores.findIndex(p => p.actorId === this.playerData.actorId);
            if (action === "raise") {
                QuesoMentira.QM.promptRaise(myIndex);
            } else { 
                game.socket.emit(QuesoMentira.SOCKET_NAME, { type: "PLAYER_ACTION", payload: { action, callerIx: myIndex } }); 
            }
        });
    }
}

class GMDiceTrayApp extends Application {
    constructor(options = {}) { super(options); }
    static get defaultOptions() { return foundry.utils.mergeObject(super.defaultOptions, { id: `qm-gm-dice-tray`, template: `modules/queso-mentira/templates/gm-dice-tray.html`, width: 450, height: "auto", title: game.i18n.localize("QM.gmTray.title"), classes: ["qm-dialog", "qm-dice-tray"], resizable: true }); }
    
    getData() { 
        const session = game.settings.get("queso-mentira", "session");
        if (!session) return { session: null };
        const gmActor = session.jugadores.find(p => p.type === 'gm');
        const isMyTurn = gmActor ? session.jugadores[session.turno]?.actorId === gmActor.actorId : false;
        return { session, gmActor, isMyTurn }; 
    }

    activateListeners(html) {
        super.activateListeners(html);
        html.find(".gm-actions .qm-btn[data-action]").on("click", ev => {
            const action = ev.currentTarget.dataset.action;
            const S = game.settings.get("queso-mentira", "session");
            const gmActor = S.jugadores.find(p => p.type === 'gm');
            if (!gmActor) return;

            const myIndex = S.jugadores.findIndex(p => p.actorId === gmActor.actorId);
            if (myIndex === -1) return;

            if (action === "raise") {
                QuesoMentira.QM.promptRaise(myIndex);
            } else if (action === "lie") {
                QuesoMentira.QM.resolveLie(myIndex);
            } else if (action === "spoton") {
                QuesoMentira.QM.resolveSpotOn(myIndex);
            }
        });
    }
}


// ===================================================================================
// 2. CLASE PRINCIPAL DEL MÓDULO
// ===================================================================================

class QuesoMentira {
    static ID = "queso-mentira";
    static SOCKET_NAME = `module.${this.ID}`;
    static openApps = {};

    static initialize() {
        this.registerSettings();
        this.setupHooks();
        this.setupSocket();
    }

    static registerSettings() {
        game.settings.register(this.ID, "session", { scope: "world", config: false, type: Object, default: null });
        game.settings.register(this.ID, "startDice", { scope: "world", config: false, type: Number, default: 5 });
        game.settings.register(this.ID, "onesWild", { scope: "world", config: false, type: Boolean, default: true });
    }

    static setupHooks() {
        Hooks.on("getSceneControlButtons", controls => {
            if (!game.user.isGM) return;
            const tok = controls.find(c => c.name === "token");
            if (!tok || tok.tools.some(t => t.name === this.ID)) return;
            tok.tools.push({
                name: this.ID,
                title: game.i18n.localize("QM.title"),
                icon: "fas fa-cheese",
                button: true,
                onClick: () => PlayerSelectApp.singleton.render(true)
            });
        });

        Hooks.on("renderChatMessage", (msg, html) => {
            const hasGmButtons = html[0].querySelector(".qm-btn-gm");
            if (hasGmButtons && game.user.isGM) {
                html.find('.qm-btn-gm').each((_, btn) => {
                    btn.addEventListener("click", ev => {
                        ev.preventDefault();
                        const action = ev.currentTarget.dataset.action;
                        if (action === "gm-remove-die") {
                            const actorId = ev.currentTarget.dataset.actorId;
                            this.QM.gmRemoveDie(actorId);
                        }
                        if (action === "gm-end-game") {
                            this.QM.gmEndGame();
                        }
                    });
                });
            }
        });
    }

    static setupSocket() {
        game.socket.on(this.SOCKET_NAME, data => {
            const { type, payload, targetUser } = data;
            if (targetUser && targetUser !== game.user.id) return;

            if (game.user.isGM && type === "PLAYER_ACTION") {
                const { action, callerIx, betData } = payload;
                if (action === "lie") this.QM.resolveLie(callerIx);
                if (action === "spoton") this.QM.resolveSpotOn(callerIx);
                if (action === "registerBet") this.QM.registerBet(betData);
                return;
            }

            if (type === "OPEN_TRAY") {
                if (QuesoMentira.openApps[payload.actorId]) QuesoMentira.openApps[payload.actorId].close();
                const tray = new DiceTrayApp(payload);
                QuesoMentira.openApps[payload.actorId] = tray;
                tray.render(true);
            }
             if (type === "UPDATE_ALL_TRAYS") {
                const session = game.settings.get(QuesoMentira.ID, "session");
                
                if (game.user.isGM && QuesoMentira.openApps['gm_tray']?.rendered) {
                    QuesoMentira.openApps['gm_tray'].render(true);
                }
                
                if (session) {
                    const humanPlayers = session.jugadores.filter(p => p.type === 'humano');
                    for (const player of humanPlayers) {
                         const actor = game.actors.get(player.actorId);
                         if (actor?.testUserPermission(game.user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER)) {
                             const tray = QuesoMentira.openApps[player.actorId];
                             if (tray?.rendered) {
                                tray.render(true);
                             }
                         }
                    }
                }
            }
            if (type === "CLOSE_ALL_TRAYS") {
                for (const app of Object.values(QuesoMentira.openApps)) {
                    app.close();
                }
                QuesoMentira.openApps = {};
            }
            if (type === "NOTIFY_ERROR") {
                ui.notifications.warn(payload);
            }
        });
    }

    static Helpers = {
        getUsersForActor(actorId) {
            const actor = game.actors.get(actorId);
            if (!actor) return [];
            return game.users.filter(u => u.active && actor.testUserPermission(u, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER));
        },
        binomTail(k, n, p) {
            let result = 0;
            for (let i = k; i <= n; i++) {
                const binomialCoeff = (fact, k) => {
                    let res = 1;
                    for (let i = 1; i <= k; i++) res = res * (fact - i + 1) / i;
                    return res;
                };
                result += binomialCoeff(n, i) * Math.pow(p, i) * Math.pow(1 - p, n - i);
            }
            return result;
        },
        stars: n => "★".repeat(n),
        status: S => {
            const playerLines = S.jugadores.map(j => {
                let icon = j.type === "humano" ? "🐭" : j.type === "ia" ? "🤖" : "👑";
                let line = `${icon} <b>${j.name}</b> | ${QuesoMentira.Helpers.stars(j.dadosRestantes)}`;
                if (game.user.isGM) {
                    line += ` <button class="qm-btn qm-btn-gm" data-action="gm-remove-die" data-actor-id="${j.actorId}">-1</button>`;
                }
                return line;
            }).join("<br>");
            let gmControls = game.user.isGM ? `<div class="flexrow" style="gap:.5rem; margin-top: 5px;"><button class="qm-btn qm-btn-gm" data-action="gm-end-game">${game.i18n.localize("QM.gm.endGame")}</button></div>` : "";
            return `<div class="qm-status"><b>${game.i18n.localize("QM.chat.statusTitle")}</b><br>${playerLines}${gmControls}</div>`;
        },
        playSound: (src, vol = 0.8) => {
            foundry.audio.AudioHelper.play({ src: `modules/${QuesoMentira.ID}/assets/sounds/${src}`, volume: vol, autoplay: true, loop: false }, true);
        },
        updateAllUIs() {
            game.socket.emit(QuesoMentira.SOCKET_NAME, { type: "UPDATE_ALL_TRAYS" });
        }
    }

    static QM = {
        async startGame(formData) {
            if (!game.user.isGM) return;
            const jugadores = [];
            const startDice = Number(formData["start-dice"]);
            const onesWild = !!formData["qm-ones-wild"];
            await game.settings.set(QuesoMentira.ID, "startDice", startDice);
            await game.settings.set(QuesoMentira.ID, "onesWild", onesWild);

            for (const [k, v] of Object.entries(formData)) {
                if (!v || ["start-dice", "qm-ones-wild"].includes(k)) continue;
                const [, id] = k.match(/actor-(.+)-mode/);
                const actor = game.actors.get(id);
                if (!actor) continue;
                let playerType = v.startsWith("ia-") ? "ia" : v;
                let level = v.startsWith("ia-") ? v.replace("ia-", "") : null;
                jugadores.push({ name: actor.name, type: playerType, level, actorId: id, dadosRestantes: startDice, dados: [] });
            }
            if (jugadores.length < 2) { ui.notifications.warn(game.i18n.localize("QM.notify.twoTokensNeeded")); return; }
            
            const session = { jugadores, ronda: 0, turno: 0, apuesta: null, onesWild, active: true };
            await game.settings.set(QuesoMentira.ID, "session", session);
            
            ChatMessage.create({ content: `<h2 class="qm-msg">${game.i18n.localize("QM.chat.gameStarts")}</h2><p class="qm-msg">${session.onesWild ? game.i18n.localize("QM.chat.wildRule") : game.i18n.localize("QM.chat.noWildRule")}</p>`, classes: ["qm-msg"] });
            this.startRound();
        },

        async startRound() {
            if (!game.user.isGM) return;
            let S = game.settings.get(QuesoMentira.ID, "session");
            if (!S || !S.active) return;
            
            QuesoMentira.Helpers.playSound('roll.ogg', 0.6);

            for (const j of S.jugadores) {
                const token = canvas.tokens.placeables.find(t => t.actor?.id === j.actorId);
                if (token?.actor?.effects.find(e => e.getFlag("core", "statusId") === CONFIG.specialStatusEffects.DEFEATED)) {
                    await token.actor.toggleStatusEffect(CONFIG.specialStatusEffects.DEFEATED, { active: false });
                }
                const roll = new Roll(`${j.dadosRestantes}d6`);
                await roll.evaluate();
                j.dados = roll.dice[0].results.map(r => r.result).sort((a, b) => a - b);
                
                if (j.type === "humano") {
                    QuesoMentira.Helpers.getUsersForActor(j.actorId).forEach(owner => {
                        game.socket.emit(QuesoMentira.SOCKET_NAME, { type: "OPEN_TRAY", payload: j, targetUser: owner.id });
                    });
                }
            }
            
            if (!QuesoMentira.openApps['gm_tray']?.rendered) {
                const gmTray = new GMDiceTrayApp();
                QuesoMentira.openApps['gm_tray'] = gmTray;
                gmTray.render(true);
            }

            S.totalDados = S.jugadores.reduce((t, j) => t + j.dadosRestantes, 0);
            S.turno = S.turno ?? Math.floor(Math.random() * S.jugadores.length);
            if (S.turno >= S.jugadores.length) S.turno = 0;
            S.apuesta = null;
            S.ronda++;
            await game.settings.set(QuesoMentira.ID, "session", S);
            
            const startPlayer = S.jugadores[S.turno];
            ChatMessage.create({ content: `<i class="qm-msg">${game.i18n.format("QM.chat.roundStarts", { round: S.ronda, name: startPlayer.name })}</i>`, classes: ["qm-msg"] });
            ChatMessage.create({ content: QuesoMentira.Helpers.status(S), "flags.core.canPopout": true });
            
            QuesoMentira.Helpers.updateAllUIs();
            this.promptTurn();
        },

        promptTurn() {
            if (!game.user.isGM) return;
            const S = game.settings.get(QuesoMentira.ID, "session");
            if (!S || !S.active) return;
            const j = S.jugadores[S.turno];
            const token = canvas.tokens.placeables.find(t => t.actor?.id === j.actorId);
            if (token) canvas.ping(token.center, { style: "pulse" });
            
            if (j.type === "humano" || j.type === "gm") return; 
            
            window.setTimeout(() => {
                const aiFunction = { "experta": this.aiExpert, "tramposa": this.aiCheater }[j.level] || this.aiBasic;
                aiFunction.call(this, j);
            }, 1500);
        },

        promptRaise(ix) {
            const S = game.settings.get(QuesoMentira.ID, "session");
            const player = S.jugadores[ix];
            const p = S.apuesta;
            const minC = p ? p.cantidad : 1;
            const minV = p ? p.valor + 1 : 1;

            const dialogTitle = game.i18n.format("QM.dialog.betTitle", { name: player.name });
            const content = `<form class="flexcol"><label>${game.i18n.format("QM.dialog.quantityLabel",{min:minC,max:S.totalDados})}:<input id="c" type="number" value="${minC}" min="${minC}" max="${S.totalDados}"></label><label>${game.i18n.localize("QM.dialog.valueLabel")}:<input id="v" type="number" value="${minV}" min="${minV > 6 ? 6 : minV}" max="6"></label></form>`;
            new Dialog({
                title: dialogTitle,
                content,
                buttons: {
                    raise: {
                        label: game.i18n.localize("QM.dialog.raiseButton"),
                        icon: '<i class="fas fa-check"></i>',
                        callback: h => {
                            const betData = { cantidad: +h.find("#c").val(), valor: +h.find("#v").val(), jugadorIx: ix };
                            if (game.user.isGM) this.registerBet(betData);
                            else game.socket.emit(QuesoMentira.SOCKET_NAME, { type: "PLAYER_ACTION", payload: { action: "registerBet", betData } });
                        }
                    }
                },
                default: "raise"
            }, { classes: ["qm-dialog"] }).render(true);
        },
        
        async registerBet(betData) {
            if (!game.user.isGM) return;
            let S = game.settings.get(QuesoMentira.ID, "session");
            if (!S || !S.active) return;
            const { cantidad, valor, jugadorIx } = betData;
            const p = S.apuesta;
            
            let ok = !p || cantidad > p.cantidad || (cantidad === p.cantidad && valor > p.valor);

            if (cantidad < 1 || cantidad > S.totalDados || valor < 1 || valor > 6 || !ok) {
                const errorMsg = game.i18n.localize("QM.notify.invalidBet");
                if (S.jugadores[jugadorIx].type === 'gm') ui.notifications.warn(errorMsg);
                else QuesoMentira.Helpers.getUsersForActor(S.jugadores[jugadorIx].actorId).forEach(owner => game.socket.emit(QuesoMentira.SOCKET_NAME, { type: "NOTIFY_ERROR", payload: errorMsg, targetUser: owner.id }));
                return;
            }

            S.apuesta = { cantidad, valor, jugadorIx };
            S.turno = (jugadorIx + 1) % S.jugadores.length;
            await game.settings.set(QuesoMentira.ID, "session", S);
            
            ChatMessage.create({ content: `<b>${S.jugadores[jugadorIx].name}</b> ${game.i18n.format("QM.chat.bets", {cantidad, valor})}` });
            
            // SOLUCIÓN: Forzar la actualización de la bandeja del GM directamente, además de la señal global.
            if (game.user.isGM && QuesoMentira.openApps['gm_tray']) {
                QuesoMentira.openApps['gm_tray'].render(true);
            }
            QuesoMentira.Helpers.updateAllUIs();
            this.promptTurn();
        },

        aiBasic(j) {
            const S = game.settings.get(QuesoMentira.ID, "session"), p = S.apuesta;
            let c, v;
            if (!p) { c = 1; v = Math.ceil(Math.random() * 6); }
            else if (p.cantidad < S.totalDados) { c = p.cantidad + 1; v = p.valor; }
            else if (p.valor < 6) { c = p.cantidad; v = p.valor + 1; }
            else { this.resolveLie(S.turno); return; }
            this.registerBet({ cantidad: c, valor: v, jugadorIx: S.turno });
        },
        aiExpert(j) {
            const S = game.settings.get(QuesoMentira.ID, "session"), p = S.apuesta;
            const own = j.dados.reduce((o, d) => ((o[d] = (o[d] || 0) + 1), o), {});
            if (S.onesWild) { if (own[1]) { for (const d of [2, 3, 4, 5, 6]) own[d] = (own[d] || 0) + own[1]; } }
            const rest = S.totalDados - j.dadosRestantes;
            const pDie = v => (v === 1 || !S.onesWild) ? 1 / 6 : 2 / 6;
            if (p) {
                const need = p.cantidad - (own[p.valor] || 0);
                if (need > 0 && QuesoMentira.Helpers.binomTail(need, rest, pDie(p.valor)) < 0.3) { this.resolveLie(S.turno); return; }
            }
            const startC = p ? p.cantidad : 1;
            for (let c = startC; c <= S.totalDados; c++) {
                const startV = (p && c === p.cantidad) ? p.valor + 1 : 1;
                for (let v = startV; v <= 6; v++) {
                    const need = c - (own[v] || 0);
                    if (need >= 0 && QuesoMentira.Helpers.binomTail(need, rest, pDie(v)) >= 0.35) { this.registerBet({ cantidad: c, valor: v, jugadorIx: S.turno }); return; }
                }
            }
            this.resolveLie(S.turno);
        },
        aiCheater(j) {
            const S = game.settings.get(QuesoMentira.ID, "session"), p = S.apuesta;
            const counts = {};
            S.jugadores.forEach(pl => pl.dados.forEach(d => counts[d] = (counts[d] || 0) + 1));
            const wild = v => v === 1 || !S.onesWild ? counts[v] || 0 : (counts[v] || 0) + (counts[1] || 0);
            if (p && wild(p.valor) < p.cantidad) { this.resolveLie(S.turno); return; }
            let bestV = 1, bestC = wild(1);
            for (let v = 2; v <= 6; v++) { const c = wild(v); if (c > bestC) { bestC = c; bestV = v; } }
            let c = p ? p.cantidad : 1, v = p ? p.valor : 1;
            if(p){
                if (bestC > p.cantidad) { c = bestC; v = bestV; } 
                else if (bestC === p.cantidad) { c = bestC; v = Math.max(p.valor + 1, bestV); } 
                else { c = p.cantidad + 1; v = p.valor; }
            } else { c = bestC; v = bestV; }
            if (v > 6) { c++; v = 1; }
            if (c > S.totalDados) { this.resolveLie(S.turno); return; }
            this.registerBet({ cantidad: c, valor: v, jugadorIx: S.turno });
        },
      
        async resolveRound(loserIndices, diceLost = 1) {
            if (!game.user.isGM) return;
            let S = game.settings.get(QuesoMentira.ID, "session");
            if (!S || !S.active) return;
            
            const indices = Array.isArray(loserIndices) ? loserIndices : [loserIndices];
            let nextTurnPlayerId = S.jugadores[indices[0]]?.actorId;

            for (const loserIndex of indices) {
                const loser = S.jugadores[loserIndex];
                if (!loser) continue;
                loser.dadosRestantes -= diceLost;
                if (loser.dadosRestantes <= 0) {
                    loser.dadosRestantes = 0;
                    const token = canvas.tokens.placeables.find(t => t.actor?.id === loser.actorId);
                    if (token?.actor && !token.actor.effects.find(e => e.getFlag("core", "statusId") === CONFIG.specialStatusEffects.DEFEATED)) {
                        await token.actor.toggleStatusEffect(CONFIG.specialStatusEffects.DEFEATED, { active: true, overlay: true });
                    }
                }
            }
            S.jugadores = S.jugadores.filter(p => p.dadosRestantes > 0);
            
            if (S.jugadores.length <= 1) {
                QuesoMentira.Helpers.playSound('win.ogg', 1);
                const winnerName = S.jugadores.length ? S.jugadores[0].name : game.i18n.localize("QM.chat.noWinner");
                await ChatMessage.create({ content: `<h2 class="qm-msg">${S.jugadores.length ? game.i18n.format("QM.chat.winsGame", { name: winnerName }) : winnerName}</h2>`, classes: ["qm-msg"] });
                await game.settings.set(QuesoMentira.ID, "session", null);
                QuesoMentira.Helpers.updateAllUIs();
                return;
            }
            
            S.turno = S.jugadores.findIndex(p => p.actorId === nextTurnPlayerId);
            if (S.turno === -1) S.turno = 0;
            await game.settings.set(QuesoMentira.ID, "session", S);
            
            QuesoMentira.Helpers.updateAllUIs();
            setTimeout(() => this.startRound(), 3000);
        },

        async resolveLie(callerIx) {
            if (!game.user.isGM) return;
            let S = game.settings.get(QuesoMentira.ID, "session");
            if (!S || !S.active || !S.apuesta) return;
            const p = S.apuesta;
            const total = S.jugadores.flatMap(j => j.dados).filter(d => d === p.valor || (S.onesWild && p.valor !== 1 && d === 1)).length;
            const isLiar = total < p.cantidad;
            const loserIndex = isLiar ? p.jugadorIx : callerIx;
            const loser = S.jugadores[loserIndex];
            const comodinTxt = S.onesWild && p.valor !== 1 ? ` ${game.i18n.localize("QM.chat.wildsIncluded")}` : "";
            
            await ChatMessage.create({ content: `<h3 class="qm-msg">${game.i18n.localize("QM.chat.revealTitle")}</h3><p class="qm-msg">${game.i18n.format("QM.chat.revealResult",{total,value:p.valor,wild:comodinTxt})}</p><p class="qm-msg"><b>${loser.name}</b> ${game.i18n.format("QM.chat.losesDie",{count:1,remaining:Math.max(0,loser.dadosRestantes-1)})}</p>`, classes: ["qm-msg"] });
            
            S.apuesta = null;
            await game.settings.set(QuesoMentira.ID, "session", S);
            QuesoMentira.Helpers.updateAllUIs();
            
            this.resolveRound(loserIndex, 1);
        },

        async resolveSpotOn(callerIx) {
            if (!game.user.isGM) return;
            let S = game.settings.get(QuesoMentira.ID, "session");
            if (!S || !S.active || !S.apuesta) return;
            const p = S.apuesta;
            const total = S.jugadores.flatMap(j => j.dados).filter(d => d === p.valor || (S.onesWild && p.valor !== 1 && d === 1)).length;
            const isCorrect = total === p.cantidad;
            const caller = S.jugadores[callerIx];
            const comodinTxt = S.onesWild && p.valor !== 1 ? ` ${game.i18n.localize("QM.chat.wildsIncluded")}` : "";
            
            await ChatMessage.create({ content: `<h3 class="qm-msg">${game.i18n.format("QM.chat.spotOnCalled",{name:caller.name})}</h3><p class="qm-msg">${game.i18n.format("QM.chat.revealResult",{total,value:p.valor,wild:comodinTxt})}</p>`, classes: ["qm-msg"] });
            
            S.apuesta = null;
            await game.settings.set(QuesoMentira.ID, "session", S);
            QuesoMentira.Helpers.updateAllUIs();
            
            if (isCorrect) {
                await ChatMessage.create({ content: `<p class="qm-msg"><b>${caller.name}</b> ${game.i18n.localize("QM.chat.spotOnSuccess")}</p>` });
                this.resolveRound(S.jugadores.map((_,i) => i).filter(i => i !== callerIx), 1);
            } else {
                await ChatMessage.create({ content: `<p class="qm-msg"><b>${caller.name}</b> ${game.i18n.localize("QM.chat.spotOnFail")}</p>` });
                this.resolveRound(callerIx, 2);
            }
        },

        async gmRemoveDie(actorId) {
            const S = game.settings.get(QuesoMentira.ID, "session");
            const playerIndex = S.jugadores.findIndex(p => p.actorId === actorId);
            if (playerIndex === -1) return;
            await ChatMessage.create({ content: `<p class="qm-msg">${game.i18n.format("QM.gm.dieRemoved", {name: S.jugadores[playerIndex].name})}</p>` });
            this.resolveRound(playerIndex, 1);
        },

        async gmEndGame() {
            await game.settings.set(QuesoMentira.ID, "session", null);
            await ChatMessage.create({ content: `<p class="qm-msg">${game.i18n.localize("QM.gm.gameEndedManually")}</p>` });
            QuesoMentira.Helpers.updateAllUIs();
        }
    }
}


// ===================================================================================
// 3. INICIALIZACIÓN DEL MÓDULO
// ===================================================================================

Hooks.once("setup", () => {
    QuesoMentira.initialize();
});

// --- FIN DEL ARCHIVO ---