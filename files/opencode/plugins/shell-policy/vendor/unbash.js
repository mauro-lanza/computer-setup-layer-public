// unbash 6.0.3 (ISC, https://github.com/webpro-nl/unbash), bundled with bun build --target=bun --format=esm
// node_modules/unbash/dist/traversal.js
function forEachChild(node, callback) {
  switch (node.type) {
    case "Script":
    case "CompoundList":
    case "AndOr":
      for (const command of node.commands)
        callback(command);
      return;
    case "Statement":
      callback(node.command);
      return;
    case "Command":
      for (const child of node.prefix)
        callback(child);
      if (node.name)
        callback(node.name);
      for (const child of node.suffix)
        callback(child);
      return;
    case "Pipeline":
      for (const prefix of node.prefixes)
        callback(prefix);
      for (const command of node.commands)
        callback(command);
      return;
    case "Redirected":
      callback(node.command);
      for (const redirect of node.redirects)
        callback(redirect);
      return;
    case "If":
      callback(node.clause);
      callback(node.then);
      for (const branch of node.elif)
        callback(branch);
      if (node.else)
        callback(node.else);
      return;
    case "Elif":
      callback(node.clause);
      callback(node.then);
      return;
    case "For":
    case "Select":
      callback(node.name);
      if (node.wordlist)
        for (const word of node.wordlist)
          callback(word);
      callback(node.body);
      return;
    case "While":
      callback(node.clause);
      callback(node.body);
      return;
    case "Function":
    case "Coproc":
      if (node.name)
        callback(node.name);
      callback(node.body);
      return;
    case "Subshell":
    case "BraceGroup":
      callback(node.body);
      return;
    case "Case":
      callback(node.word);
      for (const item of node.items)
        callback(item);
      return;
    case "CaseItem":
      for (const pattern of node.pattern)
        callback(pattern);
      callback(node.body);
      return;
    case "ArithmeticFor": {
      const initialize = node.initialize;
      if (initialize)
        callback(initialize);
      const test = node.test;
      if (test)
        callback(test);
      const update = node.update;
      if (update)
        callback(update);
      callback(node.body);
      return;
    }
    case "Word":
    case "Glob":
    case "ArithmeticWord":
    case "HereDocBody":
    case "BraceExpansion":
    case "ExtendedGlob": {
      const parts = node.parts;
      if (parts)
        for (const part of parts)
          callback(part);
      return;
    }
    case "DoubleQuoted":
    case "LocaleString":
      for (const part of node.parts)
        callback(part);
      return;
    case "ParameterExpansion":
      if (node.index)
        callback(node.index);
      if (node.operation)
        callback(node.operation);
      return;
    case "Default":
    case "Remove":
    case "Transform":
      callback(node.operand);
      return;
    case "CaseModification":
      if (node.operand)
        callback(node.operand);
      return;
    case "Replace":
      callback(node.pattern);
      callback(node.replacement);
      return;
    case "Slice":
      callback(node.offset);
      if (node.length)
        callback(node.length);
      return;
    case "Assignment": {
      const index = node.index;
      if (index)
        callback(index);
      callback(node.value);
      return;
    }
    case "ArrayValue":
      for (const element of node.elements)
        callback(element);
      return;
    case "Redirect":
    case "HereString":
      if (node.descriptor)
        callback(node.descriptor);
      if (node.target)
        callback(node.target);
      return;
    case "HereDoc":
      if (node.descriptor)
        callback(node.descriptor);
      if (node.delimiter)
        callback(node.delimiter);
      callback(node.body);
      return;
    case "CommandExpansion":
    case "ProcessSubstitution":
    case "ArithmeticCommandExpansion": {
      const script = node.script;
      if (script)
        callback(script);
      return;
    }
    case "ArithmeticExpansion":
    case "ArithmeticCommand":
    case "ArithmeticGroup":
    case "TestCommand":
    case "TestGroup": {
      const expression = node.expression;
      if (expression)
        callback(expression);
      return;
    }
    case "ArithmeticBinary":
    case "TestBinary":
      callback(node.left);
      callback(node.right);
      return;
    case "ArithmeticUnary":
    case "TestUnary":
      callback(node.operand);
      return;
    case "ArithmeticTernary":
      callback(node.test);
      callback(node.consequent);
      callback(node.alternate);
      return;
    case "TestLogical":
      for (const operand of node.operands)
        callback(operand);
      return;
    case "TestNot":
      for (const negation of node.negations)
        callback(negation);
      callback(node.operand);
      return;
    case "Literal":
    case "SingleQuoted":
    case "AnsiCQuoted":
    case "SimpleExpansion":
    case "Names":
    case "Unknown":
    case "FileDescriptor":
    case "FileDescriptorVariable":
    case "HereDocDelimiter":
    case "Time":
    case "Negation":
      return;
    default: {
      const exhaustive = node;
      throw new TypeError(`Unexpected syntax node: ${exhaustive}`);
    }
  }
}
// node_modules/unbash/dist/ansi-c.js
function isOctal(code) {
  return code >= 48 && code <= 55;
}
function isHex(code) {
  return code >= 48 && code <= 57 || code >= 65 && code <= 70 || code >= 97 && code <= 102;
}
function codePoint(value, fallback) {
  try {
    return String.fromCodePoint(value);
  } catch {
    return fallback;
  }
}
var utf8 = new TextDecoder("utf-8", { ignoreBOM: true });
function decodeBytes(bytes) {
  return utf8.decode(new Uint8Array(bytes));
}
function readByteEscape(source, pos, limit) {
  if (source.charCodeAt(pos) !== 92 || pos + 2 > limit)
    return;
  const escaped = source.charCodeAt(pos + 1);
  const digitsStart = pos + 2;
  let end = digitsStart;
  if (escaped === 120) {
    while (end < limit && end - digitsStart < 2 && isHex(source.charCodeAt(end)))
      end++;
    if (end === digitsStart)
      return;
    return { value: Number.parseInt(source.slice(digitsStart, end), 16), end };
  }
  if (!isOctal(escaped))
    return;
  while (end < limit && end - digitsStart < 2 && isOctal(source.charCodeAt(end)))
    end++;
  return { value: Number.parseInt(source.slice(pos + 1, end), 8) & 255, end };
}
function decodeAnsiCQuoted(source, start, limit) {
  let pos = start;
  let value = "";
  let bytes = [];
  let nul = -1;
  while (pos < limit && source.charCodeAt(pos) !== 39) {
    const escapeStart = pos;
    const byte = readByteEscape(source, pos, limit);
    if (byte && byte.value >= 128) {
      bytes.push(byte.value);
      pos = byte.end;
      continue;
    }
    if (bytes.length > 0) {
      value += decodeBytes(bytes);
      bytes = [];
    }
    if (byte) {
      if (byte.value === 0 && nul === -1)
        nul = value.length;
      value += String.fromCharCode(byte.value);
      pos = byte.end;
      continue;
    }
    if (source.charCodeAt(pos) !== 92 || pos + 1 >= limit) {
      const runStart = pos;
      while (pos < limit) {
        const code = source.charCodeAt(pos);
        if (code === 39 || code === 92 && pos + 1 < limit)
          break;
        pos++;
      }
      value += source.slice(runStart, pos);
      continue;
    }
    pos++;
    const escaped = source[pos++];
    switch (escaped) {
      case "a":
        value += "\x07";
        break;
      case "b":
        value += "\b";
        break;
      case "e":
      case "E":
        value += "\x1B";
        break;
      case "f":
        value += "\f";
        break;
      case "n":
        value += `
`;
        break;
      case "r":
        value += "\r";
        break;
      case "t":
        value += "\t";
        break;
      case "v":
        value += "\v";
        break;
      case "\\":
        value += "\\";
        break;
      case "'":
        value += "'";
        break;
      case '"':
        value += '"';
        break;
      case "?":
        value += "?";
        break;
      case `
`:
        break;
      case "c": {
        const code = pos < limit ? source.charCodeAt(pos) : 39;
        if (code === 39) {
          value += source.slice(escapeStart, pos);
          break;
        }
        pos++;
        if (code === 92) {
          const pair = pos < limit && source.charCodeAt(pos) === 92;
          if (pair)
            pos++;
          value += "\x1C";
          if (!pair && pos < limit) {
            value += source[pos];
            pos++;
          }
          break;
        }
        const control = code === 63 ? 127 : code & 31;
        if (control === 0 && code < 128 && nul === -1)
          nul = value.length;
        value += String.fromCharCode(control);
        break;
      }
      case "u":
      case "U": {
        const digitsStart = pos;
        const maxDigits = escaped === "u" ? 4 : 8;
        while (pos < limit && pos - digitsStart < maxDigits && isHex(source.charCodeAt(pos)))
          pos++;
        if (pos === digitsStart) {
          value += `\\${escaped}`;
          break;
        }
        const raw = source.slice(escapeStart, pos);
        const point = Number.parseInt(source.slice(digitsStart, pos), 16);
        if (point === 0 && nul === -1)
          nul = value.length;
        value += codePoint(point, raw);
        break;
      }
      default:
        value += `\\${escaped}`;
        break;
    }
  }
  if (bytes.length > 0)
    value += decodeBytes(bytes);
  if (nul !== -1)
    value = value.slice(0, nul);
  const closed = pos < limit;
  if (closed)
    pos++;
  return { value, end: pos, closed };
}

// node_modules/unbash/dist/expansion.js
class ScriptExpansionImpl {
  static _resolveScript;
  type;
  pos;
  end;
  text;
  #window;
  #script = undefined;
  constructor(type, pos, end, text, window) {
    this.type = type;
    this.pos = pos;
    this.end = end;
    this.text = text;
    this.#window = window;
  }
  get script() {
    const window = this.#window;
    if (window !== undefined) {
      const script = ScriptExpansionImpl._resolveScript(window.source, window.start, window.end, window.depth, window.parenBoundary, window.context);
      if (window.context === undefined)
        script.source = window.source;
      this.script = script;
    }
    return this.#script;
  }
  set script(script) {
    this.#script = script;
    this.#window = undefined;
  }
  toJSON() {
    return { type: this.type, pos: this.pos, end: this.end, text: this.text, script: this.script };
  }
}

class ProcessSubstitutionImpl extends ScriptExpansionImpl {
  operator;
  constructor(pos, end, text, operator, window) {
    super("ProcessSubstitution", pos, end, text, window);
    this.operator = operator;
  }
  toJSON() {
    return {
      type: this.type,
      pos: this.pos,
      end: this.end,
      text: this.text,
      operator: this.operator,
      script: this.script
    };
  }
}

class ArithmeticExpansionImpl {
  static _resolveExpression;
  type = "ArithmeticExpansion";
  pos;
  end;
  text;
  #window;
  #expression = undefined;
  constructor(pos, end, text, window) {
    this.pos = pos;
    this.end = end;
    this.text = text;
    this.#window = window;
  }
  get expression() {
    const window = this.#window;
    if (window !== undefined) {
      this.expression = ArithmeticExpansionImpl._resolveExpression(window.body, window.offset, window.source, window.depth, window.context, window.depth + 1);
    }
    return this.#expression;
  }
  set expression(expression) {
    this.#expression = expression;
    this.#window = undefined;
  }
  toJSON() {
    return { type: this.type, pos: this.pos, end: this.end, text: this.text, expression: this.expression };
  }
}

// node_modules/unbash/dist/limits.js
var MAX_SYNTAX_NESTING = 256;

// node_modules/unbash/dist/word-value.js
function dequoteValue(parts) {
  let s = "";
  for (const c of parts)
    s += c.type === "Literal" ? c.value : c.text;
  return s;
}
function unescapeBareValue(text) {
  const first = text.indexOf("\\");
  if (first === -1)
    return text;
  let s = "";
  let start = 0;
  for (let i = first;i < text.length; i++) {
    if (text.charCodeAt(i) !== 92)
      continue;
    s += text.slice(start, i);
    i++;
    if (i >= text.length) {
      s += "\\";
      start = i;
      break;
    }
    if (text.charCodeAt(i) !== 10)
      s += text[i];
    start = i + 1;
  }
  return s + text.slice(start);
}
function continuedExpansionValue(text) {
  let pos = 1;
  while (text[pos] === "\\" && text[pos + 1] === `
`)
    pos += 2;
  return pos === 1 || text[pos] !== "(" ? text : text[0] + text.slice(pos);
}
function wordPartsValue(parts) {
  let value = "";
  for (const part of parts) {
    switch (part.type) {
      case "Literal":
      case "Glob":
      case "SingleQuoted":
      case "AnsiCQuoted":
        value += part.value;
        break;
      case "DoubleQuoted":
      case "LocaleString":
        value += dequoteValue(part.parts);
        break;
      case "CommandExpansion":
        value += part.text[0] === "$" ? continuedExpansionValue(part.text) : part.text;
        break;
      case "ExtendedGlob":
        value += continuedExpansionValue(part.text);
        break;
      default:
        value += part.text;
        break;
    }
  }
  return value;
}

// node_modules/unbash/dist/word.js
class WordImpl {
  type = "Word";
  text;
  pos;
  end;
  #source;
  #resolver;
  #depth;
  #parts;
  #value = null;
  constructor(text, pos, end, source, resolver, depth = 0) {
    this.text = text;
    this.pos = pos;
    this.end = end;
    this.#source = source;
    this.#resolver = resolver;
    this.#depth = depth;
    this.#parts = resolver === undefined ? undefined : null;
  }
  get value() {
    if (this.#value === null) {
      const parts = this.#source === undefined && this.#parts === null ? undefined : this.parts;
      this.#value = parts ? wordPartsValue(parts) : unescapeBareValue(this.text);
    }
    return this.#value;
  }
  get parts() {
    if (this.#parts === null) {
      this.#parts = this.#resolver?.(this.#source ?? "", this, this.#depth) ?? undefined;
    }
    return this.#parts;
  }
  set parts(v) {
    this.#parts = v ?? undefined;
  }
  toJSON() {
    return { type: this.type, text: this.text, pos: this.pos, end: this.end, parts: this.parts, value: this.value };
  }
}

// node_modules/unbash/dist/substitution-context.js
function createSubstitutionContext(parent) {
  const boundaries = parent === undefined ? undefined : substitutionBoundaries(parent);
  return { boundaries, wordParts: undefined, embeddedParts: undefined, arrayParts: undefined };
}
function substitutionBoundaries(context) {
  return context.boundaries ?? (context.boundaries = new Map);
}

// node_modules/unbash/dist/chars.js
var CH_TAB = 9;
var CH_NL = 10;
var CH_SPACE = 32;
var CH_BANG = 33;
var CH_DQUOTE = 34;
var CH_HASH = 35;
var CH_DOLLAR = 36;
var CH_PERCENT = 37;
var CH_AMP = 38;
var CH_SQUOTE = 39;
var CH_LPAREN = 40;
var CH_RPAREN = 41;
var CH_STAR = 42;
var CH_PLUS = 43;
var CH_COMMA = 44;
var CH_DASH = 45;
var CH_DOT = 46;
var CH_SLASH = 47;
var CH_0 = 48;
var CH_9 = 57;
var CH_COLON = 58;
var CH_SEMI = 59;
var CH_LT = 60;
var CH_EQ = 61;
var CH_GT = 62;
var CH_QUESTION = 63;
var CH_AT = 64;
var CH_A = 65;
var CH_Z = 90;
var CH_LBRACKET = 91;
var CH_BACKSLASH = 92;
var CH_RBRACKET = 93;
var CH_CARET = 94;
var CH_UNDERSCORE = 95;
var CH_BACKTICK = 96;
var CH_a = 97;
var CH_z = 122;
var CH_LBRACE = 123;
var CH_PIPE = 124;
var CH_RBRACE = 125;
var CH_TILDE = 126;
function skipLineContinuations(source, pos, end) {
  while (pos + 1 < end && source.charCodeAt(pos) === CH_BACKSLASH && source.charCodeAt(pos + 1) === CH_NL)
    pos += 2;
  return pos;
}

// node_modules/unbash/dist/glob.js
function hasGlobCharacters(text) {
  return /[*?[]/.test(text);
}
var bracketSyntax = new Uint8Array(128);
bracketSyntax[CH_BANG] = 1;
bracketSyntax[CH_CARET] = 1;
bracketSyntax[CH_LBRACKET] = 1;
bracketSyntax[CH_RBRACKET] = 1;
bracketSyntax[CH_COLON] = 1;
bracketSyntax[CH_DOT] = 1;
bracketSyntax[CH_EQ] = 1;
bracketSyntax[CH_DASH] = 1;
bracketSyntax[CH_BACKSLASH] = 1;
function bracketEnds(source, start, end, parts, offset) {
  let close = end - 1;
  while (close > start && source.charCodeAt(close) !== CH_RBRACKET)
    close--;
  if (close === start)
    return null;
  const positions = [];
  const kinds = [];
  const members = [];
  let partIndex = 0;
  let symbols = false;
  for (let pos = start;pos < end; pos++) {
    while (parts && partIndex < parts.length && parts[partIndex].end <= pos + offset)
      partIndex++;
    const part = parts?.[partIndex];
    const tokenPos = pos;
    let kind = 0;
    if (part && part.pos <= pos + offset && part.type !== "Literal") {
      pos = part.end - offset - 1;
    } else {
      kind = source.charCodeAt(pos);
      if (kind === CH_BACKSLASH && pos + 1 < end && source.charCodeAt(pos + 1) === CH_NL) {
        pos++;
        continue;
      }
      if (kind >= 128 || !bracketSyntax[kind])
        kind = 0;
    }
    const last = kinds.length - 1;
    if (kind === 0 && last >= 0 && kinds[last] === 0) {
      members[last]++;
      continue;
    }
    if (last >= 0 && kinds[last] === CH_LBRACKET && (kind === CH_COLON || kind === CH_EQ || kind === CH_DOT)) {
      symbols = true;
    }
    positions.push(tokenPos);
    kinds.push(kind);
    members.push(1);
  }
  const count = kinds.length;
  let symbolEnd;
  if (symbols) {
    symbolEnd = new Int32Array(count).fill(-1);
    let close = -1;
    let colon = -1;
    let eq = -1;
    let dot = -1;
    for (let i = count - 1;i >= 0; i--) {
      const kind = kinds[i + 2];
      if (kind === CH_RBRACKET)
        close = i + 2;
      else if (kinds[i + 3] === CH_RBRACKET) {
        if (kind === CH_COLON)
          colon = i + 2;
        else if (kind === CH_EQ)
          eq = i + 2;
        else if (kind === CH_DOT)
          dot = i + 2;
      }
      if (kinds[i] !== CH_LBRACKET)
        continue;
      const type = kinds[i + 1];
      const found = type === CH_COLON ? colon : type === CH_EQ ? eq : type === CH_DOT ? dot : -1;
      if (found !== -1 && (type === CH_DOT || close === -1 || close > found))
        symbolEnd[i] = found + 2;
    }
  }
  const subBracket = (open) => symbolEnd === undefined ? -1 : symbolEnd[open];
  const endFrom = new Int32Array(count + 2).fill(-1);
  const resume = (next, range) => {
    if (next >= count)
      return -1;
    if (range && kinds[next] === CH_DASH && next + 1 < count && kinds[next + 1] !== CH_RBRACKET) {
      let last = next + 1;
      if (kinds[last] === CH_BACKSLASH) {
        if (last + 1 >= count)
          return -1;
        last++;
      }
      let after = last + 1;
      if (kinds[last] === CH_LBRACKET && kinds[last + 1] === CH_DOT) {
        const symbol = subBracket(last);
        if (symbol !== -1)
          after = symbol;
      } else if (kinds[last] === 0 && members[last] > 1) {
        return endFrom[last];
      }
      if (after >= count)
        return -1;
      return kinds[after] === CH_RBRACKET ? after + 1 : endFrom[after];
    }
    return kinds[next] === CH_RBRACKET ? next + 1 : endFrom[next];
  };
  for (let t = count - 1;t >= 0; t--) {
    const kind = kinds[t];
    let after = t + 1;
    let range = true;
    if (kind === CH_BACKSLASH) {
      if (t + 1 >= count)
        continue;
      after = t + 2;
    } else if (kind === CH_LBRACKET) {
      const type = kinds[t + 1];
      if (type === CH_COLON || type === CH_EQ || type === CH_DOT) {
        const symbol = subBracket(t);
        if (symbol !== -1) {
          after = symbol;
          range = type === CH_DOT;
        }
      }
    }
    endFrom[t] = resume(after, range);
  }
  const ends = new Map;
  for (let t = 0;t < count; t++) {
    if (kinds[t] !== CH_LBRACKET)
      continue;
    let first = t + 1;
    if (kinds[first] === CH_BANG || kinds[first] === CH_CARET)
      first++;
    if (first >= count)
      continue;
    const close = kinds[first] === CH_RBRACKET ? resume(first + 1, true) : endFrom[first];
    if (close !== -1)
      ends.set(positions[t], positions[close - 1] + 1);
  }
  return ends;
}
function appendRange(source, start, end, parts, index, offset, result) {
  while (start < end) {
    while (parts && index < parts.length && parts[index].end <= start + offset)
      index++;
    const part = parts?.[index];
    if (part && part.pos === start + offset && part.end <= end + offset) {
      result.push(part);
      start = part.end - offset;
      index++;
      continue;
    }
    const stop = part ? Math.min(end, (part.pos > start + offset ? part.pos : part.end) - offset) : end;
    const text = source.slice(start, stop);
    result.push({ type: "Literal", pos: start + offset, end: stop + offset, text, value: unescapeBareValue(text) });
    start = stop;
  }
  return index;
}
function parseGlobParts(source, start, end, parts, offset = 0) {
  let result;
  let brackets;
  let partIndex = 0;
  let emittedIndex = 0;
  let literalStart = start;
  for (let pos = start;pos < end; pos++) {
    while (parts && partIndex < parts.length && parts[partIndex].end <= pos + offset)
      partIndex++;
    const part = parts?.[partIndex];
    if (part && part.pos <= pos + offset && part.type !== "Literal") {
      pos = part.end - offset - 1;
      continue;
    }
    const character = source.charCodeAt(pos);
    if (character === CH_BACKSLASH) {
      pos++;
      continue;
    }
    let globEnd;
    if (character === CH_STAR || character === CH_QUESTION) {
      const limit = part ? Math.min(end, part.end - offset) : end;
      const next = skipLineContinuations(source, pos + 1, limit);
      if (next < limit && source.charCodeAt(next) === CH_LPAREN)
        continue;
      globEnd = pos + 1;
      if (character === CH_STAR) {
        while (globEnd < limit && source.charCodeAt(globEnd) === CH_STAR) {
          const next = skipLineContinuations(source, globEnd + 1, limit);
          if (next < limit && source.charCodeAt(next) === CH_LPAREN)
            break;
          globEnd++;
        }
      }
    } else if (character === CH_LBRACKET) {
      if (brackets === undefined)
        brackets = bracketEnds(source, pos, end, parts, offset);
      const close = brackets?.get(pos);
      if (close === undefined)
        continue;
      globEnd = close;
    } else {
      continue;
    }
    if (!result)
      result = [];
    emittedIndex = appendRange(source, literalStart, pos, parts, emittedIndex, offset, result);
    const text = source.slice(pos, globEnd);
    let glob;
    if (character === CH_LBRACKET) {
      const interior = [];
      emittedIndex = appendRange(source, pos + 1, globEnd - 1, parts, emittedIndex, offset, interior);
      glob = {
        type: "Glob",
        kind: "bracket",
        pos: pos + offset,
        end: globEnd + offset,
        text,
        value: "[" + wordPartsValue(interior) + "]",
        parts: interior
      };
    } else {
      glob = {
        type: "Glob",
        kind: character === CH_STAR ? "star" : "question",
        pos: pos + offset,
        end: globEnd + offset,
        text,
        value: text,
        parts: undefined
      };
    }
    result.push(glob);
    literalStart = globEnd;
    pos = globEnd - 1;
  }
  if (!result)
    return parts ?? undefined;
  appendRange(source, literalStart, end, parts, emittedIndex, offset, result);
  return result;
}

// node_modules/unbash/dist/lexer.js
var Token = {
  Word: 0,
  Assignment: 1,
  Semi: 2,
  Newline: 3,
  Pipe: 4,
  And: 5,
  Or: 6,
  Amp: 7,
  LParen: 8,
  RParen: 9,
  LBrace: 10,
  RBrace: 11,
  Bang: 12,
  If: 13,
  Then: 14,
  Else: 15,
  Elif: 16,
  Fi: 17,
  Do: 18,
  Done: 19,
  For: 20,
  While: 21,
  Until: 22,
  In: 23,
  Case: 24,
  Esac: 25,
  Function: 26,
  DoubleSemi: 27,
  SemiAmp: 28,
  DoubleSemiAmp: 29,
  Select: 30,
  DblLBracket: 31,
  DblRBracket: 32,
  EOF: 33,
  ArithCmd: 34,
  Coproc: 35,
  Redirect: 36
};

class TokenValue {
  token = Token.EOF;
  _value = "";
  _owner;
  pos = 0;
  end = 0;
  fileDescriptor = undefined;
  variableName = undefined;
  descriptorEnd = 0;
  delimiterQuoted = false;
  content = undefined;
  targetPos = 0;
  targetEnd = 0;
  assignmentOperatorPos = -1;
  raw = false;
  keywordEligible = false;
  constructor(owner = null) {
    this._owner = owner;
  }
  get value() {
    return this._value ?? (this._value = this._owner === null ? "" : this._owner._tokenValue(this.pos, this.end, this.raw));
  }
  set value(v) {
    this._value = v;
  }
  reset() {
    this.token = Token.EOF;
    this._value = "";
    this.pos = 0;
    this.end = 0;
    this.fileDescriptor = undefined;
    this.variableName = undefined;
    this.descriptorEnd = 0;
    this.delimiterQuoted = false;
    this.content = undefined;
    this.targetPos = 0;
    this.targetEnd = 0;
    this.assignmentOperatorPos = -1;
    this.raw = false;
    this.keywordEligible = false;
  }
  copyFrom(other) {
    this.token = other.token;
    this._value = other._value;
    this.pos = other.pos;
    this.end = other.end;
    this.fileDescriptor = other.fileDescriptor;
    this.variableName = other.variableName;
    this.descriptorEnd = other.descriptorEnd;
    this.delimiterQuoted = other.delimiterQuoted;
    this.content = other.content;
    this.targetPos = other.targetPos;
    this.targetEnd = other.targetEnd;
    this.assignmentOperatorPos = other.assignmentOperatorPos;
    this.raw = other.raw;
    this.keywordEligible = other.keywordEligible;
  }
}
var RESERVED_WORDS = new Map([
  ["if", Token.If],
  ["then", Token.Then],
  ["else", Token.Else],
  ["elif", Token.Elif],
  ["fi", Token.Fi],
  ["do", Token.Do],
  ["done", Token.Done],
  ["for", Token.For],
  ["while", Token.While],
  ["until", Token.Until],
  ["in", Token.In],
  ["case", Token.Case],
  ["esac", Token.Esac],
  ["function", Token.Function],
  ["select", Token.Select],
  ["coproc", Token.Coproc],
  ["!", Token.Bang],
  ["{", Token.LBrace],
  ["}", Token.RBrace]
]);
var charType = new Uint8Array(128);
charType[CH_PIPE] = 1;
charType[CH_AMP] = 1;
charType[CH_SEMI] = 1;
charType[CH_LPAREN] = 1;
charType[CH_RPAREN] = 1;
charType[CH_LT] = 1;
charType[CH_GT] = 1;
charType[CH_SPACE] = 1;
charType[CH_TAB] = 1;
charType[CH_NL] = 1;
charType[CH_BACKSLASH] = 2;
charType[CH_SQUOTE] = 2;
charType[CH_DQUOTE] = 2;
charType[CH_DOLLAR] = 2;
charType[CH_BACKTICK] = 2;
charType[CH_LBRACE] = 2;
function skipBlanks(source, pos, end) {
  while (pos < end) {
    const ch = source.charCodeAt(pos);
    if (ch === CH_SPACE || ch === CH_TAB)
      pos++;
    else if (ch === CH_BACKSLASH && pos + 1 < end && source.charCodeAt(pos + 1) === CH_NL)
      pos += 2;
    else
      break;
  }
  return pos;
}
var arithmeticWordDelimiter = new Uint8Array(128);
for (const ch of [
  CH_TAB,
  CH_NL,
  CH_SPACE,
  CH_BANG,
  CH_PERCENT,
  CH_AMP,
  CH_LPAREN,
  CH_RPAREN,
  CH_STAR,
  CH_PLUS,
  CH_COMMA,
  CH_DASH,
  CH_SLASH,
  CH_COLON,
  CH_LT,
  CH_EQ,
  CH_GT,
  CH_QUESTION,
  CH_CARET,
  CH_PIPE
]) {
  arithmeticWordDelimiter[ch] = 1;
}
function hasEmbeddedWordStructure(source, start, end) {
  for (let pos = start;pos < end; pos++) {
    const ch = source.charCodeAt(pos);
    if (ch === CH_BACKSLASH || ch === CH_SQUOTE || ch === CH_DQUOTE || ch === CH_DOLLAR || ch === CH_BACKTICK || (ch === CH_LT || ch === CH_GT) && pos + 1 < end && source.charCodeAt(pos + 1) === CH_LPAREN) {
      return true;
    }
  }
  return false;
}
function findUnnested(s, target, pairTernaries = false, findNestedEnd) {
  let depth = 0;
  let ternaryDepth = 0;
  for (let i = 0;i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === CH_BACKSLASH) {
      i++;
      continue;
    }
    if (c === CH_LBRACE) {
      depth++;
      continue;
    }
    if (c === CH_RBRACE) {
      if (depth > 0)
        depth--;
      continue;
    }
    if (c === CH_SQUOTE) {
      i++;
      while (i < s.length && s.charCodeAt(i) !== CH_SQUOTE)
        i++;
      continue;
    }
    if (c === CH_DQUOTE) {
      i++;
      while (i < s.length) {
        const quoted = s.charCodeAt(i);
        if (quoted === CH_DQUOTE)
          break;
        if (quoted === CH_BACKSLASH) {
          i += 2;
          continue;
        }
        const nestedEnd = findNestedEnd?.(i, true) ?? i;
        if (nestedEnd > i) {
          i = nestedEnd;
          continue;
        }
        i++;
      }
      continue;
    }
    const nestedEnd = findNestedEnd?.(i, false) ?? i;
    if (nestedEnd > i) {
      i = nestedEnd - 1;
      continue;
    }
    if (pairTernaries && depth === 0) {
      if (c === CH_QUESTION) {
        ternaryDepth++;
        continue;
      }
      if (c === CH_COLON && ternaryDepth > 0) {
        ternaryDepth--;
        continue;
      }
    }
    if (c === target && depth === 0)
      return i;
  }
  return -1;
}
var isIdChar = new Uint8Array(128);
for (let i = CH_a;i <= CH_z; i++)
  isIdChar[i] = 3;
