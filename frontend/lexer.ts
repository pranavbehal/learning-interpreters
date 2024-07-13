// Everything we want to support
export enum TokenType {
  // Literals:
  Number,
  Identifier,

  // Keywords:
  Let,

  // Grouping & Operators:
  BinaryOperator,
  Equals,
  OpenParen,
  CloseParen,
  EOF,
}

// Reserved keywords (so we can distinguish reserved identifiers and variable names)
const KEYWORDS: Record<string, TokenType> = {
  let: TokenType.Let,
};

export interface Token {
  value: string;
  type: TokenType;
}

function token(value = "", type: TokenType): Token {
  return { value, type };
}

// Checks if a character is alphabetic
function isalpha(src: String) {
  return src.toUpperCase() != src.toLowerCase();
}

// Checks if a character is a number by using character code bounds
function isint(str: string) {
  const c = str.charCodeAt(0);
  const bounds = ["0".charCodeAt(0), "9".charCodeAt(0)];

  return c >= bounds[0] && c <= bounds[1];
}

// Checks for whitespaces and other things to not check
function isskippable(str: string) {
  return str == " " || str == "\n" || str == "\t";
}

// Making a token for every word/non-spaced item
export function tokenize(sourceCode: string): Token[] {
  const tokens = new Array<Token>();
  const src = sourceCode.split("");

  while (src.length > 0) {
    if (src[0] == "(") tokens.push(token(src.shift(), TokenType.OpenParen));
    else if (src[0] == ")")
      tokens.push(token(src.shift(), TokenType.CloseParen));
    else if (
      src[0] == "+" ||
      src[0] == "-" ||
      src[0] == "*" ||
      src[0] == "/" ||
      src[0] == "%"
    ) {
      tokens.push(token(src.shift(), TokenType.BinaryOperator));
    } else if (src[0] == "=") {
      tokens.push(token(src.shift(), TokenType.Equals));
    } else {
      // Handles multi-character things (the top if-elses were for single-character items)

      // Making tokens for numbers
      if (isint(src[0])) {
        let num = "";
        while (src.length > 0 && isint(src[0])) {
          num += src.shift();
        }

        tokens.push(token(num, TokenType.Number));
      } else if (isalpha(src[0])) {
        let ident = "";
        while (src.length > 0 && isalpha(src[0])) {
          ident += src.shift();
        }

        // Check for reserved keywords
        const reserved = KEYWORDS[ident];
        if (typeof reserved == "number") {
          tokens.push(token(ident, reserved));
        } else {
          tokens.push(token(ident, TokenType.Identifier));
        }
      } else if (isskippable(src[0])) {
        src.shift(); // Skips the character
      } else {
        console.log("Unrecognized character found in source: ", src[0]);
        Deno.exit(1);
      }
    }
  }
  tokens.push({ type: TokenType.EOF, value: "EndOfFile" });
  return tokens;
}
