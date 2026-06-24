import { stringify } from 'yaml';
import { parseCelToExpressionItem } from './parseCelExpression';
import {
CelExpressionItem,
ClusterMatchItem, ClusterRule, ClusterRuleBody,
makeCelExpression,
makeDefaultFormState, makeId,   MatchConditionItem,   PolicyFormState, PolicyScope, PolicyType, PolicyVariable, ResourceRule, } from './types';

// Map a policy `kind` to the form's PolicyType.
const KIND_TO_TYPE: Record<string, PolicyType> = {
  ValidatingPolicy: 'validating',
  ClusterValidatingPolicy: 'validating',
  MutatingPolicy: 'mutation',
  ClusterMutatingPolicy: 'mutation',
  GeneratingPolicy: 'generating',
  ClusterGeneratingPolicy: 'generating',
  DeletingPolicy: 'deleting',
  ClusterDeletingPolicy: 'deleting',
  ImageValidatingPolicy: 'imageValidating',
  ClusterImageValidatingPolicy: 'imageValidating',
  ClusterPolicy: 'cluster',
  Policy: 'cluster',
};

// Kinds the template selector should offer for a given form PolicyType.
// The policies.kyverno.io API kinds are cluster-scoped and not "Cluster"-prefixed;
// only the legacy kyverno.io/v1 API distinguishes ClusterPolicy vs Policy.
export const POLICY_TYPE_TO_KINDS: Record<PolicyType, string[]> = {
  validating: ['ValidatingPolicy'],
  mutation: ['MutatingPolicy'],
  generating: ['GeneratingPolicy'],
  deleting: ['DeletingPolicy'],
  imageValidating: ['ImageValidatingPolicy'],
  cluster: ['ClusterPolicy', 'Policy'],
};

// ── helpers ──────────────────────────────────────────────────────────────────

function asStringArray(v: any, fallback: string[] = []): string[] {
  if (Array.isArray(v)) return v.map(x => String(x));
  if (typeof v === 'string' && v.length) return [v];
  return fallback;
}

// Serialise an object/string field (pattern, data, patchStrategicMerge) to YAML text.
function toYamlText(v: any): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  try {
    return stringify(v).trimEnd();
  } catch {
    return String(v);
  }
}

function parseAnnotations(policy: any): PolicyFormState['annotations'] {
  const ann = policy?.metadata?.annotations ?? {};
  const get = (k: string) => (typeof ann[k] === 'string' ? ann[k] : '');
  return {
    title: get('policies.kyverno.io/title'),
    category: get('policies.kyverno.io/category'),
    severity: (get('policies.kyverno.io/severity') as any) || 'medium',
    subject: get('policies.kyverno.io/subject') || 'Pod',
    description: get('policies.kyverno.io/description'),
    minversion: get('policies.kyverno.io/minversion') || '1.14.0',
  };
}

function parseResourceRules(spec: any): ResourceRule[] {
  const rules = spec?.matchConstraints?.resourceRules;
  if (!Array.isArray(rules) || rules.length === 0) return makeDefaultFormState().resourceRules;
  return rules.map((r: any) => ({
    id: makeId(),
    apiGroups: asStringArray(r.apiGroups, ['']),
    apiVersions: asStringArray(r.apiVersions, ['v1']),
    operations: asStringArray(r.operations, ['CREATE', 'UPDATE']),
    resources: asStringArray(r.resources, ['pods']),
  }));
}

// CEL expressions are decompiled into the visual builder where possible, falling
// back to the raw editor only for expressions that can't be represented.
function parseValidations(spec: any): CelExpressionItem[] {
  const vals = spec?.validations;
  if (!Array.isArray(vals) || vals.length === 0) return [makeCelExpression()];
  return vals.map((v: any) => {
    const parsed = parseCelToExpressionItem(typeof v.expression === 'string' ? v.expression : '');
    return {
      id: makeId(),
      groups: parsed.groups,
      useRaw: parsed.useRaw,
      rawExpression: parsed.rawExpression,
      message: typeof v.messageExpression === 'string' ? v.messageExpression : (v.message ?? ''),
      messageIsExpression: typeof v.messageExpression === 'string' && v.messageExpression.length > 0,
    };
  });
}