for (let i = CH_A;i <= CH_Z; i++)
  isIdChar[i] = 3;
for (let i = CH_0;i <= CH_9; i++)
  isIdChar[i] = 2;
isIdChar[CH_UNDERSCORE] = 3;
var extglobPrefix = new Uint8Array(128);
extglobPrefix[CH_QUESTION] = 1;
extglobPrefix[CH_AT] = 1;
extglobPrefix[CH_STAR] = 1;
extglobPrefix[CH_PLUS] = 1;
extglobPrefix[CH_BANG] = 1;
extglobPrefix[CH_EQ] = 1;
function isExtglobOpen(prefix) {
  return prefix < 128 && prefix !== CH_EQ && extglobPrefix[prefix] === 1;
}
var extglobOp = {
  [CH_QUESTION]: "?",
  [CH_AT]: "@",
  [CH_STAR]: "*",
  [CH_PLUS]: "+",
  [CH_BANG]: "!"
};
function isDQChild(p) {
  const t = p.type;
  return t === "Literal" || t === "SimpleExpansion" || t === "ParameterExpansion" || t === "CommandExpansion" || t === "ArithmeticExpansion";
}
function isAllDigitsRange(src, start, end) {
  for (let i = start;i < end; i++) {
    const c = src.charCodeAt(i);
    if (c < CH_0 || c > CH_9)
      return false;
  }
  return end > start;
}
var ASSIGNMENT_INVALID = -1;
var ASSIGNMENT_NAME_START = 0;
var ASSIGNMENT_NAME = 1;
var ASSIGNMENT_AFTER_INDEX = 2;
var ASSIGNMENT_AFTER_PLUS = 3;
var ASSIGNMENT_INDEX_BASE = 4;
function joinWordParts(head, tail) {
  const last = head[head.length - 1];
  const first = tail[0];
  let start = 0;
  if (last?.type === "Literal" && first?.type === "Literal" && last.end === first.pos) {
    head[head.length - 1] = {
      type: "Literal",
      pos: last.pos,
      end: first.end,
      text: last.text + first.text,
      value: last.value + first.value
    };
    start = 1;
  }
  for (let i = start;i < tail.length; i++)
    head.push(tail[i]);
  return head;
}
function isMatchedAssignment(state) {
  return state < ASSIGNMENT_INVALID;
}
function assignmentOperatorPos(state) {
  return -state - 2;
}
function scanAssignmentPrefix(src, start, end, initialState) {
  let state = initialState;
  for (let i = start;i < end && state >= 0; i++) {
    const c = src.charCodeAt(i);
    if (state >= ASSIGNMENT_INDEX_BASE) {
      if (c === CH_LBRACKET)
        state++;
      else if (c === CH_RBRACKET && --state === ASSIGNMENT_INDEX_BASE)
        state = ASSIGNMENT_AFTER_INDEX;
    } else if (state === ASSIGNMENT_NAME_START) {
      state = c < 128 && isIdChar[c] & 1 ? ASSIGNMENT_NAME : ASSIGNMENT_INVALID;
    } else if (state === ASSIGNMENT_NAME) {
      if (c < 128 && isIdChar[c] & 2)
        continue;
      if (c === CH_LBRACKET)
        state = ASSIGNMENT_INDEX_BASE + 1;
      else if (c === CH_PLUS)
        state = ASSIGNMENT_AFTER_PLUS;
      else
        state = c === CH_EQ ? -i - 2 : ASSIGNMENT_INVALID;
    } else if (state === ASSIGNMENT_AFTER_INDEX) {
      if (c === CH_PLUS)
        state = ASSIGNMENT_AFTER_PLUS;
      else
        state = c === CH_EQ ? -i - 2 : ASSIGNMENT_INVALID;
    } else {
      state = c === CH_EQ ? -i - 2 : ASSIGNMENT_INVALID;
    }
  }
  return state;
}
function setToken(out, token, value, pos = 0, end = 0) {
  out.token = token;
  out._value = value;
  out.pos = pos;
  out.end = end;
  out.fileDescriptor = undefined;
  out.variableName = undefined;
  out.descriptorEnd = 0;
  out.delimiterQuoted = false;
  out.content = undefined;
  out.assignmentOperatorPos = -1;
  out.raw = false;
  out.keywordEligible = false;
}
function setSpanToken(out, token, pos, end, raw) {
  out.token = token;
  out._value = null;
  out.pos = pos;
  out.end = end;
  out.fileDescriptor = undefined;
  out.variableName = undefined;
  out.descriptorEnd = 0;
  out.delimiterQuoted = false;
  out.content = undefined;
  out.assignmentOperatorPos = -1;
  out.raw = raw;
  out.keywordEligible = false;
}
function matchReservedWord(src, start, len) {
  switch (src.charCodeAt(start)) {
    case CH_BANG:
      return len === 1 ? Token.Bang : undefined;
    case CH_LBRACE:
      return len === 1 ? Token.LBrace : undefined;
    case CH_RBRACE:
      return len === 1 ? Token.RBrace : undefined;
    case 105: {
      if (len !== 2)
        return;
      const c = src.charCodeAt(start + 1);
      return c === 102 ? Token.If : c === 110 ? Token.In : undefined;
    }
    case 102:
      if (len === 2)
        return src.charCodeAt(start + 1) === 105 ? Token.Fi : undefined;
      if (len === 3)
        return src.startsWith("for", start) ? Token.For : undefined;
      if (len === 8)
        return src.startsWith("function", start) ? Token.Function : undefined;
      return;
    case 116:
      return len === 4 && src.startsWith("then", start) ? Token.Then : undefined;
    case 101:
      if (len !== 4)
        return;
      if (src.startsWith("else", start))
        return Token.Else;
      if (src.startsWith("elif", start))
        return Token.Elif;
      if (src.startsWith("esac", start))
        return Token.Esac;
      return;
    case 100:
      if (len === 2)
        return src.charCodeAt(start + 1) === 111 ? Token.Do : undefined;
      if (len === 4)
        return src.startsWith("done", start) ? Token.Done : undefined;
      return;
    case 99:
      if (len === 4)
        return src.startsWith("case", start) ? Token.Case : undefined;
      if (len === 6)
        return src.startsWith("coproc", start) ? Token.Coproc : undefined;
      return;
    case 119:
      return len === 5 && src.startsWith("while", start) ? Token.While : undefined;
    case 117:
      return len === 5 && src.startsWith("until", start) ? Token.Until : undefined;
    case 115:
      return len === 6 && src.startsWith("select", start) ? Token.Select : undefined;
    default:
      return;
  }
}
var LexContext = {
  Normal: 0,
  CommandStart: 1,
  TestMode: 2,
  CommandPrefix: 3,
  Declaration: 4,
  ArrayElement: 5,
  FunctionName: 6,
  CasePattern: 7,
  EvalArgument: 8
};
function isBraceCommandOpener(after) {
  return after === CH_SPACE || after === CH_TAB || after === CH_NL || after === CH_PIPE;
}

