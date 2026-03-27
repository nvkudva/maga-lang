/**
 * MagaInterpreter - A custom-built, lightweight interpreter for the Maga-Code language.
 * Maga-Code is a Kannada-inspired programming language designed for playful learning.
 */
class MagaInterpreter {
  constructor() {
    /** @type {Object<string, *>} Dictionary to store variables */
    this.variables = {};
    /** @type {string[]} Accumulator for program output */
    this.output = [];
  }

  /**
   * Normalizes Kannada-script keywords back to English equivalents.
   * @param {string} code
   * @returns {string}
   */
  normalizeKannada(code) {
    if (typeof KannadaTranslit === 'undefined' || !KannadaTranslit.KANNADA_KEYWORDS) return code;
    // Split on quoted strings so we only replace keywords OUTSIDE of string literals
    const parts = code.split(/(\"[\s\S]*?\")/);
    const normalized = parts.map((part, i) => {
      // Even indices = outside quotes; odd indices = inside quotes (keep verbatim)
      if (i % 2 !== 0) return part;
      let result = part;
      for (const [kannadaKw, englishKw] of Object.entries(KannadaTranslit.KANNADA_KEYWORDS)) {
        result = result.split(kannadaKw).join(englishKw);
      }
      return result;
    });
    return normalized.join('');
  }

  /**
   * Tokenizes the source code into an array of strings.
   * Supports both ASCII and Kannada Unicode (U+0C00-U+0C7F) identifiers.
   * @param {string} code - The Maga-Code source string.
   * @returns {string[]} An array of tokens.
   */
  tokenize(code) {
    const tokens = [];
    // Replace non-breaking spaces with standard space to ensure regex \s handles it cleanly
    const cleanCode = code.replace(/\u00A0/g, ' ');
    const regex = /("[\s\S]*?"|\d+|[\u0C80-\u0CFFa-zA-Z_][\u0C80-\u0CFFa-zA-Z0-9_]*|==|!=|<=|>=|=|[{}();+\-*/\<\>!|&%])/g;
    let match;
    while ((match = regex.exec(cleanCode)) !== null) {
      tokens.push(match[0]);
    }
    return tokens;
  }

  /**
   * Skips a block of code enclosed in curly braces {}.
   * @param {string[]} tokens - The array of tokens.
   * @param {number} pos - The current position at '{'.
   * @returns {number} The position after the closing '}'.
   */
  skipBlock(tokens, pos) {
    let depth = 1;
    pos++;
    while (depth > 0 && pos < tokens.length) {
      if (tokens[pos] === "{") depth++;
      if (tokens[pos] === "}") depth--;
      pos++;
    }
    return pos;
  }

  /**
   * Interprets and executes the given Maga-Code.
   * @param {string} code - The source code to execute.
   * @returns {string} The collected output of the program.
   * @throws {Error} If the program doesn't start with 'shuru maga'.
   */
  interpret(code) {
    this.variables = {};
    this.output = [];
    // Normalize Kannada-script keywords so the parser handles both modes
    const normalizedCode = this.normalizeKannada(code);
    const tokens = this.tokenize(normalizedCode);
    let pos = 0;

    if (tokens[pos] !== "shuru" || tokens[pos + 1] !== "maga") {
      throw new Error("Program must start with 'shuru maga' (or ಶುರು ಮಗ in Kannada mode)");
    }
    pos += 2;

    try {
      while (pos < tokens.length) {
        if (tokens[pos] === "mugisu" && tokens[pos + 1] === "maga") {
          break;
        }
        pos = this.executeStatement(tokens, pos);
      }
    } catch (e) {
      this.output.push("Error: " + e.message);
    }

    return this.output.join("\n");
  }

  /**
   * Executes a single statement or control structure.
   * @param {string[]} tokens - The array of tokens.
   * @param {number} pos - The current token position.
   * @returns {number} The next token position after execution.
   */
  executeStatement(tokens, pos) {
    const token = tokens[pos];

    // PRINT: helu maga <expr>;
    if (token === "helu" && tokens[pos + 1] === "maga") {
      pos += 2;
      let exprTokens = [];
      while (tokens[pos] !== ";") {
        exprTokens.push(tokens[pos]);
        pos++;
      }
      const value = this.evaluateExpression(exprTokens);
      this.output.push(value);
      return pos + 1; // Skip ';'
    }

    // ASSIGNMENT: <varName> = <expr>;
    if (tokens[pos + 1] === "=") {
      const varName = tokens[pos];
      pos += 2;
      let exprTokens = [];
      while (tokens[pos] !== ";") {
        exprTokens.push(tokens[pos]);
        pos++;
      }
      this.variables[varName] = this.evaluateExpression(exprTokens);
      return pos + 1; // Skip ';'
    }

    // IF STATEMENT: maga <cond> adre { ... } [illandre maga { ... }]
    if (token === "maga") {
      pos += 1;
      let conditionTokens = [];
      while (tokens[pos] !== "adre" && pos < tokens.length) {
        conditionTokens.push(tokens[pos]);
        pos++;
      }
      const condition = !!this.evaluateExpression(conditionTokens);
      if (tokens[pos] === "adre") pos++; // Skip 'adre'
      if (tokens[pos] === "{") pos++; // Skip '{'

      if (condition) {
        while (pos < tokens.length && tokens[pos] !== "}") {
          pos = this.executeStatement(tokens, pos);
        }
        pos++; // Skip '}'

        // Skip subsequent 'illandre' blocks if the 'if' condition was met
        while (pos < tokens.length) {
          if (tokens[pos] === "illandre" && tokens[pos + 1] === "maga") {
            pos += 2;
            let currentIsElseIf = false;
            let checkPos = pos;
            while (tokens[checkPos] !== "{" && checkPos < tokens.length) {
              if (tokens[checkPos] === "adre") {
                currentIsElseIf = true;
                break;
              }
              checkPos++;
            }
            // Skip the block correctly
            pos = this.skipBlock(tokens, checkPos);
          } else {
            break;
          }
        }
      } else {
        // Skip the 'if' true block
        pos = this.skipBlock(tokens, pos - 1);

        let handled = false;
        while (pos < tokens.length) {
          if (tokens[pos] === "illandre" && tokens[pos + 1] === "maga") {
            pos += 2;
            let isElseIf = false;
            let tempPos = pos;
            while (tokens[tempPos] !== "{" && tempPos < tokens.length) {
              if (tokens[tempPos] === "adre") {
                isElseIf = true;
                break;
              }
              tempPos++;
            }

            if (isElseIf) {
              // ELSE IF case
              let innerCondTokens = [];
              while (tokens[pos] !== "adre" && pos < tokens.length) {
                innerCondTokens.push(tokens[pos]);
                pos++;
              }
              const innerCondition = !!this.evaluateExpression(innerCondTokens);
              if (tokens[pos] === "adre") pos++;
              if (tokens[pos] === "{") pos++;

              if (innerCondition && !handled) {
                while (tokens[pos] !== "}" && pos < tokens.length) {
                  pos = this.executeStatement(tokens, pos);
                }
                pos++; // Skip '}'
                handled = true;
              } else {
                pos = this.skipBlock(tokens, pos - 1);
              }
            } else {
              // SIMPLE ELSE case: illandre maga {
              if (tokens[pos] === "{") pos++;
              if (!handled) {
                while (tokens[pos] !== "}" && pos < tokens.length) {
                  pos = this.executeStatement(tokens, pos);
                }
                pos++; // Skip '}'
                handled = true;
              } else {
                pos = this.skipBlock(tokens, pos - 1);
              }
              break;
            }
          } else {
            break;
          }
        }
      }
      return pos;
    }

    // WHILE LOOP: repeat madu maga <cond> { ... }
    if (
      token === "repeat" &&
      tokens[pos + 1] === "madu" &&
      tokens[pos + 2] === "maga"
    ) {
      pos += 3;
      let conditionTokens = [];
      while (tokens[pos] !== "{" && pos < tokens.length) {
        conditionTokens.push(tokens[pos]);
        pos++;
      }
      let bodyStart = pos + 1; // Position after '{'
      let bodyEnd = this.skipBlock(tokens, pos) - 1; // Position of '}'

      while (this.evaluateExpression(conditionTokens)) {
        let currentPos = bodyStart;
        while (currentPos < bodyEnd) {
          currentPos = this.executeStatement(tokens, currentPos);
        }
      }
      return bodyEnd + 1; // Return position after '}'
    }

    // Default: unknown token or skip
    pos++;
    return pos;
  }

  /**
   * Evaluates an expression by resolving variables and using standard JS eval.
   * @param {string[]} tokens - The tokens forming the expression.
   * @returns {*} The evaluated result.
   */
  evaluateExpression(tokens) {
    if (tokens.length === 0) return null;

    const expression = tokens
      .map((t) => {
        if (this.variables.hasOwnProperty(t)) {
          return JSON.stringify(this.variables[t]);
        }
        return t;
      })
      .join(" ");

    try {
      // Replace '==' with '===' and '!=' with '!==' for strict matching
      let sanitized = expression.replace(/==|!=/g, (match) =>
        match === "==" ? "===" : "!==",
      );
      return eval(sanitized);
    } catch (e) {
      // Fallback for simple string handling
      return expression;
    }
  }
}
