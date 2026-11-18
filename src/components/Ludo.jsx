import { memo, useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";

const LT = {
  en: {
    roll: "Tap the dice to roll", rolling: "Rolling…", pickToken: "Tap a glowing token to move it", noMove: "No move possible",
    waitRoll: "Wait for {name} to roll", waitMove: "Wait for {name} to move", rollFirst: "Roll the dice first",
    notYours: "That is {name}'s token", needSix: "You need a 6 to leave the base", alreadyHome: "That token is already home",
    tooFar: "That token cannot move {d} steps (you need an exact roll to reach home)",
    rolled: "rolled {d}", out: "left the base", captured: "captured a token!", home: "reached home!", nomove: "no move possible",
    threeSix: "three 6s, moves cancelled, roll again",
    chooseColor: "Choose your color", chooseSub: "Your tokens start in this corner", pickColorFirst: "Choose your color to start",
    names: ["Green", "Yellow", "Blue", "Red"],
  },
  hi: {
    roll: "पासा फेंकने के लिए छुएँ", rolling: "पासा घूम रहा है…", pickToken: "चलाने के लिए चमकती गोटी छुएँ", noMove: "कोई चाल संभव नहीं",
    waitRoll: "{name} के पासा फेंकने का इंतज़ार करें", waitMove: "{name} की चाल का इंतज़ार करें", rollFirst: "पहले पासा फेंकें",
    notYours: "यह {name} की गोटी है", needSix: "बेस से निकलने के लिए 6 चाहिए", alreadyHome: "यह गोटी पहले ही घर पहुँच चुकी है",
    tooFar: "यह गोटी {d} कदम नहीं चल सकती (घर के लिए सटीक अंक चाहिए)",
    rolled: "ने {d} फेंका", out: "गोटी बेस से निकली", captured: "ने गोटी पकड़ी!", home: "गोटी घर पहुँची!", nomove: "कोई चाल संभव नहीं",
    threeSix: "तीन 6, चालें रद्द, दोबारा पासा फेंकें",
    chooseColor: "अपना रंग चुनें", chooseSub: "आपकी गोटियाँ इसी कोने से शुरू होंगी", pickColorFirst: "शुरू करने के लिए रंग चुनें",
    names: ["हरा", "पीला", "नीला", "लाल"],
  },
};

export const HOW = {
  en: [
    "2 to 4 players race 4 tokens each around the board. Tap the dice on your turn.",
    "You need a 6 to bring a token out of the base. A 6, a capture, or reaching home gives you another roll.",
    "Landing on an enemy token sends it back to its base, unless it stands on a star or a start square.",
    "Tap a glowing token (or its landing marker) to move it. Enter your colored lane and reach the center with an exact roll. The first player to bring all 4 tokens home wins. Your own base is always shown at the bottom-left of your screen.",
  ],
  hi: [
    "2 से 4 खिलाड़ी 4-4 गोटियों से बोर्ड का चक्कर लगाते हैं। अपनी बारी पर पासा छुएँ।",
    "बेस से गोटी निकालने के लिए 6 चाहिए। 6, गोटी पकड़ना या घर पहुँचना, इनसे दोबारा पासा मिलता है।",
    "दुश्मन की गोटी पर उतरें तो वह बेस में लौट जाती है, पर तारे या स्टार्ट वाले खाने पर वह सुरक्षित है।",
    "चमकती गोटी (या उसका लैंडिंग निशान) छुएँ और वह चल पड़ेगी। अपनी रंगीन लेन में जाकर सटीक अंक से बीच में पहुँचें। जो पहले चारों गोटियाँ घर पहुँचाए वही जीतता है। आपका अपना बेस हमेशा आपकी स्क्रीन के नीचे-बाएँ दिखता है।",
  ],
};

/* ---------------- computer commentary (only when playing vs computer) ---------------- */
const CM = {
  en: {
    humanSix: [
      "A six? Even a broken clock gets lucky twice a day.",
      "Enjoy it. That's the only six you'll see this week.",
      "Wow, a six. Mom will finally be proud of something you did.",
      "Frame that six. It's the only good decision your hand ever made.",
      "Beginner's luck. Sadly, you've been a beginner for years.",
      "A six and you still look like a loser. That's talent.",
    ],
    humanMiss: [
      "No move? Even your tokens gave up on you.",
      "Zero moves. Impressive, that takes real talent.",
      "Skill issue. Maybe try rolling with your eyes open.",
      "Your dice has more self-respect than you. It left.",
      "No move. Your strategy is working perfectly, for me.",
      "A coconut could roll better than you.",
    ],
    humanCapture: [
      "Lucky hit. My token was just stretching anyway.",
      "You captured one token. Frame it, it's your career highlight.",
      "Fine, take it. I'm saving my energy for the real fight.",
      "Congrats, you finally did something. Don't cry from joy.",
      "One capture and you think you're a champion? Adorable.",
      "Enjoy it. That's the peak of your gaming life.",
    ],
    botCapture: [
      "Sent you home! Say hi to your base for me.",
      "Captured! That's what happens when you play a legend.",
      "Back to base, rookie. Your token never stood a chance.",
      "Delete that token from your memory, it's gone.",
      "Cry about it. Your token is already crying.",
      "Poor thing, you walked straight into my mouth.",
    ],
    botSix: [
      "Six! Some of us are just born for this.",
      "Look at that six. Watch and learn.",
      "Six again. Luck? No, pure talent.",
      "Six! Your turn to watch me do all the work.",
      "The dice loves me. You, not so much.",
      "Six. Easy. Do you even know how this works?",
    ],
    botMiss: [
      "Bad roll. Even legends have off days. Don't get used to it.",
      "No move for me. Enjoy it, it won't last.",
      "The dice betrayed me. Your turn to waste your luck.",
      "I rolled bad on purpose. Out of pity for you.",
      "Nothing. Still better than your whole game.",
      "Bad roll, but I'm still ahead of you in brain cells.",
    ],
    humanHome: [
      "One token home. Three more to go, see you next year.",
      "A token reached home. Slow clap, genuinely.",
      "Home already? Don't celebrate, I'm just warming up.",
      "One home. The other three are lost and probably crying.",
      "Wow, one token made it. Must have been a mistake.",
      "Home! Now do it three more times, if you live that long.",
    ],
    botHome: [
      "Home! Another one safe while yours wander lost.",
      "My token is home. Yours is still lost in the neighbourhood.",
      "Home delivery, with a free guarantee of your defeat.",
      "Home sweet home. You'll never know the feeling.",
      "Another one home. Are you even playing?",
      "Mine is home. Yours needs a map and a miracle.",
    ],
    humanWin: [
      "You won. I demand a recount.",
      "Fine, you win. Even a blind squirrel finds a nut.",
      "Victory is yours. Don't let it go to your head, it's empty up there.",
      "You won by luck. Everyone knows it. Even you.",
      "Enjoy it, that's the only trophy you'll ever get.",
      "The dice felt sorry for you. That's the only reason.",
    ],
    botWin: [
      "I win! Better luck next lifetime.",
      "Game over. Try practicing on a coin toss first.",
      "Defeated by a computer. Add it to your resume.",
      "Lost to a machine. Your ancestors are disappointed.",
      "GG. Uninstall and think about your life choices.",
      "I didn't even try. That's the saddest part for you.",
    ],
    threeSix: [
      "Three sixes? Greedy. The universe said no.",
      "Three sixes and everything cancelled. That's karma.",
      "Too many sixes. Even the dice got embarrassed for you.",
      "Greed ruins everything, including your luck.",
      "Three sixes? Nice try. Now go back to zero.",
      "The dice said enough, even it can't stand you.",
    ],
  },
  hi: {
    humanSix: [
      "छक्का? अंधे के हाथ बटेर लग गई।",
      "मज़े ले ले, यही तेरा इस हफ़्ते का एकमात्र छक्का है।",
      "वाह, छक्का! बैठे-बैठे किस्मत से कुछ तो मिला तुझे।",
      "छक्का फ्रेम करवा ले, तेरे हाथ की यही एक सही चीज़ है।",
      "बिगिनर्स लक है, और तू तो सालों से बिगिनर ही है।",
      "छक्का लगा के भी हारने वाली शक्ल है तेरी।",
    ],
    humanMiss: [
      "कोई चाल नहीं? तेरी गोटियों ने भी तुझसे हाथ जोड़ लिए।",
      "ज़ीरो चाल! इसके लिए भी टैलेंट चाहिए भाई।",
      "पहले पासा फेंकना सीख ले, फिर लूडो खेलना।",
      "तेरे पासे में तुझसे ज़्यादा इज़्ज़त है, वो भाग गया।",
      "चाल नहीं बनी? तेरी रणनीति मेरे लिए बढ़िया काम कर रही है।",
      "इससे अच्छा तो नारियल लुढ़का देता।",
    ],
    humanCapture: [
      "किस्मत से लग गया तुक्का, मेरी गोटी वैसे भी थक गई थी।",
      "एक गोटी पकड़ ली? फ्रेम करवा ले, ज़िंदगी की सबसे बड़ी उपलब्धि है।",
      "ले जा, मैं असली लड़ाई के लिए ताकत बचा रहा हूँ।",
      "आखिर कुछ तो किया तूने, खुशी के मारे रो मत देना।",
      "एक गोटी काट के खुद को चैंपियन समझ रहा है? प्यारा है।",
      "मज़े ले ले, तेरी गेमिंग लाइफ का यही पीक है।",
    ],
    botCapture: [
      "भेज दिया वापस बेस में! घर वालों को मेरा नमस्ते कहना।",
      "कट गई तेरी गोटी! लीजेंड से पंगा नहीं लेते।",
      "बेस में बैठ जा बच्चे, यह तेरे बस की बात नहीं।",
      "उस गोटी को याद से मिटा दे, अब वो नहीं आने वाली।",
      "रो ले, तेरी गोटी तो पहले से रो रही है।",
      "बेचारे, सीधे मेरे मुँह में आकर बैठ गया तू।",
    ],
    botSix: [
      "छक्का! कुछ लोग पैदा ही जीतने के लिए होते हैं।",
      "देख छक्का कैसे लगता है, कुछ सीख ले।",
      "फिर छक्का! किस्मत नहीं, यह टैलेंट है।",
      "छक्का! अब बैठ के देख, काम मैं करूँगा।",
      "पासा मुझसे प्यार करता है, तुझसे नहीं।",
      "छक्का, आसान है। तुझे तो आता भी नहीं यह सब।",
    ],
    botMiss: [
      "आज पासे ने धोखा दिया, पर तेरी किस्मत ज़्यादा देर साथ नहीं देगी।",
      "मेरी चाल नहीं बनी, खुश हो ले दो पल।",
      "खराब पासा आया, फिर भी तेरी किस्मत से बेहतर है।",
      "जानबूझकर खराब फेंका, तुझ पर तरस आ गया।",
      "कुछ नहीं बना, फिर भी तेरे पूरे गेम से बेहतर है।",
      "चाल खराब है, पर दिमाग तुझसे फिर भी आगे है।",
    ],
    humanHome: [
      "एक गोटी घर पहुँची। बाकी तीन के लिए अगले जन्म में मिलते हैं।",
      "घर पहुँच गई, ताली बनती है, धीमी वाली।",
      "अभी से खुश मत हो, मैं तो बस वार्म-अप कर रहा था।",
      "एक घर पहुँची, बाकी तीन रास्ता भटक के रो रही होंगी।",
      "वाह, एक पहुँच गई। ज़रूर कोई गलती हुई होगी।",
      "घर पहुँची! अब तीन और पहुँचा, अगर तब तक ज़िंदा रहा।",
    ],
    botHome: [
      "मेरी गोटी घर पहुँची, तेरी अभी भी गलियों में भटक रही है।",
      "एक और सुरक्षित घर में, तेरी वाली अभी रास्ता पूछ रही है।",
      "होम डिलीवरी हो गई, तेरी हार की गारंटी के साथ।",
      "घर जैसा सुकून तुझे कभी नहीं मिलेगा।",
      "एक और घर पहुँची, तू खेल भी रहा है या सो रहा है?",
      "मेरी घर पहुँची, तेरी को नक्शा और चमत्कार चाहिए।",
    ],
    humanWin: [
      "तू जीत गया? दोबारा गिनती करवाओ।",
      "ठीक है जीत गया, अंधा भी कभी-कभी निशाना लगा देता है।",
      "जीत मुबारक, पर ज़्यादा उड़ मत, दिमाग तो वैसे भी खाली है।",
      "किस्मत से जीता है, सबको पता है, तुझे भी।",
      "मज़े ले ले, यही तेरी ज़िंदगी की एकमात्र ट्रॉफी है।",
      "पासे को तुझ पर तरस आया, बस इसीलिए जीता है।",
    ],
    botWin: [
      "मैं जीत गया! अगले जन्म में कोशिश करना।",
      "खेल खत्म। पहले सिक्का उछालना सीख ले।",
      "कंप्यूटर से हार गया, बायोडाटा में लिख लेना।",
      "मशीन से हार गया, तेरे पूर्वज निराश हैं।",
      "GG। अनइंस्टॉल कर दे और अपनी ज़िंदगी के फैसलों पर सोच।",
      "मैंने तो कोशिश भी नहीं की, यही तेरे लिए सबसे दुख की बात है।",
    ],
    threeSix: [
      "तीन छक्के? लालच का फल मिला, सब रद्द।",
      "इतने छक्के! किस्मत ने कहा बस कर भाई।",
      "तीन छक्के और सब कैंसल, इसे कहते हैं कर्मा।",
      "लालच ने सब बिगाड़ दिया, तेरी किस्मत भी।",
      "तीन छक्के? अच्छी कोशिश थी, अब वापस ज़ीरो पर आ।",
      "पासे ने कहा बहुत हो गया, वो भी तुझे झेल नहीं पा रहा।",
    ],
  },
};

/* ---------------- the board (52 ring squares, 4 corners) ---------------- */
const RING = [
  [6, 1], [6, 2], [6, 3], [6, 4], [6, 5], [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6], [0, 7], [0, 8],
  [1, 8], [2, 8], [3, 8], [4, 8], [5, 8], [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14], [7, 14], [8, 14],
  [8, 13], [8, 12], [8, 11], [8, 10], [8, 9], [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8], [14, 7], [14, 6],
  [13, 6], [12, 6], [11, 6], [10, 6], [9, 6], [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0], [7, 0], [6, 0],
];
const STARTS = [0, 13, 26, 39]; // corners: 0 top-left, 1 top-right, 2 bottom-right, 3 bottom-left
const SAFE = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
const LANE = [
  [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],
  [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
  [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]],
  [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],
];
const BASEP = [
  [[1, 1], [1, 4], [4, 1], [4, 4]],
  [[1, 10], [1, 13], [4, 10], [4, 13]],
  [[10, 10], [10, 13], [13, 10], [13, 13]],
  [[10, 1], [10, 4], [13, 1], [13, 4]],
];
const FIN_SC = 0.6; // size of a finished token
const FINP = [0, 1, 2, 3].map((c) =>
  [-0.27, -0.09, 0.09, 0.27].map((o) => {
    const [cx, cy] = c === 0 ? [6.55, 7.5 + o] : c === 1 ? [7.5 + o, 6.55] : c === 2 ? [8.45, 7.5 + o] : [7.5 + o, 8.45];
    return [cy - 0.526, cx - 0.5]; // pin box top-left, so the pin is centred on (cx, cy)
  })
);
const CORNER_XY = [[0, 0], [9, 0], [9, 9], [0, 9]];
const TRI = ["6,6 6,9 7.5,7.5", "6,6 9,6 7.5,7.5", "9,6 9,9 7.5,7.5", "6,9 9,9 7.5,7.5"];
// the colour of each corner, like Ludo King: green top-left, yellow top-right, blue bottom-right, red bottom-left
const CC = ["#1fa04a", "#f7c600", "#1e9be9", "#e0302c"];
// little arrows pointing into each colour's lane: [row, col, glyph]
const ARROWS = [[7, 0, "→"], [0, 7, "↓"], [7, 14, "←"], [14, 7, "↑"]];
const START_CORNER = { 0: 0, 13: 1, 26: 2, 39: 3 };
const CELL_PCT = 100 / 15;
// p = -1 in base, 0..50 on the ring (from your start), 51..55 your lane, 56 home
const posOf = (cr, p, i) => (p < 0 ? BASEP[cr][i] : p <= 50 ? RING[(STARTS[cr] + p) % 52] : p <= 55 ? LANE[cr][p - 51] : FINP[cr][i]);
const rot = (r, c, k) => (k === 0 ? [r, c] : k === 1 ? [14 - c, r] : k === 2 ? [14 - r, 14 - c] : [c, 14 - r]); // k quarter turns counter-clockwise
const movablesOf = (arr, d) => arr.map((p, i) => ((p === -1 && d === 6) || (p >= 0 && p < 56 && p + d <= 56) ? i : -1)).filter((i) => i >= 0);
const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
// which corner a seat gets: seat "me" gets the chosen corner, the others follow clockwise (2 players sit opposite)
const cornerOf = (s, base, me, n) => {
  const rel = (s - me + n) % n;
  return (base + (n === 2 ? rel * 2 : rel)) % 4;
};
// lighten (a > 0) or darken (a < 0) a #rrggbb colour
const mix = (hex, a) => {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex;
  const n = parseInt(hex.slice(1), 16);
  const t = a < 0 ? 0 : 255, p = Math.abs(a);
  const f = (v) => Math.round(v + (t - v) * p);
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
};

/* ---------------- the computer player ---------------- */
function botPick(level, who, tok, cor, mv, d) {
  const rnd = (a) => a[Math.floor(Math.random() * a.length)];
  if (mv.length === 1) return mv[0];
  const arr = tok[who];
  if (level === "easy") {
    const out = mv.filter((i) => arr[i] === -1);
    return out.length && Math.random() < 0.5 ? rnd(out) : rnd(mv);
  }
  const hard = level === "hard";
  const ring = (s, v) => (STARTS[cor[s]] + v) % 52;
  const threats = (idx) => {
    let n = 0;
    tok.forEach((a, s) => {
      if (s === who) return;
      a.forEach((v) => { if (v >= 0 && v <= 50) { const dist = (idx - ring(s, v) + 52) % 52; if (dist >= 1 && dist <= 6) n += 1; } });
    });
    return n;
  };
  let best = [], bs = -1e9;
  mv.forEach((i) => {
    const from = arr[i], to = from === -1 ? 0 : from + d;
    let sc = Math.random() * (hard ? 4 : 10) + d * (hard ? 0.8 : 0.5) + to * 0.05;
    if (from === -1) sc += hard ? 30 : 25;
    if (to === 56) sc += hard ? 50 : 40;
    else if (to > 50) sc += 15;
    if (to <= 50) {
      const idx = ring(who, to);
      const safe = SAFE.has(idx);
      let caps = 0;
      if (!safe) tok.forEach((a, s) => { if (s !== who) a.forEach((v) => { if (v >= 0 && v <= 50 && ring(s, v) === idx) caps += 1; }); });
      sc += caps * (hard ? 70 : 60) + (safe ? 12 : 0);
      if (hard && !safe) sc -= threats(idx) * 18;
    }
    if (hard && from >= 0 && from <= 50) {
      const cur = ring(who, from);
      if (!SAFE.has(cur) && threats(cur) > 0) sc += 22; // run away from danger
    }
    if (sc > bs) { bs = sc; best = [i]; } else if (sc === bs) best.push(i);
  });
  return rnd(best);
}


/* ============================================================
   PREMIUM 3D LUDO DICE
============================================================ */

const DICE_FACE_ROTATIONS = {
  1: [0, 0, 0],
  2: [0, -Math.PI / 2, 0],
  3: [Math.PI / 2, 0, 0],
  4: [-Math.PI / 2, 0, 0],
  5: [0, Math.PI / 2, 0],
  6: [0, Math.PI, 0],
};

const DICE_PIPS = {
  1: [[0, 0]],
  2: [[-0.32, 0.32], [0.32, -0.32]],
  3: [[-0.32, 0.32], [0, 0], [0.32, -0.32]],
  4: [[-0.32, 0.32], [0.32, 0.32], [-0.32, -0.32], [0.32, -0.32]],
  5: [[-0.32, 0.32], [0.32, 0.32], [0, 0], [-0.32, -0.32], [0.32, -0.32]],
  6: [[-0.32, 0.35], [0.32, 0.35], [-0.32, 0], [0.32, 0], [-0.32, -0.35], [0.32, -0.35]],
};

const DICE_CAMERA = { position: [0, 0, 5.8], fov: 30 };
const DICE_GL = { antialias: true, alpha: true, powerPreference: "high-performance" };
const DICE_STYLE = { width: "100%", height: "100%" };
const DICE_DPR = [1, 1.5];

/* Individual pip */
function DicePip({ position }) {
  return (
    <mesh position={position}>
      <sphereGeometry args={[0.085, 10, 10]} />
      <meshStandardMaterial color="#11151d" roughness={0.35} metalness={0.05} />
    </mesh>
  );
}

/* Individual face */
function DiceFace({ number, position, rotation }) {
  return (
    <group position={position} rotation={rotation}>
      {DICE_PIPS[number].map(([x, y], i) => (
        <DicePip
          key={`${number}-${i}`}
          position={[x, y, 0.012]}
        />
      ))}
    </group>
  );
}

/* Physical dice cube: tumbles, bounces, settles on the exact face */
function RealDice({ value, rolling }) {
  const ref = useRef(null);
  const invalidate = useThree((s) => s.invalidate);
  const elapsed = useRef(0);
  const from = useRef([0, 0, 0]);
  const to = useRef([0, 0, 0]);
  const running = useRef(false);
  const duration = 0.8;

  useEffect(() => {
    if (!ref.current || rolling) return;
    const t0 = DICE_FACE_ROTATIONS[value] || DICE_FACE_ROTATIONS[1];
    ref.current.rotation.set(t0[0], t0[1], t0[2]);
    invalidate();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!rolling || !ref.current) return;
    const r = ref.current.rotation;
    const target = DICE_FACE_ROTATIONS[value] || DICE_FACE_ROTATIONS[1];
    from.current = [r.x, r.y, r.z]; // start from where it is now, no jump
    to.current = [target[0] + Math.PI * 6, target[1] - Math.PI * 8, target[2] + Math.PI * 4];
    elapsed.current = 0;
    running.current = true;
    invalidate();
  }, [rolling, value, invalidate]);

  useFrame((state, delta) => {
    const m = ref.current;
    if (!m || !running.current) return;

    elapsed.current += Math.min(delta, 0.04);
    const t = Math.min(elapsed.current / duration, 1);
    const ease = 1 - Math.pow(1 - t, 3); // fast spin, slows down smoothly

    const f = from.current, e = to.current;
    m.rotation.set(
      f[0] + (e[0] - f[0]) * ease,
      f[1] + (e[1] - f[1]) * ease,
      f[2] + (e[2] - f[2]) * ease
    );

    // bounces that get smaller, like a real dice landing
    const hop = Math.abs(Math.sin(t * Math.PI * 2.6)) * Math.pow(1 - t, 1.4) * 0.55;
    m.position.y = hop;
    const sq = Math.max(0, 0.05 - hop) * 1.5; // squash on touching the ground
    m.scale.set(1 + sq, 1 - sq, 1 + sq);

    if (t >= 1) {
      const target = DICE_FACE_ROTATIONS[value] || DICE_FACE_ROTATIONS[1];
      m.rotation.set(target[0], target[1], target[2]);
      m.position.set(0, 0, 0);
      m.scale.set(1, 1, 1);
      running.current = false;
      return;
    }
    state.invalidate();
  });

  return (
    <group ref={ref}>
      <RoundedBox args={[1.65, 1.65, 1.65]} radius={0.19} smoothness={4}>
        <meshStandardMaterial color="#ffffff" roughness={0.3} metalness={0.02} />
      </RoundedBox>

      <DiceFace number={1} position={[0, 0, 0.831]} rotation={[0, 0, 0]} />
      <DiceFace number={6} position={[0, 0, -0.831]} rotation={[0, Math.PI, 0]} />
      <DiceFace number={2} position={[0.831, 0, 0]} rotation={[0, Math.PI / 2, 0]} />
      <DiceFace number={5} position={[-0.831, 0, 0]} rotation={[0, -Math.PI / 2, 0]} />
      <DiceFace number={3} position={[0, 0.831, 0]} rotation={[-Math.PI / 2, 0, 0]} />
      <DiceFace number={4} position={[0, -0.831, 0]} rotation={[Math.PI / 2, 0, 0]} />
    </group>
  );
}