class Lexer {
  static _findSubstitutionEnd;
  src;
  srcEnd;
  parenBoundary;
  pos;
  current;
  nextState;
  hasPeek;
  pendingHereDocs;
  substitutionContext;
  _errors = null;
  _buildParts = false;
  _buildValue = false;
  _nestingDepth = 0;
  constructor(src, start = 0, end = src.length, parenBoundary = false, context = createSubstitutionContext()) {
    this.src = src;
    this.srcEnd = end;
    this.parenBoundary = parenBoundary;
    this.pos = start;
    this.current = new TokenValue(this);
    this.nextState = new TokenValue(this);
    this.hasPeek = false;
    this.pendingHereDocs = null;
    this.substitutionContext = context;
    if (start === 0 && src.charCodeAt(0) === CH_HASH && src.charCodeAt(1) === CH_BANG) {
      const nl = src.indexOf(`
`);
      this.pos = nl === -1 ? this.srcEnd : nl + 1;
    }
  }
  getSource() {
    return this.src;
  }
  fork(start, end, parenBoundary = false) {
    const lexer = new Lexer(this.src, start, end, parenBoundary, this.substitutionContext);
    lexer._nestingDepth = this._nestingDepth;
    return lexer;
  }
  getSubstitutionContext() {
    return this.substitutionContext;
  }
  get errors() {
    return this._errors ?? (this._errors = []);
  }
  commandExpansion(pos, text, start, inner, parenBoundary = false) {
    const window = this.scriptWindow(this.src, start, start + inner.length, parenBoundary);
    return new ScriptExpansionImpl("CommandExpansion", pos, this.pos, text, window);
  }
  decodedCommandExpansion(pos, text, inner) {
    const window = this.scriptWindow(inner, 0, inner.length, false, true);
    return new ScriptExpansionImpl("CommandExpansion", pos, this.pos, text, window);
  }
  processSubstitution(pos, text, operator, inner) {
    const window = this.scriptWindow(this.src, pos + 2, pos + 2 + inner.length, !this._unbalanced);
    return new ProcessSubstitutionImpl(pos, this.pos, text, operator, window);
  }
  scriptWindow(source, start, end, parenBoundary, decoded = false) {
    if (this._nestingDepth > MAX_SYNTAX_NESTING)
      return;
    const context = decoded ? undefined : this.substitutionContext;
    return { source, start, end, depth: this._nestingDepth + 1, parenBoundary, context };
  }
  getPos() {
    return this.pos;
  }
  findSubstitutionEnd(start, end, depth = this._nestingDepth + 1) {
    if (Lexer._findSubstitutionEnd === undefined)
      return -1;
    return Lexer._findSubstitutionEnd(this.src, start, end, depth, this.substitutionContext);
  }
  _tokenValue(pos, end, raw) {
    return raw ? this.src.slice(pos, end) : this.wordValueOf(pos, end);
  }
  wordValueOf(start, end) {
    const savedPos = this.pos;
    const savedEnd = this.srcEnd;
    const savedBuildValue = this._buildValue;
    const savedUnbalanced = this._unbalanced;
    const errorCount = this._errors === null ? 0 : this._errors.length;
    this.pos = start;
    this.srcEnd = end;
    this._buildValue = true;
    this.readWordText();
    if (this.pos < end && this._wordAssignmentState !== undefined && this._wordAssignmentState >= ASSIGNMENT_INDEX_BASE) {
      this.pos = start;
      this.readWordText(true);
    }
    const value = this._wordText;
    this.pos = savedPos;
    this.srcEnd = savedEnd;
    this._buildValue = savedBuildValue;
    this._unbalanced = savedUnbalanced;
    if (this._errors !== null)
      this._errors.length = errorCount;
    return value;
  }
  findClosingBracket(start, end = this.srcEnd) {
    const limit = Math.min(end, this.srcEnd);
    let window = this._bracketWindow;
    if (!window || window.limit !== limit) {
      window = { limit, last: this.src.lastIndexOf("]", limit - 1) };
      this._bracketWindow = window;
    }
    if (start > window.last)
      return -1;
    return this.findClosingShellDelimiter(start, end, CH_RBRACKET);
  }
  findClosingArithmeticBracket(start, end = this.srcEnd) {
    return this.findClosingShellDelimiter(start, end, CH_RBRACKET, false, false);
  }
  findClosingBrace(start, end = this.srcEnd) {
    return this.findClosingShellDelimiter(start, end, CH_RBRACE);
  }
  findClosingParenthesis(start, end = this.srcEnd) {
    const savedPos = this.pos;
    const savedEnd = this.srcEnd;
    const savedUnbalanced = this._unbalanced;
    this.pos = start;
    this.srcEnd = Math.min(end, this.srcEnd);
    this.extractBalanced();
    const close = this._unbalanced ? -1 : this.pos - 1;
    this.pos = savedPos;
    this.srcEnd = savedEnd;
    this._unbalanced = savedUnbalanced;
    return close;
  }
  findArithmeticExpansionEnd(start, end = this.srcEnd) {
    const scanner = this.fork(start, end);
    scanner.pos = start + 1;
    scanner.scanArithmeticBody();
    return scanner.pos;
  }
  findArithmeticWordEnd(start, end = this.srcEnd) {
    const scanner = this.fork(start, end);
    scanner.pos = start;
    return scanner.scanArithmeticWordEnd();
  }
  scanArithmeticWordEnd() {
    while (this.pos < this.srcEnd) {
      const ch = this.src.charCodeAt(this.pos);
      if (ch === CH_DOLLAR) {
        this.readDollar();
        continue;
      }
      if (ch === CH_BACKTICK) {
        this.readBacktickExpansion();
        continue;
      }
      if (ch === CH_SQUOTE) {
        this.pos++;
        this.skipSQ();
        continue;
      }
      if (ch === CH_DQUOTE) {
        this.pos++;
        this.skipDQ();
        continue;
      }
      if (ch === CH_BACKSLASH) {
        this.pos += 2;
        continue;
      }
      if (ch === CH_LBRACKET) {
        const close = this.findClosingBracket(this.pos + 1);
        if (close !== -1) {
          this.pos = close + 1;
          continue;
        }
      }
      if ((ch === CH_LT || ch === CH_GT) && this.src.charCodeAt(this.pos + 1) === CH_LPAREN) {
        this.pos += 2;
        this.extractBalanced();
        continue;
      }
      if (ch < 128 && arithmeticWordDelimiter[ch])
        break;
      this.pos++;
    }
    return this.pos;
  }
  findClosingShellDelimiter(start, end, closing, array = false, braces = true) {
    const savedPos = this.pos;
    const savedEnd = this.srcEnd;
    const savedUnbalanced = this._unbalanced;
    this.srcEnd = Math.min(end, this.srcEnd);
    const delimiters = [closing];
    let pos = start;
    let wordStart = true;
    let invalid = -1;
    while (pos < this.srcEnd) {
      const ch = this.src.charCodeAt(pos);
      if (ch === CH_BACKSLASH) {
        if (pos + 1 < this.srcEnd && this.src.charCodeAt(pos + 1) !== CH_NL)
          wordStart = false;
        pos += 2;
        continue;
      }
      if (ch === CH_HASH && array && delimiters.length === 1 && wordStart) {
        while (pos < this.srcEnd && this.src.charCodeAt(pos) !== CH_NL)
          pos++;
        continue;
      }
      if (ch === CH_SQUOTE) {
        this.pos = pos + 1;
        this.skipSQ();
        pos = this.pos;
        wordStart = false;
        continue;
      }
      if (ch === CH_DQUOTE) {
        this.pos = pos + 1;
        this.skipDQ();
        pos = this.pos;
        wordStart = false;
        continue;
      }
      if (ch === CH_BACKTICK) {
        pos++;
        while (pos < this.srcEnd && this.src.charCodeAt(pos) !== CH_BACKTICK) {
          if (this.src.charCodeAt(pos) === CH_BACKSLASH)
            pos++;
          pos++;
        }
        if (pos < this.srcEnd)
          pos++;
        wordStart = false;
        continue;
      }
      if (ch === CH_DOLLAR && pos + 1 < this.srcEnd && this.src.charCodeAt(pos + 1) === CH_LPAREN || (ch === CH_LT || ch === CH_GT) && pos + 1 < this.srcEnd && this.src.charCodeAt(pos + 1) === CH_LPAREN) {
        this.pos = pos + 2;
        this.extractBalanced();
        pos = this.pos;
        wordStart = false;
        continue;
      }
      const expected = delimiters[delimiters.length - 1];
      if (ch === CH_DOLLAR && pos + 1 < this.srcEnd) {
        const after = this.src.charCodeAt(pos + 1);
        if (after === CH_SQUOTE) {
          pos = decodeAnsiCQuoted(this.src, pos + 2, this.srcEnd).end;
          wordStart = false;
          continue;
        }
        if (after === CH_DOLLAR) {
          pos += 2;
          wordStart = false;
          continue;
        }
        if (after === CH_LBRACE && braces) {
          delimiters.push(CH_RBRACE);
          pos += 2;
          wordStart = false;
          continue;
        }
      }
      if (array && delimiters.length === 1) {
        if (ch === CH_LBRACKET && wordStart) {
          delimiters.push(CH_RBRACKET);
        } else if (invalid === -1 && (ch === CH_SEMI || ch === CH_AMP || ch === CH_PIPE || ch === CH_LT || ch === CH_GT || ch === CH_LPAREN && !isExtglobOpen(this.src.charCodeAt(pos - 1)))) {
          invalid = pos;
        }
      }
      if (expected === CH_RBRACKET && ch === CH_LBRACKET) {
        delimiters.push(CH_RBRACKET);
      } else if (expected === CH_RPAREN && ch === CH_LPAREN) {
        delimiters.push(CH_RPAREN);
      } else if (ch === expected) {
        delimiters.pop();
        if (delimiters.length === 0) {
          this.pos = savedPos;
          this.srcEnd = savedEnd;
          this._unbalanced = savedUnbalanced;
          if (invalid !== -1)
            this.errors.push({ message: `unexpected '${this.src[invalid]}' in array assignment`, pos: invalid });
          return pos;
        }
        wordStart = false;
        pos++;
        continue;
      }
      wordStart = ch < 128 && (charType[ch] & 1) !== 0;
      pos++;
    }
    this.pos = savedPos;
    this.srcEnd = savedEnd;
    this._unbalanced = savedUnbalanced;
    return -1;
  }
  scanBraceExpansion(start) {
    const src = this.src;
    const len = this.srcEnd;
    const first = start + 1 < len ? src.charCodeAt(start + 1) : 0;
    if (first <= CH_SPACE || first === CH_RBRACE)
      return -1;
    const savedPos = this.pos;
    const savedUnbalanced = this._unbalanced;
    const errorCount = this._errors === null ? 0 : this._errors.length;
    let depth = 1;
    let hasSep = false;
    let end = -1;
    let pos = start + 1;
    while (pos < len) {
      const ch = src.charCodeAt(pos);
      const type = ch < 128 ? charType[ch] : 0;
      if (type === 0) {
        pos++;
        if (ch === CH_RBRACE) {
          if (--depth === 0) {
            end = pos;
            break;
          }
        } else if (depth === 1 && (ch === 44 || ch === 46 && src.charCodeAt(pos) === 46)) {
          hasSep = true;
        }
        continue;
      }
      const next = pos + 1 < len ? src.charCodeAt(pos + 1) : 0;
      if (type & 1) {
        if (next === CH_LPAREN && (ch === CH_LT || ch === CH_GT)) {
          this.pos = pos + 2;
          this.extractBalanced();
          pos = this.pos;
        } else if (ch === CH_LPAREN && isExtglobOpen(src.charCodeAt(pos - 1))) {
          const close = this.findClosingShellDelimiter(pos + 1, len, CH_RPAREN);
          if (close === -1)
            break;
          pos = close + 1;
        } else {
          break;
        }
      } else if (ch === CH_BACKSLASH) {
        pos += 2;
      } else if (ch === CH_SQUOTE) {
        this.pos = pos + 1;
        this.skipSQ();
        pos = this.pos;
      } else if (ch === CH_DQUOTE) {
        this.pos = pos + 1;
        this.skipDQ();
        pos = this.pos;
      } else if (ch === CH_BACKTICK) {
        pos++;
        while (pos < len && src.charCodeAt(pos) !== CH_BACKTICK)
          pos += src.charCodeAt(pos) === CH_BACKSLASH ? 2 : 1;
        pos++;
      } else if (ch === CH_LBRACE) {
        depth++;
        pos++;
      } else if (next === CH_SQUOTE) {
        pos = decodeAnsiCQuoted(src, pos + 2, len).end;
      } else if (next === CH_LBRACE) {
        const close = this.findClosingBrace(pos + 2, len);
        if (close === -1)
          break;
        pos = close + 1;
      } else if (next === CH_LPAREN) {
        this.pos = pos + 2;
        this.extractBalanced();
        pos = this.pos;
      } else {
        pos++;
      }
    }
    this.pos = savedPos;
    this._unbalanced = savedUnbalanced;
    if (this._errors !== null)
      this._errors.length = errorCount;
    return hasSep ? end : -1;
  }
  skipSubshellBody() {
    this.extractBalanced(false);
    return this._unbalanced ? -1 : this.pos;
  }
  skipCompoundBody(closeToken) {
    const frames = [
      { close: closeToken, phase: closeToken === Token.Esac ? "case-pattern" : "commands" }
    ];
    let commandStart = true;
    for (;; ) {
      const phase = frames[frames.length - 1].phase;
      let ctx = commandStart ? LexContext.CommandStart : LexContext.Normal;
      if (phase === "function-name")
        ctx = LexContext.FunctionName;
      else if (phase === "case-pattern" && commandStart)
        ctx = LexContext.CasePattern;
      const value = this.next(ctx);
      const token = value.token;
      if (token === Token.EOF)
        return -1;
      const last = frames.length - 1;
      const frame = frames[last];
      if (frame.phase === "function-name") {
        if (token === Token.Newline)
          continue;
        frame.phase = "function-body";
        commandStart = true;
        continue;
      } else if (frame.phase === "function-body") {
        if (token === Token.Newline)
          continue;
        frame.phase = "commands";
        commandStart = true;
        if (token === Token.LParen && this.peek(LexContext.Normal).token === Token.RParen) {
          this.next(LexContext.Normal);
          frame.phase = "function-body";
          continue;
        }
      } else if (frame.phase === "coproc-command") {
        if (token === Token.Newline)
          continue;
        if (token === Token.Word) {
          frame.phase = "coproc-body";
          commandStart = true;
          continue;
        }
        frame.phase = "commands";
        commandStart = true;
      } else if (frame.phase === "coproc-body") {
        if (token === Token.Newline)
          continue;
        frame.phase = token === Token.Word && value.keywordEligible && value.value === "time" ? "time-command" : "commands";
        commandStart = true;
        if (frame.phase === "time-command")
          continue;
      } else if (frame.phase === "time-command") {
        if (token === Token.Word && value.keywordEligible && value.value === "-p") {
          frame.phase = "time-command-after-p";
          continue;
        }
        if (token === Token.Word && value.keywordEligible && value.value === "--") {
          frame.phase = "commands";
          continue;
        }
        frame.phase = "commands";
        commandStart = true;
      } else if (frame.phase === "time-command-after-p") {
        if (token === Token.Word && value.keywordEligible && value.value === "--") {
          frame.phase = "commands";
          continue;
        }
        frame.phase = "commands";
        commandStart = true;
      } else if (frame.phase === "for-header") {
        if (token === Token.ArithCmd || token === Token.Semi || token === Token.Newline) {
          commandStart = true;
          continue;
        }
        if (token === Token.Do || token === Token.LBrace) {
          frame.close = token === Token.Do ? Token.Done : Token.RBrace;
          frame.phase = "commands";
          commandStart = true;
          continue;
        }
      } else if (frame.phase === "case-word") {
        if (token === Token.Newline)
          continue;
        frame.phase = "case-in";
        commandStart = false;
        continue;
      } else if (frame.phase === "case-in") {
        if (token === Token.Newline) {
          commandStart = true;
          continue;
        }
        frame.phase = "case-pattern";
        commandStart = true;
        continue;
      } else if (frame.phase === "case-pattern") {
        if (token === Token.Esac && commandStart) {
          frames.pop();
          if (frames.length === 0)
            return value.end;
          commandStart = false;
          continue;
        }
        if (token === Token.RParen) {
          frame.phase = "commands";
          commandStart = true;
        } else {
          commandStart = token === Token.Newline;
        }
        continue;
      }
      if (token === frame.close) {
        frames.pop();
        if (frames.length === 0)
          return value.end;
        commandStart = false;
        continue;
      }
      if (commandStart) {
        switch (token) {
          case Token.LParen:
            frames.push({ close: Token.RParen, phase: "commands" });
            break;
          case Token.LBrace:
            frames.push({ close: Token.RBrace, phase: "commands" });
            break;
          case Token.If:
            frames.push({ close: Token.Fi, phase: "commands" });
            break;
          case Token.For:
            frames.push({ close: Token.Done, phase: "for-header" });
            break;
          case Token.While:
          case Token.Until:
          case Token.Select:
            frames.push({ close: Token.Done, phase: "commands" });
            break;
          case Token.Case:
            frames.push({ close: Token.Esac, phase: "case-word" });
            break;
          case Token.DblLBracket:
            if (!this.skipTestCommandBody())
              return -1;
            commandStart = false;
            continue;
          case Token.Assignment:
          case Token.Redirect:
          case Token.Bang:
          case Token.Then:
          case Token.Else:
          case Token.Elif:
          case Token.Do:
          case Token.In:
            break;
          case Token.Semi:
          case Token.Newline:
          case Token.Pipe:
          case Token.And:
          case Token.Or:
          case Token.Amp:
          case Token.DoubleSemi:
          case Token.SemiAmp:
          case Token.DoubleSemiAmp:
            break;
          case Token.Function:
            frame.phase = "function-name";
            break;
          case Token.Coproc:
            frame.phase = "coproc-command";
            break;
          default:
            if (token === Token.Word && value.keywordEligible && value.value === "time") {
              frame.phase = "time-command";
              commandStart = true;
            } else {
              commandStart = false;
            }
            continue;
        }
      }
      switch (token) {
        case Token.Semi:
        case Token.Newline:
        case Token.Pipe:
        case Token.And:
        case Token.Or:
        case Token.Amp:
          commandStart = true;
          break;
        case Token.DoubleSemi:
        case Token.SemiAmp:
        case Token.DoubleSemiAmp:
          if (frame.close === Token.Esac)
            frame.phase = "case-pattern";
          commandStart = true;
          break;
        case Token.RParen:
          commandStart = true;
          break;
      }
    }
  }
  skipTestGroup() {
    let depth = 1;
    for (;; ) {
      const value = this.next(LexContext.TestMode);
      if (value.token === Token.EOF)
        return -1;
      if (value.token === Token.DblRBracket) {
        this.unshift(value);
        return -1;
      }
      if (value.token === Token.LParen)
        depth++;
      else if (value.token === Token.RParen && --depth === 0)
        return value.end;
    }
  }
  skipTestCommandBody() {
    for (;; ) {
      const token = this.next(LexContext.TestMode).token;
      if (token === Token.DblRBracket)
        return true;
      if (token === Token.EOF)
        return false;
    }
  }
  buildWordParts(startPos) {
    this._buildParts = true;
    this.pos = startPos;
    const ch = this.src.charCodeAt(startPos);
    if ((ch === 60 || ch === 62) && startPos + 1 < this.srcEnd && this.src.charCodeAt(startPos + 1) === 40) {
      this.pos = startPos + 2;
      const inner = this.extractBalanced();
      const text = this.src.slice(startPos, this.pos);
      const part = this.processSubstitution(startPos, text, ch === 60 ? "<" : ">", inner);
      if (this.pos < this.srcEnd) {
        this.readWordText();
        if (this._wordParts) {
          this._wordParts.unshift(part);
        } else {
          this._wordParts = [part];
        }
      } else {
        this._wordParts = [part];
      }
    } else {
      this.readWordText();
      if (this.pos < this.srcEnd && this._wordAssignmentState !== undefined && this._wordAssignmentState >= ASSIGNMENT_INDEX_BASE) {
        this.pos = startPos;
        this.readWordText(true);
      }
    }
    return this._wordParts;
  }
  buildEmbeddedWordParts(startPos, arithmetic = false) {
    this._buildParts = true;
    this.pos = startPos;
    this.readInnerWordText(false, arithmetic);
    return this._wordParts;
  }
  buildArrayElementParts(startPos) {
    const close = this.findClosingBracket(startPos + 1);
    if (close === -1)
      return this.buildWordParts(startPos);
    const src = this.src;
    this._buildParts = true;
    const head = hasEmbeddedWordStructure(src, startPos, close + 1) ? this.parseSubFieldWord(startPos, close + 1, "embedded") : undefined;
    this.pos = close + 1;
    this.readWordText(false, LexContext.ArrayElement);
    const end = this.pos;
    const operator = skipLineContinuations(src, close + 1, end);
    const after = src.charCodeAt(operator);
    const keyed = after === CH_EQ || after === CH_PLUS && src.charCodeAt(operator + 1) === CH_EQ;
    let headParts = head?.parts;
    let tailParts = this._wordParts;
    if (keyed)
      tailParts = parseGlobParts(src, close + 1, end, tailParts) ?? tailParts;
    if (!headParts && !tailParts)
      return keyed ? null : parseGlobParts(src, startPos, end, undefined) ?? null;
    const headText = src.slice(startPos, close + 1);
    if (!headParts)
      headParts = [{ type: "Literal", pos: startPos, end: close + 1, text: headText, value: head?.value ?? headText }];
    if (!tailParts)
      tailParts = end > close + 1 ? [{ type: "Literal", pos: close + 1, end, text: src.slice(close + 1, end), value: this._wordText }] : [];
    let parts = joinWordParts(headParts, tailParts);
    if (!keyed)
      parts = parseGlobParts(src, startPos, end, parts) ?? parts;
    return parts.length > 1 || parts[0].type !== "Literal" ? parts : null;
  }
  buildHereDocParts(bodyPos, bodyEnd) {
    this._buildParts = true;
    const src = this.src;
    const parts = [];
    let hasExpansion = false;
    let litBuf = "";
    let litStart = bodyPos;
    let i = bodyPos;
    const flushLit = () => {
      if (i > litStart) {
        parts.push({ type: "Literal", pos: litStart, end: i, value: litBuf, text: src.slice(litStart, i) });
        litBuf = "";
      }
    };
    while (i < bodyEnd) {
      const ch = src.charCodeAt(i);
      if (ch === 92) {
        if (i + 1 < bodyEnd) {
          const nc = src.charCodeAt(i + 1);
          if (nc === CH_NL) {
            i += 2;
            continue;
          }
          if (nc === 36 || nc === 96 || nc === 92) {
            litBuf += String.fromCharCode(nc);
            i += 2;
            continue;
          }
        }
        litBuf += "\\";
        i++;
        continue;
      }
      if (ch === 36 && src.charCodeAt(i + 1) !== CH_SQUOTE && src.charCodeAt(i + 1) !== CH_DQUOTE) {
        flushLit();
        litStart = i;
        this.pos = i;
        this.readDollar();
        if (this._resultPart) {
          hasExpansion = true;
          parts.push(this._resultPart);
          litStart = this.pos;
        } else {
          litBuf += src.slice(i, this.pos);
        }
        i = this.pos;
        continue;
      }
      if (ch === 96) {
        flushLit();
        litStart = i;
        this.pos = i;
        this.readBacktickExpansion();
        if (this._resultPart) {
          hasExpansion = true;
          parts.push(this._resultPart);
          litStart = this.pos;
        } else {
          litBuf += src.slice(i, this.pos);
        }
        i = this.pos;
        continue;
      }
      litBuf += src[i];
      i++;
    }
    flushLit();
    return hasExpansion ? parts : null;
  }
  registerHereDocTarget(target) {
    if (this.pendingHereDocs === null)
      return;
    for (const hd of this.pendingHereDocs) {
      if (!hd.target) {
        hd.target = target;
        return;
      }
    }
  }
  readTestRegexWord() {
    this.hasPeek = false;
    this.skipSpacesAndTabs();
    const src = this.src;
    const len = this.srcEnd;
    const start = this.pos;
    let depth = 0;
    while (this.pos < len) {
      const ch = src.charCodeAt(this.pos);
      if (ch === CH_LPAREN) {
        depth++;
        this.pos++;
        continue;
      }
      if (ch === CH_BACKSLASH) {
        this.pos += this.pos + 1 < len ? 2 : 1;
        continue;
      }
      if (ch === CH_SQUOTE) {
        const quotePos = this.pos++;
        const ansiC = quotePos > start && src.charCodeAt(quotePos - 1) === CH_DOLLAR;
        while (this.pos < len && src.charCodeAt(this.pos) !== CH_SQUOTE) {
          if (ansiC && src.charCodeAt(this.pos) === CH_BACKSLASH && this.pos + 1 < len)
            this.pos++;
          this.pos++;
        }
        if (this.pos < len)
          this.pos++;
        else
          this.errors.push({
            message: ansiC ? "unterminated ANSI-C quote" : "unterminated single quote",
            pos: quotePos
          });
        continue;
      }
      if (ch === CH_DQUOTE) {
        this.pos++;
        this.readDoubleQuoted();
        continue;
      }
      if (ch === CH_BACKTICK) {
        this.readBacktickExpansion();
        continue;
      }
      if (depth > 0) {
        if (ch === CH_RPAREN)
          depth--;
        this.pos++;
        continue;
      }
      if (ch === CH_DOLLAR) {
        this.readDollar();
        continue;
      }
      if ((ch === CH_LT || ch === CH_GT) && this.pos + 1 < len && src.charCodeAt(this.pos + 1) === CH_LPAREN) {
        const subPos = this.pos;
        this.pos += 2;
        this.extractBalanced();
        if (this._unbalanced)
          this.errors.push({ message: "unterminated process substitution", pos: subPos });
        continue;
      }
      if (ch < 128 && charType[ch] & 1 && ch !== CH_PIPE)
        break;
      this.pos++;
    }
    setToken(this.current, Token.Word, src.slice(start, this.pos), start, this.pos);
    return this.current;
  }
  readCStyleForExprs() {
    this.hasPeek = false;
    const src = this.src;
    const len = this.srcEnd;
    while (this.pos < len && (src.charCodeAt(this.pos) === CH_SPACE || src.charCodeAt(this.pos) === CH_TAB))
      this.pos++;
    const openPos = this.pos;
    if (this.pos < len && src.charCodeAt(this.pos) === CH_LPAREN)
      this.pos++;
    const starts = [this.pos, 0, 0];
    const parts = ["", "", "", 0, 0, 0];
    let partIdx = 0;
    let depth = 1;
    let partStart = this.pos;
    let extra = false;
    const setPart = (end) => {
      const raw = src.slice(partStart, end);
      parts[partIdx] = raw.trim();
      parts[3 + partIdx] = starts[partIdx] + raw.length - raw.trimStart().length;
    };
    while (this.pos < len && depth > 0) {
      const c = src.charCodeAt(this.pos);
      if (c === CH_LPAREN) {
        depth++;
        this.pos++;
      } else if (c === CH_RPAREN) {
        depth--;
        if (depth === 0) {
          if (!extra)
            setPart(this.pos);
          if (partIdx < 2)
            this.errors.push({ message: "expected three arithmetic expressions in for header", pos: this.pos });
          this.pos++;
          while (this.pos < len && (src.charCodeAt(this.pos) === CH_SPACE || src.charCodeAt(this.pos) === CH_TAB))
            this.pos++;
          if (this.pos < len && src.charCodeAt(this.pos) === CH_RPAREN)
            this.pos++;
          break;
        }
        this.pos++;
      } else if (c === CH_SEMI && depth === 1) {
        if (partIdx === 2) {
          if (!extra) {
            setPart(this.pos);
            this.errors.push({ message: "expected three arithmetic expressions in for header", pos: this.pos });
          }
          extra = true;
          this.pos++;
          continue;
        }
        setPart(this.pos);
        partIdx++;
        this.pos++;
        partStart = this.pos;
        starts[partIdx] = partStart;
      } else if (c === CH_DOLLAR) {
        this.readDollar();
      } else if (c === CH_BACKTICK) {
        this.readBacktickExpansion();
      } else if (c === CH_BACKSLASH) {
        this.pos += this.pos + 1 < len ? 2 : 1;
      } else if (c === CH_SQUOTE) {
        this.pos++;
        this.skipSQ();
      } else if (c === CH_DQUOTE) {
        this.pos++;
        this.skipDQ();
      } else {
        this.pos++;
      }
    }
    if (depth > 0) {
      if (!extra)
        setPart(this.pos);
      this.errors.push({ message: "unterminated arithmetic for header", pos: openPos });
    }
    return parts;
  }
  peek(ctx = LexContext.Normal) {
    if (!this.hasPeek) {
      this.readNext(this.nextState, ctx);
      this.hasPeek = true;
    }
    return this.nextState;
  }
  peekFollow(closers) {
    if (!this.hasPeek) {
      const ctx = closers[this.current.token] ? LexContext.CommandStart : LexContext.Normal;
      this.readNext(this.nextState, ctx);
      this.hasPeek = true;
    }
    return this.nextState;
  }
  next(ctx = LexContext.Normal) {
    if (this.hasPeek) {
      this.hasPeek = false;
      const temp = this.current;
      this.current = this.nextState;
      this.nextState = temp;
      return this.current;
    }
    this.readNext(this.current, ctx);
    return this.current;
  }
  unshift(tok) {
    this.nextState.copyFrom(tok);
    this.hasPeek = true;
  }
  readNext(out, ctx) {
    const src = this.src;
    const len = this.srcEnd;
    let pos = skipBlanks(src, this.pos, len);
    if (ctx === LexContext.TestMode) {
      while (pos < len && src.charCodeAt(pos) === CH_NL)
        pos = skipBlanks(src, pos + 1, len);
    }
    this.pos = pos;
    if (pos >= len) {
      this.consumePendingHereDocs();
      setToken(out, Token.EOF, "", pos, pos);
      return;
    }
    const tokenStart = pos;
    const ch = src.charCodeAt(pos);
    if (ch === CH_HASH) {
      while (this.pos < len && src.charCodeAt(this.pos) !== CH_NL)
        this.pos++;
      this.readNext(out, ctx);
      return;
    }
    if (ch === CH_NL) {
      this.pos++;
      this.consumePendingHereDocs();
      setToken(out, Token.Newline, `
`, tokenStart, this.pos);
      return;
    }
    if (ctx === LexContext.TestMode && (ch === CH_LT || ch === CH_GT) && !(this.pos + 1 < this.srcEnd && src.charCodeAt(this.pos + 1) === CH_LPAREN)) {
      this.pos++;
      setToken(out, Token.Word, ch === CH_LT ? "<" : ">", tokenStart, this.pos);
      out.keywordEligible = true;
      return;
    }
    if (ch < 128 && charType[ch] & 1 && this.tryReadOperator(out, ch, ctx, tokenStart))
      return;
    if (ch === CH_LBRACKET && ctx === LexContext.ArrayElement && this.readArrayElement(out, tokenStart))
      return;
    this.readWord(out, ctx, tokenStart);
  }
  tryReadOperator(out, ch, ctx, tokenStart) {
    const src = this.src;
    const pos = this.pos;
    const next = pos + 1 < this.srcEnd ? src.charCodeAt(pos + 1) : 0;
    switch (ch) {
      case CH_SEMI:
        if (next === CH_SEMI) {
          if (pos + 2 < this.srcEnd && src.charCodeAt(pos + 2) === CH_AMP) {
            this.pos += 3;
            setToken(out, Token.DoubleSemiAmp, ";;&", tokenStart, this.pos);
            return true;
          }
          this.pos += 2;
          setToken(out, Token.DoubleSemi, ";;", tokenStart, this.pos);
          return true;
        }
        if (next === CH_AMP) {
          this.pos += 2;
          setToken(out, Token.SemiAmp, ";&", tokenStart, this.pos);
          return true;
        }
        this.pos++;
        setToken(out, Token.Semi, ";", tokenStart, this.pos);
        return true;
      case CH_PIPE:
        if (next === CH_PIPE) {
          this.pos += 2;
          setToken(out, Token.Or, "||", tokenStart, this.pos);
          return true;
        }
        if (next === CH_AMP) {
          this.pos += 2;
          setToken(out, Token.Pipe, "|&", tokenStart, this.pos);
          return true;
        }
        this.pos++;
        setToken(out, Token.Pipe, "|", tokenStart, this.pos);
        return true;
      case CH_AMP:
        if (next === CH_AMP) {
          this.pos += 2;
          setToken(out, Token.And, "&&", tokenStart, this.pos);
          return true;
        }
        if (next === CH_GT) {
          this.pos += 2;
          const append = this.pos < this.srcEnd && src.charCodeAt(this.pos) === CH_GT;
          if (append)
            this.pos++;
          this.skipSpacesAndTabs();
          const targetPos = this.pos;
          if (this.pos < this.srcEnd && src.charCodeAt(this.pos) !== CH_NL && src.charCodeAt(this.pos) !== CH_HASH) {
            this.readRedirectTargetText();
          }
          this.redirectToken(out, append ? "&>>" : "&>", tokenStart, targetPos);
          return true;
        }
        this.pos++;
        setToken(out, Token.Amp, "&", tokenStart, this.pos);
        return true;
      case CH_LPAREN:
        if (ctx === LexContext.CommandStart && next === CH_LPAREN) {
          const savedErrors = this.errors.length;
          this.readArithmeticCommand(out, tokenStart);
          if (!this._notArithmetic)
            return true;
          this.errors.length = savedErrors;
          this.pos = tokenStart;
        }
        this.pos++;
        setToken(out, Token.LParen, "(", tokenStart, this.pos);
        return true;
      case CH_RPAREN:
        this.pos++;
        setToken(out, Token.RParen, ")", tokenStart, this.pos);
        return true;
      case CH_LT:
      case CH_GT:
        return this.readRedirection(out, tokenStart);
      default:
        return false;
    }
  }
  readRedirection(out, tokenStart) {
    const src = this.src;
    const ch = src.charCodeAt(this.pos);
    let op = "";
    if (ch === CH_LT) {
      this.pos++;
      const next = this.pos < this.srcEnd ? src.charCodeAt(this.pos) : 0;
      if (next === CH_LT) {
        this.pos++;
        const third = this.pos < this.srcEnd ? src.charCodeAt(this.pos) : 0;
        if (third === CH_LT) {
          this.pos++;
          op = "<<<";
        } else {
          const dash = third === CH_DASH;
          if (dash)
            this.pos++;
          this.skipSpacesAndTabs();
          const targetPos = this.pos;
          if (this.pos >= this.srcEnd || src.charCodeAt(this.pos) !== CH_HASH)
            this.readHereDocDelimiter();
          const hasTarget = this.pos > targetPos;
          if (hasTarget) {
            (this.pendingHereDocs ?? (this.pendingHereDocs = [])).push({
              delimiter: this._hereDelim,
              strip: dash,
              quoted: this._hereQuoted
            });
          }
          setToken(out, Token.Redirect, dash ? "<<-" : "<<", tokenStart, this.pos);
          out.content = hasTarget ? this._hereDelim : undefined;
          out.delimiterQuoted = hasTarget && this._hereQuoted;
          out.targetPos = targetPos;
          out.targetEnd = hasTarget ? this.pos : targetPos;
          return true;
        }
      } else if (next === CH_LPAREN) {
        this.readProcessSubstitution(out, "<", tokenStart);
        return true;
      } else if (next === CH_GT) {
        op = "<>";
        this.pos++;
      } else if (next === CH_AMP) {
        op = "<&";
        this.pos++;
      } else {
        op = "<";
      }
    } else if (ch === CH_GT) {
      this.pos++;
      const next = this.pos < this.srcEnd ? src.charCodeAt(this.pos) : 0;
      if (next === CH_LPAREN) {
        this.readProcessSubstitution(out, ">", tokenStart);
        return true;
      }
      if (next === CH_GT) {
        op = ">>";
        this.pos++;
      } else if (next === CH_AMP) {
        op = ">&";
        this.pos++;
      } else if (next === CH_PIPE) {
        op = ">|";
        this.pos++;
      } else {
        op = ">";
      }
    }
    this.skipSpacesAndTabs();
    if (this.pos < this.srcEnd) {
      const nc = src.charCodeAt(this.pos);
      if ((nc === CH_LT || nc === CH_GT) && this.pos + 1 < this.srcEnd && src.charCodeAt(this.pos + 1) === CH_LPAREN) {
        const psStart = this.pos;
        this.pos += 2;
        this.extractBalanced();
        if (this._unbalanced)
          this.errors.push({ message: "unterminated process substitution", pos: psStart });
        const psText = src.slice(psStart, this.pos);
        setToken(out, Token.Redirect, op, tokenStart, this.pos);
        out.content = psText;
        out.targetPos = psStart;
        out.targetEnd = this.pos;
        return true;
      }
      const targetPos = this.pos;
      if (nc !== CH_NL && nc !== CH_HASH)
        this.readRedirectTargetText();
      this.redirectToken(out, op, tokenStart, targetPos);
      return true;
    }
    this.redirectToken(out, op, tokenStart, this.pos);
    return true;
  }
  readRedirectTargetText() {
    const savedBuildValue = this._buildValue;
    this._buildValue = true;
    this.readWordText();
    this._buildValue = savedBuildValue;
  }
  redirectToken(out, operator, tokenStart, targetPos) {
    const hasTarget = this.pos > targetPos && (this._wordText.length > 0 || this._wordQuoted);
    setToken(out, Token.Redirect, operator, tokenStart, this.pos);
    out.content = hasTarget ? this._wordText : undefined;
    out.targetPos = targetPos;
    out.targetEnd = hasTarget ? this.pos : targetPos;
  }
  readProcessSubstitution(out, operator, tokenStart) {
    this.pos++;
    this.extractBalanced();
    if (this._unbalanced)
      this.errors.push({ message: "unterminated process substitution", pos: tokenStart });
    const text = this.src.slice(tokenStart, this.pos);
    setToken(out, Token.Word, text, tokenStart, this.pos);
  }
  readHereDocDelimiter() {
    const src = this.src;
    const len = this.srcEnd;
    const savedBuildValue = this._buildValue;
    this._buildValue = true;
    let delimiter = "";
    let quoted = false;
    while (this.pos < len) {
      const c = src.charCodeAt(this.pos);
      if (c === CH_SQUOTE) {
        quoted = true;
        this.pos++;
        while (this.pos < len && src.charCodeAt(this.pos) !== CH_SQUOTE) {
          delimiter += src[this.pos];
          this.pos++;
        }
        if (this.pos < len)
          this.pos++;
      } else if (c === CH_DQUOTE) {
        quoted = true;
        this.pos++;
        while (this.pos < len && src.charCodeAt(this.pos) !== CH_DQUOTE) {
          if (src.charCodeAt(this.pos) === CH_BACKSLASH && this.pos + 1 < len) {
            const next = src.charCodeAt(this.pos + 1);
            if (next === CH_NL) {
              this.pos += 2;
              continue;
            }
            if (next === CH_DOLLAR || next === CH_BACKTICK || next === CH_DQUOTE || next === CH_BACKSLASH)
              this.pos++;
          }
          delimiter += src[this.pos];
          this.pos++;
        }
        if (this.pos < len)
          this.pos++;
      } else if (c === CH_BACKSLASH) {
        if (this.pos + 1 < len && src.charCodeAt(this.pos + 1) === CH_NL) {
          this.pos += 2;
          continue;
        }
        quoted = true;
        this.pos++;
        if (this.pos < len) {
          delimiter += src[this.pos];
          this.pos++;
        } else {
          delimiter += "\\";
        }
      } else if (c === CH_BACKTICK) {
        const btStart = this.pos;
        this.pos++;
        while (this.pos < len && src.charCodeAt(this.pos) !== CH_BACKTICK) {
          if (src.charCodeAt(this.pos) === CH_BACKSLASH)
            this.pos++;
          this.pos++;
        }
        if (this.pos < len)
          this.pos++;
        delimiter += src.slice(btStart, this.pos);
      } else if (c === CH_DOLLAR) {
        const next = this.pos + 1 < len ? src.charCodeAt(this.pos + 1) : 0;
        if (next === CH_SQUOTE || next === CH_DQUOTE)
          quoted = true;
        this.readDollar();
        delimiter += this._resultText;
      } else if (c < 128 && charType[c] & 1) {
        break;
      } else {
        delimiter += src[this.pos];
        this.pos++;
      }
    }
    this._buildValue = savedBuildValue;
    this._hereDelim = delimiter;
    this._hereQuoted = quoted;
  }
  consumePendingHereDocs() {
    const pending = this.pendingHereDocs;
    if (pending === null || pending.length === 0)
      return;
    for (const hd of pending) {
      const bodyPos = this.pos;
      const bodyEnd = this.skipHereDocBody(hd.delimiter, hd.strip, this.parenBoundary, hd.quoted);
      if (hd.target) {
        hd.target.body.pos = bodyPos;
        hd.target.body.end = bodyEnd;
        hd.target.body.text = this.src.slice(bodyPos, bodyEnd);
        if (this.hereDocClosingPos !== -1)
          hd.target.closing = { pos: this.hereDocClosingPos, end: this.hereDocClosingEnd };
      }
    }
    pending.length = 0;
  }
  hereDocClosingPos = -1;
  hereDocClosingEnd = -1;
  matchHereDocDelimiter(delimiter, lineStart, end, join) {
    const src = this.src;
    let pos = lineStart;
    for (let i = 0;i < delimiter.length; ) {
      if (join && src.charCodeAt(pos) === CH_BACKSLASH && pos + 1 < end && src.charCodeAt(pos + 1) === CH_NL) {
        pos += 2;
        continue;
      }
      if (pos >= end || src.charCodeAt(pos) !== delimiter.charCodeAt(i))
        return -1;
      pos++;
      i++;
    }
    return pos;
  }
  logicalLineEnd(from, end, join) {
    const src = this.src;
    let lineEnd = src.indexOf(`
`, from);
    while (lineEnd !== -1 && lineEnd < end) {
      if (!join)
        return lineEnd;
      let backslashes = lineEnd;
      while (backslashes > from && src.charCodeAt(backslashes - 1) === CH_BACKSLASH)
        backslashes--;
      if ((lineEnd - backslashes) % 2 === 0)
        return lineEnd;
      from = lineEnd + 1;
      lineEnd = src.indexOf(`
`, from);
    }
    return end;
  }
  skipHereDocBody(delimiter, strip, parenEnds = false, quoted = false) {
    this.hereDocClosingPos = -1;
    this.hereDocClosingEnd = -1;
    const src = this.src;
    const len = this.srcEnd;
    while (this.pos < len) {
      let lineStart = this.pos;
      const lineEnd = this.logicalLineEnd(lineStart, len, !quoted);
      for (;; ) {
        const before = lineStart;
        if (strip)
          while (lineStart < lineEnd && src.charCodeAt(lineStart) === CH_TAB)
            lineStart++;
        if (!quoted)
          lineStart = skipLineContinuations(src, lineStart, lineEnd);
        if (lineStart === before)
          break;
      }
      let afterDelim = this.matchHereDocDelimiter(delimiter, lineStart, lineEnd, !quoted);
      if (afterDelim !== -1 && !quoted)
        afterDelim = skipLineContinuations(src, afterDelim, lineEnd);
      if (afterDelim === lineEnd) {
        const bodyEnd = this.pos;
        if (!parenEnds || !this.parenBoundary || lineEnd !== len) {
          this.hereDocClosingPos = lineStart;
          this.hereDocClosingEnd = lineEnd;
        }
        this.pos = lineEnd < len ? lineEnd + 1 : lineEnd;
        return bodyEnd;
      }
      if (parenEnds && afterDelim !== -1) {
        let paren = afterDelim;
        while (paren < lineEnd && src.charCodeAt(paren) !== CH_RPAREN)
          paren++;
        if (paren < lineEnd || this.parenBoundary && lineEnd === len) {
          const bodyEnd = this.pos;
          this.pos = afterDelim;
          return bodyEnd;
        }
      }
      this.pos = lineEnd < len ? lineEnd + 1 : lineEnd;
    }
    return this.pos;
  }
  _wordText = "";
  _wordRaw = false;
  _wordQuoted = false;
  _wordHasExpansions = false;
  _wordKeywordEligible = false;
  _wordAssignmentState;
  _bracketWindow;
  _wordParts = null;
  _resultText = "";
  _resultIsRaw = true;
  _resultHasExpansion = false;
  _resultPart;
  _unbalanced = false;
  _notArithmetic = false;
  _arithUnterminated = false;
  _dqText = "";
  _dqHasExpansions = false;
  _dqParts = null;
  _dqEnd = 0;
  _hereDelim = "";
  _hereQuoted = false;
  readWord(out, ctx, tokenStart = 0) {
    const errorStart = this._errors === null ? 0 : this._errors.length;
    this.readWordText(false, ctx, true);
    if (ctx === LexContext.Normal) {
      const next = this.pos < this.srcEnd ? this.src.charCodeAt(this.pos) : 0;
      if (!this._wordRaw || next !== CH_LT && next !== CH_GT) {
        setSpanToken(out, Token.Word, tokenStart, this.pos, this._wordRaw);
        out.keywordEligible = this._wordKeywordEligible;
        return;
      }
    }
    this.classifyWord(out, ctx, tokenStart, errorStart);
  }
  isRedirectVariable(start, end) {
    const src = this.src;
    for (let i = start;i < end; i++) {
      const c = src.charCodeAt(i);
      if (c === CH_LBRACKET && i > start) {
        return i + 2 < end && src.charCodeAt(end - 1) === CH_RBRACKET && this.findClosingBracket(i + 1, end) === end - 1;
      }
      if (c >= 128 || !(isIdChar[c] & (i === start ? 1 : 2)))
        return false;
    }
    return end > start;
  }
  readArrayElement(out, tokenStart) {
    const close = this.findClosingBracket(tokenStart + 1);
    if (close === -1)
      return false;
    this.pos = close + 1;
    this.readWordText();
    setSpanToken(out, Token.Word, tokenStart, this.pos, true);
    return true;
  }
  classifyWord(out, ctx, tokenStart, errorStart) {
    const src = this.src;
    const raw = this._wordRaw;
    const hasExpansions = this._wordHasExpansions;
    const quoted = this._wordQuoted;
    const keywordEligible = this._wordKeywordEligible;
    let assignmentState = this._wordAssignmentState;
    const wordEnd = this.pos;
    const wordLen = wordEnd - tokenStart;
    if (ctx === LexContext.CasePattern) {
      let token = Token.Word;
      if (keywordEligible) {
        const reserved = raw ? matchReservedWord(src, tokenStart, wordLen) : RESERVED_WORDS.get(this.wordValueOf(tokenStart, wordEnd));
        if (reserved === Token.Esac)
          token = reserved;
      }
      setSpanToken(out, token, tokenStart, wordEnd, raw);
      out.keywordEligible = keywordEligible;
      return;
    }
    let value = null;
    if (!raw && !hasExpansions && keywordEligible && (ctx === LexContext.CommandStart || ctx === LexContext.TestMode)) {
      const nextCh = wordEnd < this.srcEnd ? src.charCodeAt(wordEnd) : 0;
      if (!quoted && wordLen <= 16 || nextCh === CH_LT || nextCh === CH_GT) {
        value = this.wordValueOf(tokenStart, wordEnd);
      }
    }
    if (ctx === LexContext.CommandStart && keywordEligible) {
      if (raw) {
        if (wordLen <= 8) {
          const reserved = matchReservedWord(src, tokenStart, wordLen);
          if (reserved !== undefined) {
            setSpanToken(out, reserved, tokenStart, wordEnd, true);
            return;
          }
        }
        if (wordLen === 2 && src.charCodeAt(tokenStart) === CH_LBRACKET && src.charCodeAt(tokenStart + 1) === CH_LBRACKET) {
          setSpanToken(out, Token.DblLBracket, tokenStart, wordEnd, true);
          return;
        }
      } else if (value !== null && value.length > 0) {
        const fc = value.charCodeAt(0);
        if (fc >= CH_a && fc <= CH_z && value.length <= 8 || fc === CH_BANG || fc === CH_LBRACE || fc === CH_RBRACE) {
          const reserved = RESERVED_WORDS.get(value);
          if (reserved !== undefined) {
            setToken(out, reserved, value, tokenStart, wordEnd);
            return;
          }
        }
        if (fc === CH_LBRACKET && value === "[[") {
          setToken(out, Token.DblLBracket, value, tokenStart, wordEnd);
          return;
        }
      }
    }
    if (ctx === LexContext.CommandStart || ctx === LexContext.CommandPrefix || ctx === LexContext.Declaration) {
      if (assignmentState === undefined) {
        let eq = -1;
        let bracket = false;
        for (let i = tokenStart + 1;i < wordEnd; i++) {
          const c = src.charCodeAt(i);
          if (c === CH_EQ) {
            eq = i;
            break;
          }
          if (c === CH_LBRACKET)
            bracket = true;
        }
        if (eq !== -1 || ctx !== LexContext.Declaration && bracket) {
          assignmentState = scanAssignmentPrefix(src, tokenStart, wordEnd, ASSIGNMENT_NAME_START);
        }
      }
      if (assignmentState !== undefined) {
        if (ctx !== LexContext.Declaration && assignmentState >= ASSIGNMENT_INDEX_BASE) {
          if (wordEnd < this.srcEnd) {
            if (this._errors !== null)
              this._errors.length = errorStart;
            this.pos = tokenStart;
            this.readWordText(true, ctx, true);
            if (this.pos > wordEnd) {
              this.classifyWord(out, ctx, tokenStart, errorStart);
              return;
            }
          }
          if (this._errors === null || this._errors.length === errorStart) {
            this.errors.push({ message: "unterminated array subscript", pos: src.indexOf("[", tokenStart) });
          }
        }
        if (isMatchedAssignment(assignmentState)) {
          setSpanToken(out, Token.Assignment, tokenStart, wordEnd, raw);
          if (value !== null)
            out._value = value;
          out.assignmentOperatorPos = assignmentOperatorPos(assignmentState);
          return;
        }
      }
    }
    if ((ctx === LexContext.CommandStart || ctx === LexContext.TestMode) && keywordEligible) {
      if (raw) {
        if (wordLen === 2 && src.charCodeAt(tokenStart) === CH_RBRACKET && src.charCodeAt(tokenStart + 1) === CH_RBRACKET) {
          setSpanToken(out, Token.DblRBracket, tokenStart, wordEnd, true);
          return;
        }
      } else if (value === "]]") {
        setToken(out, Token.DblRBracket, value, tokenStart, wordEnd);
        return;
      }
    }
    if (!hasExpansions && this.pos < this.srcEnd) {
      const nc = src.charCodeAt(this.pos);
      if (nc === CH_LT || nc === CH_GT) {
        if (raw) {
          const fc = src.charCodeAt(tokenStart);
          if (fc >= CH_0 && fc <= CH_9 && isAllDigitsRange(src, tokenStart, wordEnd)) {
            const fd = Number.parseInt(src.slice(tokenStart, wordEnd), 10);
            if (this.readRedirection(out, tokenStart)) {
              out.fileDescriptor = fd;
              out.descriptorEnd = wordEnd;
              return;
            }
          }
          if (fc === CH_LBRACE && src.charCodeAt(wordEnd - 1) === CH_RBRACE && this.isRedirectVariable(tokenStart + 1, wordEnd - 1)) {
            const varname = src.slice(tokenStart + 1, wordEnd - 1);
            if (this.readRedirection(out, tokenStart)) {
              out.variableName = varname;
              out.descriptorEnd = wordEnd;
              return;
            }
          }
        }
      }
    }
    setSpanToken(out, Token.Word, tokenStart, wordEnd, raw);
    if (value !== null)
      out._value = value;
    out.keywordEligible = keywordEligible;
  }
  readWordText(subscripts = false, ctx = LexContext.Normal, scanning = false) {
    const src = this.src;
    const len = this.srcEnd;
    let pos = this.pos;
    const fastStart = pos;
    let exitCh = 0;
    while (pos < len) {
      const c = src.charCodeAt(pos);
      if (c < 128 && charType[c]) {
        exitCh = c;
        break;
      }
      pos++;
    }
    if (pos >= len || charType[exitCh] & 1 && !(exitCh === CH_LPAREN && pos > fastStart && extglobPrefix[src.charCodeAt(pos - 1)]) && !subscripts) {
      this.pos = pos;
      this._wordText = (this._buildParts || this._buildValue) && pos > fastStart ? src.slice(fastStart, pos) : "";
      this._wordRaw = true;
      this._wordQuoted = false;
      this._wordHasExpansions = false;
      this._wordKeywordEligible = true;
      this._wordAssignmentState = undefined;
      if (this._buildParts) {
        this._wordParts = hasGlobCharacters(this._wordText) && ctx !== LexContext.ArrayElement ? parseGlobParts(src, fastStart, pos, undefined) ?? null : null;
      }
      return;
    }
    const bp = this._buildParts;
    const bt = bp || this._buildValue;
    let text = bt && pos > fastStart ? src.slice(fastStart, pos) : "";
    let quoted = false;
    let hasExpansions = false;
    let keywordEligible = true;
    let valueIsRaw = true;
    let lastValueChar = pos > fastStart ? src.charCodeAt(pos - 1) : 0;
    let assignmentState = scanAssignmentPrefix(src, fastStart, pos, ASSIGNMENT_NAME_START);
    let parts;
    let litBuf = "";
    let litStart = 0;
    let hasGlobs = false;
    if (bp) {
      parts = [];
      litBuf = text;
      litStart = fastStart;
      hasGlobs = text.length > 0 && hasGlobCharacters(text);
    }
    while (pos < len) {
      const ch = src.charCodeAt(pos);
      if (ch >= 128 || !charType[ch]) {
        const runStart = pos;
        pos++;
        while (pos < len) {
          const c = src.charCodeAt(pos);
          if (c < 128 && charType[c])
            break;
          pos++;
        }
        lastValueChar = src.charCodeAt(pos - 1);
        assignmentState = scanAssignmentPrefix(src, runStart, pos, assignmentState);
        if (bt) {
          const chunk = src.slice(runStart, pos);
          text += chunk;
          if (bp) {
            litBuf += chunk;
            hasGlobs = hasGlobs || hasGlobCharacters(chunk);
          }
        }
        continue;
      }
      if (charType[ch] & 1) {
        if (subscripts && assignmentState >= ASSIGNMENT_INDEX_BASE) {
          const close = this.findClosingBracket(pos);
          if (close !== -1) {
            const spanEnd = close + 1;
            assignmentState = assignmentState === ASSIGNMENT_INDEX_BASE + 1 ? ASSIGNMENT_AFTER_INDEX : assignmentState - 1;
            lastValueChar = src.charCodeAt(close);
            if (bt) {
              const chunk = src.slice(pos, spanEnd);
              text += chunk;
              if (bp) {
                litBuf += chunk;
                hasGlobs = hasGlobs || hasGlobCharacters(chunk);
              }
            }
            pos = spanEnd;
            continue;
          }
        }
        if (ch === CH_LPAREN && lastValueChar < 128 && extglobPrefix[lastValueChar]) {
          if (ctx === LexContext.FunctionName || assignmentState >= ASSIGNMENT_INDEX_BASE && (ctx === LexContext.CommandStart || ctx === LexContext.CommandPrefix))
            break;
          if (ctx === LexContext.CommandStart && lastValueChar === CH_BANG && keywordEligible && src.charCodeAt(fastStart) === CH_BANG && skipLineContinuations(src, fastStart + 1, len) === pos)
            break;
          const prefixChar = lastValueChar;
          if (prefixChar === CH_EQ && scanning && !((ctx === LexContext.CommandStart || ctx === LexContext.CommandPrefix || ctx === LexContext.Declaration || ctx === LexContext.EvalArgument) && isMatchedAssignment(assignmentState) && skipLineContinuations(src, assignmentOperatorPos(assignmentState) + 1, len) === pos))
            break;
          const innerStart = pos + 1;
          const close = this.findClosingShellDelimiter(innerStart, len, CH_RPAREN, prefixChar === CH_EQ);
          if (close === -1 && !scanning && !subscripts && assignmentState >= ASSIGNMENT_INDEX_BASE)
            break;
          if (ctx === LexContext.CommandStart && prefixChar !== CH_EQ && close !== -1 && skipBlanks(src, innerStart, close) === close)
            break;
          keywordEligible = false;
          const patternEnd = close === -1 ? len : close;
          pos = close === -1 ? len : close + 1;
          if (close === -1)
            this.errors.push({ message: "unterminated extended glob", pos: innerStart - 2 });
          lastValueChar = src.charCodeAt(pos - 1);
          if (bt) {
            const eg = "(" + src.slice(innerStart, pos);
            text += eg;
            if (bp && prefixChar !== CH_EQ) {
              let prefixPos = innerStart - 2;
              while (src.charCodeAt(prefixPos) === CH_NL && src.charCodeAt(prefixPos - 1) === CH_BACKSLASH) {
                prefixPos -= 2;
              }
              if (litBuf.length > 0) {
                const trimmed = litBuf.slice(0, -1);
                if (prefixPos > litStart)
                  parts.push({
                    type: "Literal",
                    pos: litStart,
                    end: prefixPos,
                    value: trimmed,
                    text: src.slice(litStart, prefixPos)
                  });
                litBuf = "";
              }
              const op = extglobOp[prefixChar];
              parts.push({
                type: "ExtendedGlob",
                pos: prefixPos,
                end: pos,
                text: src.slice(prefixPos, pos),
                operator: op,
                pattern: src.slice(innerStart, patternEnd),
                parts: this.subFieldParts(innerStart, patternEnd)
              });
              litStart = pos;
            } else if (bp) {
              litBuf += eg;
              hasGlobs = hasGlobs || hasGlobCharacters(eg);
            }
          }
          continue;
        }
        break;
      }
      if (ch === CH_BACKSLASH) {
        pos++;
        if (pos < len) {
          if (src.charCodeAt(pos) === CH_NL) {
            pos++;
            valueIsRaw = false;
          } else {
            if (assignmentState >= 0 && assignmentState < ASSIGNMENT_INDEX_BASE)
              assignmentState = ASSIGNMENT_INVALID;
            quoted = true;
            keywordEligible = false;
            valueIsRaw = false;
            lastValueChar = src.charCodeAt(pos);
            if (bt) {
              text += src[pos];
              if (bp)
                litBuf += src[pos];
            }
            pos++;
          }
        } else {
          if (assignmentState >= 0 && assignmentState < ASSIGNMENT_INDEX_BASE)
            assignmentState = ASSIGNMENT_INVALID;
          quoted = true;
          keywordEligible = false;
          lastValueChar = CH_BACKSLASH;
          if (bt) {
            text += "\\";
            if (bp)
              litBuf += "\\";
          }
        }
        continue;
      }
      if (ch === CH_SQUOTE) {
        const sqStart = pos;
        if (assignmentState >= 0 && assignmentState < ASSIGNMENT_INDEX_BASE)
          assignmentState = ASSIGNMENT_INVALID;
        quoted = true;
        keywordEligible = false;
        valueIsRaw = false;
        pos++;
        const start = pos;
        while (pos < len && src.charCodeAt(pos) !== CH_SQUOTE)
          pos++;
        if (pos > start)
          lastValueChar = src.charCodeAt(pos - 1);
        const value = bt ? src.slice(start, pos) : "";
        if (bt)
          text += value;
        if (pos < len)
          pos++;
        else
          this.errors.push({ message: "unterminated single quote", pos: start - 1 });
        if (bp) {
          if (sqStart > litStart) {
            parts.push({
              type: "Literal",
              pos: litStart,
              end: sqStart,
              value: litBuf,
              text: src.slice(litStart, sqStart)
            });
            litBuf = "";
          }
          parts.push({ type: "SingleQuoted", pos: sqStart, end: pos, value, text: src.slice(sqStart, pos) });
          litStart = pos;
        }
        continue;
      }
      if (ch === CH_DQUOTE) {
        const dqStart = pos;
        if (assignmentState >= 0 && assignmentState < ASSIGNMENT_INDEX_BASE)
          assignmentState = ASSIGNMENT_INVALID;
        quoted = true;
        keywordEligible = false;
        valueIsRaw = false;
        pos++;
        this.pos = pos;
        this.readDoubleQuoted();
        pos = this.pos;
        if (this._dqEnd > dqStart + 1)
          lastValueChar = src.charCodeAt(this._dqEnd - 1);
        if (this._dqHasExpansions)
          hasExpansions = true;
        if (bt)
          text += this._dqText;
        if (bp) {
          if (dqStart > litStart) {
            parts.push({
              type: "Literal",
              pos: litStart,
              end: dqStart,
              value: litBuf,
              text: src.slice(litStart, dqStart)
            });
            litBuf = "";
          }
          const dqText = src.slice(dqStart, pos);
          parts.push({
            type: "DoubleQuoted",
            pos: dqStart,
            end: pos,
            text: dqText,
            parts: this._dqParts ?? [
              {
                type: "Literal",
                pos: dqStart + 1,
                end: this._dqEnd,
                value: this._dqText,
                text: src.slice(dqStart + 1, this._dqEnd)
              }
            ]
          });
          litStart = pos;
        }
        continue;
      }
      if (ch === CH_DOLLAR) {
        keywordEligible = false;
        const dollarStart = pos;
        if (assignmentState >= 0 && assignmentState < ASSIGNMENT_INDEX_BASE)
          assignmentState = ASSIGNMENT_INVALID;
        const next = pos + 1 < len ? src.charCodeAt(pos + 1) : 0;
        if (next === CH_SQUOTE || next === CH_DQUOTE)
          quoted = true;
        this.pos = pos;
        this.readDollar();
        pos = this.pos;
        if (!this._resultIsRaw)
          valueIsRaw = false;
        if (pos > dollarStart)
          lastValueChar = src.charCodeAt(pos - 1);
        if (this._resultHasExpansion)
          hasExpansions = true;
        if (bt)
          text += this._resultText;
        if (bp) {
          if (this._resultPart) {
            if (dollarStart > litStart) {
              parts.push({
                type: "Literal",
                pos: litStart,
                end: dollarStart,
                value: litBuf,
                text: src.slice(litStart, dollarStart)
              });
              litBuf = "";
            }
            parts.push(this._resultPart);
            litStart = pos;
          } else {
            litBuf += this._resultText;
          }
        }
        continue;
      }
      if (ch === CH_BACKTICK) {
        keywordEligible = false;
        const btStart = pos;
        if (assignmentState >= 0 && assignmentState < ASSIGNMENT_INDEX_BASE)
          assignmentState = ASSIGNMENT_INVALID;
        this.pos = pos;
        this.readBacktickExpansion();
        pos = this.pos;
        valueIsRaw = false;
        lastValueChar = src.charCodeAt(pos - 1);
        hasExpansions = true;
        if (bt)
          text += this._resultText;
        if (bp) {
          if (btStart > litStart) {
            parts.push({
              type: "Literal",
              pos: litStart,
              end: btStart,
              value: litBuf,
              text: src.slice(litStart, btStart)
            });
            litBuf = "";
          }
          parts.push(this._resultPart);
          litStart = pos;
        }
        continue;
      }
      if (ch === CH_LBRACE) {
        if (assignmentState >= 0 && assignmentState < ASSIGNMENT_INDEX_BASE)
          assignmentState = ASSIGNMENT_INVALID;
        const braceEnd = this.scanBraceExpansion(pos);
        if (braceEnd > 0) {
          keywordEligible = false;
          lastValueChar = src.charCodeAt(braceEnd - 1);
          if (bt) {
            const braceText = src.slice(pos, braceEnd);
            text += braceText;
            if (bp) {
              if (pos > litStart) {
                parts.push({
                  type: "Literal",
                  pos: litStart,
                  end: pos,
                  value: litBuf,
                  text: src.slice(litStart, pos)
                });
                litBuf = "";
              }
              parts.push({
                type: "BraceExpansion",
                pos,
                end: braceEnd,
                text: braceText,
                parts: this.subFieldParts(pos + 1, braceEnd - 1)
              });
              litStart = braceEnd;
            }
          }
          pos = braceEnd;
          continue;
        }
        lastValueChar = CH_LBRACE;
        if (bt) {
          text += "{";
          if (bp)
            litBuf += "{";
        }
        pos++;
        continue;
      }
      pos++;
    }
    if (bp && pos > litStart)
      parts.push({ type: "Literal", pos: litStart, end: pos, value: litBuf, text: src.slice(litStart, pos) });
    this.pos = pos;
    this._wordText = text;
    this._wordRaw = valueIsRaw;
    this._wordQuoted = quoted;
    this._wordHasExpansions = hasExpansions;
    this._wordKeywordEligible = keywordEligible;
    this._wordAssignmentState = assignmentState;
    if (bp) {
      this._wordParts = parts.length > 1 || parts.length === 1 && parts[0].type !== "Literal" ? parts : null;
      if (hasGlobs && ctx !== LexContext.ArrayElement)
        this._wordParts = parseGlobParts(src, fastStart, pos, this._wordParts) ?? null;
    }
  }
  readInnerWordText(insideDoubleQuotes = false, arithmetic = false, globs = false) {
    const src = this.src;
    const len = this.srcEnd;
    let pos = this.pos;
    const start = pos;
    let text = "";
    const bp = this._buildParts;
    let parts;
    let litBuf = "";
    let litStart = 0;
    let preserveLiteral = false;
    let hasGlobs = false;
    if (bp) {
      parts = [];
      litStart = pos;
    }
    while (pos < len) {
      const ch = src.charCodeAt(pos);
      if (ch === CH_BACKSLASH) {
        pos++;
        if (pos < len) {
          if (src.charCodeAt(pos) === CH_NL) {
            pos++;
          } else {
            const next = src.charCodeAt(pos);
            if (insideDoubleQuotes && next !== CH_DOLLAR && next !== CH_BACKTICK && next !== CH_DQUOTE && next !== CH_BACKSLASH && next !== CH_RBRACE) {
              text += "\\";
              if (bp)
                litBuf += "\\";
              preserveLiteral = true;
            }
            const escaped = src[pos++];
            text += escaped;
            if (bp)
              litBuf += escaped;
          }
        }
        continue;
      }
      if (ch === CH_SQUOTE && !insideDoubleQuotes) {
        const sqStart = pos;
        pos++;
        const start = pos;
        while (pos < len && src.charCodeAt(pos) !== CH_SQUOTE)
          pos++;
        const value = src.slice(start, pos);
        text += value;
        if (pos < len)
          pos++;
        if (bp) {
          if (sqStart > litStart) {
            parts.push({
              type: "Literal",
              pos: litStart,
              end: sqStart,
              value: litBuf,
              text: src.slice(litStart, sqStart)
            });
            litBuf = "";
          }
          parts.push({ type: "SingleQuoted", pos: sqStart, end: pos, value, text: src.slice(sqStart, pos) });
          litStart = pos;
        }
        continue;
      }
      if (ch === CH_DQUOTE) {
        const dqStart = pos;
        pos++;
        this.pos = pos;
        this.readDoubleQuoted(insideDoubleQuotes);
        pos = this.pos;
        text += this._dqText;
        if (bp) {
          if (dqStart > litStart) {
            parts.push({
              type: "Literal",
              pos: litStart,
              end: dqStart,
              value: litBuf,
              text: src.slice(litStart, dqStart)
            });
            litBuf = "";
          }
          const dqText = src.slice(dqStart, pos);
          parts.push({
            type: "DoubleQuoted",
            pos: dqStart,
            end: pos,
            text: dqText,
            parts: this._dqParts ?? [
              {
                type: "Literal",
                pos: dqStart + 1,
                end: this._dqEnd,
                value: this._dqText,
                text: src.slice(dqStart + 1, this._dqEnd)
              }
            ]
          });
          litStart = pos;
        }
        continue;
      }
      if (ch === CH_DOLLAR) {
        const dollarStart = pos;
        this.pos = pos;
        this.readDollar(insideDoubleQuotes);
        pos = this.pos;
        text += this._resultText;
        if (bp) {
          if (this._resultPart) {
            if (dollarStart > litStart) {
              parts.push({
                type: "Literal",
                pos: litStart,
                end: dollarStart,
                value: litBuf,
                text: src.slice(litStart, dollarStart)
              });
              litBuf = "";
            }
            parts.push(this._resultPart);
            litStart = pos;
          } else {
            litBuf += this._resultText;
          }
        }
        continue;
      }
      if (ch === CH_BACKTICK) {
        const btStart = pos;
        this.pos = pos;
        this.readBacktickExpansion(insideDoubleQuotes);
        pos = this.pos;
        text += this._resultText;
        if (bp) {
          if (btStart > litStart) {
            parts.push({
              type: "Literal",
              pos: litStart,
              end: btStart,
              value: litBuf,
              text: src.slice(litStart, btStart)
            });
            litBuf = "";
          }
          parts.push(this._resultPart);
          litStart = pos;
        }
        continue;
      }
      if (!insideDoubleQuotes && !arithmetic && (ch === CH_LT || ch === CH_GT) && pos + 1 < len && src.charCodeAt(pos + 1) === CH_LPAREN) {
        const psStart = pos;
        this.pos = pos + 2;
        const inner = this.extractBalanced();
        pos = this.pos;
        const raw = src.slice(psStart, pos);
        text += raw;
        if (bp) {
          if (psStart > litStart) {
            parts.push({
              type: "Literal",
              pos: litStart,
              end: psStart,
              value: litBuf,
              text: src.slice(litStart, psStart)
            });
            litBuf = "";
          }
          parts.push(this.processSubstitution(psStart, raw, ch === CH_LT ? "<" : ">", inner));
          litStart = pos;
        }
        continue;
      }
      text += src[pos];
      if (bp) {
        litBuf += src[pos];
        if (globs && (ch === CH_STAR || ch === CH_QUESTION || ch === CH_LBRACKET))
          hasGlobs = true;
      }
      pos++;
    }
    if (bp && pos > litStart)
      parts.push({ type: "Literal", pos: litStart, end: pos, value: litBuf, text: src.slice(litStart, pos) });
    this.pos = pos;
    this._wordText = text;
    this._wordRaw = false;
    this._wordQuoted = false;
    this._wordHasExpansions = false;
    this._wordKeywordEligible = false;
    if (bp) {
      this._wordParts = parts.length > 1 || parts.length === 1 && (parts[0].type !== "Literal" || preserveLiteral) ? parts : null;
      if (hasGlobs)
        this._wordParts = parseGlobParts(src, start, pos, this._wordParts) ?? null;
    }
  }
  subFieldParts(start, end) {
    if (this._nestingDepth >= MAX_SYNTAX_NESTING)
      return;
    return hasEmbeddedWordStructure(this.src, start, end) ? this.parseSubFieldWord(start, end).parts : parseGlobParts(this.src, start, end, undefined);
  }
  parseSubFieldWord(start, end, context = "word", arithmetic = false) {
    if (start >= end)
      return new WordImpl("", start, start);
    if (this._nestingDepth >= MAX_SYNTAX_NESTING)
      return new WordImpl(this.src.slice(start, end), start, end);
    this._nestingDepth++;
    const savedEnd = this.srcEnd;
    const savedPos = this.pos;
    const savedText = this._wordText;
    const savedParts = this._wordParts;
    const savedQuoted = this._wordQuoted;
    const savedKeywordEligible = this._wordKeywordEligible;
    this.srcEnd = end;
    this.pos = start;
    this.readInnerWordText(context === "quoted", arithmetic, context === "word");
    const word = new WordImpl(this.src.slice(start, end), start, end);
    if (this._buildParts) {
      word.parts = this._wordParts ?? undefined;
    }
    this.srcEnd = savedEnd;
    this.pos = savedPos;
    this._wordText = savedText;
    this._wordParts = savedParts;
    this._wordQuoted = savedQuoted;
    this._wordKeywordEligible = savedKeywordEligible;
    this._nestingDepth--;
    return word;
  }
  skipSQ() {
    while (this.pos < this.srcEnd && this.src.charCodeAt(this.pos) !== CH_SQUOTE)
      this.pos++;
    if (this.pos < this.srcEnd)
      this.pos++;
  }
  skipAnsiCQuoted() {
    const quotePos = this.pos - 1;
    const result = decodeAnsiCQuoted(this.src, this.pos, this.srcEnd);
    this.pos = result.end;
    if (!result.closed)
      this.errors.push({ message: "unterminated ANSI-C quote", pos: quotePos });
  }
  skipDQ() {
    const src = this.src;
    const len = this.srcEnd;
    this._unbalanced = false;
    if (this._nestingDepth < MAX_SYNTAX_NESTING) {
      while (this.pos < len) {
        const ch = src.charCodeAt(this.pos);
        if (ch === CH_DQUOTE) {
          this.pos++;
          return;
        }
        if (ch === CH_BACKSLASH) {
          this.pos = Math.min(this.pos + 2, len);
          continue;
        }
        if (ch === CH_BACKTICK)
          break;
        if (ch === CH_DOLLAR) {
          const next = src.charCodeAt(this.pos + 1);
          if (next === CH_LPAREN || next === CH_LBRACE || next === CH_DOLLAR)
            break;
        }
        this.pos++;
      }
    }
    this.extractBalanced(true, true);
  }
  skipSpacesAndTabs() {
    this.pos = skipBlanks(this.src, this.pos, this.srcEnd);
  }
  readDoubleQuoted(unescapeAll = false) {
    const src = this.src;
    const len = this.srcEnd;
    const contentStart = this.pos;
    let hasExpansions = false;
    const bp = this._buildParts;
    const bt = bp || this._buildValue;
    if (!bp) {
      let p = this.pos;
      while (p < len) {
        const c = src.charCodeAt(p);
        if (c === CH_DQUOTE) {
          this._dqText = bt ? src.slice(contentStart, p) : "";
          this._dqEnd = p;
          this.pos = p + 1;
          this._dqHasExpansions = false;
          this._dqParts = null;
          return;
        }
        if (c === CH_DOLLAR || c === CH_BACKTICK || c === CH_BACKSLASH)
          break;
        p++;
      }
    }
    let text = "";
    let parts = null;
    let litBuf = "";
    let litStart = bp ? this.pos : 0;
    while (this.pos < len && src.charCodeAt(this.pos) !== CH_DQUOTE) {
      const runStart = this.pos;
      while (this.pos < len) {
        const c = src.charCodeAt(this.pos);
        if (c === CH_DQUOTE || c === CH_BACKSLASH || c === CH_DOLLAR || c === CH_BACKTICK)
          break;
        this.pos++;
      }
      if (bt && this.pos > runStart) {
        const chunk = src.slice(runStart, this.pos);
        text += chunk;
        if (bp)
          litBuf += chunk;
      }
      if (this.pos >= len || src.charCodeAt(this.pos) === CH_DQUOTE)
        break;
      const ch = src.charCodeAt(this.pos);
      if (ch === CH_BACKSLASH) {
        this.pos++;
        if (this.pos < len) {
          const next = src.charCodeAt(this.pos);
          if (next === CH_NL) {
            this.pos++;
            continue;
          }
          if (bt) {
            if (unescapeAll || next === CH_DOLLAR || next === CH_BACKTICK || next === CH_DQUOTE || next === CH_BACKSLASH) {
              const c = src[this.pos];
              text += c;
              if (bp)
                litBuf += c;
            } else {
              const pair = "\\" + src[this.pos];
              text += pair;
              if (bp)
                litBuf += pair;
            }
          }
          this.pos++;
        }
        continue;
      }
      if (ch === CH_DOLLAR) {
        const afterDollar = this.pos + 1 < len ? src.charCodeAt(this.pos + 1) : 0;
        if (afterDollar === CH_DQUOTE || afterDollar === CH_SQUOTE) {
          if (bt) {
            text += "$";
            if (bp)
              litBuf += "$";
          }
          this.pos++;
          continue;
        }
        const expStart = this.pos;
        this.readDollar(true);
        if (bt)
          text += this._resultText;
        if (this._resultHasExpansion)
          hasExpansions = true;
        if (bp) {
          const rp = this._resultPart;
          if (rp && isDQChild(rp)) {
            if (!parts)
              parts = [];
            if (expStart > litStart) {
              parts.push({
                type: "Literal",
                pos: litStart,
                end: expStart,
                value: litBuf,
                text: src.slice(litStart, expStart)
              });
              litBuf = "";
            }
            parts.push(rp);
            litStart = this.pos;
          } else {
            litBuf += this._resultText;
          }
        }
        continue;
      }
      if (ch === CH_BACKTICK) {
        const btStart = this.pos;
        this.readBacktickExpansion(true);
        if (bt)
          text += this._resultText;
        hasExpansions = true;
        if (bp && this._resultPart && isDQChild(this._resultPart)) {
          if (!parts)
            parts = [];
          if (btStart > litStart) {
            parts.push({
              type: "Literal",
              pos: litStart,
              end: btStart,
              value: litBuf,
              text: src.slice(litStart, btStart)
            });
            litBuf = "";
          }
          parts.push(this._resultPart);
          litStart = this.pos;
        }
        continue;
      }
    }
    if (bp && parts && this.pos > litStart)
      parts.push({ type: "Literal", pos: litStart, end: this.pos, value: litBuf, text: src.slice(litStart, this.pos) });
    this._dqEnd = this.pos;
    if (this.pos < len)
      this.pos++;
    else
      this.errors.push({ message: "unterminated double quote", pos: contentStart - 1 });
    this._dqText = text;
    this._dqHasExpansions = hasExpansions;
    this._dqParts = parts;
  }
  readDollar(insideDoubleQuotes = false) {
    const dollarPos = this.pos;
    this.pos++;
    const src = this.src;
    const len = this.srcEnd;
    const bt = this._buildParts || this._buildValue;
    if (this.pos >= len) {
      this._resultText = "$";
      this._resultIsRaw = true;
      this._resultHasExpansion = false;
      this._resultPart = undefined;
      return;
    }
    const logicalPos = skipLineContinuations(src, this.pos, len);
    if (logicalPos > this.pos && src.charCodeAt(logicalPos) === CH_LPAREN && src.charCodeAt(logicalPos + 1) !== CH_LPAREN)
      this.pos = logicalPos;
    const ch = src.charCodeAt(this.pos);
    if (ch === CH_LPAREN) {
      if (this.pos + 1 < len && src.charCodeAt(this.pos + 1) === CH_LPAREN) {
        const savedPos = this.pos;
        const savedErrors = this.errors.length;
        this.readArithmeticExpansion(dollarPos);
        if (!this._notArithmetic)
          return;
        this.errors.length = savedErrors;
        this.pos = savedPos;
      }
      this.readCommandSubstitution(dollarPos);
      return;
    }
    if (ch === CH_LBRACE) {
      const after = this.pos + 1 < len ? src.charCodeAt(this.pos + 1) : 0;
      if (after === CH_SPACE || after === CH_TAB || after === CH_NL) {
        this.readBraceCommandSubstitution();
        return;
      }
      if (after === CH_PIPE) {
        this.readValueSubstitution();
        return;
      }
      this.readParameterExpansion(insideDoubleQuotes);
      return;
    }
    if (ch === CH_SQUOTE) {
      this.pos++;
      if (bt) {
        const value = this.readAnsiCQuoted();
        this._resultText = value;
        this._resultPart = this._buildParts ? { type: "AnsiCQuoted", pos: dollarPos, end: this.pos, text: src.slice(dollarPos, this.pos), value } : undefined;
      } else {
        this.skipAnsiCQuoted();
        this._resultText = "";
        this._resultPart = undefined;
      }
      this._resultIsRaw = false;
      this._resultHasExpansion = false;
      return;
    }
    if (ch === CH_DQUOTE) {
      this.pos++;
      this.readDoubleQuoted(insideDoubleQuotes);
      this._resultText = this._dqText;
      this._resultIsRaw = false;
      this._resultHasExpansion = this._dqHasExpansions;
      if (this._buildParts) {
        const text = src.slice(dollarPos, this.pos);
        this._resultPart = {
          type: "LocaleString",
          pos: dollarPos,
          end: this.pos,
          text,
          parts: this._dqParts ?? [
            {
              type: "Literal",
              pos: dollarPos + 2,
              end: this._dqEnd,
              value: this._dqText,
              text: src.slice(dollarPos + 2, this._dqEnd)
            }
          ]
        };
      } else {
        this._resultPart = undefined;
      }
      return;
    }
    if (ch === CH_AT || ch === CH_STAR || ch === CH_HASH || ch === CH_QUESTION || ch === CH_DASH || ch === CH_DOLLAR || ch === CH_BANG || ch >= CH_0 && ch <= CH_9) {
      this.pos++;
      const text = bt ? src.slice(this.pos - 2, this.pos) : "";
      this._resultText = text;
      this._resultIsRaw = true;
      this._resultHasExpansion = false;
      this._resultPart = this._buildParts ? { type: "SimpleExpansion", pos: dollarPos, end: this.pos, text } : undefined;
      return;
    }
    if (ch < 128 && isIdChar[ch] & 1) {
      const namePos = this.pos - 1;
      while (this.pos < len) {
        const c = src.charCodeAt(this.pos);
        if (c < 128 && isIdChar[c] & 2)
          this.pos++;
        else
          break;
      }
      const text = bt ? src.slice(namePos, this.pos) : "";
      this._resultText = text;
      this._resultIsRaw = true;
      this._resultHasExpansion = false;
      this._resultPart = this._buildParts ? { type: "SimpleExpansion", pos: dollarPos, end: this.pos, text } : undefined;
      return;
    }
    if (ch === CH_LBRACKET) {
      const errorCount = this._errors === null ? 0 : this._errors.length;
      const close = this.findClosingArithmeticBracket(this.pos + 1);
      if (close !== -1) {
        const bodyStart = this.pos + 1;
        const body = src.slice(bodyStart, close);
        this.pos = close + 1;
        const text = bt ? src.slice(dollarPos, this.pos) : "";
        this._resultText = text;
        this._resultIsRaw = true;
        this._resultHasExpansion = false;
        this._resultPart = this._buildParts ? this.arithmeticExpansion(bodyStart - 2, text, body, bodyStart) : undefined;
        return;
      }
      if (this._errors !== null)
        this._errors.length = errorCount;
    }
    this._resultText = "$";
    this._resultIsRaw = true;
    this._resultHasExpansion = false;
    this._resultPart = undefined;
  }
  scanArithmeticBody() {
    this._notArithmetic = false;
    this._arithUnterminated = false;
    this.pos += 2;
    let depth = 1;
    let parenDepth = 0;
    let parentParenDepth = 0;
    let parenDepths;
    let reported = false;
    const src = this.src;
    const len = this.srcEnd;
    const start = this.pos;
    while (this.pos < len && depth > 0) {
      const c = src.charCodeAt(this.pos);
      if (c === CH_BACKSLASH) {
        this.pos += this.pos + 1 < len ? 2 : 1;
      } else if (c === CH_SQUOTE) {
        this.pos++;
        this.skipSQ();
      } else if (c === CH_DQUOTE) {
        this.pos++;
        this.skipDQ();
      } else if (c === CH_BACKTICK) {
        this.pos++;
        while (this.pos < len && src.charCodeAt(this.pos) !== CH_BACKTICK) {
          if (src.charCodeAt(this.pos) === CH_BACKSLASH)
            this.pos++;
          this.pos++;
        }
        if (this.pos < len)
          this.pos++;
      } else if (c === CH_DOLLAR && this.pos + 2 < len && src.charCodeAt(this.pos + 1) === CH_LPAREN && src.charCodeAt(this.pos + 2) !== CH_LPAREN) {
        const dollarPos = this.pos;
        this.pos += 2;
        this.extractBalanced();
        if (this._unbalanced)
          this.errors.push({ message: "unterminated command substitution", pos: dollarPos });
      } else if (c === CH_DOLLAR && this.pos + 1 < len && src.charCodeAt(this.pos + 1) === CH_LBRACE) {
        const close = this.findClosingBrace(this.pos + 2, len);
        this.pos = close === -1 ? len : close + 1;
      } else if ((c === CH_LT || c === CH_GT) && this.pos + 1 < len && src.charCodeAt(this.pos + 1) === CH_LPAREN) {
        this.pos += 2;
        this.extractBalanced();
      } else if (c === CH_LPAREN) {
        if (src.charCodeAt(this.pos - 1) === CH_DOLLAR && src.charCodeAt(this.pos + 1) === CH_LPAREN) {
          if (depth === 1)
            parentParenDepth = parenDepth;
          else
            (parenDepths ?? (parenDepths = [])).push(parenDepth);
          depth++;
          parenDepth = 0;
          if (depth + this._nestingDepth > MAX_SYNTAX_NESTING && !reported) {
            this.errors.push({ message: "maximum arithmetic expansion nesting depth exceeded", pos: this.pos - 1 });
            reported = true;
          }
          this.pos += 2;
        } else {
          if (++parenDepth + depth - 1 + this._nestingDepth > MAX_SYNTAX_NESTING && !reported) {
            this.errors.push({ message: "maximum arithmetic expression nesting depth exceeded", pos: this.pos });
            reported = true;
          }
          this.pos++;
        }
      } else if (c === CH_RPAREN && parenDepth > 0) {
        parenDepth--;
        this.pos++;
      } else if (c === CH_RPAREN && this.pos + 1 < len && src.charCodeAt(this.pos + 1) === CH_RPAREN) {
        if (--depth === 0) {
          this.pos += 2;
          break;
        }
        parenDepth = depth === 1 ? parentParenDepth : parenDepths.pop();
        this.pos += 2;
      } else if (c === CH_RPAREN && depth === 1) {
        this._notArithmetic = true;
        return "";
      } else {
        this.pos++;
      }
    }
    const bt = this._buildParts || this._buildValue;
    if (depth > 0) {
      this._arithUnterminated = true;
      return bt ? src.slice(start, this.pos) : "";
    }
    return bt ? src.slice(start, this.pos - 2) : "";
  }
  readArithmeticExpansion(dollarPos) {
    const bodyStart = this.pos + 2;
    const body = this.scanArithmeticBody();
    if (this._notArithmetic)
      return;
    if (this._arithUnterminated)
      this.errors.push({ message: "unterminated arithmetic expansion", pos: dollarPos });
    const text = this._buildParts || this._buildValue ? this.src.slice(dollarPos, this.pos) : "";
    this._resultText = text;
    this._resultIsRaw = true;
    this._resultHasExpansion = false;
    this._resultPart = this._buildParts ? this.arithmeticExpansion(dollarPos, text, body, bodyStart) : undefined;
  }
  arithmeticExpansion(pos, text, body, bodyStart) {
    return new ArithmeticExpansionImpl(pos, this.pos, text, {
      source: this.src,
      body,
      offset: bodyStart,
      depth: this._nestingDepth,
      context: this.substitutionContext
    });
  }
  readArithmeticCommand(out, tokenStart) {
    const savedBuildValue = this._buildValue;
    this._buildValue = true;
    const body = this.scanArithmeticBody();
    this._buildValue = savedBuildValue;
    if (this._arithUnterminated)
      this.errors.push({ message: "unterminated arithmetic command", pos: tokenStart });
    setToken(out, Token.ArithCmd, body, tokenStart, this.pos);
  }
  readCommandSubstitution(dollarPos) {
    const openPos = this.pos;
    this.pos++;
    const inner = this.extractBalanced();
    if (this._unbalanced)
      this.errors.push({ message: "unterminated command substitution", pos: dollarPos });
    const bt = this._buildParts || this._buildValue;
    const rawText = bt ? this.src.slice(dollarPos, this.pos) : "";
    const text = !bt || openPos === dollarPos + 1 ? rawText : "$" + this.src.slice(openPos, this.pos);
    this._resultText = text;
    this._resultIsRaw = openPos === dollarPos + 1;
    this._resultHasExpansion = true;
    if (this._buildParts) {
      this._resultPart = this.commandExpansion(dollarPos, rawText, openPos + 1, inner, !this._unbalanced);
    } else {
      this._resultPart = undefined;
    }
  }
  readBraceCommandSubstitution() {
    this.readBraceSubstitution(1);
  }
  readValueSubstitution() {
    this.readBraceSubstitution(2);
  }
  readBraceSubstitution(skip) {
    const dollarPos = this.pos - 1;
    this.pos += skip;
    const src = this.src;
    const len = this.srcEnd;
    let depth = 1;
    const start = this.pos;
    while (this.pos < len) {
      const c = src.charCodeAt(this.pos);
      if (c === CH_LBRACE)
        depth++;
      else if (c === CH_RBRACE) {
        if (--depth === 0) {
          this.pos++;
          break;
        }
      } else if (c === CH_SQUOTE) {
        this.pos++;
        this.skipSQ();
        continue;
      } else if (c === CH_DQUOTE) {
        this.pos++;
        this.skipDQ();
        continue;
      } else if (c === CH_BACKSLASH)
        this.pos++;
      this.pos++;
    }
    this._resultIsRaw = true;
    this._resultHasExpansion = true;
    if (this._buildParts || this._buildValue) {
      const rawInner = src.slice(start, this.pos - 1);
      const inner = rawInner.trim();
      const text = src.slice(dollarPos, this.pos);
      this._resultText = text;
      if (this._buildParts) {
        const innerStart = start + (rawInner.length - rawInner.trimStart().length);
        this._resultPart = this.commandExpansion(dollarPos, text, innerStart, inner);
      } else {
        this._resultPart = undefined;
      }
    } else {
      this._resultText = "";
      this._resultPart = undefined;
    }
  }
  readBacktickExpansion(insideDoubleQuotes = false) {
    this.pos++;
    const src = this.src;
    const len = this.srcEnd;
    const start = this.pos;
    if (!this._buildParts && !this._buildValue) {
      while (this.pos < len && src.charCodeAt(this.pos) !== CH_BACKTICK) {
        if (src.charCodeAt(this.pos) === CH_BACKSLASH && this.pos + 1 < len)
          this.pos++;
        this.pos++;
      }
      if (this.pos < len)
        this.pos++;
      else
        this.errors.push({ message: "unterminated backtick", pos: start - 1 });
      this._resultText = "";
      this._resultIsRaw = false;
      this._resultHasExpansion = true;
      this._resultPart = undefined;
      return;
    }
    let inner = "";
    let hasEscapes = false;
    while (this.pos < len && src.charCodeAt(this.pos) !== CH_BACKTICK) {
      if (src.charCodeAt(this.pos) === CH_BACKSLASH) {
        hasEscapes = true;
        break;
      }
      this.pos++;
    }
    if (!hasEscapes) {
      inner = src.slice(start, this.pos);
    } else {
      inner = src.slice(start, this.pos);
      while (this.pos < len && src.charCodeAt(this.pos) !== CH_BACKTICK) {
        if (src.charCodeAt(this.pos) === CH_BACKSLASH) {
          this.pos++;
          if (this.pos < len) {
            const c = src.charCodeAt(this.pos);
            if (c === CH_DOLLAR || c === CH_BACKTICK || c === CH_BACKSLASH || insideDoubleQuotes && c === CH_DQUOTE) {
              inner += src[this.pos];
            } else {
              inner += "\\" + src[this.pos];
            }
            this.pos++;
          }
        } else {
          const runStart = this.pos;
          while (this.pos < len) {
            const c = src.charCodeAt(this.pos);
            if (c === CH_BACKTICK || c === CH_BACKSLASH)
              break;
            this.pos++;
          }
          inner += src.slice(runStart, this.pos);
        }
      }
    }
    if (this.pos < len)
      this.pos++;
    else
      this.errors.push({ message: "unterminated backtick", pos: start - 1 });
    const text = src.slice(start - 1, this.pos);
    this._resultText = inner;
    this._resultHasExpansion = true;
    if (this._buildParts) {
      this._resultPart = hasEscapes ? this.decodedCommandExpansion(start - 1, text, inner) : this.commandExpansion(start - 1, text, start, inner);
    } else {
      this._resultPart = undefined;
    }
  }
  readParameterExpansion(insideDoubleQuotes) {
    const src = this.src;
    const len = this.srcEnd;
    const start = this.pos;
    this.pos++;
    let depth = 1;
    let reported = false;
    while (this.pos < len && depth > 0) {
      const ch = src.charCodeAt(this.pos);
      if (ch === CH_DOLLAR) {
        const next = this.pos + 1 < len ? src.charCodeAt(this.pos + 1) : 0;
        if (next === CH_LBRACE) {
          depth++;
          if (this._nestingDepth + depth > MAX_SYNTAX_NESTING && !reported) {
            this.errors.push({ message: "maximum parameter expansion nesting depth exceeded", pos: this.pos });
            reported = true;
          }
          this.pos += 2;
          continue;
        }
        if (next === CH_DOLLAR) {
          this.pos += 2;
          continue;
        }
        if (next === CH_LPAREN) {
          const dollarPos = this.pos;
          this.pos += 2;
          this.extractBalanced();
          if (this._unbalanced)
            this.errors.push({ message: "unterminated command substitution", pos: dollarPos });
          continue;
        }
      } else if (ch === CH_BACKTICK) {
        this.pos++;
        while (this.pos < len && src.charCodeAt(this.pos) !== CH_BACKTICK) {
          if (src.charCodeAt(this.pos) === CH_BACKSLASH)
            this.pos++;
          this.pos++;
        }
        if (this.pos < len)
          this.pos++;
        continue;
      } else if (ch === CH_RBRACE) {
        if (--depth === 0) {
          this.pos++;
          break;
        }
      } else if (ch === CH_BACKSLASH) {
        if (this.pos + 1 < len)
          this.pos++;
      } else if (ch === CH_SQUOTE) {
        this.pos++;
        if (this.pos > start + 1 && src.charCodeAt(this.pos - 2) === CH_DOLLAR)
          this.skipAnsiCQuoted();
        else
          this.skipSQ();
        continue;
      } else if (ch === CH_DQUOTE) {
        this.pos++;
        this.skipDQ();
        continue;
      }
      this.pos++;
    }
    const closed = depth === 0;
    if (!closed)
      this.errors.push({ message: "unterminated parameter expansion", pos: start - 1 });
    const text = this._buildParts || this._buildValue ? src.slice(start - 1, this.pos) : "";
    this._resultText = text;
    this._resultIsRaw = true;
    this._resultHasExpansion = false;
    if (this._buildParts) {
      const inner = src.slice(start + 1, closed ? this.pos - 1 : this.pos);
      this._resultPart = this.parseParamInner(text, inner, start + 1, insideDoubleQuotes);
    } else {
      this._resultPart = undefined;
    }
  }
  parseParamInner(text, inner, innerStart, insideDoubleQuotes) {
    const result = {
      type: "ParameterExpansion",
      pos: innerStart - 2,
      end: this.pos,
      text,
      parameter: "",
      parameterPos: innerStart,
      parameterEnd: innerStart,
      prefix: undefined,
      index: undefined,
      operation: undefined
    };
    const ilen = inner.length;
    if (ilen === 0)
      return result;
    const sub = (a, b, context = "word") => this.parseSubFieldWord(innerStart + a, innerStart + b, context);
    const closeBracket = (start) => {
      const close = this.findClosingBracket(innerStart + start, innerStart + ilen);
      return close === -1 ? -1 : close - innerStart;
    };
    let i = 0;
    if (ilen > 1 && inner.charCodeAt(0) === CH_BANG) {
      result.prefix = "!";
      i = 1;
    }
    if (ilen > 1 && inner.charCodeAt(0) === CH_HASH) {
      const nameEnd = this.scanParamName(inner, 1);
      let parameterEnd = nameEnd;
      let indexEnd = -1;
      if (parameterEnd < ilen && inner.charCodeAt(parameterEnd) === CH_LBRACKET) {
        indexEnd = closeBracket(parameterEnd + 1);
        if (indexEnd !== -1)
          parameterEnd = indexEnd + 1;
      }
      if (nameEnd > 1 && parameterEnd === ilen) {
        result.prefix = "#";
        result.parameter = inner.slice(1, nameEnd);
        result.parameterPos = innerStart + 1;
        result.parameterEnd = innerStart + nameEnd;
        if (indexEnd !== -1)
          result.index = sub(nameEnd + 1, indexEnd, "embedded");
        return result;
      }
    }
    const nameStart = i;
    i = this.scanParamName(inner, i);
    result.parameter = inner.slice(nameStart, i);
    result.parameterPos = innerStart + nameStart;
    result.parameterEnd = innerStart + i;
    if (i < ilen && inner.charCodeAt(i) === CH_LBRACKET) {
      const closeB = closeBracket(i + 1);
      if (closeB !== -1) {
        result.index = sub(i + 1, closeB, "embedded");
        i = closeB + 1;
      }
    }
    if (i >= ilen)
      return result;
    const pos = innerStart + i;
    const end = innerStart + ilen;
    const opChar = inner.charCodeAt(i);
    const nextChar = inner.charCodeAt(i + 1);
    const defaultChar = inner[opChar === CH_COLON ? i + 1 : i];
    if (defaultChar === "-" || defaultChar === "=" || defaultChar === "+" || defaultChar === "?") {
      const operandStart = i + (opChar === CH_COLON ? 2 : 1);
      result.operation = {
        type: "Default",
        pos,
        end,
        operatorEnd: innerStart + operandStart,
        operator: opChar === CH_COLON ? `:${defaultChar}` : defaultChar,
        operand: sub(operandStart, ilen, insideDoubleQuotes ? "quoted" : "word")
      };
      return result;
    }
    if (opChar === CH_COLON) {
      i++;
      const sliceStart = innerStart + i;
      const colonIdx = findUnnested(inner.slice(i), CH_COLON, true, (index, quoted) => {
        return this.findNestedShellEnd(sliceStart + index, end, quoted) - sliceStart;
      });
      result.operation = {
        type: "Slice",
        pos,
        end,
        operatorEnd: sliceStart,
        operator: ":",
        offset: sub(i, colonIdx === -1 ? ilen : i + colonIdx, "embedded"),
        length: colonIdx === -1 ? undefined : sub(i + colonIdx + 1, ilen, "embedded")
      };
      return result;
    }
    if (opChar === CH_HASH || opChar === CH_PERCENT) {
      const doubled = nextChar === opChar;
      const operator = opChar === CH_HASH ? doubled ? "##" : "#" : doubled ? "%%" : "%";
      const operandStart = i + (doubled ? 2 : 1);
      result.operation = {
        type: "Remove",
        pos,
        end,
        operatorEnd: innerStart + operandStart,
        operator,
        operand: sub(operandStart, ilen)
      };
      return result;
    }
    if (opChar === CH_SLASH) {
      i++;
      let operator = "/";
      if (nextChar === CH_SLASH || nextChar === CH_HASH || nextChar === CH_PERCENT) {
        operator = nextChar === CH_SLASH ? "//" : nextChar === CH_HASH ? "/#" : "/%";
        i++;
      }
      let separatorStart = i;
      if (nextChar === CH_SLASH) {
        separatorStart = skipLineContinuations(inner, i, ilen);
        if (inner.charCodeAt(separatorStart) === CH_SLASH)
          separatorStart++;
      }
      const sepIdx = findUnnested(inner.slice(separatorStart), CH_SLASH);
      const patternEnd = sepIdx === -1 ? ilen : separatorStart + sepIdx;
      result.operation = {
        type: "Replace",
        pos,
        end,
        operatorEnd: innerStart + i,
        operator,
        pattern: sub(i, patternEnd),
        replacement: sub(sepIdx === -1 ? ilen : patternEnd + 1, ilen)
      };
      return result;
    }
    if (opChar === CH_CARET || opChar === CH_COMMA) {
      const doubled = nextChar === opChar;
      const operator = opChar === CH_CARET ? doubled ? "^^" : "^" : doubled ? ",," : ",";
      const operandStart = i + (doubled ? 2 : 1);
      result.operation = {
        type: "CaseModification",
        pos,
        end,
        operatorEnd: innerStart + operandStart,
        operator,
        operand: operandStart === ilen ? undefined : sub(operandStart, ilen)
      };
      return result;
    }
    if (result.prefix === "!" && result.index === undefined && i + 1 === ilen && (opChar === CH_AT || opChar === CH_STAR)) {
      result.operation = { type: "Names", pos, end, operatorEnd: end, operator: opChar === CH_AT ? "@" : "*" };
      return result;
    }
    if (opChar === CH_AT) {
      result.operation = {
        type: "Transform",
        pos,
        end,
        operatorEnd: pos + 1,
        operator: "@",
        operand: sub(i + 1, ilen)
      };
      return result;
    }
    result.operation = { type: "Unknown", pos, end, operatorEnd: end, operator: inner.slice(i) };
    return result;
  }
  findNestedShellEnd(start, end, quoted) {
    const ch = this.src.charCodeAt(start);
    if (ch === CH_BACKTICK) {
      let pos = start + 1;
      while (pos < end) {
        const current = this.src.charCodeAt(pos);
        if (current === CH_BACKSLASH) {
          pos += 2;
          continue;
        }
        pos++;
        if (current === CH_BACKTICK)
          return pos;
      }
      return end;
    }
    let close;
    if (ch === CH_DOLLAR) {
      const next = start + 1;
      if (next < end && this.src.charCodeAt(next) === CH_LBRACE) {
        close = this.findClosingBrace(next + 1, end);
      } else {
        const open = skipLineContinuations(this.src, next, end);
        if (open >= end || this.src.charCodeAt(open) !== CH_LPAREN)
          return start;
        close = this.findClosingParenthesis(open + 1, end);
      }
    } else {
      const open = start + 1;
      if (quoted || ch !== CH_LT && ch !== CH_GT || open >= end || this.src.charCodeAt(open) !== CH_LPAREN) {
        return start;
      }
      close = this.findClosingParenthesis(open + 1, end);
    }
    return close === -1 ? end : close + 1;
  }
  scanParamName(s, start) {
    let i = start;
    if (i >= s.length)
      return i;
    const c = s.charCodeAt(i);
    if (c === CH_AT || c === CH_STAR || c === CH_HASH || c === CH_QUESTION || c === CH_DASH || c === CH_DOLLAR || c === CH_BANG) {
      return i + 1;
    }
    if (c >= CH_0 && c <= CH_9) {
      while (i < s.length && s.charCodeAt(i) >= CH_0 && s.charCodeAt(i) <= CH_9)
        i++;
      return i;
    }
    if (c >= CH_a && c <= CH_z || c >= CH_A && c <= CH_Z || c === CH_UNDERSCORE) {
      i++;
      while (i < s.length) {
        const ch = s.charCodeAt(i);
        if (ch >= CH_a && ch <= CH_z || ch >= CH_A && ch <= CH_Z || ch >= CH_0 && ch <= CH_9 || ch === CH_UNDERSCORE)
          i++;
        else
          break;
      }
    }
    return i;
  }
  readAnsiCQuoted() {
    const quotePos = this.pos - 1;
    const result = decodeAnsiCQuoted(this.src, this.pos, this.srcEnd);
    this.pos = result.end;
    if (!result.closed)
      this.errors.push({ message: "unterminated ANSI-C quote", pos: quotePos });
    return result.value;
  }
  extractBalanced(useGrammar = true, quoteOnly = false) {
    const src = this.src;
    const len = this.srcEnd;
    const bt = this._buildParts || this._buildValue;
    let depth = quoteOnly ? 0 : 1;
    const start = this.pos;
    this._unbalanced = false;
    const knownEnd = useGrammar && !quoteOnly ? this.substitutionContext.boundaries?.get(start) : undefined;
    if (knownEnd !== undefined && knownEnd <= len && this._nestingDepth < MAX_SYNTAX_NESTING) {
      this.pos = knownEnd;
      return bt ? src.slice(start, knownEnd - 1) : "";
    }
    let wordStart = true;
    while (!quoteOnly && this.pos < len) {
      const c = src.charCodeAt(this.pos);
      if (c === CH_RPAREN) {
        const result = bt ? src.slice(start, this.pos) : "";
        this.pos++;
        return result;
      } else if (c === CH_LPAREN || c === CH_BACKSLASH || c === CH_SQUOTE || c === CH_DQUOTE || c === CH_BACKTICK || c === CH_DOLLAR && (src.charCodeAt(this.pos + 1) === CH_SQUOTE || src.charCodeAt(this.pos + 1) === CH_DOLLAR || src.charCodeAt(this.pos + 1) === CH_LBRACE)) {
        break;
      } else if (c === CH_LT && this.pos + 1 < len && src.charCodeAt(this.pos + 1) === CH_LT) {
        break;
      } else if (c === CH_HASH && wordStart) {
        break;
      } else if (c === 99 && wordStart && this.pos + 3 < len && src.charCodeAt(this.pos + 1) === 97 && src.charCodeAt(this.pos + 2) === 115 && src.charCodeAt(this.pos + 3) === 101 && (this.pos + 4 >= len || src.charCodeAt(this.pos + 4) < 128 && charType[src.charCodeAt(this.pos + 4)] & 1)) {
        break;
      } else {
        wordStart = c < 128 && (charType[c] & 1) !== 0;
        this.pos++;
      }
    }
    let caseDepth = 0;
    let caseParens = 0;
    const wordStartAfterParen = [];
    let pendingDelims = null;
    let scripts;
    let arithBase = -1;
    let arithExtent = start >= 2 && src.charCodeAt(start) === CH_LPAREN && src.charCodeAt(start - 1) === CH_LPAREN && src.charCodeAt(start - 2) === CH_DOLLAR;
    let substitutions = 0;
    let reported = false;
    const quotes = quoteOnly ? [{ close: CH_DQUOTE, depth: 0 }] : [];
    let quotedDepth = quoteOnly ? 1 : 0;
    let parameterDepth = 0;
    let arithmeticOpens;
    let continuedDollarPos = -1;
    let continuedParenPos = -1;
    let escapedEnd = -1;
    let lastParenEnd = -1;
    let checkedGrammar = false;
    while (this.pos < len && (depth > 0 || quotes.length > 0)) {
      let ch = src.charCodeAt(this.pos);
      const quote = quotes.length === 0 ? undefined : quotes[quotes.length - 1];
      if (quote !== undefined && quote.depth === depth) {
        let commandOpen = false;
        if (ch === CH_BACKSLASH) {
          this.pos = Math.min(this.pos + 2, len);
          continue;
        }
        if (ch === quote.close) {
          quotes.pop();
          if (ch === CH_DQUOTE)
            quotedDepth--;
          else
            parameterDepth--;
          this.pos++;
          if (quoteOnly && depth === 0 && quotes.length === 0)
            return "";
          continue;
        }
        if (ch === CH_DQUOTE) {
          quotes.push({ close: CH_DQUOTE, depth });
          quotedDepth++;
        } else if (ch === CH_SQUOTE && quote.close === CH_RBRACE) {
          this.pos++;
          this.skipSQ();
          continue;
        } else if (ch === CH_BACKTICK) {
          this.pos++;
          while (this.pos < len && src.charCodeAt(this.pos) !== CH_BACKTICK) {
            if (src.charCodeAt(this.pos) === CH_BACKSLASH)
              this.pos++;
            if (this.pos < len)
              this.pos++;
          }
          if (this.pos < len)
            this.pos++;
          continue;
        } else if (ch === CH_DOLLAR) {
          const next = src.charCodeAt(this.pos + 1);
          if (next === CH_SQUOTE && quote.close === CH_RBRACE) {
            this.pos += 2;
            this.skipAnsiCQuoted();
            continue;
          }
          if (next === CH_LBRACE) {
            quotes.push({ close: CH_RBRACE, depth });
            parameterDepth++;
            this.pos++;
          } else if (next === CH_LPAREN) {
            this.pos++;
            ch = CH_LPAREN;
            commandOpen = true;
          } else if (next === CH_DOLLAR) {
            this.pos += src.charCodeAt(this.pos + 2) === CH_LPAREN ? 1 : 2;
            continue;
          }
        }
        if (!reported && this._nestingDepth + Math.max(quotedDepth, parameterDepth) > MAX_SYNTAX_NESTING) {
          this.errors.push({ message: "maximum word nesting depth exceeded", pos: this.pos });
          reported = true;
        }
        if (!commandOpen) {
          this.pos++;
          while (this.pos < len) {
            const c = src.charCodeAt(this.pos);
            if (c === CH_BACKSLASH || c === CH_DQUOTE || c === CH_DOLLAR || c === CH_BACKTICK || c === CH_RBRACE || c === CH_SQUOTE)
              break;
            this.pos++;
          }
          continue;
        }
      }
      if (ch === CH_HASH && lastParenEnd !== -1 && !arithExtent && arithBase < 0 && useGrammar && !checkedGrammar && this._nestingDepth + (scripts?.length ?? 0) < MAX_SYNTAX_NESTING && skipBlanks(src, lastParenEnd, len) === this.pos) {
        checkedGrammar = true;
        const scope = scripts?.[scripts.length - 1];
        const end = this.findSubstitutionEnd(scope?.start ?? start, len, this._nestingDepth + (scripts?.length ?? 0) + 1);
        if (end !== -1) {
          if (scope === undefined) {
            this.pos = end;
            return bt ? src.slice(start, end - 1) : "";
          }
          this.pos = end - 1;
          depth = scope.depth + 1;
          caseDepth = 0;
          caseParens = 0;
          wordStartAfterParen.length = scope.parens + 1;
          ch = CH_RPAREN;
        }
      }
      if (ch === CH_LPAREN) {
        const prev = this.pos > start && this.pos !== escapedEnd ? src.charCodeAt(this.pos - 1) : 0;
        const commandDollarPos = prev === CH_DOLLAR ? this.pos - 1 : this.pos === continuedParenPos ? continuedDollarPos : -1;
        const wordParen = commandDollarPos !== -1 || prev === CH_LT || prev === CH_GT || prev === CH_EQ || prev === CH_AT || prev === CH_QUESTION || prev === CH_STAR || prev === CH_PLUS || prev === CH_BANG || prev === CH_LPAREN && wordStartAfterParen[wordStartAfterParen.length - 1] === false || arithExtent && this.pos === start;
        const script = commandDollarPos !== -1 && src.charCodeAt(this.pos + 1) !== CH_LPAREN || (prev === CH_LT || prev === CH_GT) && arithBase < 0 && !arithExtent;
        if (script) {
          (scripts ?? (scripts = [])).push({
            start: this.pos + 1,
            dollar: commandDollarPos,
            depth,
            parens: wordStartAfterParen.length,
            caseDepth,
            caseParens,
            arithBase,
            arithExtent,
            substitutions,
            checkedGrammar,
            pendingDelims
          });
          caseDepth = 0;
          caseParens = 0;
          arithBase = -1;
          arithExtent = false;
          checkedGrammar = false;
          pendingDelims = null;
        }
        wordStartAfterParen.push(!wordParen);
        wordStart = true;
        if (!script && arithBase < 0 && this.pos + 1 < len && src.charCodeAt(this.pos + 1) === CH_LPAREN) {
          arithBase = depth;
        }
        if (commandDollarPos !== -1) {
          if (script)
            substitutions++;
          else
            (arithmeticOpens ?? (arithmeticOpens = [])).push(depth);
          if (substitutions + (arithmeticOpens?.length ?? 0) + this._nestingDepth + (quoteOnly ? 0 : 1) > MAX_SYNTAX_NESTING && !reported) {
            this.errors.push({ message: "maximum command substitution nesting depth exceeded", pos: commandDollarPos });
            reported = true;
          }
        }
        continuedDollarPos = -1;
        continuedParenPos = -1;
        depth++;
        if (caseDepth > 0)
          caseParens++;
        this.pos++;
      } else if (ch === CH_RPAREN) {
        if (caseDepth > 0 && caseParens === 0) {
          this.pos++;
          wordStart = true;
        } else {
          if (caseDepth > 0)
            caseParens--;
          depth--;
          if (depth === 0 && !quoteOnly) {
            const result = bt ? src.slice(start, this.pos) : "";
            this.pos++;
            return result;
          }
          if (depth <= arithBase)
            arithBase = -1;
          if (arithmeticOpens !== undefined) {
            while (arithmeticOpens.length > 0 && arithmeticOpens[arithmeticOpens.length - 1] >= depth)
              arithmeticOpens.pop();
          }
          wordStart = wordStartAfterParen.pop() ?? true;
          this.pos++;
          const scope = scripts?.[scripts.length - 1];
          if (scope !== undefined && scope.depth === depth) {
            scripts.pop();
            caseDepth = scope.caseDepth;
            caseParens = scope.caseParens;
            arithBase = scope.arithBase;
            arithExtent = scope.arithExtent;
            substitutions = scope.substitutions;
            checkedGrammar = scope.checkedGrammar;
            pendingDelims = scope.pendingDelims;
          }
        }
        lastParenEnd = this.pos;
      } else if (ch === CH_BACKSLASH) {
        if (this.pos > start && src.charCodeAt(this.pos - 1) === CH_DOLLAR) {
          const logicalPos = skipLineContinuations(src, this.pos, len);
          if (logicalPos > this.pos && src.charCodeAt(logicalPos) === CH_LPAREN && src.charCodeAt(logicalPos + 1) !== CH_LPAREN) {
            continuedDollarPos = this.pos - 1;
            continuedParenPos = logicalPos;
          }
        }
        this.pos++;
        if (this.pos < len) {
          if (src.charCodeAt(this.pos) !== CH_NL) {
            wordStart = false;
          }
          this.pos++;
        }
        escapedEnd = this.pos;
      } else if (ch === CH_DOLLAR) {
        const next = src.charCodeAt(++this.pos);
        if (next === CH_SQUOTE) {
          this.pos++;
          this.skipAnsiCQuoted();
        } else if (next === CH_DOLLAR) {
          this.pos++;
        } else if (next === CH_LBRACE && !isBraceCommandOpener(src.charCodeAt(this.pos + 1))) {
          quotes.push({ close: CH_RBRACE, depth });
          parameterDepth++;
          this.pos++;
        }
        wordStart = false;
      } else if (ch === CH_SQUOTE) {
        this.pos++;
        this.skipSQ();
        wordStart = false;
      } else if (ch === CH_DQUOTE) {
        quotes.push({ close: CH_DQUOTE, depth });
        quotedDepth++;
        this.pos++;
        wordStart = false;
      } else if (ch === CH_BACKTICK) {
        this.pos++;
        while (this.pos < len && src.charCodeAt(this.pos) !== CH_BACKTICK) {
          if (src.charCodeAt(this.pos) === CH_BACKSLASH)
            this.pos++;
          if (this.pos < len)
            this.pos++;
        }
        if (this.pos < len)
          this.pos++;
        wordStart = false;
      } else if (ch === CH_LT && arithBase < 0 && this.pos + 1 < len && src.charCodeAt(this.pos + 1) === CH_LT) {
        if (this.pos + 2 < len && src.charCodeAt(this.pos + 2) === CH_LT) {
          this.pos += 3;
        } else {
          this.pos += 2;
          const strip = this.pos < len && src.charCodeAt(this.pos) === CH_DASH;
          if (strip)
            this.pos++;
          this.skipSpacesAndTabs();
          this.readHereDocDelimiter();
          if (this._hereDelim || this._hereQuoted) {
            (pendingDelims ?? (pendingDelims = [])).push({
              delimiter: this._hereDelim,
              strip,
              quoted: this._hereQuoted
            });
          }
        }
        wordStart = false;
      } else if (ch === CH_NL && pendingDelims) {
        this.pos++;
        for (const hd of pendingDelims)
          this.skipHereDocBody(hd.delimiter, hd.strip, true, hd.quoted);
        pendingDelims = null;
        wordStart = true;
      } else if (ch === CH_HASH && arithBase < 0 && !arithExtent && wordStart) {
        while (this.pos < len && src.charCodeAt(this.pos) !== CH_NL)
          this.pos++;
      } else {
        const wStart = this.pos;
        while (this.pos < len) {
          const wc = src.charCodeAt(this.pos);
          if (wc < 128 && charType[wc])
            break;
          this.pos++;
        }
        if (this.pos > wStart) {
          const wLen = this.pos - wStart;
          if (wLen === 4 && wordStart && arithBase < 0 && !arithExtent) {
            const c0 = src.charCodeAt(wStart);
            if (c0 === 99 && src.charCodeAt(wStart + 1) === 97 && src.charCodeAt(wStart + 2) === 115 && src.charCodeAt(wStart + 3) === 101) {
              caseDepth++;
            } else if (c0 === 101 && src.charCodeAt(wStart + 1) === 115 && src.charCodeAt(wStart + 2) === 97 && src.charCodeAt(wStart + 3) === 99 && caseDepth > 0) {
              caseDepth--;
              if (caseDepth === 0)
                caseParens = 0;
            }
          }
          wordStart = false;
        } else {
          const wc = src.charCodeAt(this.pos);
          wordStart = wc < 128 && (charType[wc] & 1) !== 0;
          this.pos++;
        }
      }
    }
    this._unbalanced = true;
    if (quoteOnly && scripts !== undefined && scripts.length > 0) {
      this.errors.push({ message: "unterminated command substitution", pos: scripts[0].dollar });
    }
    return bt ? src.slice(start, this.pos) : "";
  }
}

