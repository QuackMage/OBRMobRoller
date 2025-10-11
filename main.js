import OBR from "https://cdn.jsdelivr.net/npm/@owlbear-rodeo/sdk/dist/obr.min.js";

const el = (id) => document.getElementById(id);

// ---- Dice helpers ----
const d = (sides) => Math.floor(Math.random() * sides) + 1;
const rollNd6 = (n) => { const rolls = Array.from({length:n}, ()=>d(6)); return { rolls, total: rolls.reduce((a,b)=>a+b,0) }; };
const roll6d6DropLowest = () => {
  const rolls = Array.from({length:6}, ()=>d(6));
  const sorted = [...rolls].sort((a,b)=>a-b);
  const dropped = sorted[0];
  const kept = sorted.slice(1);
  return { rolls, kept, dropped, total: kept.reduce((a,b)=>a+b,0) };
};
const mapAtkDie = (t) => (t<=11?4:t<=13?6:t<=15?8:t<=17?10:12);
const fmtRolls = (tag, r) => r.kept
  ? `${tag}: [${r.rolls.join(", ")}] drop ${r.dropped} = ${r.total}`
  : `${tag}: [${r.rolls.join(", ")}] = ${r.total}`;

// ---- Guards ----
async function requireGMAndScene() {
  const role = await OBR.player.getRole();
  if (role !== "GM") {
    await OBR.notification.show("Only the GM can use this roller.", "WARNING");
    throw new Error("Not GM");
  }
  const sceneId = await OBR.scene.getId();
  if (!sceneId) {
    await OBR.notification.show("Open a scene first to place the GM-only note.", "WARNING");
    throw new Error("No scene");
  }
}

async function writeLocalText(lines) {
  const view = await OBR.viewport.getViewport();
  const pos = { x: view.center.x, y: view.center.y };
  const text = lines.join("\n");

  const item = OBR.scene.local
    .buildText()
    .plainText(text)
    .width("AUTO")
    .fontFamily("monospace")
    .fontSize(14)
    .padding(8)
    .fillColor("#111")
    .textColor("#ffffff")
    .textAlign("LEFT")
    .position(pos)
    .build();

  await OBR.scene.local.addItems([item]);
  await OBR.notification.show("GM-only roll created.", "SUCCESS");
}

// ---- Roll packages ----
function rollPackage(nd6, label) {
  const hp = rollNd6(nd6);
  const ac = rollNd6(nd6);
  const atkSeed = rollNd6(nd6);
  const modSeed = rollNd6(nd6);

  const atkSides = mapAtkDie(atkSeed.total);
  const atkVal = d(atkSides);
  const modSides = mapAtkDie(modSeed.total);
  const modVal = d(modSides);

  return [
    `=== ${label} ===`,
    fmtRolls("HP", hp),
    fmtRolls("AC", ac),
    fmtRolls("ATK Seed", atkSeed) + ` → d${atkSides} = ${atkVal}`,
    fmtRolls("Mod Seed", modSeed) + ` → +d${modSides} = ${modVal}`,
    `ATK Total: ${atkVal + modVal}`,
  ];
}

function rollBBEG(levelBonus) {
  const hp = roll6d6DropLowest();
  const ac = roll6d6DropLowest();
  const atkSeed = roll6d6DropLowest();
  const modSeed = roll6d6DropLowest();

  const atkSides = mapAtkDie(atkSeed.total);
  const atkVal = d(atkSides);
  const modSides = mapAtkDie(modSeed.total);
  const modVal = d(modSides);

  let bonusText = "";
  if (levelBonus > 0) {
    const rolls = Array.from({length: levelBonus}, ()=>d(6));
    const total = rolls.reduce((a,b)=>a+b,0);
    bonusText = `  + [${rolls.join(", ")}] = ${hp.total + total}`;
  }

  return [
    `=== BBEG (6d6 drop lowest) ===`,
    fmtRolls("HP", hp) + bonusText,
    fmtRolls("AC", ac),
    fmtRolls("ATK Seed", atkSeed) + ` → d${atkSides} = ${atkVal}`,
    fmtRolls("Mod Seed", modSeed) + ` → +d${modSides} = ${modVal}`,
    `ATK Total: ${atkVal + modVal}`,
  ];
}

// ---- Wire buttons whether or not we're GM yet ----
function wire() {
  el("weak")?.addEventListener("click", async () => {
    try { await requireGMAndScene(); await writeLocalText(rollPackage(3, "Weak Mob (3d6)")); }
    catch (e) { /* notifications already shown */ }
  });
  el("strong")?.addEventListener("click", async () => {
    try { await requireGMAndScene(); await writeLocalText(rollPackage(4, "Strong Mob (4d6)")); }
    catch (e) {}
  });
  el("threat")?.addEventListener("click", async () => {
    try { await requireGMAndScene(); await writeLocalText(rollPackage(5, "Threatening Mob (5d6)")); }
    catch (e) {}
  });
  el("bbeg")?.addEventListener("click", async () => {
    try {
      await requireGMAndScene();
      const lvl = parseInt(el("bbegLevel")?.value ?? "0", 10) || 0;
      await writeLocalText(rollBBEG(lvl));
    } catch (e) {}
  });
}

OBR.onReady(wire);
