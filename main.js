// main.js
// Import OBR SDK via CORS-friendly ESM endpoint
import OBR from "https://cdn.jsdelivr.net/npm/@owlbear-rodeo/sdk@3/+esm";

const el = (id) => document.getElementById(id);

// ---------- Dice helpers ----------
const d = (sides) => Math.floor(Math.random() * sides) + 1;

const rollNd6 = (n) => {
  const rolls = Array.from({ length: n }, () => d(6));
  return { rolls, total: rolls.reduce((a, b) => a + b, 0) };
};

const roll6d6DropLowest = () => {
  const rolls = Array.from({ length: 6 }, () => d(6));
  const sorted = [...rolls].sort((a, b) => a - b);
  const dropped = sorted[0];
  const kept = sorted.slice(1);
  return { rolls, kept, dropped, total: kept.reduce((a, b) => a + b, 0) };
};

const mapAtkDie = (t) => (t <= 11 ? 4 : t <= 13 ? 6 : t <= 15 ? 8 : t <= 17 ? 10 : 12);

// ---------- Guards ----------
async function requireGM() {
  const role = await OBR.player.getRole();
  if (role !== "GM") {
    await OBR.notification.show("Only the GM can use this roller.", "WARNING");
    throw new Error("Not GM");
  }
}

// ---------- Viewport center (best effort; not required if builder missing) ----------
async function getViewportCenterSafe() {
  try {
    if (OBR.viewport && typeof OBR.viewport.getBounds === "function") {
      const b = await OBR.viewport.getBounds();
      return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    }
    if (OBR.camera && typeof OBR.camera.getView === "function") {
      const v = await OBR.camera.getView();
      if (v?.position) return { x: v.position.x, y: v.position.y };
    }
  } catch (_) { /* ignore */ }
  return { x: 0, y: 0 };
}

// ---------- Writer with graceful fallback ----------
async function writeLocalTextOrNotify(text) {
  // If local text builder exists, try to place a GM-only note
  const hasBuilder = !!(OBR.scene?.local && typeof OBR.scene.local.buildText === "function");

  if (hasBuilder) {
    try {
      const center = await getViewportCenterSafe();
      const jitter = (n) => Math.floor(Math.random() * n) - n / 2;
      const pos = { x: center.x + jitter(40), y: center.y + jitter(40) };

      const item = OBR.scene.local
        .buildText()
        .plainText(text)
        .width("AUTO")
        .fontFamily("monospace")
        .fontSize(20)
        .padding(10)
        .fillColor("#111111")
        .textColor("#ffffff")
        .strokeColor("#ffffff")
        .strokeWidth(2)
        .textAlign("LEFT")
        .position(pos)
        .build();

      await OBR.scene.local.addItems([item]); // GM-only local item
      if (center.x === 0 && center.y === 0) {
        await OBR.notification.show("GM-only note placed at (0,0). Pan to top-left if not visible.", "INFO");
      } else {
        await OBR.notification.show("GM-only roll created.", "SUCCESS");
      }
      return;
    } catch (err) {
      console.warn("Local text add failed; falling back to notification:", err);
    }
  } else {
    console.warn("OBR.scene.local.buildText is not available; using notification output.");
  }

  // Fallback: show compact result as a GM-only notification
  await OBR.notification.show(text, "SUCCESS");
}

// ---------- Compact format builders ----------
function formatCompact(label, desc, hpTotal, acTotal, atkSides, modSides) {
  return `=== ${label} (${desc}) === HP: ${hpTotal} AC: ${acTotal} ATK: d${atkSides} Mod: +d${modSides}`;
}

function buildCompactForNd6(nd6, label) {
  const hp = rollNd6(nd6);
  const ac = rollNd6(nd6);
  const atkSeed = rollNd6(nd6);
  const modSeed = rollNd6(nd6);

  const atkSides = mapAtkDie(atkSeed.total);
  const modSides = mapAtkDie(modSeed.total);

  return formatCompact(label, `${nd6}d6`, hp.total, ac.total, atkSides, modSides);
}

function buildCompactForBBEG(levelBonus) {
  const hp = roll6d6DropLowest();
  const ac = roll6d6DropLowest();
  const atkSeed = roll6d6DropLowest();
  const modSeed = roll6d6DropLowest();

  const atkSides = mapAtkDie(atkSeed.total);
  const modSides = mapAtkDie(modSeed.total);

  const bonusDesc = levelBonus > 0 ? ` + ${levelBonus}d6 HP` : "";
  return formatCompact("BBEG", `6d6 drop lowest${bonusDesc}`, hp.total, ac.total, atkSides, modSides);
}

// ---------- Wire buttons ----------
function wire() {
  console.log("Wiring buttons...");

  el("weak")?.addEventListener("click", async () => {
    try {
      await requireGM();
      const out = buildCompactForNd6(3, "Weak Mob");
      await writeLocalTextOrNotify(out);
    } catch (e) { console.warn(e); }
  });

  el("strong")?.addEventListener("click", async () => {
    try {
      await requireGM();
      const out = buildCompactForNd6(4, "Strong Mob");
      await writeLocalTextOrNotify(out);
    } catch (e) { console.warn(e); }
  });

  el("threat")?.addEventListener("click", async () => {
    try {
      await requireGM();
      const out = buildCompactForNd6(5, "Threatening Mob");
      await writeLocalTextOrNotify(out);
    } catch (e) { console.warn(e); }
  });

  el("bbeg")?.addEventListener("click", async () => {
    try {
      await requireGM();
      const lvl = parseInt(el("bbegLevel")?.value ?? "0", 10) || 0;
      const out = buildCompactForBBEG(lvl);
      await writeLocalTextOrNotify(out);
    } catch (e) { console.warn(e); }
  });
}

// Ensure SDK is ready, then wire the buttons
OBR.onReady(wire);