// node_modules/unbash/dist/arithmetic.js
function opPrec(op) {
  switch (op) {
    case ",":
      return 1;
    case "=":
    case "+=":
    case "-=":
    case "*=":
    case "/=":
    case "%=":
    case "<<=":
    case ">>=":
    case "&=":
    case "|=":
    case "^=":
      return 2;
    case "||":
      return 4;
    case "&&":
      return 5;
    case "|":
      return 6;
    case "^":
      return 7;
    case "&":
      return 8;
    case "==":
    case "!=":
      return 9;
    case "<":
    case "<=":
    case ">":
    case ">=":
      return 10;
    case "<<":
    case ">>":
      return 11;
    case "+":
    case "-":
      return 12;
    case "*":
    case "/":
    case "%":
      return 13;
    case "**":
      return 14;
    case "?":
      return 3;
    default:
      return -1;
  }
}
function trimEnd(src, start, end) {
  while (end > start) {
    const c = src.charCodeAt(end - 1);
    if (c !== CH_SPACE && c !== CH_TAB && c !== CH_NL)
      break;
    end--;
  }
  return end;
}
function opRightAssoc(op) {
  switch (op) {
    case "=":
    case "+=":
    case "-=":
    case "*=":
    case "/=":
    case "%=":
    case "<<=":
    case ">>=":
    case "&=":
    case "|=":
    case "^=":
    case "**":
      return true;
    default:
      return false;
  }
}
function parseArithmeticExpression(src, offset = 0, collector, nestingDepth = 0) {
  let pos = 0;
  const len = src.length;
  const initialWordCount = collector?.embeddedWords.length ?? 0;
  function makeWord(start, end, embedded = false) {
    const node = {
      type: "ArithmeticWord",
      pos: start + offset,
      end: end + offset,
      value: src.slice(start, end),
      parts: undefined
    };
    if (embedded)
      collector?.embeddedWords.push(node);
    return node;
  }
  function skipWS() {
    while (pos < len) {
      const c = src.charCodeAt(pos);
      if (c === CH_SPACE || c === CH_TAB || c === CH_NL)
        pos++;
      else
        break;
    }
  }
  function tryReadBinOp() {
    if (pos >= len)
      return null;
    const c = src.charCodeAt(pos);
    const nc = pos + 1 < len ? src.charCodeAt(pos + 1) : 0;
    const nnc = pos + 2 < len ? src.charCodeAt(pos + 2) : 0;
    switch (c) {
      case CH_COMMA:
        pos++;
        return ",";
      case CH_EQ:
        if (nc === CH_EQ) {
          pos += 2;
          return "==";
        }
        pos++;
        return "=";
      case CH_BANG:
        if (nc === CH_EQ) {
          pos += 2;
          return "!=";
        }
        return null;
      case CH_LT:
        if (nc === CH_LT) {
          if (nnc === CH_EQ) {
            pos += 3;
            return "<<=";
          }
          pos += 2;
          return "<<";
        }
        if (nc === CH_EQ) {
          pos += 2;
          return "<=";
        }
        pos++;
        return "<";
      case CH_GT:
        if (nc === CH_GT) {
          if (nnc === CH_EQ) {
            pos += 3;
            return ">>=";
          }
          pos += 2;
          return ">>";
        }
        if (nc === CH_EQ) {
          pos += 2;
          return ">=";
        }
        pos++;
        return ">";
      case CH_PLUS:
        if (nc === CH_EQ) {
          pos += 2;
          return "+=";
        }
        if (nc === CH_PLUS)
          return null;
        pos++;
        return "+";
      case CH_DASH:
        if (nc === CH_EQ) {
          pos += 2;
          return "-=";
        }
        if (nc === CH_DASH)
          return null;
        pos++;
        return "-";
      case CH_STAR:
        if (nc === CH_STAR) {
          pos += 2;
          return "**";
        }
        if (nc === CH_EQ) {
          pos += 2;
          return "*=";
        }
        pos++;
        return "*";
      case CH_SLASH:
        if (nc === CH_EQ) {
          pos += 2;
          return "/=";
        }
        pos++;
        return "/";
      case CH_PERCENT:
        if (nc === CH_EQ) {
          pos += 2;
          return "%=";
        }
        pos++;
        return "%";
      case CH_PIPE:
        if (nc === CH_PIPE) {
          pos += 2;
          return "||";
        }
        if (nc === CH_EQ) {
          pos += 2;
          return "|=";
        }
        pos++;
        return "|";
      case CH_AMP:
        if (nc === CH_AMP) {
          pos += 2;
          return "&&";
        }
        if (nc === CH_EQ) {
          pos += 2;
          return "&=";
        }
        pos++;
        return "&";
      case CH_CARET:
        if (nc === CH_EQ) {
          pos += 2;
          return "^=";
        }
        pos++;
        return "^";
      case CH_QUESTION:
        pos++;
        return "?";
      default:
        return null;
    }
  }
  function skipTruncatedUnary() {
    skipWS();
    while (pos < len) {
      const c = src.charCodeAt(pos);
      if (c !== CH_BANG && c !== CH_TILDE && c !== CH_PLUS && c !== CH_DASH)
        break;
      if (src.charCodeAt(pos + 1) === CH_EQ)
        break;
      pos++;
      skipWS();
    }
    if (src.charCodeAt(pos) === CH_LPAREN) {
      let groups = 1;
      pos++;
      while (pos < len && groups > 0) {
        const wordEnd = collector?.findArithmeticWordEnd?.(pos + offset, offset + len) ?? pos + offset;
        if (wordEnd > pos + offset) {
          pos = wordEnd - offset;
          continue;
        }
        const c = src.charCodeAt(pos++);
        if (c === CH_LPAREN)
          groups++;
        else if (c === CH_RPAREN)
          groups--;
      }
    } else if (pos < len && src.charCodeAt(pos) !== CH_RPAREN && src.charCodeAt(pos) !== CH_COLON) {
      parseAtom(0);
    }
    skipWS();
    const c = src.charCodeAt(pos);
    if ((c === CH_PLUS || c === CH_DASH) && src.charCodeAt(pos + 1) === c)
      pos += 2;
  }
  function recoverExpression(minPrec) {
    skipWS();
    const start = pos;
    if (start === len)
      return makeWord(start, start);
    const wordCount = collector?.embeddedWords.length ?? 0;
    let ternaries = 0;
    for (;; ) {
      skipTruncatedUnary();
      skipWS();
      if (src.charCodeAt(pos) === CH_COLON && ternaries > 0) {
        ternaries--;
        pos++;
        continue;
      }
      const saved = pos;
      const op = tryReadBinOp();
      if (op === null || ternaries === 0 && opPrec(op) < minPrec) {
        pos = saved;
        break;
      }
      if (op === "?")
        ternaries++;
    }
    if (collector)
      collector.embeddedWords.length = wordCount;
    return makeWord(start, trimEnd(src, start, pos));
  }
  function parseBinExpr(minPrec, depth) {
    if (depth > MAX_SYNTAX_NESTING)
      return recoverExpression(minPrec);
    let left = parseUnaryExpr(depth);
    while (true) {
      skipWS();
      if (pos >= len)
        break;
      const saved = pos;
      const op = tryReadBinOp();
      if (!op)
        break;
      if (op === "?") {
        if (opPrec(op) < minPrec) {
          pos = saved;
          break;
        }
        const consequent = parseBinExpr(1, depth + 1);
        skipWS();
        if (pos < len && src.charCodeAt(pos) === CH_COLON)
          pos++;
        const alternate = parseBinExpr(3, depth + 1);
        left = { type: "ArithmeticTernary", pos: left.pos, end: alternate.end, test: left, consequent, alternate };
        continue;
      }
      const prec = opPrec(op);
      if (prec < minPrec) {
        pos = saved;
        break;
      }
      const nextPrec = opRightAssoc(op) ? prec : prec + 1;
      const right = parseBinExpr(nextPrec, depth + 1);
      left = { type: "ArithmeticBinary", pos: left.pos, end: right.end, operator: op, left, right };
    }
    return left;
  }
  function parseUnaryExpr(depth) {
    skipWS();
    if (depth > MAX_SYNTAX_NESTING)
      return recoverExpression(15);
    if (pos >= len)
      return makeWord(pos, pos);
    const start = pos;
    const c = src.charCodeAt(pos);
    const nc = pos + 1 < len ? src.charCodeAt(pos + 1) : 0;
    if (c === CH_PLUS && nc === CH_PLUS) {
      pos += 2;
      const operand = parseUnaryExpr(depth + 1);
      return { type: "ArithmeticUnary", pos: start + offset, end: operand.end, operator: "++", operand, prefix: true };
    }
    if (c === CH_DASH && nc === CH_DASH) {
      pos += 2;
      const operand = parseUnaryExpr(depth + 1);
      return { type: "ArithmeticUnary", pos: start + offset, end: operand.end, operator: "--", operand, prefix: true };
    }
    if (c === CH_BANG) {
      pos++;
      const operand = parseUnaryExpr(depth + 1);
      return { type: "ArithmeticUnary", pos: start + offset, end: operand.end, operator: "!", operand, prefix: true };
    }
    if (c === CH_TILDE) {
      pos++;
      const operand = parseUnaryExpr(depth + 1);
      return { type: "ArithmeticUnary", pos: start + offset, end: operand.end, operator: "~", operand, prefix: true };
    }
    if (c === CH_PLUS && nc !== CH_PLUS && nc !== CH_EQ) {
      pos++;
      const operand = parseUnaryExpr(depth + 1);
      return { type: "ArithmeticUnary", pos: start + offset, end: operand.end, operator: "+", operand, prefix: true };
    }
    if (c === CH_DASH && nc !== CH_DASH && nc !== CH_EQ) {
      pos++;
      const operand = parseUnaryExpr(depth + 1);
      return { type: "ArithmeticUnary", pos: start + offset, end: operand.end, operator: "-", operand, prefix: true };
    }
    return parsePostfixExpr(depth);
  }
  function parsePostfixExpr(depth) {
    const operand = parseAtom(depth);
    skipWS();
    if (pos + 1 < len) {
      const c = src.charCodeAt(pos);
      const nc = src.charCodeAt(pos + 1);
      if (c === CH_PLUS && nc === CH_PLUS) {
        pos += 2;
        return { type: "ArithmeticUnary", pos: operand.pos, end: pos + offset, operator: "++", operand, prefix: false };
      }
      if (c === CH_DASH && nc === CH_DASH) {
        pos += 2;
        return { type: "ArithmeticUnary", pos: operand.pos, end: pos + offset, operator: "--", operand, prefix: false };
      }
    }
    return operand;
  }
  function parseAtom(depth) {
    skipWS();
    if (pos >= len)
      return makeWord(pos, pos);
    const c = src.charCodeAt(pos);
    if (c === CH_LPAREN) {
      const start = pos;
      pos++;
      const expr = parseBinExpr(0, depth + 1);
      skipWS();
      if (pos < len && src.charCodeAt(pos) === CH_RPAREN)
        pos++;
      return { type: "ArithmeticGroup", pos: start + offset, end: pos + offset, expression: expr };
    }
    if (c === CH_DOLLAR) {
      const start = pos;
      const wordCount = collector?.embeddedWords.length ?? 0;
      const atom = readDollarAtom();
      const wordEnd = collector?.findArithmeticWordEnd?.(start + offset, offset + len) ?? pos + offset;
      if (wordEnd > pos + offset) {
        if (collector)
          collector.embeddedWords.length = wordCount;
        pos = wordEnd - offset;
        return makeWord(start, pos, true);
      }
      return atom;
    }
    if (c === 96 || c === 34 || c === 39) {
      const start = pos;
      pos = (collector?.findArithmeticWordEnd?.(start + offset, offset + len) ?? start + offset + 1) - offset;
      return makeWord(start, pos, true);
    }
    const start = pos;
    const wordCount = collector?.embeddedWords.length ?? 0;
    const atom = readWordAtom();
    const wordEnd = collector?.findArithmeticWordEnd?.(start + offset, offset + len) ?? pos + offset;
    if (wordEnd > pos + offset) {
      if (collector)
        collector.embeddedWords.length = wordCount;
      pos = wordEnd - offset;
      return makeWord(start, pos, true);
    }
    return atom;
  }
  function readDollarAtom() {
    const start = pos;
    pos++;
    if (pos >= len)
      return makeWord(start, pos);
    const c = src.charCodeAt(pos);
    if (c === CH_LPAREN) {
      if (pos + 1 < len && src.charCodeAt(pos + 1) === CH_LPAREN) {
        const expansionEnd = collector?.findArithmeticExpansionEnd(start + offset, offset + len) ?? -1;
        if (expansionEnd !== -1) {
          pos = expansionEnd - offset;
        } else {
          pos += 2;
          let depth = 1;
          while (pos < len && depth > 0) {
            if (src.charCodeAt(pos) === CH_LPAREN && src.charCodeAt(pos + 1) === CH_LPAREN) {
              depth++;
              pos += 2;
            } else if (src.charCodeAt(pos) === CH_RPAREN && src.charCodeAt(pos + 1) === CH_RPAREN) {
              depth--;
              pos += 2;
            } else {
              pos++;
            }
          }
        }
      } else {
        pos++;
        const close = collector?.findClosingParenthesis(pos + offset, offset + len) ?? -1;
        if (close !== -1) {
          pos = close - offset + 1;
        } else {
          let depth = 1;
          while (pos < len && depth > 0) {
            const ch = src.charCodeAt(pos++);
            if (ch === CH_LPAREN)
              depth++;
            else if (ch === CH_RPAREN)
              depth--;
          }
        }
        const text = src.slice(start, pos);
        return collector ? collector.commandExpansion(start + offset, pos + offset, text) : new ScriptExpansionImpl("ArithmeticCommandExpansion", start + offset, pos + offset, text);
      }
    } else if (c === CH_LBRACE) {
      const close = collector?.findClosingBrace(pos + offset + 1, offset + len) ?? -1;
      if (close !== -1) {
        pos = close - offset + 1;
      } else {
        pos++;
        let depth = 1;
        while (pos < len && depth > 0) {
          const ch = src.charCodeAt(pos++);
          if (ch === CH_LBRACE)
            depth++;
          else if (ch === CH_RBRACE)
            depth--;
        }
      }
    } else {
      while (pos < len) {
        const ch = src.charCodeAt(pos);
        if (ch >= CH_a && ch <= CH_z || ch >= CH_A && ch <= CH_Z || ch >= CH_0 && ch <= CH_9 || ch === CH_UNDERSCORE)
          pos++;
        else
          break;
      }
    }
    return makeWord(start, pos, c === CH_LPAREN || c === CH_LBRACE);
  }
  function readWordAtom() {
    const start = pos;
    while (pos < len) {
      const c = src.charCodeAt(pos);
      if (c >= CH_0 && c <= CH_9 || c >= CH_A && c <= CH_Z || c >= CH_a && c <= CH_z || c === CH_UNDERSCORE || c === 35) {
        pos++;
      } else
        break;
    }
    if (pos > start && pos < len && src.charCodeAt(pos) === CH_LBRACKET) {
      const close = collector?.findClosingBracket?.(pos + offset + 1, offset + len) ?? -1;
      if (close !== -1) {
        pos = close - offset + 1;
      } else {
        pos++;
        let depth = 1;
        while (pos < len && depth > 0) {
          const c = src.charCodeAt(pos);
          if (c === CH_LBRACKET)
            depth++;
          else if (c === CH_RBRACKET)
            depth--;
          pos++;
        }
      }
      return makeWord(start, pos, true);
    }
    if (pos === start) {
      pos++;
      return makeWord(start, pos);
    }
    return makeWord(start, pos);
  }
  skipWS();
  if (pos >= len)
    return null;
  const start = pos;
  const result = parseBinExpr(0, nestingDepth);
  skipWS();
  if (pos < len) {
    if (collector)
      collector.embeddedWords.length = initialWordCount;
    return makeWord(start, trimEnd(src, start, len), collector !== undefined);
  }
  return result;
}