function parseMatchConditions(spec: any): MatchConditionItem[] {
  const conds = spec?.matchConditions;
  if (!Array.isArray(conds)) return [];
  return conds.map((c: any) => {
    const parsed = parseCelToExpressionItem(typeof c.expression === 'string' ? c.expression : '');
    return {
      id: makeId(),
      name: c.name ?? '',
      groups: parsed.groups,
      useRaw: parsed.useRaw,
      rawExpression: parsed.rawExpression,
    };
  });
}

function parseVariables(spec: any): PolicyVariable[] {
  const vars = spec?.variables;
  if (!Array.isArray(vars)) return [];
  return vars.map((v: any) => ({
    id: makeId(),
    name: v.name ?? '',
    expression: typeof v.expression === 'string' ? v.expression : '',
  }));
}

function parseClusterRules(spec: any): ClusterRule[] {
  const rules = spec?.rules;
  if (!Array.isArray(rules) || rules.length === 0) return makeDefaultFormState().cluster.rules;

  return rules.map((r: any): ClusterRule => {
    const matchSource: any[] = Array.isArray(r?.match?.any)
      ? r.match.any
      : Array.isArray(r?.match?.all)
        ? r.match.all
        : [{}];
    const matchAny: ClusterMatchItem[] = matchSource.map((m: any) => ({
      id: makeId(),
      kinds: asStringArray(m?.resources?.kinds, []),
      operations: asStringArray(m?.resources?.operations, []),
      namespaces: asStringArray(m?.resources?.namespaces, []),
    }));

    let body: ClusterRuleBody;
    if (r.validate) {
      if (r.validate.cel?.expressions) {
        body = {
          type: 'validate',
          mode: 'cel',
          celExpressions: r.validate.cel.expressions.map((e: any) => {
            const parsed = parseCelToExpressionItem(typeof e.expression === 'string' ? e.expression : '');
            return {
              id: makeId(),
              groups: parsed.groups,
              useRaw: parsed.useRaw,
              rawExpression: parsed.rawExpression,
              message: typeof e.messageExpression === 'string' ? e.messageExpression : (e.message ?? ''),
              messageIsExpression: typeof e.messageExpression === 'string' && e.messageExpression.length > 0,
            };
          }),
          message: '',
          pattern: '',
        };
      } else {
        body = {
          type: 'validate',
          mode: 'pattern',
          celExpressions: [makeCelExpression()],
          message: r.validate.message ?? '',
          pattern: toYamlText(r.validate.pattern),
        };
      }
    } else if (r.mutate) {
      body = { type: 'mutate', patchStrategicMerge: toYamlText(r.mutate.patchStrategicMerge) };
    } else if (r.generate) {
      body = {
        type: 'generate',
        apiVersion: r.generate.apiVersion ?? '',
        kind: r.generate.kind ?? '',
        name: r.generate.name ?? '',
        namespace: r.generate.namespace ?? '',
        data: toYamlText(r.generate.data),
      };
    } else {
      body = { type: 'validate', mode: 'cel', celExpressions: [makeCelExpression()], message: '', pattern: '' };
    }

    return { id: makeId(), name: r.name ?? 'rule-1', matchAny, body };
  });
}

// ── main ─────────────────────────────────────────────────────────────────────

/**
 * Convert a raw Kyverno policy object (e.g. a template) into an editable
 * PolicyFormState. Unknown / missing fields fall back to sane defaults so the
 * result is always a complete, editable form.
 */