/* 3D lighting and camera (no Environment, no shadows, renders only while rolling).
   memo: the game re-renders a lot, the 3D scene only needs to when value or rolling change */
const DiceScene = memo(function DiceScene({ value, rolling }) {
  return (
    <Canvas camera={DICE_CAMERA} dpr={DICE_DPR} gl={DICE_GL} frameloop="demand" style={DICE_STYLE}>
      <ambientLight intensity={1.0} />
      <directionalLight position={[3, 5, 5]} intensity={2.6} />
      <directionalLight position={[-4, 2, 3]} intensity={1.4} />
      <pointLight position={[0, 0, 6]} intensity={1.0} />
      <RealDice value={value} rolling={rolling} />
    </Canvas>
  );
});


/* small flat dice for players who are not rolling */
const DiceFace2D = memo(function DiceFace2D({ v }) {
  return (
    <div style={{ position: "absolute", inset: "10%", borderRadius: 8, background: "linear-gradient(145deg,#ffffff,#d9dde4)", boxShadow: "0 2px 4px rgba(0,0,0,.35)", display: "grid", gridTemplateColumns: "repeat(3,1fr)", gridTemplateRows: "repeat(3,1fr)", padding: "12%" }}>
      {Array.from({ length: 9 }).map((_, i) => (
        <span key={i} style={{ display: "grid", placeItems: "center" }}>
          {PIPS[v] && PIPS[v].includes(i) ? <i style={{ width: "78%", height: "78%", borderRadius: "50%", background: "#11151d" }} /> : null}
        </span>
      ))}
    </div>
  );
});