// node_modules/unbash/dist/parts.js
var computeBareWordParts = (_source, word) => hasGlobCharacters(word.text) ? parseGlobParts(word.text, 0, word.text.length, undefined, word.pos) : undefined;
function wordPartsResolver(context) {
  return context.wordParts ?? (context.wordParts = (source, word, depth) => computeWordParts(source, word, depth, context));
}
function embeddedPartsResolver(context) {
  return context.embeddedParts ?? (context.embeddedParts = (source, word, depth) => computeEmbeddedWordParts(source, word, depth, context));
}
function arrayPartsResolver(context) {
  return context.arrayParts ?? (context.arrayParts = (source, word, depth) => computeArrayElementParts(source, word, depth, context));
}
function computeWordParts(source, word, depth = 0, context = createSubstitutionContext()) {
  const lexer = new Lexer(source, word.pos, word.end, false, context);
  lexer._nestingDepth = depth;
  const parts = lexer.buildWordParts(word.pos);
  return parts ?? undefined;
}
function computeEmbeddedWordParts(source, word, depth = 0, context, arithmetic = false) {
  if (!hasEmbeddedWordStructure(source, word.pos, word.end))
    return;
  const lexer = new Lexer(source, word.pos, word.end, false, context);
  lexer._nestingDepth = depth;
  const parts = lexer.buildEmbeddedWordParts(word.pos, arithmetic);
  return parts ?? undefined;
}
function computeArrayElementParts(source, word, depth = 0, context) {
  const lexer = new Lexer(source, word.pos, word.end, false, context);
  lexer._nestingDepth = depth;
  const parts = lexer.buildArrayElementParts(word.pos);
  return parts ?? undefined;
}
function computeHereDocBodyParts(source, word, depth = 0, context) {
  const lexer = new Lexer(source, word.pos, word.end, false, context);
  lexer._nestingDepth = depth;
  const parts = lexer.buildHereDocParts(word.pos, word.end);
  return parts ?? undefined;
}

