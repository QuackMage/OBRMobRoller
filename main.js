import OBR from "https://cdn.jsdelivr.net/npm/@owlbear-rodeo/sdk/dist/obr.min.js";

function rollDie(sides) {
  return Math.floor(Math.random() * sides) + 1;
}
function rollNd6(n) {
  const rolls = Array.from({ length: n }, () => rollDie(6));
  const total = rolls.reduce((a, b) => a + b, 0);
  return { rolls, total };
}
function roll6d6DropLowest() {
  const rolls = Array.from({ length: 6 }, () => rollDie(6));
  const sorted = [...rolls].sort((a,b)=>a-b);
  const dropped = sorted[0];
  const kept = sorted.slice(1);
  const total = kept.reduce((a,b)=>a+b,0);
  return { rolls, kept, dropped, total };
}
function mapAtkDie(total) {
  if (total <= 11) return 4;
  if (total <= 13) return 6;
  if (total <= 15) return 8;
  if (total <= 17) return 10;
  return 12; // 18+
}
function fmtRolls(tag, r) {
  if (r.kept) return `${tag}: [${r.rolls.join(", ")}] drop ${r.dropped} = ${r.total}`;
  return `${tag}: [${r.rolls.join(", ")}] = ${r.total}`;
}

async function ensureGM() {
  const role = await OBR.player.getRole();
  if (role !== "GM") {
    await OBR.notification.show("Only the GM can use this roller.", "WARNING");
    throw new Error("Not GM");
  }
}

async function writeLocalText(lines) {
  // Position near the current viewport center
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
    .strokeColor("#fff")
    .strokeWidth(0)
    .textAlign("LEFT")
    .position(pos)
    .build();

  await OBR.scene.local.addItems([item]); // GM-only
  await OBR.notification.show("GM-only roll created.", "SUCCESS");
}

function rollPackage(nd6, label) {
  const hp = rollNd6(nd6);
  const ac = rollNd6(nd6);
  const atkBaseRoll = rollNd6(nd6);
  const atkModRoll = rollNd6(nd6);

  const atkDieSides = mapAtkDie(atkBaseRoll.total);
  const atkDieResult = rollDie(atkDieSides);

  const modDieSides = mapAtkDie(atkModRoll.total);
  const modDieResult = rollDie(modDieSides);

  const lines = [
    `=== ${label} ===`,
    fmtRolls("HP", hp),
    fmtRolls("AC", ac),
    fmtRolls("ATK Seed", atkBaseRoll) + ` → d${atkDieSides} = ${atkDieResult}`,
    fmtRolls("Mod Seed", atkModRoll) + ` → +d${modDieSides} = ${modDieResult}`,
    `ATK Total: ${atkDieResult + modDieResult}`,
  ];

  return lines;
}

function rollBBEG(levelBonus) {
  const hp = roll6d6DropLowest();
  const ac = roll6d6DropLowest();
  const atkSeed = roll6d6DropLowest();
  const modSeed = roll6d6DropLowest();

  const atkDieSides = mapAtkDie(atkSeed.total);
  const atkDieResult = rollDie(atkDieSides);

  const modDieSides = mapAtkDie(modSeed.total);
  const modDieResult = rollDie(modDieSides);

  // Extra HP: + (levelBonus)d6
  let hpBonus = { rolls: [], total: 0 };
  if (levelBonus && levelBonus > 0) {
    const rolls = Array.from({ length: levelBonus }, () => rollDie(6));
    hpBonus.rolls = rolls;
    hpBonus.total = rolls.reduce((a,b)=>a+b,0);
  }

  const lines = [
    `=== BBEG (6d6 drop lowest) ===`,
    fmtRolls("HP", hp) + (hpBonus.total ? `  + [${hpBonus.rolls.join(", ")}] = ${hp.total + hpBonus.total}` : ""),
    fmtRolls("AC", ac),
    fmtRolls("ATK Seed", atkSeed) + ` → d${atkDieSides} = ${atkDieResult}`,
    fmtRolls("Mod Seed", modSeed) + ` → +d${modDieSides} = ${modDieResult}`,
    `ATK Total: ${atkDieResult + modDieResult}`,
  ];

  return lines;
}

OBR.onReady(async () => {
  try { await ensureGM(); } catch { return; }

  // Wire buttons
  document.getElementById("weak").addEventListener("click", async () => {
    await writeLocalText(rollPackage(3, "Weak Mob (3d6)"));
  });
  document.getElementById("strong").addEventListener("click", async () => {
    await writeLocalText(rollPackage(4, "Strong Mob (4d6)"));
  });
  document.getElementById("threat").addEventListener("click", async () => {
    await writeLocalText(rollPackage(5, "Threatening Mob (5d6)"));
  });
  document.getElementById("bbeg").addEventListener("click", async () => {
    const lvl = parseInt(document.getElementById("bbegLevel").value, 10) || 0;
    await writeLocalText(rollBBEG(lvl));
  });
});