export function parsePolicyToFormState(policy: any): PolicyFormState {
  const base = makeDefaultFormState();
  if (!policy || typeof policy !== 'object') return base;

  const kind: string = policy.kind ?? '';
  const type: PolicyType = KIND_TO_TYPE[kind] ?? base.type;
  const spec = policy.spec ?? {};
  const namespace = policy?.metadata?.namespace ?? '';

  let scope: PolicyScope;
  if (kind === 'Policy') scope = 'namespace';
  else if (kind.startsWith('Cluster')) scope = 'cluster';
  else scope = namespace ? 'namespace' : 'cluster';

  const state: PolicyFormState = {
    ...base,
    type,
    scope,
    name: policy?.metadata?.name ?? '',
    namespace,
    annotations: parseAnnotations(policy),
    resourceRules: parseResourceRules(spec),
  };

  switch (type) {
    case 'validating':
      state.validating = {
        validationActions: asStringArray(spec.validationActions, ['Audit']),
        backgroundEnabled: Boolean(spec?.evaluation?.background?.enabled),
        variables: parseVariables(spec),
        matchConditions: parseMatchConditions(spec),
        validations: parseValidations(spec),
      };
      break;

    case 'imageValidating':
      state.imageValidating = {
        timeoutSeconds: Number(spec?.webhookConfiguration?.timeoutSeconds) || 30,
        backgroundEnabled: Boolean(spec?.evaluation?.background?.enabled),
        validationActions: asStringArray(spec.validationActions, ['Deny']),
        variables: parseVariables(spec),
        matchConditions: parseMatchConditions(spec),
        matchImageReferences: Array.isArray(spec.matchImageReferences) && spec.matchImageReferences.length
          ? spec.matchImageReferences.map((r: any) => ({ id: makeId(), glob: r.glob ?? '' }))
          : base.imageValidating.matchImageReferences,
        attestors: Array.isArray(spec.attestors)
          ? spec.attestors.map((a: any) => ({
              id: makeId(),
              name: a.name ?? '',
              type: a.cosign ? 'cosign' : 'notary',
              certValue: a?.notary?.certs?.value ?? '',
              keyValue: a?.cosign?.key?.value ?? '',
            }))
          : [],
        validations: parseValidations(spec),
      };
      break;

    case 'mutation':
      state.mutation = {
        reinvocationPolicy: spec.reinvocationPolicy === 'IfNeeded' ? 'IfNeeded' : 'Never',
        patches: Array.isArray(spec.mutations) && spec.mutations.length
          ? spec.mutations.map((m: any) => ({
              id: makeId(),
              expression: m?.applyConfiguration?.expression ?? '',
            }))
          : base.mutation.patches,
      };
      break;

    case 'generating':
      state.generating = {
        synchronizeEnabled: spec?.evaluation?.synchronize?.enabled ?? true,
        variables: parseVariables(spec).length ? parseVariables(spec) : base.generating.variables,
        generateExpression: Array.isArray(spec.generate) && spec.generate[0]?.expression
          ? spec.generate[0].expression
          : base.generating.generateExpression,
      };
      break;

    case 'deleting': {
      const matchExpr = spec?.matchConstraints?.namespaceSelector?.matchExpressions;
      state.deleting = {
        conditions: Array.isArray(spec.conditions) && spec.conditions.length
          ? spec.conditions.map((c: any) => {
              const parsed = parseCelToExpressionItem(typeof c.expression === 'string' ? c.expression : '');
              return {
                id: makeId(),
                name: c.name ?? '',
                groups: parsed.groups,
                useRaw: parsed.useRaw,
                rawExpression: parsed.rawExpression,
              };
            })
          : base.deleting.conditions,
        schedule: spec.schedule ?? base.deleting.schedule,
        useNamespaceSelector: Array.isArray(matchExpr) && matchExpr.length > 0,
        namespaceMatchExpressions: Array.isArray(matchExpr)
          ? matchExpr.map((e: any) => ({
              id: makeId(),
              key: e.key ?? '',
              operator: e.operator ?? 'In',
              values: asStringArray(e.values).join(', '),
            }))
          : [],
      };
      break;
    }

    case 'cluster':
      state.cluster = {
        validationFailureAction: spec.validationFailureAction === 'Enforce' ? 'Enforce' : 'Audit',
        background: spec.background ?? true,
        rules: parseClusterRules(spec),
      };
      break;
  }

  return state;
}
