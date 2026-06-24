import {
  CelCondition, CelConditionGroup, CelOperator,
makeCelCondition,
makeCelGroup,   makeId, } from './types';

// Reverse of compileCelExpression: turn a CEL string into the visual builder's
// OR-groups of AND-conditions. Anything that can't be recognised becomes a
// single `raw` condition so it stays editable inline rather than forcing the
// whole expression into the raw editor.

export interface ParsedExpression {
  groups: CelConditionGroup[];
  useRaw: boolean;
  rawExpression: string;
}

// ── low-level string helpers (string- and bracket-aware) ───────────────────────

function splitTopLevel(expr: string, op: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let inStr: string | null = null;
  let last = 0;
  for (let i = 0; i < expr.length; i++) {
    const c = expr[i];
    if (inStr) {
      if (c === inStr && expr[i - 1] !== '\\') inStr = null;
      continue;
    }
    if (c === '"' || c === "'") { inStr = c; continue; }
    if (c === '(' || c === '[' || c === '{') { depth++; continue; }
    if (c === ')' || c === ']' || c === '}') { depth--; continue; }
    if (depth !== 0) continue;
    if (op.length === 2 && c === op[0] && expr[i + 1] === op[1]) {
      parts.push(expr.slice(last, i));
      i++;
      last = i + 1;
    } else if (op.length === 1 && c === op) {
      parts.push(expr.slice(last, i));
      last = i + 1;
    }
  }
  parts.push(expr.slice(last));
  return parts.map(s => s.trim()).filter(s => s.length > 0);
}

function stripOuterParens(input: string): string {
  let s = input.trim();
  // eslint-disable-next-line no-constant-condition
  while (s.length >= 2 && s[0] === '(' && s[s.length - 1] === ')') {
    let depth = 0;
    let inStr: string | null = null;
    let wraps = true;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (inStr) {
        if (c === inStr && s[i - 1] !== '\\') inStr = null;
        continue;
      }
      if (c === '"' || c === "'") { inStr = c; continue; }
      if (c === '(') depth++;
      else if (c === ')') {
        depth--;
        if (depth === 0 && i !== s.length - 1) { wraps = false; break; }
      }
    }
    if (wraps) s = s.slice(1, -1).trim();
    else break;
  }
  return s;
}

function unquote(v: string): string {
  const t = v.trim();
  if (t.length >= 2 && ((t[0] === '"' && t.endsWith('"')) || (t[0] === "'" && t.endsWith("'")))) {
    return t.slice(1, -1);
  }
  return t;
}

function findTopLevelComparison(expr: string): { op: string; left: string; right: string } | null {
  let depth = 0;
  let inStr: string | null = null;
  for (let i = 0; i < expr.length; i++) {
    const c = expr[i];
    if (inStr) {
      if (c === inStr && expr[i - 1] !== '\\') inStr = null;
      continue;
    }
    if (c === '"' || c === "'") { inStr = c; continue; }
    if (c === '(' || c === '[' || c === '{') { depth++; continue; }
    if (c === ')' || c === ']' || c === '}') { depth--; continue; }
    if (depth !== 0) continue;
    const two = expr.substr(i, 2);
    if (two === '==' || two === '!=' || two === '>=' || two === '<=') {
      return { op: two, left: expr.slice(0, i), right: expr.slice(i + 2) };
    }
    if (c === '>' || c === '<') {
      return { op: c, left: expr.slice(0, i), right: expr.slice(i + 1) };
    }
  }
  return null;
}

// ── single condition parsing ───────────────────────────────────────────────────

function parseSingleCondition(raw: string): Omit<CelCondition, 'id'> {
  const expr = stripOuterParens(raw);
  let m: RegExpMatchArray | null;

  // !has(...) / has(...)
  if ((m = expr.match(/^!\s*has\(([\s\S]+)\)$/))) return { fieldPath: m[1].trim(), operator: 'notHas', value: '' };
  if ((m = expr.match(/^has\(([\s\S]+)\)$/))) return { fieldPath: m[1].trim(), operator: 'has', value: '' };

  // size(FP) <op> N
  if ((m = expr.match(/^size\(([\s\S]+)\)\s*(==|>|<)\s*([\s\S]+)$/))) {
    const opMap: Record<string, CelOperator> = { '==': 'sizeEquals', '>': 'sizeGreater', '<': 'sizeLess' };
    return { fieldPath: m[1].trim(), operator: opMap[m[2]], value: m[3].trim() };
  }

  // FP.startsWith/endsWith/contains/matches("...")
  if ((m = expr.match(/^(.+)\.(startsWith|endsWith|contains|matches)\(\s*(['"])([\s\S]*)\3\s*\)$/))) {
    return { fieldPath: m[1].trim(), operator: m[2] as CelOperator, value: m[4] };
  }

  // FP.all(VAR, EXPR) / FP.exists(VAR, EXPR) — capture the iteration variable so the
  // body keeps referencing the same name when recompiled.
  if ((m = expr.match(/^(.+)\.all\(\s*(\w+)\s*,\s*([\s\S]+)\)$/))) {
    return { fieldPath: m[1].trim(), operator: 'allMatch', value: m[3].trim(), loopVar: m[2] };
  }
  if ((m = expr.match(/^(.+)\.exists\(\s*(\w+)\s*,\s*([\s\S]+)\)$/))) {
    return { fieldPath: m[1].trim(), operator: 'anyMatch', value: m[3].trim(), loopVar: m[2] };
  }

  // FP in [ ... ]  (list membership — NOT key-in-map, which falls through to raw)
  if ((m = expr.match(/^([\s\S]+?)\s+in\s+\[([\s\S]*)\]$/))) {
    const values = splitTopLevel(m[2], ',').map(unquote).join(', ');
    return { fieldPath: m[1].trim(), operator: 'in', value: values };
  }

  // comparison operators
  const cmp = findTopLevelComparison(expr);
  if (cmp) {
    const opMap: Record<string, CelOperator> = {
      '==': 'equals', '!=': 'notEquals',
      '>=': 'greaterOrEqual', '<=': 'lessOrEqual',
      '>': 'greaterThan', '<': 'lessThan',
    };
    const operator = opMap[cmp.op];
    let value = cmp.right.trim();
    if (operator === 'equals' || operator === 'notEquals') value = unquote(value);
    return { fieldPath: cmp.left.trim(), operator, value };
  }

  // anything else → raw CEL condition
  return { fieldPath: '', operator: 'raw', value: expr };
}

// ── main ─────────────────────────────────────────────────────────────────────

export function parseCelToExpressionItem(expression: string | undefined | null): ParsedExpression {
  const expr = (expression ?? '').trim();
  if (!expr) {
    return { groups: [makeCelGroup()], useRaw: false, rawExpression: '' };
  }

  try {
    const orParts = splitTopLevel(expr, '||');
    const groups: CelConditionGroup[] = orParts.map(part => {
      const inner = stripOuterParens(part);
      const andParts = splitTopLevel(inner, '&&');
      const conditions: CelCondition[] = andParts.map(ap => ({
        id: makeId(),
        ...parseSingleCondition(ap),
      }));
      return { id: makeId(), conditions: conditions.length ? conditions : [makeCelCondition()] };
    });

    return { groups: groups.length ? groups : [makeCelGroup()], useRaw: false, rawExpression: expr };
  } catch {
    // On any unexpected failure keep the original text in the raw editor.
    return { groups: [makeCelGroup()], useRaw: true, rawExpression: expr };
  }
}