// node_modules/unbash/dist/arithmetic-parts.js
function parseArithmeticWithParts(body, offset, source, depth, context, embeddedDepth = depth) {
  if (!hasEmbeddedWordStructure(source, offset, offset + body.length)) {
    return parseArithmeticExpression(body, offset, undefined, depth) ?? undefined;
  }
  const embeddedWords = [];
  const lexer = new Lexer(source, 0, source.length, false, context);
  lexer._nestingDepth = depth;
  const expression = parseArithmeticExpression(body, offset, {
    embeddedWords,
    commandExpansion: (pos, end, text) => new ScriptExpansionImpl("ArithmeticCommandExpansion", pos, end, text, {
      source,
      start: pos + 2,
      end: end - 1,
      depth: depth + 1,
      parenBoundary: true,
      context
    }),
    findClosingBracket: (start, end) => lexer.findClosingBracket(start, end),
    findClosingBrace: (start, end) => lexer.findClosingBrace(start, end),
    findClosingParenthesis: (start, end) => lexer.findClosingParenthesis(start, end),
    findArithmeticExpansionEnd: (start, end) => lexer.findArithmeticExpansionEnd(start, end),
    findArithmeticWordEnd: (start, end) => lexer.findArithmeticWordEnd(start, end)
  }, depth) ?? undefined;
  if (embeddedDepth <= MAX_SYNTAX_NESTING) {
    for (const node of embeddedWords)
      node.parts = computeEmbeddedWordParts(source, node, embeddedDepth, context, true);
  }
  return expression;
}

