/**
 * MagaLang Playground — Core Application Logic
 * Supports dual-language UI and real-time Kannada transliteration.
 */
document.addEventListener("DOMContentLoaded", () => {
  const editor = document.getElementById("editor");
  const lineNumbers = document.getElementById("lineNumbers");
  const runBtn = document.getElementById("runBtn");
  const clearBtn = document.getElementById("clearBtn");
  const output = document.getElementById("output");
  const langEnBtn = document.getElementById("langEnBtn");
  const langKnBtn = document.getElementById("langKnBtn");
  const exampleCards = document.querySelectorAll(".example-card");

  // UI Elements for translation
  const mainTitle = document.getElementById("mainTitle");
  const mainDesc = document.getElementById("mainDesc");
  const outputLabel = document.getElementById("outputLabel");
  const examplesHeading = document.getElementById("examplesHeading");
  const footerText = document.getElementById("footerText");

  const interpreter = new MagaInterpreter();
  let isKannadaMode = true; 

  const UI_TRANSLATIONS = {
    en: {
      mainTitle: 'MagaLang <span>Playground</span>',
      mainDesc: 'The ultimate Kannada-inspired programming language. Type in English, see in Kannada.',
      runBtn: 'Run Maga 🚀',
      clearBtn: 'Clear Output',
      outputLabel: 'Output',
      examplesHeading: 'Try these examples:',
      footerText: 'Made for the Magas, by a Maga.',
      welcomeMessage: 'Welcome to MagaLang! Click "Run Maga" to execute.',
      placeholder: 'Write your MagaLang here...'
    },
    kn: {
      mainTitle: 'MagaLang <span>ಪ್ಲೇಗ್ರೌಂಡ್</span>',
      mainDesc: 'ಅತ್ಯುತ್ತಮ ಕನ್ನಡ-ಪ್ರೇರಿತ ಪ್ರೋಗ್ರಾಮಿಂಗ್ ಭಾಷೆ. ಇಂಗ್ಲಿಷ್‌ನಲ್ಲಿ ಟೈಪ್ ಮಾಡಿ, ಕನ್ನಡದಲ್ಲಿ ನೋಡಿ.',
      runBtn: 'ರನ್ ಮಗ 🚀',
      clearBtn: 'ಔಟ್‌ಪುಟ್ ತೆರವುಗೊಳಿಸಿ',
      outputLabel: 'ಔಟ್‌ಪುಟ್',
      examplesHeading: 'ಈ ಉದಾಹರಣೆಗಳನ್ನು ಪ್ರಯತ್ನಿಸಿ:',
      footerText: 'ಮಗಗಳಿಗಾಗಿ, ಒಬ್ಬ ಮಗನಿಂದ ತಯಾರಿಸಲ್ಪಟ್ಟಿದೆ.',
      welcomeMessage: 'MagaLang ಗೆ ಸುಸ್ವಾಗತ! ಎಕ್ಸಿಕ್ಯೂಟ್ ಮಾಡಲು "ರನ್ ಮಗ" ಕ್ಲಿಕ್ ಮಾಡಿ.',
      placeholder: 'ಇಲ್ಲಿ ನಿಮ್ಮ MagaLang ಬರೆಯಿರಿ...'
    }
  };

  // --- Suggestions Dropdown State ---
  let suggestions = [];
  let selectedIndex = 0;
  let suggestionBox = null;
  let activeWord = "";
  let lastFetchTimestamp = 0;

  function createSuggestionBox() {
    if (suggestionBox) return suggestionBox;
    suggestionBox = document.createElement("div");
    suggestionBox.className = "suggestions-dropdown";
    suggestionBox.style.display = "none";
    document.body.appendChild(suggestionBox);
    return suggestionBox;
  }

  // --- Suggestions Logic (Google Input Tools) ---
  async function fetchSuggestions(text) {
    if (!text || text.trim().length === 0) return [];
    
    const timestamp = Date.now();
    lastFetchTimestamp = timestamp;

    try {
      const url = `https://inputtools.google.com/request?text=${encodeURIComponent(text)}&itc=kn-t-i0-und&num=8&cp=0&cs=1&ie=utf-8&oe=utf-8&app=magalang`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (timestamp !== lastFetchTimestamp) return null;

      if (data && data[0] === "SUCCESS") {
        return data[1][0][1];
      }
    } catch (e) {
      console.error("Transliteration fetch failed:", e);
      if (typeof KannadaTranslit !== "undefined") {
        return [KannadaTranslit.transliterateWord(text)];
      }
    }
    return [];
  }

  function showSuggestions(word, rect) {
    if (!isKannadaMode || !word) {
      hideSuggestions();
      return;
    }

    fetchSuggestions(word).then((results) => {
      if (!results || results.length === 0) {
        hideSuggestions();
        return;
      }

      suggestions = results;
      selectedIndex = 0;
      activeWord = word;
      renderSuggestions(rect);
    });
  }

  function renderSuggestions(rect) {
    const box = createSuggestionBox();
    box.innerHTML = "";
    
    suggestions.forEach((s, i) => {
      const item = document.createElement("div");
      item.className = "suggestion-item" + (i === selectedIndex ? " selected" : "");
      item.innerHTML = `<span>${s}</span><span class="suggestion-index">${i + 1}</span>`;
      
      item.onclick = () => {
        selectSuggestion(i);
      };
      
      box.appendChild(item);
    });

    box.style.left = `${rect.left}px`;
    box.style.top = `${rect.bottom + 5}px`;
    box.style.display = "block";

    const boxRect = box.getBoundingClientRect();
    if (boxRect.right > window.innerWidth) {
      box.style.left = `${window.innerWidth - boxRect.width - 20}px`;
    }
    if (boxRect.bottom > window.innerHeight) {
      box.style.top = `${rect.top - boxRect.height - 5}px`;
    }
  }

  function hideSuggestions() {
    if (suggestionBox) {
      suggestionBox.style.display = "none";
    }
    suggestions = [];
    activeWord = "";
  }

  function selectSuggestion(index) {
    const word = suggestions[index];
    if (word) {
      replaceWordAtCursor(activeWord, word);
    }
    hideSuggestions();
  }

  // --- Editor Helpers ---
  function getCaretCoordinates() {
    const sel = window.getSelection();
    if (sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      return range.getBoundingClientRect();
    }
    return null;
  }

  function getCurrentWord() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return "";
    
    const range = sel.getRangeAt(0);
    const text = range.startContainer.textContent || "";
    const offset = range.startOffset;
    
    let start = offset - 1;
    while (start >= 0 && /[a-zA-Z0-9']/.test(text[start])) {
      start--;
    }
    start++;
    
    return text.substring(start, offset);
  }

  function replaceWordAtCursor(oldWord, newWord) {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;

    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    const offset = range.startOffset;
    
    let start = offset - oldWord.length;
    const originalText = node.textContent;
    node.textContent = originalText.substring(0, start) + newWord + originalText.substring(offset);
    
    const newRange = document.createRange();
    newRange.setStart(node, start + newWord.length);
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);
    
    updateLineNumbers();
  }

  // --- Line Numbers ---
  function updateLineNumbers() {
    const text = editor.innerText || "";
    const lines = text.split(/\r\n|\r|\n/).length;
    lineNumbers.innerHTML = "";
    for (let i = 1; i <= lines; i++) {
        const span = document.createElement("span");
        span.textContent = i;
        lineNumbers.appendChild(span);
    }
  }

  // --- Event Listeners ---
  editor.addEventListener("input", (e) => {
    updateLineNumbers();
    
    if (!isKannadaMode) return;

    if (e.data === " " || e.data === "\n" || !e.data) {
      hideSuggestions();
      return;
    }

    const word = getCurrentWord();
    if (word && word.length > 0) {
      const rect = getCaretCoordinates();
      if (rect) {
        showSuggestions(word, rect);
      }
    } else {
      hideSuggestions();
    }
  });

  editor.addEventListener("keydown", (e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      document.execCommand("insertText", false, "    ");
      return;
    }

    if (suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        selectedIndex = (selectedIndex + 1) % suggestions.length;
        renderSuggestions(getCaretCoordinates());
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        selectedIndex = (selectedIndex - 1 + suggestions.length) % suggestions.length;
        renderSuggestions(getCaretCoordinates());
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        selectSuggestion(selectedIndex);
      } else if (e.key === " ") {
        e.preventDefault();
        selectSuggestion(selectedIndex);
        document.execCommand("insertText", false, " ");
      } else if (e.key === "Escape") {
        hideSuggestions();
      }
    }
  });

  editor.addEventListener("scroll", () => {
    lineNumbers.scrollTop = editor.scrollTop;
  });

  // --- Language Switcher ---
  function setLanguage(lang) {
    isKannadaMode = (lang === "kn");
    const t = UI_TRANSLATIONS[lang];

    // Update Toggle UI FIRST
    if (isKannadaMode) {
      langKnBtn.classList.add("active");
      langEnBtn.classList.remove("active");
      editor.classList.add("kannada-font");
    } else {
      langEnBtn.classList.add("active");
      langKnBtn.classList.remove("active");
      editor.classList.remove("kannada-font");
      hideSuggestions();
    }

    // Update Global UI Text
    mainTitle.innerHTML = t.mainTitle;
    mainDesc.textContent = t.mainDesc;
    runBtn.textContent = t.runBtn;
    clearBtn.textContent = t.clearBtn;
    outputLabel.textContent = t.outputLabel;
    examplesHeading.textContent = t.examplesHeading;
    footerText.textContent = t.footerText;
    
    if (output.textContent.includes("Welcome") || output.textContent.includes("MagaLang ಗೆ ಸುಸ್ವಾಗತ")) {
        output.textContent = t.welcomeMessage;
    }

    editor.setAttribute("data-placeholder", t.placeholder);

    // Update Example Cards UI ONLY (not active code yet)
    exampleCards.forEach(card => {
      const cardTitle = card.querySelector(".card-title");
      const cardDesc = card.querySelector(".card-desc");
      if (isKannadaMode) {
        cardTitle.textContent = card.getAttribute("data-title-kn");
        cardDesc.textContent = card.getAttribute("data-desc-kn");
      } else {
        cardTitle.textContent = card.getAttribute("data-title-en");
        cardDesc.textContent = card.getAttribute("data-desc-en");
      }
    });

    // --- TRANSFORM ACTIVE CODE ---
    const currentCode = editor.innerText;
    if (currentCode.trim().length > 0) {
        if (isKannadaMode) {
            // Check if it's already Kannada using a simple heuristic (presence of Unicode in Kannada range)
            const hasKannada = /[\u0C80-\u0CFF]/.test(currentCode);
            if (!hasKannada) {
                // Roman -> Kannada
                editor.innerText = KannadaTranslit.transliterate(currentCode);
            }
        } else {
            // Kannada -> Roman (Keywords only)
            let restored = currentCode;
            for (const [kn, en] of Object.entries(KannadaTranslit.KANNADA_KEYWORDS)) {
                restored = restored.split(kn).join(en);
            }
            editor.innerText = restored;
        }
    }

    updateLineNumbers();
  }

  langEnBtn.addEventListener("click", () => setLanguage("en"));
  langKnBtn.addEventListener("click", () => setLanguage("kn"));

  // --- Example Cards Click ---
  exampleCards.forEach(card => {
    card.addEventListener("click", () => {
      let code = isKannadaMode 
        ? card.getAttribute("data-code-kn") 
        : card.getAttribute("data-code-en");
      
      editor.innerText = code;
      updateLineNumbers();
      output.innerText = isKannadaMode ? "ಉದಾಹರಣೆ ಲೋಡ್ ಆಗಿದೆ. ರನ್ ಮಾಡಲು 'ರನ್ ಮಗ' ಕ್ಲಿಕ್ ಮಾಡಿ." : "Loaded example. Click Run to execute.";
    });
  });

  // --- Control Buttons ---
  runBtn.addEventListener("click", () => {
    const code = editor.innerText;
    output.innerText = isKannadaMode ? "ರನ್ ಮಾಡಲಾಗುತ್ತಿದೆ...\n" : "Running...\n";
    
    setTimeout(() => {
      try {
        const result = interpreter.interpret(code);
        output.innerText = result || (isKannadaMode ? "ಪ್ರೋಗ್ರಾಂ ಯಶಸ್ವಿಯಾಗಿ ಮುಗಿದಿದೆ." : "Program finished with no output.");
      } catch (err) {
        output.innerText = "Error: " + err.message;
      }
    }, 100);
  });

  clearBtn.addEventListener("click", () => {
    output.innerText = "";
  });

  // --- INITIALIZATION ---
  // 1. Set language to Kannada FIRST
  setLanguage("kn");
  
  // 2. Load the exact Kannada code of the first example
  const firstCodeKn = exampleCards[0].getAttribute("data-code-kn");
  editor.innerText = firstCodeKn;
  
  updateLineNumbers();
});
