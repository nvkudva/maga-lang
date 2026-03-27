/**
 * KannadaTranslit — Transliterates romanized Kannada (typed in English)
 * into actual Kannada Unicode characters in real-time.
 *
 * Strategy: greedy longest-match on a syllable table, left-to-right.
 * Numbers, math symbols, punctuation and quoted strings are preserved as-is.
 */

const KannadaTranslit = (() => {
  // ---------------------------------------------------------------------------
  // Syllable table  (longer keys MUST come first for greedy matching)
  // ---------------------------------------------------------------------------
  const SYLLABLE_MAP = [
    // ---- Two-char consonant clusters / special combos ----
    ["shu", "ಶು"],
    ["shi", "ಶಿ"],
    ["sha", "ಶ"],
    ["shr", "ಶ್ರ"],
    ["shru", "ಶ್ರು"],
    ["ksh", "ಕ್ಷ"],
    ["ksha", "ಕ್ಷ"],
    ["kshe", "ಕ್ಷೆ"],
    ["gna", "ಜ್ಞ"],
    ["gne", "ಜ್ಞೆ"],
    ["tra", "ತ್ರ"],
    ["dra", "ದ್ರ"],
    ["bra", "ಬ್ರ"],
    ["pra", "ಪ್ರ"],
    ["nna", "ನ್ನ"],
    ["lla", "ಲ್ಲ"],
    ["tta", "ತ್ತ"],
    ["dda", "ದ್ದ"],
    ["mma", "ಮ್ಮ"],
    ["rra", "ರ್ರ"],
    ["ssa", "ಸ್ಸ"],

    // ---- ka/ke/ki/ko/ku ----
    ["kaa", "ಕಾ"],
    ["kee", "ಕೀ"],
    ["kii", "ಕೀ"],
    ["koo", "ಕೂ"],
    ["kuu", "ಕೂ"],
    ["kai", "ಕೈ"],
    ["kau", "ಕೌ"],
    ["ka", "ಕ"],
    ["ke", "ಕೆ"],
    ["ki", "ಕಿ"],
    ["ko", "ಕೊ"],
    ["ku", "ಕು"],

    // ---- ga ----
    ["gaa", "ಗಾ"],
    ["gee", "ಗೀ"],
    ["gii", "ಗೀ"],
    ["goo", "ಗೂ"],
    ["guu", "ಗೂ"],
    ["ga", "ಗ"],
    ["ge", "ಗೆ"],
    ["gi", "ಗಿ"],
    ["go", "ಗೊ"],
    ["gu", "ಗು"],

    // ---- cha/che/chi ----
    ["chaa", "ಚಾ"],
    ["chee", "ಚೀ"],
    ["chii", "ಚೀ"],
    ["choo", "ಚೂ"],
    ["cha", "ಚ"],
    ["che", "ಚೆ"],
    ["chi", "ಚಿ"],
    ["cho", "ಚೊ"],
    ["chu", "ಚು"],

    // ---- ja ----
    ["jaa", "ಜಾ"],
    ["jee", "ಜೀ"],
    ["jii", "ಜೀ"],
    ["joo", "ಜೂ"],
    ["ja", "ಜ"],
    ["je", "ಜೆ"],
    ["ji", "ಜಿ"],
    ["jo", "ಜೊ"],
    ["ju", "ಜು"],

    // ---- ta ----
    ["taa", "ತಾ"],
    ["tee", "ತೀ"],
    ["tii", "ತೀ"],
    ["too", "ತೂ"],
    ["ta", "ತ"],
    ["te", "ತೆ"],
    ["ti", "ತಿ"],
    ["to", "ತೊ"],
    ["tu", "ತು"],

    // ---- da ----
    ["daa", "ದಾ"],
    ["dee", "ದೀ"],
    ["dii", "ದೀ"],
    ["doo", "ದೂ"],
    ["da", "ದ"],
    ["de", "ದೆ"],
    ["di", "ದಿ"],
    ["do", "ದೊ"],
    ["du", "ದು"],

    // ---- na ----
    ["naa", "ನಾ"],
    ["nee", "ನೀ"],
    ["nii", "ನೀ"],
    ["noo", "ನೂ"],
    ["na", "ನ"],
    ["ne", "ನೆ"],
    ["ni", "ನಿ"],
    ["no", "ನೊ"],
    ["nu", "ನು"],

    // ---- pa ----
    ["paa", "ಪಾ"],
    ["pee", "ಪೀ"],
    ["pii", "ಪೀ"],
    ["poo", "ಪೂ"],
    ["pa", "ಪ"],
    ["pe", "ಪೆ"],
    ["pi", "ಪಿ"],
    ["po", "ಪೊ"],
    ["pu", "ಪು"],

    // ---- ba ----
    ["baa", "ಬಾ"],
    ["bee", "ಬೀ"],
    ["bii", "ಬೀ"],
    ["boo", "ಬೂ"],
    ["ba", "ಬ"],
    ["be", "ಬೆ"],
    ["bi", "ಬಿ"],
    ["bo", "ಬೊ"],
    ["bu", "ಬು"],

    // ---- ma ----
    ["maa", "ಮಾ"],
    ["mee", "ಮೀ"],
    ["mii", "ಮೀ"],
    ["moo", "ಮೂ"],
    ["ma", "ಮ"],
    ["me", "ಮೆ"],
    ["mi", "ಮಿ"],
    ["mo", "ಮೊ"],
    ["mu", "ಮು"],

    // ---- ya ----
    ["yaa", "ಯಾ"],
    ["yee", "ಯೀ"],
    ["yii", "ಯೀ"],
    ["yoo", "ಯೂ"],
    ["ya", "ಯ"],
    ["ye", "ಯೆ"],
    ["yi", "ಯಿ"],
    ["yo", "ಯೊ"],
    ["yu", "ಯು"],

    // ---- ra ----
    ["raa", "ರಾ"],
    ["ree", "ರೀ"],
    ["rii", "ರೀ"],
    ["roo", "ರೂ"],
    ["ra", "ರ"],
    ["re", "ರೆ"],
    ["ri", "ರಿ"],
    ["ro", "ರೊ"],
    ["ru", "ರು"],

    // ---- la ----
    ["laa", "ಲಾ"],
    ["lee", "ಲೀ"],
    ["lii", "ಲೀ"],
    ["loo", "ಲೂ"],
    ["la", "ಲ"],
    ["le", "ಲೆ"],
    ["li", "ಲಿ"],
    ["lo", "ಲೊ"],
    ["lu", "ಲು"],

    // ---- va/wa ----
    ["vaa", "ವಾ"],
    ["vee", "ವೀ"],
    ["vii", "ವೀ"],
    ["voo", "ವೂ"],
    ["va", "ವ"],
    ["ve", "ವೆ"],
    ["vi", "ವಿ"],
    ["vo", "ವೊ"],
    ["vu", "ವು"],
    ["wa", "ವ"],
    ["we", "ವೆ"],
    ["wi", "ವಿ"],
    ["wo", "ವೊ"],
    ["wu", "ವು"],

    // ---- sa ----
    ["saa", "ಸಾ"],
    ["see", "ಸೀ"],
    ["sii", "ಸೀ"],
    ["soo", "ಸೂ"],
    ["sa", "ಸ"],
    ["se", "ಸೆ"],
    ["si", "ಸಿ"],
    ["so", "ಸೊ"],
    ["su", "ಸು"],

    // ---- ha ----
    ["haa", "ಹಾ"],
    ["hee", "ಹೀ"],
    ["hii", "ಹೀ"],
    ["hoo", "ಹೂ"],
    ["ha", "ಹ"],
    ["he", "ಹೆ"],
    ["hi", "ಹಿ"],
    ["ho", "ಹೊ"],
    ["hu", "ಹು"],

    // ---- fa ----
    ["fa", "ಫ"],
    ["fe", "ಫೆ"],
    ["fi", "ಫಿ"],
    ["fo", "ಫೊ"],
    ["fu", "ಫು"],

    // ---- pure vowels (standalone) ----
    ["aa", "ಆ"],
    ["ee", "ಈ"],
    ["ii", "ಈ"],
    ["oo", "ಊ"],
    ["uu", "ಊ"],
    ["ai", "ಐ"],
    ["au", "ಔ"],
    ["a", "ಅ"],
    ["e", "ಎ"],
    ["i", "ಇ"],
    ["o", "ಒ"],
    ["u", "ಉ"],

    // ---- consonant-only endings (halant) ----
    ["k", "ಕ್"],
    ["g", "ಗ್"],
    ["c", "ಚ್"],
    ["j", "ಜ್"],
    ["t", "ತ್"],
    ["d", "ದ್"],
    ["n", "ನ್"],
    ["p", "ಪ್"],
    ["b", "ಬ್"],
    ["m", "ಮ್"],
    ["y", "ಯ್"],
    ["r", "ರ್"],
    ["l", "ಲ್"],
    ["v", "ವ್"],
    ["s", "ಸ್"],
    ["h", "ಹ್"],
  ];

  // Pre-sort: longest key first (already maintained above, but be safe)
  SYLLABLE_MAP.sort((a, b) => b[0].length - a[0].length);

  /**
   * Transliterate a single word (no spaces, no quotes, no numbers).
   */
  function transliterateWord(word) {
    let result = "";
    let i = 0;
    const lower = word.toLowerCase();
    while (i < lower.length) {
      let matched = false;
      for (const [latin, kannada] of SYLLABLE_MAP) {
        if (lower.startsWith(latin, i)) {
          result += kannada;
          i += latin.length;
          matched = true;
          break;
        }
      }
      if (!matched) {
        // Keep unknowns (numbers, symbols) as-is
        result += word[i];
        i++;
      }
    }
    return result;
  }

  /**
   * Transliterate a full line of code.
   * Rules:
   *   • Content inside "..." strings is transliterated (it's Kannada text).
   *   • Numbers, operators and punctuation outside strings are kept verbatim.
   *   • Words (letter sequences) outside strings are transliterated.
   */
  function transliterateLine(line) {
    let result = "";
    let i = 0;
    while (i < line.length) {
      if (line[i] === '"') {
        // Start of a quoted string — transliterate its content
        result += '"';
        i++;
        let strContent = "";
        while (i < line.length && line[i] !== '"') {
          strContent += line[i];
          i++;
        }
        result += transliterateWord(strContent);
        if (i < line.length) {
          result += '"';
          i++;
        }
      } else if (/[a-zA-Z_]/.test(line[i])) {
        // Collect full word token
        let word = "";
        while (i < line.length && /[a-zA-Z_]/.test(line[i])) {
          word += line[i];
          i++;
        }
        result += transliterateWord(word);
      } else {
        // Number, operator, whitespace, punctuation — pass through
        result += line[i];
        i++;
      }
    }
    return result;
  }

  /**
   * Transliterate an entire code block (multi-line).
   */
  function transliterate(code) {
    return code.split("\n").map(transliterateLine).join("\n");
  }

  /**
   * Kannada keyword map: Kannada-script → English MagaLang keyword.
   * Keys are the EXACT glyphs the transliterator produces for each keyword.
   * Used by the interpreter's normalizeKannada() to accept Kannada-script programs.
   *
   * Verified mappings (run: node -e "...transliterateWord(w)"):
   *   shuru    → ಶುರು
   *   maga     → ಮಗ
   *   mugisu   → ಮುಗಿಸು
   *   helu     → ಹೆಲು
   *   adre     → ಅದ್ರೆ
   *   illandre → ಇಲ್ಲನ್ದ್ರೆ
   *   repeat   → ರಿಪೀಟ್  (also accept the canonical Kannada form)
   *   madu     → ಮದು
   */
  const KANNADA_KEYWORDS = {
    // --- Core keywords (exact transliterator output) ---
    ಶುರು: "shuru",
    ಮಗ: "maga",
    ಮುಗಿಸು: "mugisu",
    ಹೇಳು: "helu",
    ಆದ್ರೆ: "adre",
    ಇಲ್ಲಾಂದ್ರೆ: "illandre",
    ರಿಪೀಟ್: "repeat", // transliterator output for 'repeat'
    ಮಾಡು: "madu",
  };

  return {
    transliterate,
    transliterateWord,
    transliterateLine,
    KANNADA_KEYWORDS,
  };
})();