// node_modules/unbash/dist/assignment.js
class ArrayValueImpl {
  type = "ArrayValue";
  pos;
  end;
  #source;
  #depth;
  #context;
  #elements;
  constructor(source, pos, end, depth, context) {
    this.pos = pos;
    this.end = end;
    this.#source = source;
    this.#depth = depth;
    this.#context = context;
  }
  get elements() {
    if (this.#elements)
      return this.#elements;
    const lexer = new Lexer(this.#source, this.pos + 1, this.end - 1, false, this.#context);
    lexer._nestingDepth = this.#depth;
    const elements = [];
    while (lexer.peek(LexContext.ArrayElement).token !== Token.EOF) {
      const token = lexer.next(LexContext.ArrayElement);
      if (token.token !== Token.Word && token.token !== Token.Assignment)
        continue;
      const text = token.raw ? token.value : this.#source.slice(token.pos, token.end);
      const indexed = text.charCodeAt(0) === 91;
      const context = lexer.getSubstitutionContext();
      const source = !indexed && token.raw && token.keywordEligible ? undefined : this.#source;
      const resolver = source === undefined ? computeBareWordParts : indexed ? arrayPartsResolver(context) : wordPartsResolver(context);
      elements.push(new WordImpl(text, token.pos, token.end, source, resolver, this.#depth));
    }
    this.#elements = elements;
    return elements;
  }
  toJSON() {
    return { type: this.type, pos: this.pos, end: this.end, elements: this.elements };
  }
}

class AssignmentImpl {
  type = "Assignment";
  pos;
  end;
  text;
  #source;
  #depth;
  #context;
  #operatorPos;
  #name = null;
  #append;
  #index;
  #value = null;
  constructor(text, pos, end, source, operatorPos, depth, context) {
    this.pos = pos;
    this.end = end;
    this.text = text;
    this.#source = source;
    this.#operatorPos = operatorPos;
    this.#depth = depth;
    this.#context = context;
  }
  get name() {
    return this.#name ?? this.resolveTarget();
  }
  get append() {
    if (this.#name === null)
      this.resolveTarget();
    return this.#append;
  }
  get index() {
    if (this.#name === null)
      this.resolveTarget();
    return this.#index;
  }
  get value() {
    if (this.#value !== null)
      return this.#value;
    const start = this.#operatorPos + 1;
    const arrayStart = skipLineContinuations(this.#source, start, this.end);
    this.#value = this.#source.charCodeAt(arrayStart) === 40 && this.#source.charCodeAt(this.end - 1) === 41 ? new ArrayValueImpl(this.#source, arrayStart, this.end, this.#depth, this.#context) : new WordImpl(this.#source.slice(start, this.end), start, this.end, this.#source, wordPartsResolver(this.#context), this.#depth);
    return this.#value;
  }
  resolveTarget() {
    const equal = this.#operatorPos - this.pos;
    let nameEnd = equal;
    let appendPos = equal;
    while (appendPos >= 2 && this.text.charCodeAt(appendPos - 2) === 92 && this.text.charCodeAt(appendPos - 1) === 10)
      appendPos -= 2;
    if (this.text.charCodeAt(appendPos - 1) === 43) {
      this.#append = true;
      nameEnd = appendPos - 1;
    }
    const bracket = this.text.indexOf("[");
    if (bracket > 0 && bracket < nameEnd) {
      const close = this.text.lastIndexOf("]", equal);
      if (close > bracket) {
        const start = this.pos + bracket + 1;
        const end = this.pos + close;
        this.#index = new WordImpl(this.#source.slice(start, end), start, end, this.#source, embeddedPartsResolver(this.#context), this.#depth);
        nameEnd = bracket;
      }
    }
    const name = this.text.slice(0, nameEnd);
    return this.#name = name.includes("\\\n") ? name.split("\\\n").join("") : name;
  }
  toJSON() {
    return {
      type: this.type,
      pos: this.pos,
      end: this.end,
      text: this.text,
      name: this.name,
      append: this.append,
      index: this.index,
      value: this.value
    };
  }
}

// node_modules/unbash/dist/command.js
var isArgument = (item) => item.type === "Word" || item.type === "Assignment";

class CommandImpl {
  type = "Command";
  pos;
  end;
  name;
  prefix;
  suffix;
  #args;
  #redirects;
  constructor(pos, end, name, prefix, suffix) {
    this.pos = pos;
    this.end = end;
    this.name = name;
    this.prefix = prefix;
    this.suffix = suffix;
  }
  get args() {
    if (this.#args === undefined) {
      const suffix = this.suffix;
      this.#args = suffix.every(isArgument) ? suffix : suffix.filter(isArgument);
    }
    return this.#args;
  }
  get redirects() {
    if (this.#redirects === undefined) {
      const redirects = [];
      for (const item of this.prefix)
        if (item.type !== "Assignment")
          redirects.push(item);
      for (const item of this.suffix)
        if (!isArgument(item))
          redirects.push(item);
      this.#redirects = redirects;
    }
    return this.#redirects;
  }
  toJSON() {
    return { type: this.type, pos: this.pos, end: this.end, name: this.name, prefix: this.prefix, suffix: this.suffix };
  }
}

// node_modules/unbash/dist/heredoc.js
class HereDocBodyImpl {
  type = "HereDocBody";
  pos;
  end;
  text = "";
  #source;
  #depth;
  #context;
  #parts;
  constructor(source, pos, quoted, depth, context) {
    this.pos = pos;
    this.end = pos;
    this.#source = source;
    this.#depth = depth;
    this.#context = context;
    this.#parts = quoted ? undefined : null;
  }
  get parts() {
    if (this.#parts === null)
      this.#parts = computeHereDocBodyParts(this.#source, this, this.#depth, this.#context);
    return this.#parts;
  }
  toJSON() {
    return { type: this.type, pos: this.pos, end: this.end, text: this.text, parts: this.parts };
  }
}

// node_modules/unbash/dist/parser.js
Lexer._findSubstitutionEnd = findSubstitutionEnd;
ScriptExpansionImpl._resolveScript = parseRegion;
ArithmeticExpansionImpl._resolveExpression = parseArithmeticWithParts;
function isDeclarationCommand(name) {
  switch (name.length) {
    case 5:
      return name === "local" || name === "alias";
    case 6:
      return name === "export";
    case 7:
      return name === "declare" || name === "typeset";
    case 8:
      return name === "readonly";
    default:
      return false;
  }
}

class ArithmeticCommandImpl {
  type = "ArithmeticCommand";
  pos;
  end;
  body;
  #source;
  #depth;
  #context;
  #expression = null;
  constructor(pos, end, body, source, depth, context) {
    this.pos = pos;
    this.end = end;
    this.body = body;
    this.#source = source;
    this.#depth = depth;
    this.#context = context;
  }
  get expression() {
    if (this.#expression === null) {
      this.#expression = parseArithmeticWithParts(this.body, this.pos + 2, this.#source, this.#depth, this.#context);
    }
    return this.#expression;
  }
  set expression(v) {
    this.#expression = v ?? undefined;
  }
  toJSON() {
    return {
      type: this.type,
      pos: this.pos,
      end: this.end,
      expression: this.expression,
      body: this.body
    };
  }
}

class ArithmeticForImpl {
  type = "ArithmeticFor";
  pos;
  end;
  body;
  #initStr;
  #testStr;
  #updateStr;
  #initPos;
  #testPos;
  #updatePos;
  #source;
  #depth;
  #context;
  #initialize = null;
  #test = null;
  #update = null;
  constructor(pos, end, body, initStr, testStr, updateStr, initPos, testPos, updatePos, source, depth, context) {
    this.pos = pos;
    this.end = end;
    this.body = body;
    this.#initStr = initStr;
    this.#testStr = testStr;
    this.#updateStr = updateStr;
    this.#initPos = initPos;
    this.#testPos = testPos;
    this.#updatePos = updatePos;
    this.#source = source;
    this.#depth = depth;
    this.#context = context;
  }
  get initialize() {
    if (this.#initialize === null) {
      if (this.#initStr) {
        this.#initialize = parseArithmeticWithParts(this.#initStr, this.#initPos, this.#source, this.#depth, this.#context);
      } else {
        this.#initialize = undefined;
      }
    }
    return this.#initialize;
  }
  set initialize(v) {
    this.#initialize = v ?? undefined;
  }
  get test() {
    if (this.#test === null) {
      if (this.#testStr) {
        this.#test = parseArithmeticWithParts(this.#testStr, this.#testPos, this.#source, this.#depth, this.#context);
      } else {
        this.#test = undefined;
      }
    }
    return this.#test;
  }
  set test(v) {
    this.#test = v ?? undefined;
  }
  get update() {
    if (this.#update === null) {
      if (this.#updateStr) {
        this.#update = parseArithmeticWithParts(this.#updateStr, this.#updatePos, this.#source, this.#depth, this.#context);
      } else {
        this.#update = undefined;
      }
    }
    return this.#update;
  }
  set update(v) {
    this.#update = v ?? undefined;
  }
  toJSON() {
    return {
      type: this.type,
      pos: this.pos,
      end: this.end,
      initialize: this.initialize,
      test: this.test,
      update: this.update,
      body: this.body
    };
  }
}
var CASE_TERMINATORS = {
  [Token.DoubleSemi]: ";;",
  [Token.SemiAmp]: ";&",
  [Token.DoubleSemiAmp]: ";;&"
};
var REDIRECT_OPS = {
  ">": ">",
  ">>": ">>",
  "<": "<",
  "<>": "<>",
  "<&": "<&",
  ">&": ">&",
  ">|": ">|",
  "&>": "&>",
  "&>>": "&>>"
};
var listTerminators = new Uint8Array(37);
listTerminators[Token.EOF] = 1;
listTerminators[Token.RParen] = 1;
listTerminators[Token.RBrace] = 1;
listTerminators[Token.Then] = 1;
listTerminators[Token.Else] = 1;
listTerminators[Token.Elif] = 1;
listTerminators[Token.Fi] = 1;
listTerminators[Token.Do] = 1;
listTerminators[Token.Done] = 1;
listTerminators[Token.Esac] = 1;
listTerminators[Token.DoubleSemi] = 1;
listTerminators[Token.SemiAmp] = 1;
listTerminators[Token.DoubleSemiAmp] = 1;
var compoundClosers = new Uint8Array(37);
compoundClosers[Token.RParen] = 1;
compoundClosers[Token.RBrace] = 1;
compoundClosers[Token.DblRBracket] = 1;
compoundClosers[Token.Fi] = 1;
compoundClosers[Token.Done] = 1;
compoundClosers[Token.Esac] = 1;
compoundClosers[Token.ArithCmd] = 1;
function isTestNegation(t) {
  return t.token === Token.Word && t.keywordEligible && t.value === "!";
}
var commandStarts = new Uint8Array(37);
commandStarts[Token.Word] = 1;
commandStarts[Token.Assignment] = 1;
commandStarts[Token.Bang] = 1;
commandStarts[Token.LParen] = 1;
commandStarts[Token.LBrace] = 1;
commandStarts[Token.DblLBracket] = 1;
commandStarts[Token.If] = 1;
commandStarts[Token.For] = 1;
commandStarts[Token.While] = 1;
commandStarts[Token.Until] = 1;
commandStarts[Token.Case] = 1;
commandStarts[Token.Function] = 1;
commandStarts[Token.Select] = 1;
commandStarts[Token.ArithCmd] = 1;
commandStarts[Token.Coproc] = 1;
commandStarts[Token.Redirect] = 1;
var UNARY_TEST_OPS = {
  "-a": 1,
  "-b": 1,
  "-c": 1,
  "-d": 1,
  "-e": 1,
  "-f": 1,
  "-g": 1,
  "-h": 1,
  "-k": 1,
  "-p": 1,
  "-r": 1,
  "-s": 1,
  "-t": 1,
  "-u": 1,
  "-v": 1,
  "-w": 1,
  "-x": 1,
  "-z": 1,
  "-n": 1,
  "-o": 1,
  "-N": 1,
  "-S": 1,
  "-L": 1,
  "-G": 1,
  "-O": 1,
  "-R": 1
};
var BINARY_TEST_OPS = {
  "==": 1,
  "!=": 1,
  "=~": 1,
  "=": 1,
  "-eq": 1,
  "-ne": 1,
  "-lt": 1,
  "-le": 1,
  "-gt": 1,
  "-ge": 1,
  "-nt": 1,
  "-ot": 1,
  "-ef": 1,
  "<": 1,
  ">": 1
};
var EMPTY_REDIRECTS = [];
var EMPTY_PREFIXES = [];
var EMPTY_ELIFS = [];
function parse(source) {
  return new Parser(source, 0, source.length).run();
}
function parseRegion(source, start, end, depth = 0, parenBoundary = false, context) {
  return new Parser(source, start, end, depth, parenBoundary, undefined, context).run();
}

class SubstitutionLexer extends Lexer {
  boundaries;
  pending;
  context;
  constructor(source, boundary, boundaries, pending, context, parenBoundary = true) {
    super(source, boundary.start, boundary.end, parenBoundary, context);
    this._nestingDepth = boundary.depth;
    this.boundaries = boundaries;
    this.pending = pending;
    this.context = context;
  }
  fork(start, end, parenBoundary = false) {
    return new SubstitutionLexer(this.getSource(), { start, end, depth: this._nestingDepth }, this.boundaries, this.pending, this.context, parenBoundary);
  }
  findSubstitutionEnd(start, end, depth = this._nestingDepth + 1) {
    const known = this.context.boundaries?.get(start);
    if (known !== undefined)
      return known <= end ? known : -1;
    const boundary = this.boundaries.get(start);
    if (boundary !== undefined)
      return boundary <= end ? boundary : -1;
    if (!this.boundaries.has(start)) {
      this.boundaries.set(start, undefined);
      this.pending.push({ start, end, depth });
    }
    return -1;
  }
}
function findSubstitutionEnd(source, start, end, depth, context) {
  const boundaries = new Map([[start, undefined]]);
  const pending = [{ start, end, depth }];
  while (pending.length > 0) {
    const count = pending.length;
    const boundary = pending[count - 1];
    const lexer = new SubstitutionLexer(source, boundary, boundaries, pending, context);
    const found = new Parser(source, boundary.start, boundary.end, boundary.depth, true, lexer).findSubstitutionEnd();
    if (pending.length === count) {
      boundaries.set(boundary.start, found);
      if (found !== -1)
        substitutionBoundaries(context).set(boundary.start, found);
      pending.pop();
    }
  }
  return boundaries.get(start) ?? -1;
}

class Parser {
  tok;
  source;
  start;
  end;
  depth;
  errors = null;
  syntaxDepth = 0;
  constructor(source, start, end, depth = 0, parenBoundary = false, lexer, context) {
    this.tok = lexer ?? new Lexer(source, start, end, parenBoundary, createSubstitutionContext(context));
    this.tok._nestingDepth = depth;
    this.source = source;
    this.start = start;
    this.end = end;
    this.depth = depth;
  }
  run() {
    const start = this.start;
    if (this.depth > MAX_SYNTAX_NESTING)
      this.error("maximum substitution nesting depth exceeded", start);
    let shebang;
    if (start === 0 && this.source.charCodeAt(0) === 35 && this.source.charCodeAt(1) === 33) {
      const nl = this.source.indexOf(`
`);
      shebang = nl === -1 ? this.source : this.source.slice(0, nl);
    }
    const commands = this.list();
    for (;; ) {
      const unexpected = this.tok.peek(LexContext.CommandStart);
      if (unexpected.token === Token.EOF)
        break;
      this.unexpectedToken(unexpected);
      if (!listTerminators[unexpected.token] && unexpected.token !== Token.In)
        break;
      this.tok.next(LexContext.CommandStart);
      let separator = this.tok.peek(LexContext.CommandStart).token;
      if (separator !== Token.Semi && separator !== Token.Newline && separator !== Token.Amp)
        break;
      while (separator === Token.Semi || separator === Token.Newline || separator === Token.Amp) {
        this.tok.next(LexContext.CommandStart);
        separator = this.tok.peek(LexContext.CommandStart).token;
      }
      const recovered = this.list();
      for (let i = 0;i < recovered.length; i++)
        commands.push(recovered[i]);
    }
    const lexerErrors = this.tok._errors;
    if (lexerErrors !== null && lexerErrors.length > 0) {
      const errors = this.errors ?? (this.errors = []);
      for (let i = 0;i < lexerErrors.length; i++)
        errors.push(lexerErrors[i]);
    }
    if (this.errors !== null && this.errors.length > 1)
      this.errors.sort((a, b) => a.pos - b.pos);
    return { type: "Script", pos: start, end: this.end, shebang, commands, errors: this.errors ?? undefined };
  }
  error(message, pos) {
    (this.errors ?? (this.errors = [])).push({ message, pos });
  }
  unexpectedToken(t) {
    this.error(`unexpected token '${t.token === Token.Newline ? "newline" : t.value}'`, t.pos);
  }
  findSubstitutionEnd() {
    this.list();
    return this.acceptEnd(Token.RParen);
  }
  skipSemi() {
    if (this.tok.peek(LexContext.Normal).token === Token.Semi)
      this.tok.next(LexContext.Normal);
  }
  accept(token, ctx = LexContext.Normal) {
    if (this.tok.peek(ctx).token === token)
      return this.tok.next(ctx);
    return null;
  }
  acceptEnd(token, ctx = LexContext.Normal) {
    if (this.tok.peek(ctx).token === token)
      return this.tok.next(ctx).end;
    return -1;
  }
  skipNewlines(ctx = LexContext.Normal) {
    while (this.tok.peek(ctx).token === Token.Newline)
      this.tok.next(ctx);
  }
  doBody(hasDo) {
    const body = this.list();
    const emptyPos = hasDo ? this.emptyListPos(body) : -1;
    if (emptyPos >= 0)
      this.error("expected command after 'do'", emptyPos);
    return body;
  }
  emptyListPos(commands) {
    return commands.length === 0 ? this.tok.peek(LexContext.CommandStart).pos : -1;
  }
  makeStatement(command) {
    return {
      type: "Statement",
      pos: command.pos,
      end: command.end,
      command,
      background: undefined
    };
  }
  list() {
    const commands = [];
    this.skipNewlines(LexContext.CommandStart);
    let t = this.tok.peek(LexContext.CommandStart).token;
    if (listTerminators[t] || !commandStarts[t])
      return commands;
    const first = this.andOr();
    if (first)
      commands.push(this.makeStatement(first));
    for (;; ) {
      t = this.tok.peekFollow(compoundClosers).token;
      if (t !== Token.Semi && t !== Token.Newline && t !== Token.Amp)
        break;
      const isBackground = t === Token.Amp;
      const sepEnd = this.tok.next(LexContext.Normal).end;
      if (isBackground) {
        const stmt = commands[commands.length - 1];
        stmt.background = true;
        stmt.end = sepEnd;
      }
      this.skipNewlines(LexContext.CommandStart);
      t = this.tok.peek(LexContext.CommandStart).token;
      if (listTerminators[t] || !commandStarts[t])
        break;
      const node = this.andOr();
      if (node)
        commands.push(this.makeStatement(node));
    }
    return commands;
  }
  andOr() {
    const first = this.pipeline();
    if (!first)
      return null;
    let t = this.tok.peek(LexContext.Normal).token;
    if (t !== Token.And && t !== Token.Or)
      return first;
    const commands = [first];
    const operators = [];
    do {
      const operatorToken = this.tok.next(LexContext.Normal);
      const operator = operatorToken.token === Token.And ? "&&" : "||";
      this.skipNewlines(LexContext.CommandStart);
      const next = this.pipeline();
      if (!next) {
        this.error(`expected command after '${operator}'`, operatorToken.end);
        break;
      }
      operators.push(operator);
      commands.push(next);
      t = this.tok.peek(LexContext.Normal).token;
    } while (t === Token.And || t === Token.Or);
    return {
      type: "AndOr",
      pos: first.pos,
      end: commands[commands.length - 1].end,
      commands,
      operators
    };
  }
  withRedirects(command) {
    const redirects = this.collectTrailingRedirects();
    if (redirects.length === 0)
      return command;
    return { type: "Redirected", pos: command.pos, end: redirects[redirects.length - 1].end, command, redirects };
  }
  pipeline() {
    let prefixes;
    for (;; ) {
      const token = this.tok.peek(LexContext.CommandStart);
      const isTime = token.token === Token.Word && token.keywordEligible && token.value === "time";
      if (token.token !== Token.Bang && !isTime)
        break;
      const prefix = this.tok.next(LexContext.CommandStart);
      const pos = prefix.pos;
      const keywordEnd = prefix.end;
      let posix;
      let endOfOptions;
      if (isTime) {
        let flag = this.tok.peek(LexContext.CommandStart);
        if (flag.token === Token.Word && flag.keywordEligible && flag.value === "-p") {
          this.tok.next(LexContext.CommandStart);
          posix = { pos: flag.pos, end: flag.end };
          flag = this.tok.peek(LexContext.CommandStart);
        }
        if (flag.token === Token.Word && flag.keywordEligible && flag.value === "--") {
          this.tok.next(LexContext.CommandStart);
          endOfOptions = { pos: flag.pos, end: flag.end };
        }
      }
      if (prefixes === undefined)
        prefixes = [];
      prefixes.push(isTime ? { type: "Time", pos, end: endOfOptions?.end ?? posix?.end ?? keywordEnd, keywordEnd, posix, endOfOptions } : { type: "Negation", pos, end: keywordEnd });
    }
    const command = this.pipelineCommands();
    if (!prefixes)
      return command;
    const pos = prefixes[0].pos;
    if (command?.type === "Pipeline") {
      command.prefixes = prefixes;
      command.pos = pos;
      return command;
    }
    return {
      type: "Pipeline",
      pos,
      end: command ? command.end : prefixes[prefixes.length - 1].end,
      prefixes,
      commands: command ? [command] : [],
      operators: []
    };
  }
  pipelineCommands() {
    const first = this.command();
    if (!first)
      return null;
    if (this.tok.peek(LexContext.Normal).token !== Token.Pipe)
      return first;
    const commands = [first];
    const operators = [];
    while (this.tok.peek(LexContext.Normal).token === Token.Pipe) {
      const pipeToken = this.tok.next(LexContext.Normal);
      const operator = pipeToken.value === "|&" ? "|&" : "|";
      this.skipNewlines(LexContext.CommandStart);
      const cmd = this.command();
      if (!cmd) {
        this.error(`expected command after '${operator}'`, pipeToken.end);
        break;
      }
      operators.push(operator);
      commands.push(cmd);
    }
    if (commands.length === 1) {
      return commands[0];
    }
    const pipeline = {
      type: "Pipeline",
      pos: first.pos,
      end: commands[commands.length - 1].end,
      prefixes: EMPTY_PREFIXES,
      commands,
      operators
    };
    return pipeline;
  }
  command() {
    let compound;
    switch (this.tok.peek(LexContext.CommandStart).token) {
      case Token.LParen:
        compound = this.subshell();
        break;
      case Token.LBrace:
        compound = this.braceGroup();
        break;
      case Token.If:
        compound = this.ifClause();
        break;
      case Token.For:
        compound = this.forClause();
        break;
      case Token.While:
        compound = this.whileClause();
        break;
      case Token.Until:
        compound = this.untilClause();
        break;
      case Token.Case:
        compound = this.caseClause();
        break;
      case Token.Function:
        return this.functionDef();
      case Token.Select:
        compound = this.selectClause();
        break;
      case Token.DblLBracket:
        compound = this.testCommand();
        break;
      case Token.ArithCmd:
        compound = this.arithCommand();
        break;
      case Token.Coproc:
        return this.coprocCommand();
      case Token.Word:
      case Token.Assignment:
      case Token.Redirect:
        return this.simpleCommandOrFunction(false);
      default:
        return null;
    }
    return this.withRedirects(compound);
  }
  collectTrailingRedirects() {
    let redirects = EMPTY_REDIRECTS;
    while (this.tok.peekFollow(compoundClosers).token === Token.Redirect) {
      if (redirects === EMPTY_REDIRECTS)
        redirects = [];
      redirects.push(this.readRedirect(LexContext.Normal));
    }
    return redirects;
  }
  arithCommand() {
    const tok = this.tok.next(LexContext.CommandStart);
    return new ArithmeticCommandImpl(tok.pos, tok.end, tok.value, this.source, this.depth, this.tok.getSubstitutionContext());
  }
  coprocCommand() {
    const start = this.tok.next(LexContext.CommandStart);
    const pos = start.pos;
    const first = this.tok.peek(LexContext.CommandStart);
    let name;
    if (first.token === Token.Word) {
      const lookahead = this.tok.fork(first.end, this.end);
      switch (lookahead.peek(LexContext.CommandStart).token) {
        case Token.LParen:
          lookahead.next(LexContext.CommandStart);
          if (lookahead.peek(LexContext.Normal).token !== Token.RParen)
            name = this.readWord(LexContext.CommandStart);
          break;
        case Token.LBrace:
        case Token.If:
        case Token.For:
        case Token.While:
        case Token.Until:
        case Token.Case:
        case Token.Select:
        case Token.DblLBracket:
        case Token.ArithCmd:
          name = this.readWord(LexContext.CommandStart);
      }
    }
    const cmd = first.token === Token.Word && name === undefined ? this.simpleCommandOrFunction(true) : this.command();
    if (cmd && cmd.type !== "Function" && cmd.type !== "Coproc") {
      return { type: "Coproc", pos, end: cmd.end, name, body: cmd };
    }
    this.error("expected command after 'coproc'", cmd?.pos ?? start.end);
    const body = cmd ? this.makeCompoundList([this.makeStatement(cmd)]) : { type: "CompoundList", pos: start.end, end: start.end, commands: [] };
    return { type: "Coproc", pos, end: body.end, name, body };
  }
  subshell() {
    return this.subshellBody(this.tok.next(LexContext.CommandStart).pos);
  }
  subshellBody(pos) {
    if (this.syntaxDepth >= MAX_SYNTAX_NESTING) {
      this.error("maximum subshell nesting depth exceeded", pos);
      const closeEnd = this.tok.skipSubshellBody();
      if (closeEnd < 0)
        this.error("expected ')' to close subshell", this.tok.getPos());
      const end = closeEnd >= 0 ? closeEnd : pos;
      return { type: "Subshell", pos, end, body: this.makeCompoundList([]) };
    }
    this.syntaxDepth++;
    const commands = this.list();
    this.syntaxDepth--;
    if (commands.length === 0)
      this.error("expected command in subshell", pos);
    const closeEnd = this.acceptEnd(Token.RParen, LexContext.Normal);
    if (closeEnd < 0)
      this.error("expected ')' to close subshell", this.tok.getPos());
    const end = closeEnd >= 0 ? closeEnd : pos;
    return { type: "Subshell", pos, end, body: this.makeCompoundList(commands) };
  }
  braceGroup() {
    const pos = this.tok.next(LexContext.CommandStart).pos;
    if (this.syntaxDepth >= MAX_SYNTAX_NESTING) {
      this.error("maximum brace group nesting depth exceeded", pos);
      const closeEnd = this.tok.skipCompoundBody(Token.RBrace);
      if (closeEnd < 0)
        this.error("expected '}' to close brace group", this.tok.getPos());
      const end = closeEnd >= 0 ? closeEnd : pos;
      return { type: "BraceGroup", pos, end, body: this.makeCompoundList([]) };
    }
    this.syntaxDepth++;
    const commands = this.list();
    this.syntaxDepth--;
    if (commands.length === 0)
      this.error("expected command in brace group", pos);
    const closeEnd = this.acceptEnd(Token.RBrace, LexContext.Normal);
    if (closeEnd < 0)
      this.error("expected '}' to close brace group", this.tok.getPos());
    const end = closeEnd >= 0 ? closeEnd : pos;
    return { type: "BraceGroup", pos, end, body: this.makeCompoundList(commands) };
  }
  ifClause() {
    const pos = this.tok.next(LexContext.CommandStart).pos;
    if (this.syntaxDepth >= MAX_SYNTAX_NESTING) {
      this.error("maximum if nesting depth exceeded", pos);
      const closeEnd = this.tok.skipCompoundBody(Token.Fi);
      if (closeEnd < 0)
        this.error("expected 'fi' to close 'if'", this.tok.getPos());
      const end = closeEnd >= 0 ? closeEnd : pos;
      return {
        type: "If",
        pos,
        end,
        clause: this.makeCompoundList([]),
        then: this.makeCompoundList([]),
        elif: EMPTY_ELIFS,
        else: undefined
      };
    }
    this.syntaxDepth++;
    let command;
    let branchPos = pos;
    for (;; ) {
      const clauseCommands = this.list();
      const emptyClausePos = this.emptyListPos(clauseCommands);
      const clause = this.makeCompoundList(clauseCommands);
      this.skipSemi();
      const thenToken = this.accept(Token.Then, LexContext.CommandStart);
      if (!thenToken)
        this.error("expected 'then'", this.tok.getPos());
      else if (emptyClausePos >= 0)
        this.error(`expected command after '${branchPos === pos ? "if" : "elif"}'`, emptyClausePos);
      const thenCommands = this.list();
      const then_ = this.makeCompoundList(thenCommands);
      if (thenToken && thenCommands.length === 0) {
        this.error("expected command after 'then'", this.tok.peek(LexContext.CommandStart).pos);
        then_.pos = thenToken.end;
        then_.end = thenToken.end;
      }
      if (command) {
        if (command.elif === EMPTY_ELIFS)
          command.elif = [];
        command.elif.push({
          type: "Elif",
          pos: branchPos,
          end: then_.end,
          clause,
          then: then_
        });
      } else {
        command = { type: "If", pos, end: pos, clause, then: then_, elif: EMPTY_ELIFS, else: undefined };
      }
      this.skipSemi();
      const elif = this.accept(Token.Elif, LexContext.CommandStart);
      if (!elif)
        break;
      branchPos = elif.pos;
    }
    if (this.accept(Token.Else, LexContext.CommandStart)) {
      const elseCommands = this.list();
      const emptyElsePos = this.emptyListPos(elseCommands);
      if (emptyElsePos >= 0)
        this.error("expected command after 'else'", emptyElsePos);
      command.else = this.makeCompoundList(elseCommands);
      this.skipSemi();
    }
    const closeEnd = this.acceptEnd(Token.Fi, LexContext.CommandStart);
    if (closeEnd < 0)
      this.error("expected 'fi' to close 'if'", this.tok.getPos());
    command.end = closeEnd >= 0 ? closeEnd : branchPos;
    this.syntaxDepth--;
    return command;
  }
  forClause() {
    const pos = this.tok.next(LexContext.CommandStart).pos;
    if (this.tok.peek(LexContext.Normal).token === Token.LParen) {
      return this.cStyleFor(pos);
    }
    const name = this.readRequiredWord("for");
    let wordlist;
    this.skipNewlines(LexContext.CommandStart);
    if (this.tok.peek(LexContext.CommandStart).token === Token.In) {
      this.tok.next(LexContext.CommandStart);
      wordlist = [];
      while (this.tok.peek(LexContext.Normal).token === Token.Word) {
        wordlist.push(this.readWord(LexContext.Normal));
      }
    }
    this.skipSemi();
    this.skipNewlines(LexContext.CommandStart);
    if (this.tok.peek(LexContext.CommandStart).token === Token.LBrace) {
      const bg = this.braceGroup();
      return { type: "For", pos, end: bg.end, name, wordlist, body: bg.body };
    }
    const hasDo = this.accept(Token.Do, LexContext.CommandStart) !== null;
    if (!hasDo)
      this.error("expected 'do'", this.tok.getPos());
    if (this.syntaxDepth >= MAX_SYNTAX_NESTING) {
      this.error("maximum for nesting depth exceeded", pos);
      const closeEnd = this.tok.skipCompoundBody(Token.Done);
      if (closeEnd < 0)
        this.error("expected 'done' to close 'for'", this.tok.getPos());
      const end = closeEnd >= 0 ? closeEnd : pos;
      return { type: "For", pos, end, name, wordlist, body: this.makeCompoundList([]) };
    }
    this.syntaxDepth++;
    const body = this.doBody(hasDo);
    this.syntaxDepth--;
    this.skipSemi();
    const closeEnd = this.acceptEnd(Token.Done, LexContext.CommandStart);
    if (closeEnd < 0)
      this.error("expected 'done' to close 'for'", this.tok.getPos());
    const end = closeEnd >= 0 ? closeEnd : pos;
    return { type: "For", pos, end, name, wordlist, body: this.makeCompoundList(body) };
  }
  cStyleFor(pos) {
    const [initStr, testStr, updateStr, initPos, testPos, updatePos] = this.tok.readCStyleForExprs();
    if (this.tok.peek(LexContext.CommandStart).token === Token.Semi)
      this.tok.next(LexContext.CommandStart);
    this.skipNewlines(LexContext.CommandStart);
    if (this.tok.peek(LexContext.CommandStart).token === Token.LBrace) {
      const bg = this.braceGroup();
      return new ArithmeticForImpl(pos, bg.end, bg.body, initStr, testStr, updateStr, initPos, testPos, updatePos, this.source, this.depth, this.tok.getSubstitutionContext());
    }
    const hasDo = this.accept(Token.Do, LexContext.CommandStart) !== null;
    if (!hasDo)
      this.error("expected 'do'", this.tok.getPos());
    if (this.syntaxDepth >= MAX_SYNTAX_NESTING) {
      this.error("maximum for nesting depth exceeded", pos);
      const closeEnd = this.tok.skipCompoundBody(Token.Done);
      if (closeEnd < 0)
        this.error("expected 'done' to close 'for'", this.tok.getPos());
      const end = closeEnd >= 0 ? closeEnd : pos;
      return new ArithmeticForImpl(pos, end, this.makeCompoundList([]), initStr, testStr, updateStr, initPos, testPos, updatePos, this.source, this.depth, this.tok.getSubstitutionContext());
    }
    this.syntaxDepth++;
    const body = this.doBody(hasDo);
    this.syntaxDepth--;
    const closeEnd = this.acceptEnd(Token.Done, LexContext.CommandStart);
    if (closeEnd < 0)
      this.error("expected 'done' to close 'for'", this.tok.getPos());
    const end = closeEnd >= 0 ? closeEnd : pos;
    return new ArithmeticForImpl(pos, end, this.makeCompoundList(body), initStr, testStr, updateStr, initPos, testPos, updatePos, this.source, this.depth, this.tok.getSubstitutionContext());
  }
  whileClause() {
    return this.whileOrUntil("while");
  }
  untilClause() {
    return this.whileOrUntil("until");
  }
  whileOrUntil(kind) {
    const pos = this.tok.next(LexContext.CommandStart).pos;
    if (this.syntaxDepth >= MAX_SYNTAX_NESTING) {
      this.error(`maximum ${kind} nesting depth exceeded`, pos);
      const closeEnd = this.tok.skipCompoundBody(Token.Done);
      if (closeEnd < 0)
        this.error(`expected 'done' to close '${kind}'`, this.tok.getPos());
      const end = closeEnd >= 0 ? closeEnd : pos;
      return {
        type: "While",
        pos,
        end,
        kind,
        clause: this.makeCompoundList([]),
        body: this.makeCompoundList([])
      };
    }
    this.syntaxDepth++;
    const clauseCommands = this.list();
    const emptyClausePos = this.emptyListPos(clauseCommands);
    const clause = this.makeCompoundList(clauseCommands);
    this.skipSemi();
    const hasDo = this.accept(Token.Do, LexContext.CommandStart) !== null;
    if (!hasDo)
      this.error("expected 'do'", this.tok.getPos());
    else if (emptyClausePos >= 0)
      this.error(`expected command after '${kind}'`, emptyClausePos);
    const body = this.doBody(hasDo);
    this.skipSemi();
    const closeEnd = this.acceptEnd(Token.Done, LexContext.CommandStart);
    if (closeEnd < 0)
      this.error(`expected 'done' to close '${kind}'`, this.tok.getPos());
    const end = closeEnd >= 0 ? closeEnd : pos;
    this.syntaxDepth--;
    return { type: "While", pos, end, kind, clause, body: this.makeCompoundList(body) };
  }
  caseClause() {
    const pos = this.tok.next(LexContext.CommandStart).pos;
    const word = this.readRequiredWord("case");
    this.skipNewlines(LexContext.CommandStart);
    if (!this.accept(Token.In, LexContext.CommandStart))
      this.error("expected 'in' after 'case' word", this.tok.getPos());
    this.skipNewlines(LexContext.CasePattern);
    if (this.syntaxDepth >= MAX_SYNTAX_NESTING) {
      this.error("maximum case nesting depth exceeded", pos);
      const closeEnd = this.tok.skipCompoundBody(Token.Esac);
      if (closeEnd < 0)
        this.error("expected 'esac' to close 'case'", this.tok.getPos());
      const end = closeEnd >= 0 ? closeEnd : pos;
      return { type: "Case", pos, end, word, items: [] };
    }
    this.syntaxDepth++;
    const items = [];
    let invalid = false;
    let t = this.tok.peek(LexContext.CasePattern).token;
    while (t !== Token.Esac && t !== Token.EOF) {
      const itemPos = this.tok.peek(LexContext.Normal).pos;
      this.accept(Token.LParen, LexContext.Normal);
      const pattern = [];
      let expectWord = true;
      let next = this.tok.peek(LexContext.Normal);
      while (next.token !== Token.RParen && next.token !== Token.EOF) {
        const valid = next.token === (expectWord ? Token.Word : Token.Pipe);
        if (valid)
          expectWord = !expectWord;
        else if (!invalid) {
          this.unexpectedToken(next);
          invalid = true;
        }
        const tok = this.tok.next(LexContext.Normal);
        if (tok.token === Token.Word)
          pattern.push(this.toWord(tok));
        next = this.tok.peek(LexContext.Normal);
      }
      if (expectWord && next.token === Token.RParen && !invalid) {
        this.unexpectedToken(next);
        invalid = true;
      }
      const rparenEnd = this.acceptEnd(Token.RParen, LexContext.Normal);
      const cmds = this.list();
      const bodyPos = rparenEnd >= 0 ? rparenEnd : pattern.length > 0 ? pattern[pattern.length - 1].end : itemPos;
      const itemEnd = cmds.length > 0 ? cmds[cmds.length - 1].end : bodyPos;
      const item = {
        type: "CaseItem",
        pos: itemPos,
        end: itemEnd,
        pattern,
        body: cmds.length > 0 ? this.makeCompoundList(cmds) : { type: "CompoundList", pos: bodyPos, end: bodyPos, commands: [] },
        terminator: undefined
      };
      const after = this.tok.peek(LexContext.CommandStart);
      t = after.token;
      if (t === Token.DoubleSemi || t === Token.SemiAmp || t === Token.DoubleSemiAmp) {
        const termTok = this.tok.next(LexContext.CommandStart);
        item.terminator = CASE_TERMINATORS[termTok.token];
        item.end = termTok.end;
      } else if (t !== Token.Esac && t !== Token.EOF && !invalid) {
        this.unexpectedToken(after);
        invalid = true;
      }
      items.push(item);
      this.skipNewlines(LexContext.CasePattern);
      t = this.tok.peek(LexContext.CasePattern).token;
    }
    const closeEnd = this.acceptEnd(Token.Esac, LexContext.CommandStart);
    if (closeEnd < 0)
      this.error("expected 'esac' to close 'case'", this.tok.getPos());
    const end = closeEnd >= 0 ? closeEnd : pos;
    this.syntaxDepth--;
    return { type: "Case", pos, end, word, items };
  }
  selectClause() {
    const pos = this.tok.next(LexContext.CommandStart).pos;
    const name = this.readRequiredWord("select");
    let wordlist;
    this.skipNewlines(LexContext.CommandStart);
    if (this.tok.peek(LexContext.CommandStart).token === Token.In) {
      this.tok.next(LexContext.CommandStart);
      wordlist = [];
      while (this.tok.peek(LexContext.Normal).token === Token.Word) {
        wordlist.push(this.readWord(LexContext.Normal));
      }
    }
    this.skipSemi();
    this.skipNewlines(LexContext.CommandStart);
    if (this.tok.peek(LexContext.CommandStart).token === Token.LBrace) {
      const bg = this.braceGroup();
      return { type: "Select", pos, end: bg.end, name, wordlist, body: bg.body };
    }
    const hasDo = this.accept(Token.Do, LexContext.CommandStart) !== null;
    if (!hasDo)
      this.error("expected 'do'", this.tok.getPos());
    if (this.syntaxDepth >= MAX_SYNTAX_NESTING) {
      this.error("maximum select nesting depth exceeded", pos);
      const closeEnd = this.tok.skipCompoundBody(Token.Done);
      if (closeEnd < 0)
        this.error("expected 'done' to close 'select'", this.tok.getPos());
      const end = closeEnd >= 0 ? closeEnd : pos;
      return { type: "Select", pos, end, name, wordlist, body: this.makeCompoundList([]) };
    }
    this.syntaxDepth++;
    const body = this.doBody(hasDo);
    this.syntaxDepth--;
    this.skipSemi();
    const closeEnd = this.acceptEnd(Token.Done, LexContext.CommandStart);
    if (closeEnd < 0)
      this.error("expected 'done' to close 'select'", this.tok.getPos());
    const end = closeEnd >= 0 ? closeEnd : pos;
    return { type: "Select", pos, end, name, wordlist, body: this.makeCompoundList(body) };
  }
  testCommand() {
    const pos = this.tok.next(LexContext.CommandStart).pos;
    const expr = this.parseTestOr();
    const closeEnd = this.acceptEnd(Token.DblRBracket, LexContext.TestMode);
    if (closeEnd < 0)
      this.error("expected ']]' to close '[['", this.tok.getPos());
    const end = closeEnd >= 0 ? closeEnd : pos;
    return { type: "TestCommand", pos, end, expression: expr };
  }
  parseTestOr() {
    const first = this.parseTestAnd();
    if (this.tok.peek(LexContext.TestMode).token !== Token.Or)
      return first;
    const operands = [first];
    do {
      this.tok.next(LexContext.TestMode);
      operands.push(this.parseTestAnd());
    } while (this.tok.peek(LexContext.TestMode).token === Token.Or);
    return {
      type: "TestLogical",
      pos: first.pos,
      end: operands[operands.length - 1].end,
      operator: "||",
      operands
    };
  }
  parseTestAnd() {
    const first = this.parseTestNot();
    if (this.tok.peek(LexContext.TestMode).token !== Token.And)
      return first;
    const operands = [first];
    do {
      this.tok.next(LexContext.TestMode);
      operands.push(this.parseTestNot());
    } while (this.tok.peek(LexContext.TestMode).token === Token.And);
    return {
      type: "TestLogical",
      pos: first.pos,
      end: operands[operands.length - 1].end,
      operator: "&&",
      operands
    };
  }
  parseTestNot() {
    let t = this.tok.peek(LexContext.TestMode);
    if (!isTestNegation(t))
      return this.parseTestPrimary();
    const negations = [];
    while (isTestNegation(t)) {
      const bang = this.tok.next(LexContext.TestMode);
      negations.push({ type: "Negation", pos: bang.pos, end: bang.end });
      t = this.tok.peek(LexContext.TestMode);
    }
    const operand = this.parseTestPrimary();
    return { type: "TestNot", pos: negations[0].pos, end: operand.end, negations, operand };
  }
  parseTestPrimary() {
    if (this.tok.peek(LexContext.TestMode).token === Token.LParen) {
      const openPos = this.tok.next(LexContext.TestMode).pos;
      if (this.syntaxDepth >= MAX_SYNTAX_NESTING) {
        this.error("maximum test group nesting depth exceeded", openPos);
        const closeEnd = this.tok.skipTestGroup();
        if (closeEnd < 0)
          this.error("expected ')' to close test group", this.tok.getPos());
        const end = closeEnd >= 0 ? closeEnd : openPos;
        const operand = new WordImpl("", openPos, openPos);
        const expression = {
          type: "TestUnary",
          pos: openPos,
          end: openPos,
          operator: "-n",
          operand
        };
        return { type: "TestGroup", pos: openPos, end, expression };
      }
      this.syntaxDepth++;
      const expr = this.parseTestOr();
      this.syntaxDepth--;
      const closeEnd = this.acceptEnd(Token.RParen, LexContext.TestMode);
      if (closeEnd < 0)
        this.error("expected ')' to close test group", this.tok.getPos());
      const end = closeEnd >= 0 ? closeEnd : openPos;
      return { type: "TestGroup", pos: openPos, end, expression: expr };
    }
    const first = this.tok.next(LexContext.TestMode);
    if (first.token === Token.And || first.token === Token.Or)
      this.unexpectedToken(first);
    const val = first.value;
    const firstPos = first.pos;
    const firstEnd = first.end;
    if (first.keywordEligible && UNARY_TEST_OPS[val] === 1) {
      if (this.tok.peek(LexContext.TestMode).token === Token.Word) {
        const operand = this.readTestOperand();
        return {
          type: "TestUnary",
          pos: firstPos,
          end: operand.end,
          operator: val,
          operand
        };
      }
      this.error("expected operand after unary test operator", firstEnd);
      const operand = new WordImpl("", firstEnd, firstEnd);
      return { type: "TestUnary", pos: firstPos, end: firstEnd, operator: val, operand };
    }
    const nt = this.tok.peek(LexContext.TestMode);
    if (nt.token === Token.Word && nt.keywordEligible && BINARY_TEST_OPS[nt.value] === 1) {
      const op = this.tok.next(LexContext.TestMode).value;
      let right;
      if (op === "=~") {
        const token = this.tok.readTestRegexWord();
        right = new WordImpl(this.source.slice(token.pos, token.end), token.pos, token.end, this.source, embeddedPartsResolver(this.tok.getSubstitutionContext()), this.depth);
      } else {
        right = this.readTestOperand();
      }
      const left = this.toWordFromPosEnd(first, firstPos, firstEnd);
      return {
        type: "TestBinary",
        pos: firstPos,
        end: right.end,
        operator: op,
        left,
        right
      };
    }
    const w = this.toWordFromPosEnd(first, firstPos, firstEnd);
    return { type: "TestUnary", pos: firstPos, end: w.end, operator: "-n", operand: w };
  }
  readTestOperand() {
    const t = this.tok.next(LexContext.TestMode);
    if (t.keywordEligible && (t.value === "<" || t.value === ">"))
      this.error(`unexpected argument '${t.value}' to conditional operator`, t.pos);
    return this.toWord(t);
  }
  functionDef() {
    const pos = this.tok.next(LexContext.CommandStart).pos;
    const name = this.readWord(LexContext.FunctionName);
    let body;
    if (this.tok.peek(LexContext.CommandStart).token === Token.LParen) {
      const openPos = this.tok.next(LexContext.CommandStart).pos;
      if (this.tok.peek(LexContext.CommandStart).token === Token.RParen) {
        this.tok.next(LexContext.CommandStart);
        this.skipNewlines(LexContext.CommandStart);
        body = this.commandAsBody();
      } else {
        body = this.withRedirects(this.subshellBody(openPos));
      }
    } else {
      this.skipNewlines(LexContext.CommandStart);
      body = this.commandAsBody();
    }
    return { type: "Function", pos, end: body.end, name, body };
  }
  simpleCommandOrFunction(coproc) {
    const prefix = [];
    const cmdPos = this.tok.peek(LexContext.CommandStart).pos;
    let lastEnd = cmdPos;
    let ctx = LexContext.CommandStart;
    for (;; ) {
      const t = this.tok.peek(ctx).token;
      if (t === Token.Assignment) {
        const assignment = this.tok.next(ctx);
        lastEnd = assignment.end;
        prefix.push(this.parseAssignment(assignment));
      } else if (t === Token.Redirect) {
        const redirect = this.readRedirect(ctx);
        prefix.push(redirect);
        lastEnd = redirect.end;
      } else {
        break;
      }
      ctx = LexContext.CommandPrefix;
    }
    if (this.tok.peek(LexContext.Normal).token !== Token.Word) {
      return new CommandImpl(cmdPos, lastEnd, undefined, prefix, []);
    }
    const nameToken = this.tok.next(LexContext.Normal);
    const keyword = nameToken.keywordEligible ? nameToken.value : "";
    const name = this.toWord(nameToken);
    ctx = isDeclarationCommand(keyword) ? LexContext.Declaration : keyword === "eval" || keyword === "let" ? LexContext.EvalArgument : LexContext.Normal;
    lastEnd = name.end;
    const suffix = [];
    if (coproc) {
      while (this.tok.peek(LexContext.CommandPrefix).token === Token.Assignment) {
        const token = this.tok.next(LexContext.CommandPrefix);
        const word = ctx === LexContext.Declaration ? this.parseAssignment(token) : this.toWord(token);
        suffix.push(word);
        lastEnd = word.end;
      }
    }
    if (this.tok.peek(ctx).token === Token.LParen && suffix.length === 0) {
      this.tok.next(LexContext.Normal);
      if (this.tok.peek(LexContext.Normal).token === Token.RParen) {
        this.tok.next(LexContext.Normal);
        this.skipNewlines(LexContext.CommandStart);
        const body = this.commandAsBody();
        return {
          type: "Function",
          pos: name.pos,
          end: body.end,
          name,
          body
        };
      }
    }
    for (;; ) {
      const st = this.tok.peek(ctx).token;
      if (st === Token.Word || st === Token.Assignment) {
        const token = this.tok.next(ctx);
        const w = st === Token.Assignment ? this.parseAssignment(token) : this.toWord(token);
        suffix.push(w);
        lastEnd = w.end;
      } else if (st === Token.Redirect) {
        const redirect = this.readRedirect(ctx);
        suffix.push(redirect);
        lastEnd = redirect.end;
      } else {
        break;
      }
    }
    return new CommandImpl(cmdPos, lastEnd, name, prefix, suffix);
  }
  readRedirect(ctx) {
    const t = this.tok.next(ctx);
    const tPos = t.pos;
    const tEnd = t.end;
    const descriptor = t.fileDescriptor !== undefined ? { type: "FileDescriptor", pos: tPos, end: t.descriptorEnd, value: t.fileDescriptor } : t.variableName !== undefined ? { type: "FileDescriptorVariable", pos: tPos, end: t.descriptorEnd, name: t.variableName } : undefined;
    const hasTarget = t.targetEnd > t.targetPos;
    if (!hasTarget)
      this.error("expected redirect target", t.targetPos);
    if (t.value === "<<" || t.value === "<<-") {
      const r = {
        type: "HereDoc",
        pos: tPos,
        end: tEnd,
        operator: t.value,
        descriptor,
        delimiter: hasTarget ? {
          type: "HereDocDelimiter",
          pos: t.targetPos,
          end: t.targetEnd,
          text: this.source.slice(t.targetPos, t.targetEnd),
          value: t.content ?? "",
          quoted: t.delimiterQuoted
        } : undefined,
        body: new HereDocBodyImpl(this.source, tEnd, t.delimiterQuoted, this.depth, this.tok.getSubstitutionContext()),
        closing: undefined
      };
      if (hasTarget)
        this.tok.registerHereDocTarget(r);
      return r;
    }
    const target = hasTarget ? new WordImpl(this.source.slice(t.targetPos, t.targetEnd), t.targetPos, t.targetEnd, this.source, wordPartsResolver(this.tok.getSubstitutionContext()), this.depth) : undefined;
    return t.value === "<<<" ? { type: "HereString", pos: tPos, end: tEnd, operator: "<<<", descriptor, target } : { type: "Redirect", pos: tPos, end: tEnd, operator: REDIRECT_OPS[t.value] ?? ">", descriptor, target };
  }
  commandAsBody() {
    const cmd = this.command();
    if (cmd && cmd.type !== "Command" && cmd.type !== "Function" && cmd.type !== "Coproc")
      return cmd;
    this.error("expected compound command as function body", cmd?.pos ?? this.tok.getPos());
    return this.makeCompoundList(cmd ? [this.makeStatement(cmd)] : []);
  }
  readWord(ctx) {
    return this.toWord(this.tok.next(ctx));
  }
  readRequiredWord(keyword) {
    const t = this.tok.peek(LexContext.Normal);
    if (t.token === Token.Word)
      return this.toWord(this.tok.next(LexContext.Normal));
    if (t.token !== Token.EOF)
      this.error(`expected word after '${keyword}'`, t.pos);
    return new WordImpl("", t.pos, t.pos);
  }
  toWord(tok) {
    const text = tok.raw ? tok.value : this.source.slice(tok.pos, tok.end);
    const source = tok.raw && tok.keywordEligible ? undefined : this.source;
    return new WordImpl(text, tok.pos, tok.end, source, source === undefined ? computeBareWordParts : wordPartsResolver(this.tok.getSubstitutionContext()), this.depth);
  }
  toWordFromPosEnd(tok, pos, end) {
    if (tok.pos === pos && tok.end === end)
      return this.toWord(tok);
    return new WordImpl(this.source.slice(pos, end), pos, end, this.source, wordPartsResolver(this.tok.getSubstitutionContext()), this.depth);
  }
  parseAssignment(token) {
    const text = token.raw ? token.value : this.source.slice(token.pos, token.end);
    return new AssignmentImpl(text, token.pos, token.end, this.source, token.assignmentOperatorPos, this.depth, this.tok.getSubstitutionContext());
  }
  makeCompoundList(commands) {
    const p = this.tok.getPos();
    const pos = commands.length > 0 ? commands[0].pos : p;
    const end = commands.length > 0 ? commands[commands.length - 1].end : p;
    return { type: "CompoundList", pos, end, commands };
  }
}
export {
  forEachChild,
  parse,
  parseRegion
};