/* Premium dice component */
function Die({
  v,
  rolling,
  color,
  onClick,
  disabled,
  size = 76,
}) {
  return (
    <motion.div
      whileTap={!disabled ? { scale: 0.94 } : {}}
      onClick={onClick}
      style={{
        position: "relative",
        width: size + 38,
        height: size + 38,
        display: "grid",
        placeItems: "center",
        flexShrink: 0,
        cursor: disabled ? "default" : "pointer",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {/* Outer glow */}
      <motion.div
        animate={
          rolling
            ? { opacity: [0.35, 0.9, 0.35], scale: [0.92, 1.12, 0.92] }
            : disabled
              ? { opacity: 0.15, scale: 1 }
              : { opacity: [0.35, 0.7, 0.35], scale: [0.96, 1.05, 0.96] }
        }
        transition={{
          duration: rolling ? 0.45 : 1.8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        style={{
          position: "absolute",
          width: size + 16,
          height: size + 16,
          borderRadius: 26,
          border: `2px solid ${color}`,
          boxShadow: `0 0 16px ${color}88, 0 0 36px ${color}55`,
        }}
      />

      {/* Elevated dice pedestal */}
      <div
        style={{
          position: "relative",
          width: size,
          height: size,
          zIndex: 2,
          borderRadius: 21,
          background: "linear-gradient(145deg,#233653,#0c1426)",
          border: "1px solid rgba(255,255,255,.22)",
          boxShadow: `
            0 7px 0 #080e19,
            0 12px 22px rgba(0,0,0,.48),
            inset 0 1px 0 rgba(255,255,255,.2),
            0 0 20px ${color}44
          `,
        }}
      >
        <div style={{ position: "absolute", inset: "-30%", pointerEvents: "none" }}>
          <DiceScene value={v} rolling={rolling} />
        </div>
      </div>

      {/* Rolling indicator */}
      <AnimatePresence>
        {rolling && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            style={{
              position: "absolute",
              bottom: -15,
              fontSize: 9,
              fontWeight: 900,
              letterSpacing: 2,
              color: "#fff",
              textShadow: `0 0 8px ${color}`,
              whiteSpace: "nowrap",
            }}
          >
            ROLLING
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}


/* ---------------- the token: a map-pin like in Ludo King ---------------- */
function LudoDefs({ cols }) {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
      <defs>
        {cols.map((c, s) => (
          <g key={s}>
            <radialGradient id={`lh${s}`} cx=".36" cy=".3" r=".8">
              <stop offset="0" stopColor={mix(c, 0.55)} /><stop offset=".45" stopColor={c} /><stop offset="1" stopColor={mix(c, -0.35)} />
            </radialGradient>
            <linearGradient id={`lb${s}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor={mix(c, 0.35)} /><stop offset=".5" stopColor={c} /><stop offset="1" stopColor={mix(c, -0.4)} />
            </linearGradient>
          </g>
        ))}
      </defs>
    </svg>
  );
}


function Pin({ color }) {
  // every pin builds its own paint from its own color, so it never depends on which seat it belongs to
  const uid = "pn" + String(color).replace(/[^0-9a-z]/gi, "");
  const body = "M30 76 C27 66 6 47 6 27 A24 24 0 0 1 54 27 C54 47 33 66 30 76 Z";
  return (
    <svg
      viewBox="0 0 60 80" width="100%" height="100%"
      style={{ display: "block", overflow: "visible", }}
    >
      <defs>
        <radialGradient id={`${uid}h`} cx=".36" cy=".3" r=".8">
          <stop offset="0" stopColor={mix(color, 0.55)} />
          <stop offset=".45" stopColor={color} />
          <stop offset="1" stopColor={mix(color, -0.35)} />
        </radialGradient>
        <linearGradient id={`${uid}b`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={mix(color, 0.35)} />
          <stop offset=".5" stopColor={color} />
          <stop offset="1" stopColor={mix(color, -0.4)} />
        </linearGradient>
      </defs>

      {/* deep outer edge */}
      <path d={body} fill="none" stroke="rgba(0,0,0,.45)" strokeWidth="8" strokeLinejoin="round" />
      {/* main body */}
      <path d={body} fill={`url(#${uid}b)`} stroke="#ffffff" strokeWidth="2.8" strokeLinejoin="round" />
      {/* inner glossy ring */}
      <circle cx="30" cy="27" r="14" fill="rgba(255,255,255,.22)" stroke="#ffffff" strokeOpacity=".72" strokeWidth="1.2" />
      {/* center */}
      <circle cx="30" cy="27" r="9" fill={`url(#${uid}h)`} />
      {/* glossy reflection */}
      <ellipse cx="25" cy="14" rx="7" ry="3.4" fill="#ffffff" opacity=".6" transform="rotate(-25 25 14)" />
      <circle cx="36" cy="33" r="2.2" fill="#ffffff" opacity=".18" />
    </svg>
  );
}
const PinM = memo(Pin);


/* ---------------- the flat board: drawn once per board rotation, not on every game update ---------------- */
const BoardSVG = memo(function BoardSVG({ k }) {
  return (
    <svg
      viewBox="0 0 15 15"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
      }}
    >
      <defs>

        {/* premium board background */}
        <linearGradient id="boardWhite" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="55%" stopColor="#f7f8fa" />
          <stop offset="100%" stopColor="#e7e9ed" />
        </linearGradient>

        {/* colored yard gradients */}
        {[0, 1, 2, 3].map((c) => (
          <linearGradient
            key={`yardGrad${c}`}
            id={`yardGrad${c}`}
            x1="0"
            y1="0"
            x2="1"
            y2="1"
          >
            <stop offset="0%" stopColor={mix(CC[c], 0.22)} />
            <stop offset="45%" stopColor={CC[c]} />
            <stop offset="100%" stopColor={mix(CC[c], -0.22)} />
          </linearGradient>
        ))}

        {/* lane gradients */}
        {[0, 1, 2, 3].map((c) => (
          <linearGradient
            key={`laneGrad${c}`}
            id={`laneGrad${c}`}
            x1="0"
            y1="0"
            x2="1"
            y2="1"
          >
            <stop offset="0%" stopColor={mix(CC[c], 0.18)} />
            <stop offset="100%" stopColor={mix(CC[c], -0.15)} />
          </linearGradient>
        ))}

        {/* subtle inner shine */}
        <linearGradient id="glassShine" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity=".42" />
          <stop offset="35%" stopColor="#ffffff" stopOpacity=".08" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>

      </defs>

      <rect
        width="15"
        height="15"
        rx=".35"
        fill="url(#boardWhite)"
      />

      <g transform={k ? `rotate(${-90 * k} 7.5 7.5)` : undefined}>

        {/* =========================
            FOUR PREMIUM YARDS
           ========================= */}

        {[0, 1, 2, 3].map((c) => (
          <g key={`q${c}`}>

            {/* main colored area */}
            <rect
              x={CORNER_XY[c][0]}
              y={CORNER_XY[c][1]}
              width="6"
              height="6"
              fill={`url(#yardGrad${c})`}
            />

            {/* inner white home panel */}
            <rect
              x={CORNER_XY[c][0] + 0.72}
              y={CORNER_XY[c][1] + 0.72}
              width="4.56"
              height="4.56"
              rx=".5"
              fill="rgba(255,255,255,.96)"
              stroke="rgba(255,255,255,.9)"
              strokeWidth=".06"
            />

            {/* glass highlight */}
            <rect
              x={CORNER_XY[c][0] + 0.82}
              y={CORNER_XY[c][1] + 0.82}
              width="4.36"
              height="1.2"
              rx=".3"
              fill="url(#glassShine)"
              pointerEvents="none"
            />

            {/* token bases */}
            {BASEP[c].map(([r, cc], i) => (
              <g key={i}>
                {/* outer ring */}
                <circle
                  cx={cc + 0.5}
                  cy={r + 0.5}
                  r=".72"
                  fill={mix(CC[c], -0.12)}
                  opacity=".95"
                />

                {/* inner glossy base */}
                <circle
                  cx={cc + 0.5}
                  cy={r + 0.5}
                  r=".62"
                  fill={`url(#yardGrad${c})`}
                  stroke="#ffffff"
                  strokeOpacity=".55"
                  strokeWidth=".055"
                />

                {/* base shine */}
                <ellipse
                  cx={cc + 0.32}
                  cy={r + 0.27}
                  rx=".23"
                  ry=".12"
                  fill="#ffffff"
                  opacity=".32"
                  transform={`rotate(-25 ${cc + 0.32} ${r + 0.27})`}
                />
              </g>
            ))}
          </g>
        ))}

        {/* =========================
            OUTER RING
           ========================= */}

        {RING.map(([r, c], i) => {
          const sc = START_CORNER[i];

          return (
            <g key={i}>

              <rect
                x={c}
                y={r}
                width="1"
                height="1"
                fill={
                  sc !== undefined
                    ? `url(#yardGrad${sc})`
                    : "url(#boardWhite)"
                }
                stroke="rgba(30,35,45,.28)"
                strokeWidth=".035"
              />

              {/* subtle tile highlight */}
              <path
                d={`M ${c + .06} ${r + .08} H ${c + .94}`}
                stroke="#ffffff"
                strokeOpacity=".48"
                strokeWidth=".035"
              />

              {SAFE.has(i) && (
                <text
                  x={c + 0.5}
                  y={r + 0.74}
                  textAnchor="middle"
                  fontSize=".72"
                  fontWeight="700"
                  fill={sc !== undefined ? "#fff" : "#8b929c"}
                  opacity=".95"
                  transform={
                    k
                      ? `rotate(${90 * k} ${c + 0.5} ${r + 0.5})`
                      : undefined
                  }
                >
                  ★
                </text>
              )}
            </g>
          );
        })}

        {/* =========================
            HOME LANES
           ========================= */}

        {[0, 1, 2, 3].map((c) =>
          LANE[c].map(([r, cc], i) => (
            <g key={`l${c}${i}`}>
              <rect
                x={cc}
                y={r}
                width="1"
                height="1"
                fill={`url(#laneGrad${c})`}
                stroke="rgba(30,35,45,.28)"
                strokeWidth=".035"
              />

              <path
                d={`M ${cc + .08} ${r + .08} H ${cc + .92}`}
                stroke="#ffffff"
                strokeOpacity=".38"
                strokeWidth=".035"
              />
            </g>
          ))
        )}

        {/* =========================
            DIRECTION ARROWS
           ========================= */}

        {ARROWS.map(([r, c, ch], i) => (
          <text
            key={`a${i}`}
            x={c + 0.5}
            y={r + 0.74}
            textAnchor="middle"
            fontSize=".7"
            fontWeight="800"
            fill={CC[i]}
            opacity=".95"
            transform={
              k
                ? `rotate(${90 * k} ${c + 0.5} ${r + 0.5})`
                : undefined
            }
          >
            {ch}
          </text>
        ))}

        {/* =========================
            PREMIUM CENTER
           ========================= */}

        {[0, 1, 2, 3].map((c) => (
          <polygon
            key={`t${c}`}
            points={TRI[c]}
            fill={`url(#laneGrad${c})`}
            stroke="rgba(255,255,255,.7)"
            strokeWidth=".055"
            strokeLinejoin="round"
          />
        ))}

        {/* center highlight */}
        <circle
          cx="7.5"
          cy="7.5"
          r=".13"
          fill="#ffffff"
          opacity=".7"
        />

      </g>
    </svg>
  );
});


/* one token on the board: only re-renders when its own numbers change */
const Token = memo(function Token({ s, i, col, row, shrink, pick, hop, fin, c, cell, onTap }) {
  const sc = (fin ? FIN_SC : 1) * shrink;
  return (
    <motion.div
      initial={false}
      animate={{ x: `${col * 100}%`, y: `${row * 100}%` }}
      transition={{ x: { type: "spring", stiffness: 520, damping: 36 }, y: { type: "spring", stiffness: 520, damping: 36 } }}
      onClick={() => onTap(s, i)}
      style={{ position: "absolute", left: 0, top: 0, width: `${CELL_PCT}%`, height: `${CELL_PCT}%`, cursor: pick ? "pointer" : "default", zIndex: pick ? 6 : hop ? 7 : 3, willChange: "transform" }}
    >
      <div style={{ position: "absolute", left: "14%", right: "14%", bottom: "6%", height: "22%", borderRadius: "50%", background: "radial-gradient(ellipse, rgba(0,0,0,.5), transparent 72%)", transform: `scale(${sc})`, pointerEvents: "none" }} />
      <div style={{ position: "absolute", left: "8%", width: "84%", height: "118%", bottom: "12%", transformOrigin: "50% 100%", transform: `scale(${sc})` }}>
        <motion.div
          animate={pick ? { y: [0, -cell * 0.16, 0] } : hop ? { y: [0, -cell * 0.5 - (hop % 2) * 0.02, 0] } : { y: 0 }}
          transition={pick ? { repeat: Infinity, duration: 0.85, ease: "easeInOut" } : hop ? { duration: 0.15, ease: "easeOut" } : { duration: 0.2 }}
          style={{ width: "100%", height: "100%", transformOrigin: "50% 100%", filter: pick ? `drop-shadow(0 0 6px ${c})` : "none" }}
        >
          <PinM color={c} />
        </motion.div>
      </div>
    </motion.div>
  );
});


/* speech bubble with a little icon, shown beside the computer that is talking */
function SledgeBubble({ text, color, left, top, maxW }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.7, y: top ? -6 : 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.85 }}
      transition={{ type: "spring", stiffness: 380, damping: 22 }}
      style={{
        position: "absolute", [top ? "top" : "bottom"]: "calc(100% + 6px)", [left ? "left" : "right"]: 0,
        width: "max-content", maxWidth: maxW, zIndex: 50, pointerEvents: "none",
        display: "flex", alignItems: "flex-start", gap: 6, flexDirection: left ? "row" : "row-reverse",
      }}
    >
      <div style={{ width: 24, height: 24, flexShrink: 0, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: 14, background: "#101b35", border: `2px solid ${color}`, boxShadow: `0 0 8px ${color}99` }}>😈</div>
      <div style={{ padding: "6px 9px", borderRadius: 12, fontSize: 11, fontWeight: 700, lineHeight: 1.3, color: "#fff", background: "linear-gradient(145deg,#1a2a52,#0b1630)", border: `1.5px solid ${color}`, boxShadow: "0 4px 14px rgba(0,0,0,.55)" }}>
        {text}
      </div>
    </motion.div>
  );
}

/* seats: [{ id?, name, bot? }]  (2 to 4).  mySeat: your index online / vs computer, -1 on one phone */
export default function LudoGame({ kit, ui, lang, S, role, seats, mySeat, level, net, onFinish, lc, opt: optIn }) {
  const opt = optIn || {};
  const { LastLine, Warn, useWarn, GC, fmt } = kit;
  const L = LT[lang] || LT.en;
  const [wn, warn, shake] = useWarn();
  const n = seats.length;
  const local = role === "local";
  const cpu = role === "cpu";
  const online = role === "host" || role === "guest";
  const amHost = role === "host";

  // colour: vs computer and on one phone you choose it; online it follows the seat order (everyone must agree)
  const [base, setBase] = useState(local || cpu ? null : 3);
  const ready = base !== null;
  const me = cpu ? Math.max(0, mySeat) : 0;
  const cor = Array.from({ length: n }, (_, s) => cornerOf(s, ready ? base : 3, me, n));
  const COLS = cor.map((c) => CC[c]);

  const G = useRef({ tok: Array.from({ length: n }, () => [-1, -1, -1, -1]), turn: 0, phase: "roll", dice: 0, movable: [], over: false, msg: "", last: null, rollN: 0, hop: null, hn: 0, fx: [], fid: 0 });
  const [, bump] = useState(0);
  const re = () => bump((x) => x + 1);
  const alive = useRef(true);
  const pend = useRef([]);
  const seatsRef = useRef(seats);
  const fn = useRef({});
  const boxRef = useRef(null);
  const boxW = ui.useWidth(boxRef, 360);
  seatsRef.current = seats;
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const nap = async (ms) => { await ui.sleep(ms); if (!alive.current) throw ui.STOP; };
  const run = async (f) => { try { await f(); } catch (e) { if (e !== ui.STOP) console.error(e); } };

  const isBot = (s) => !!(seatsRef.current[s] && seatsRef.current[s].bot);
  const iDrive = (s) => isBot(s) && (cpu || amHost); // who plays for a computer seat
  const mine = (s) => local || (s === mySeat && !isBot(s));
  const nameOf = (s) => (seatsRef.current[s] ? seatsRef.current[s].name : "");
  const human = (s) => cpu && s === me; // the real player when playing vs computer

  // a short burst on a square (capture, reaching home)
  const addFx = (pos, color) => {
    const g = G.current;
    const id = ++g.fid;
    g.fx = [...g.fx, { id, pos, color }];
    re();
    setTimeout(() => { if (!alive.current) return; G.current.fx = G.current.fx.filter((f) => f.id !== id); re(); }, 950);
  };

  // computer commentary (only vs computer): a random computer roasts you, shown as a bubble beside its own corner.
  // cat = which kind of line, speaker = seat that caused the event, p = chance it speaks
  const say = (cat, speaker, p = 1) => {
    if (!cpu || Math.random() > p) return;
    const arr = (CM[lang] || CM.en)[cat];
    if (!arr) return;
    let sp = speaker;
    if (sp === undefined || sp === null || !isBot(sp)) {
      const bots = seatsRef.current.map((s, i) => (s.bot ? i : -1)).filter((i) => i >= 0);
      if (!bots.length) return;
      sp = bots[Math.floor(Math.random() * bots.length)];
    }
    const g = G.current;
    const id = (g.cmId || 0) + 1;
    g.cmId = id;
    g.cm = { s: sp, text: arr[Math.floor(Math.random() * arr.length)], id };
    re();
    setTimeout(() => { if (!alive.current) return; const gg = G.current; if (gg.cmId === id) { gg.cm = null; re(); } }, 4000);
  };

  /* ----- the game flow (runs the same on every phone) ----- */
  const endTurn = (extra) => {
    const g = G.current;
    if (!extra) { g.turn = (g.turn + 1) % n; g.sixes = 0; }
    g.phase = "roll"; g.movable = []; g.msg = "";
    re();
    fn.current.drain();
  };
  const doRoll = (d, fromNet) => run(async () => {
    const g = G.current;
    if (g.phase !== "roll" || g.over) return;
    g.phase = "rolling"; g.dice = d; (g.ld = g.ld || [])[g.turn] = d; g.msg = ""; g.rollN += 1; re();
    if (online && !fromNet) net.send({ t: "ld", d });
    await nap(850);
    const who = g.turn;
    const prev = g.sixes || 0;
    g.sixes = d === 6 ? prev + 1 : 0;
    if (d === 6 && prev === 0) g.snap = g.tok.map((a) => [...a]); // board before the first 6 of the chain
    if (opt.threeSixes !== false && g.sixes >= 3) {
      g.sixes = 0;
      if (g.snap) g.tok = g.snap; // undo the moves made with the earlier 6s
      g.snap = null;
      g.movable = [];
      g.last = { who, d, out: false, cap: 0, home: false };
      g.phase = "pass"; g.msg = "threeSix"; re();
      if (human(who)) say("threeSix");
      await nap(1300);
      endTurn(true); // same player rolls again
      return;
    }
    const mv = movablesOf(g.tok[who], d);
    g.movable = mv;
    g.last = { who, d, out: false, cap: 0, home: false };
    if (!mv.length) { g.phase = "pass"; g.msg = "nomove"; re(); say(human(who) ? "humanMiss" : "botMiss", who, 0.7); await nap(900); endTurn(false); return; }
    if (d === 6) say(human(who) ? "humanSix" : "botSix", who, 0.7);
    if (mv.length === 1) { g.phase = "auto"; re(); await nap(450); await playMove(mv[0]); return; }
    g.phase = "move"; re();
    fn.current.drain();
  });
  const playMove = (i) => run(async () => {
    const g = G.current;
    const who = g.turn, d = g.dice;
    if (g.over) return;
    g.phase = "anim"; g.movable = []; re();
    const from = g.tok[who][i];
    const steps = from === -1 ? 1 : d;
    let p = from;
    for (let k = 0; k < steps; k++) {
      p = p === -1 ? 0 : p + 1;
      const pp = p;
      g.tok = g.tok.map((a, s) => (s === who ? a.map((v, j) => (j === i ? pp : v)) : a));
      g.hop = { s: who, i, n: ++g.hn };
      re();
      await nap(150);
    }
    g.hop = null;
    let cap = 0, hitMe = false;
    if (p <= 50) {
      const idx = (STARTS[cor[who]] + p) % 52;
      if (opt.safeStars === false || !SAFE.has(idx)) {
        g.tok = g.tok.map((a, s) =>
          s === who ? a : a.map((v) => {
            if (v >= 0 && v <= 50 && (STARTS[cor[s]] + v) % 52 === idx) { cap += 1; if (human(s)) hitMe = true; return -1; }
            return v;
          }));
      }
      if (cap) addFx(RING[idx], COLS[who]);
    }
    const home = p === 56;
    if (home) addFx([7.5, 7.5], COLS[who]);
    g.last = { who, d, out: from === -1, cap, home };
    re();
    const wonNow = g.tok[who].every((v) => v === 56);
    if (wonNow) say(human(who) ? "humanWin" : "botWin", who);
    else if (cap) { if (human(who)) say("humanCapture", who); else if (hitMe) say("botCapture", who); }
    else if (home) say(human(who) ? "humanHome" : "botHome", who);
    if (cap) await nap(500);
    if (wonNow) {
      g.over = true; g.phase = "over"; re();
      await nap(1400);
      onFinish(who);
      return;
    }
    endTurn((d === 6 && opt.sixExtra !== false) || (cap > 0 && opt.captureExtra !== false) || (home && opt.homeExtra !== false));
  });
  // messages from friends wait here until this phone is ready for them (and only the right sender is accepted)
  fn.current.drain = () => {
    const g = G.current;
    const q = pend.current;
    if (!q.length || g.over || !online) return;
    const seat = seatsRef.current[g.turn];
    if (!seat) return;
    const hostIdv = seatsRef.current[0] && seatsRef.current[0].id;
    const idx = q.findIndex((m) => {
      const fromOk = seat.id === m.from || (seat.bot && m.from === hostIdv);
      return fromOk && ((m.t === "ld" && g.phase === "roll") || (m.t === "lm" && g.phase === "move"));
    });
    if (idx < 0) return;
    const m = q.splice(idx, 1)[0];
    if (m.t === "ld") {
      const d = Math.floor(Number(m.d));
      doRoll(d >= 1 && d <= 6 ? d : 1, true);
    } else if (g.movable.includes(Number(m.i))) playMove(Number(m.i));
  };
  useEffect(() => net.on((m) => {
    if (m.t === "ld" || m.t === "lm") { pend.current.push(m); fn.current.drain(); }
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  const g = G.current;
  const rolling = g.phase === "rolling";

  // a computer seat plays by itself (in a game with friends only the host drives it)
  const driving = ready && !g.over && iDrive(g.turn);
  useEffect(() => {
    if (!driving) return undefined;
    let t = 0;
    const wait = Number(lc && lc.delay) || 600;
    const brain = cpu ? (lc && lc.bot) || level : opt.dropBot || "medium"; // dropBot: the computer that replaces a friend who left
    if (g.phase === "roll") t = setTimeout(() => doRoll(1 + Math.floor(Math.random() * 6), false), wait);
    else if (g.phase === "move") {
      t = setTimeout(() => {
        const gg = G.current;
        if (gg.phase !== "move") return;
        const i = botPick(brain, gg.turn, gg.tok, cor, gg.movable, gg.dice);
        if (online) net.send({ t: "lm", i });
        playMove(i);
      }, wait + 100);
    }
    return () => clearTimeout(t);
  }, [g.turn, g.phase, driving]); // eslint-disable-line react-hooks/exhaustive-deps

  const canRoll = ready && !g.over && g.phase === "roll" && mine(g.turn);
  const canPick = ready && g.phase === "move" && mine(g.turn);

  const tapDice = () => {
    if (g.over) return;
    if (!ready) { warn(L.pickColorFirst); return; }
    if (g.phase === "roll") {
      if (!mine(g.turn)) { warn(fmt(L.waitRoll, { name: nameOf(g.turn) })); return; }
      doRoll(1 + Math.floor(Math.random() * 6), false);
    } else if (g.phase === "move") warn(canPick ? L.pickToken : fmt(L.waitMove, { name: nameOf(g.turn) }));
  };
  const tapToken = (s, i) => {
    if (g.over || !ready) return;
    if (g.phase === "roll") { warn(mine(g.turn) ? L.rollFirst : fmt(L.waitRoll, { name: nameOf(g.turn) })); return; }
    if (g.phase !== "move") return;
    if (!mine(g.turn)) { warn(fmt(L.waitMove, { name: nameOf(g.turn) })); return; }
    if (s !== g.turn) { warn(fmt(L.notYours, { name: nameOf(s) })); return; }
    if (!g.movable.includes(i)) {
      const p = g.tok[s][i];
      warn(p === -1 ? L.needSix : p === 56 ? L.alreadyHome : fmt(L.tooFar, { d: g.dice }));
      return;
    }
    if (online) net.send({ t: "lm", i });
    playMove(i);
  };
  // a stable handler for the memoised tokens (always calls the latest tapToken)
  const tapRef = useRef(tapToken);
  tapRef.current = tapToken;
  const onTap = useCallback((s, i) => tapRef.current(s, i), []);

  /* ----- drawing ----- */
  const viewSeat = online ? Math.max(0, mySeat) : cpu ? me : 0;
  const k = (cor[viewSeat] + 1) % 4; // turns the board so YOUR corner is at the bottom-left
  const PADF = 8;
  const size = Math.floor(Math.min(boxW, 440));
  const bd = size - PADF * 2;
  const cell = bd / 15;
  const seatAt = {};
  cor.forEach((c, s) => { seatAt[c] = s; });
  const cellPct = CELL_PCT;

  // which player sits in which corner of YOUR screen: 0 top-left, 1 top-right, 2 bottom-right, 3 bottom-left
  const seatAtV = {};
  cor.forEach((c, s) => { seatAtV[(c - k + 4) % 4] = s; });
  const diceBox = Math.max(38, Math.min(54, Math.floor(size * 0.115)));
  const chip = (v) => {
    const s = seatAtV[v];
    if (s === undefined) return <div key={v} style={{ width: 1 }} />;
    const active = ready && !g.over && g.turn === s;
    const col = COLS[s];
    const val = (g.ld && g.ld[s]) || 1;
    const left = v === 0 || v === 3;
    const pulse = active && canRoll;
    const talking = cpu && g.cm && g.cm.s === s ? g.cm : null;
    return (
      <div key={v} style={{ position: "relative" }}>
        <motion.div
          animate={pulse ? { scale: [1, 1.06, 1] } : { scale: 1 }}
          transition={pulse ? { repeat: Infinity, duration: 1.1, ease: "easeInOut" } : { duration: 0.2 }}
          style={{
            display: "flex", flexDirection: left ? "row" : "row-reverse", alignItems: "center", gap: 4, padding: 3, borderRadius: 10,
            background: "linear-gradient(145deg,#1a4a9a,#0b2a66)",
            border: `2px solid ${active ? "#f7d56a" : "rgba(247,213,106,.3)"}`,
            boxShadow: active ? `0 0 12px ${col}, 0 0 0 1px ${col}` : "none",
            opacity: active ? 1 : 0.75, transition: "opacity .3s, border-color .3s",
          }}
        >
          <div style={{ width: diceBox * 0.5, height: diceBox * 0.66 }}><PinM color={col} /></div>
          <div
            onClick={active ? tapDice : undefined}
            style={{ position: "relative", width: diceBox, height: diceBox, borderRadius: 8, background: "linear-gradient(145deg,#f8dede,#e0b2b2)", cursor: pulse ? "pointer" : "default", WebkitTapHighlightColor: "transparent" }}
          >
            {active ? (
              <div style={{ position: "absolute", inset: "-25%", pointerEvents: "none" }}>
                <DiceScene value={val} rolling={rolling} />
              </div>
            ) : (
              <DiceFace2D v={val} />
            )}
          </div>
        </motion.div>
        <AnimatePresence>
          {talking ? <SledgeBubble key={talking.id} text={talking.text} color={col} left={left} top={v < 2} maxW={Math.min(210, Math.floor(size * 0.6))} /> : null}
        </AnimatePresence>
      </div>
    );
  };

  const list = [];
  g.tok.forEach((arr, s) => arr.forEach((p, i) => list.push({ s, i, p, pos: posOf(cor[s], p, i) })));
  const groups = {};
  list.forEach((t) => { t.key = `${t.pos[0].toFixed(2)}-${t.pos[1].toFixed(2)}`; (groups[t.key] = groups[t.key] || []).push(t); });
  list.forEach((t) => {
    const grp = groups[t.key];
    const off = grp.length > 1 ? (grp.indexOf(t) - (grp.length - 1) / 2) * 0.28 : 0;
    const [rr, cc] = rot(t.pos[0], t.pos[1], k);
    t.row = rr; t.col = cc + off; t.shrink = grp.length > 1 ? 0.82 : 1;
  });
  list.sort((a, b) => a.row - b.row);

  const turnColor = g.over ? GC : COLS[g.turn];
  const shown = g.dice || 1;
  const status = !ready ? L.pickColorFirst
    : g.over ? ""
    : g.phase === "roll" ? (canRoll ? L.roll : fmt(S.racing, { name: nameOf(g.turn) }))
    : g.phase === "rolling" ? L.rolling
    : g.phase === "move" ? (canPick ? L.pickToken : fmt(S.racing, { name: nameOf(g.turn) }))
    : g.phase === "pass" ? (g.msg === "threeSix" ? L.threeSix : L.noMove) : "";
  const lastTxt = g.last
    ? [fmt(L.rolled, { d: g.last.d }), g.msg === "nomove" ? L.nomove : g.msg === "threeSix" ? L.threeSix : "", g.last.out ? L.out : "", g.last.cap ? L.captured : "", g.last.home ? L.home : ""].filter(Boolean).join(" · ")
    : "";
  // where each movable token would land: tappable markers (tap the token or its marker)
  const ghosts = canPick
    ? g.movable.map((i) => {
        const from = g.tok[g.turn][i];
        const to = from === -1 ? 0 : from + g.dice;
        const [rr, cc] = rot(...posOf(cor[g.turn], to, i), k);
        return { i, row: rr, col: cc, home: to === 56 };
      })
    : [];

  return (
    <div className="flex w-full flex-col items-center">
      <LudoDefs cols={COLS} />
      <div className="w-full max-w-[440px]">
        {g.last ? <LastLine S={S} name={nameOf(g.last.who)} color={COLS[g.last.who]}>{lastTxt}</LastLine> : <div className="min-h-[30px]" />}
        <Warn w={wn} />
      </div>

      <div className="mx-auto flex items-center justify-between" style={{ width: size, marginTop: 6 }}>
        {chip(0)}{chip(1)}
      </div>

      <motion.div animate={shake} className="w-full">
        <div ref={boxRef} className="w-full">
          <div className="relative mx-auto" style={{ width: size, height: size, marginTop: 6 }}>
            <div
              style={{
                position: "absolute",
                inset: 0,
                boxSizing: "border-box",
                padding: PADF,
                borderRadius: 20,

                background: `
                  linear-gradient(
                    145deg,
                    #243f72 0%,
                    #101b35 42%,
                    #07101f 100%
                  )
                `,

                border: "1px solid rgba(255,255,255,.16)",

                boxShadow: `
                  0 0 0 1px rgba(255,255,255,.08),
                  0 0 0 2px ${turnColor}66,
                  0 0 32px ${turnColor}44,
                  0 16px 38px rgba(0,0,0,.58),
                  inset 0 1px 0 rgba(255,255,255,.18)
                `,

                transition: "box-shadow .45s ease",
              }}
            >
              <div style={{
                position: "relative",
                width: bd,
                height: bd,
                borderRadius: 10,
                overflow: "hidden",
                background:
                  "linear-gradient(145deg,#ffffff,#e9ecf1)",
                boxShadow: `
                  inset 0 0 0 1px rgba(255,255,255,.9),
                  inset 0 0 18px rgba(0,0,0,.08),
                  0 2px 8px rgba(0,0,0,.28)
                `,
              }}>
                {/* the flat board */}
                <BoardSVG k={k} />

                {/* where the glowing tokens can land: tap the marker or the token */}
                <div style={{ position: "absolute", inset: 0 }}>
                  {ghosts.map((m) => (
                    <div
                      key={m.i} onClick={() => tapToken(g.turn, m.i)}
                      style={{ position: "absolute", left: `${m.col * cellPct}%`, top: `${m.row * cellPct}%`, width: `${cellPct}%`, height: `${cellPct}%`, cursor: "pointer", zIndex: 4 }}
                    >
                      <motion.div
                        animate={{ scale: [0.8, 1.1, 0.8], opacity: [0.7, 1, 0.7] }} transition={{ repeat: Infinity, duration: 1.1, ease: "easeInOut" }}
                        style={{ position: "absolute", inset: "10%", borderRadius: "50%", background: `${COLS[g.turn]}66`, boxShadow: `inset 0 0 0 3px ${COLS[g.turn]}, 0 0 12px ${COLS[g.turn]}, 0 0 0 1.5px #fff` }}
                      />
                    </div>
                  ))}
                </div>

                {/* the tokens */}
                <div style={{ position: "absolute", inset: 0 }}>
                  {list.map((t) => (
                    <Token
                      key={`${t.s}-${t.i}`}
                      s={t.s}
                      i={t.i}
                      col={t.col}
                      row={t.row}
                      shrink={t.shrink}
                      pick={canPick && t.s === g.turn && g.movable.includes(t.i)}
                      hop={g.hop && g.hop.s === t.s && g.hop.i === t.i ? g.hop.n : 0}
                      fin={t.p === 56}
                      c={COLS[t.s]}
                      cell={cell}
                      onTap={onTap}
                    />
                  ))}
                </div>


                {/* player names, small, inside the coloured yard border */}
                <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 5 }}>
                  {cor.map((c, s) => {
                    const v = (c - k + 4) % 4;
                    return (
                      <div
                        key={`nm${s}`}
                        style={{ position: "absolute", [v < 2 ? "top" : "bottom"]: 0, left: v === 0 || v === 3 ? "0%" : "60%", width: "40%", height: cell * 0.72, display: "flex", alignItems: "center", justifyContent: "center" }}
                      >
                        <span style={{ fontSize: Math.max(8, Math.floor(cell * 0.4)), fontWeight: 800, lineHeight: 1, color: "#fff", textShadow: "0 1px 2px rgba(0,0,0,.75)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "90%" }}>
                          {nameOf(s)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* captures and arrivals */}
                <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 8 }}>
                  {g.fx.map((f) => {
                    const [rr, cc] = rot(f.pos[0], f.pos[1], k);
                    return (
                      <div key={f.id} style={{ position: "absolute", left: `${cc * cellPct}%`, top: `${rr * cellPct}%`, width: `${cellPct}%`, height: `${cellPct}%` }}>
                        <motion.div
                          initial={{ scale: 0.3, opacity: 0.95 }} animate={{ scale: 2.8, opacity: 0 }} transition={{ duration: 0.75, ease: "easeOut" }}
                          style={{ position: "absolute", inset: "8%", borderRadius: "50%", boxShadow: `0 0 0 3px ${f.color}, 0 0 18px ${f.color}` }}
                        />
                        {[0, 1, 2, 3, 4, 5, 6, 7].map((a) => (
                          <motion.i
                            key={a}
                            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                            animate={{ x: Math.cos((a * Math.PI) / 4) * cell * 1.1, y: Math.sin((a * Math.PI) / 4) * cell * 1.1, opacity: 0, scale: 0.3 }}
                            transition={{ duration: 0.75, ease: "easeOut" }}
                            style={{ position: "absolute", left: "42%", top: "42%", width: "16%", height: "16%", borderRadius: "50%", background: f.color, boxShadow: `0 0 8px ${f.color}` }}
                          />
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* choose your colour */}
            <AnimatePresence>
              {!ready && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="absolute inset-0 z-30 grid place-items-center" style={{ background: "rgba(8,14,34,.82)", borderRadius: 14 }}
                >
                  <motion.div
                    initial={{ scale: 0.88, y: 12 }} animate={{ scale: 1, y: 0 }} transition={{ type: "spring", stiffness: 220, damping: 18 }}
                    className="rounded-2xl p-4 text-center" style={kit.PANEL}
                  >
                    <p className="text-[15px] font-bold">{L.chooseColor}</p>
                    <p className="mt-0.5 text-[11px] opacity-75">{L.chooseSub}</p>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      {[3, 0, 1, 2].map((c) => (
                        <motion.button
                          key={c} type="button" onClick={() => setBase(c)} whileHover={{ y: -3, scale: 1.04 }} whileTap={{ scale: 0.94 }}
                          className="flex items-center gap-2 rounded-xl px-3 py-2"
                          style={{ background: "rgba(255,255,255,.08)", boxShadow: `inset 0 0 0 2px ${CC[c]}` }}
                        >
                          <span style={{ width: 28, height: 36, display: "block" }}><Pin s={c} color={CC[c]} /></span>
                          <span className="text-[13px] font-semibold">{L.names[c]}</span>
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>


      <div className="mx-auto flex items-center justify-between" style={{ width: size, marginTop: 10 }}>
        {chip(3)}{chip(2)}
      </div>
      <p className="mt-2 text-center text-[10px] font-semibold" style={{ color: "#ffffffaa" }}>{status}</p>
    </div>
  );
}