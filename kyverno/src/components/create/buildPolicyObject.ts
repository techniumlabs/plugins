import {
CelCondition,
CelConditionGroup, CelExpressionItem,   CelOperator, DeletingConditionItem, MatchConditionItem,   PolicyFormState, PolicyVariable,
} from './types';

// ── Value formatting ───────────────────────────────────────────────────────────

function formatValue(v: string): string {
  if (/^-?\d+(\.\d+)?$/.test(v.trim())) return v.trim();
  if (v === 'true' || v === 'false') return v;
  if (v.startsWith('"') || v.startsWith("'")) return v;
  return `"${v}"`;
}

// ── CEL compilation ────────────────────────────────────────────────────────────

function compileSingleCondition(c: CelCondition): string {
  const { fieldPath: fp, operator: op, value: v } = c;
  const lv = (c.loopVar && c.loopVar.trim()) || 'e';
  switch (op as CelOperator) {
    case 'equals':        return `${fp} == ${formatValue(v)}`;
    case 'notEquals':     return `${fp} != ${formatValue(v)}`;
    case 'lessThan':      return `${fp} < ${v}`;
    case 'greaterThan':   return `${fp} > ${v}`;
    case 'lessOrEqual':   return `${fp} <= ${v}`;
    case 'greaterOrEqual': return `${fp} >= ${v}`;
    case 'has':           return `has(${fp})`;
    case 'notHas':        return `!has(${fp})`;
    case 'startsWith':    return `${fp}.startsWith("${v}")`;
    case 'endsWith':      return `${fp}.endsWith("${v}")`;
    case 'contains':      return `${fp}.contains("${v}")`;
    case 'matches':       return `${fp}.matches("${v}")`;
    case 'sizeEquals':    return `size(${fp}) == ${v}`;
    case 'sizeGreater':   return `size(${fp}) > ${v}`;
    case 'sizeLess':      return `size(${fp}) < ${v}`;
    case 'in':            return `${fp} in [${v.split(',').map(s => formatValue(s.trim())).join(', ')}]`;
    case 'allMatch':      return `${fp}.all(${lv}, ${v})`;
    case 'anyMatch':      return `${fp}.exists(${lv}, ${v})`;
    case 'raw':           return v;
    default:              return `${fp} == ${formatValue(v)}`;
  }
}

function compileGroup(group: CelConditionGroup): string {
  const parts = group.conditions.map(compileSingleCondition).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  return parts.map(p => `(${p})`).join(' && ');
}

export function compileCelExpression(item: CelExpressionItem): string {
  if (item.useRaw) return item.rawExpression;
  const parts = item.groups.map(compileGroup).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  return parts.map(p => `(${p})`).join(' || ');
}

function compileDeletingCondition(item: DeletingConditionItem): string {
  if (item.useRaw) return item.rawExpression;
  const parts = item.groups.map(compileGroup).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  return parts.map(p => `(${p})`).join(' || ');
}

function compileMatchCondition(item: MatchConditionItem): string {
  if (item.useRaw) return item.rawExpression;
  const parts = item.groups.map(compileGroup).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  return parts.map(p => `(${p})`).join(' || ');
}

// Build spec.variables[] — only includes rows that have a name.
function buildVariables(variables: PolicyVariable[]): { name: string; expression: string }[] {
  return variables
    .filter(v => v.name.trim() && v.expression.trim())
    .map(v => ({ name: v.name.trim(), expression: v.expression.trim() }));
}

// Build spec.matchConditions[] — only includes rows with a name and a compiled expression.
function buildMatchConditions(conditions: MatchConditionItem[]): { name: string; expression: string }[] {
  return conditions
    .map(c => ({ name: c.name.trim(), expression: compileMatchCondition(c) }))
    .filter(c => c.name && c.expression);
}

// Build a single validation entry, supporting static message or messageExpression.
function buildValidationEntry(v: CelExpressionItem): Record<string, string> {
  const entry: Record<string, string> = { expression: compileCelExpression(v) };
  if (v.message) {
    if (v.messageIsExpression) entry.messageExpression = v.message;
    else entry.message = v.message;
  }
  return entry;
}

// ── Shared helpers ─────────────────────────────────────────────────────────────

function buildAnnotations(state: PolicyFormState): Record<string, string> {
  const ann: Record<string, string> = {};
  const { annotations: a } = state;
  if (a.title)       ann['policies.kyverno.io/title'] = a.title;
  if (a.category)    ann['policies.kyverno.io/category'] = a.category;
  if (a.severity)    ann['policies.kyverno.io/severity'] = a.severity;
  if (a.subject)     ann['policies.kyverno.io/subject'] = a.subject;
  if (a.description) ann['policies.kyverno.io/description'] = a.description;
  if (a.minversion)  ann['policies.kyverno.io/minversion'] = a.minversion;
  return ann;
}

function buildMetadata(state: PolicyFormState) {
  const meta: any = { name: state.name, annotations: buildAnnotations(state) };
  if (state.scope === 'namespace' && state.namespace) meta.namespace = state.namespace;
  return meta;
}

function buildMatchConstraints(state: PolicyFormState) {
  return {
    resourceRules: state.resourceRules.map(r => ({
      apiGroups: r.apiGroups,
      apiVersions: r.apiVersions,
      operations: r.operations,
      resources: r.resources,
    })),
  };
}

// ── Per-type builders ──────────────────────────────────────────────────────────

function buildValidating(state: PolicyFormState, metadata: any): object {
  const d = state.validating;
  const spec: any = {
    validationActions: d.validationActions,
    evaluation: { background: { enabled: d.backgroundEnabled } },
    matchConstraints: buildMatchConstraints(state),
  };
  const variables = buildVariables(d.variables ?? []);
  if (variables.length) spec.variables = variables;
  const matchConditions = buildMatchConditions(d.matchConditions ?? []);
  if (matchConditions.length) spec.matchConditions = matchConditions;
  spec.validations = d.validations.map(buildValidationEntry);
  return {
    apiVersion: 'policies.kyverno.io/v1alpha1',
    kind: 'ValidatingPolicy',
    metadata,
    spec,
  };
}

function buildMutation(state: PolicyFormState, metadata: any): object {
  const d = state.mutation;
  return {
    apiVersion: 'policies.kyverno.io/v1alpha1',
    kind: 'MutatingPolicy',
    metadata,
    spec: {
      matchConstraints: buildMatchConstraints(state),
      mutations: d.patches.map(p => ({
        patchType: 'ApplyConfiguration',
        applyConfiguration: { expression: p.expression },
      })),
      reinvocationPolicy: d.reinvocationPolicy,
    },
  };
}

function buildGenerating(state: PolicyFormState, metadata: any): object {
  const d = state.generating;
  return {
    apiVersion: 'policies.kyverno.io/v1alpha1',
    kind: 'GeneratingPolicy',
    metadata,
    spec: {
      evaluation: { synchronize: { enabled: d.synchronizeEnabled } },
      matchConstraints: buildMatchConstraints(state),
      variables: d.variables.map(v => ({ name: v.name, expression: v.expression })),
      generate: [{ expression: d.generateExpression }],
    },
  };
}

function buildDeleting(state: PolicyFormState, metadata: any): object {
  const d = state.deleting;
  const spec: any = {
    matchConstraints: buildMatchConstraints(state),
    conditions: d.conditions.map(c => ({
      name: c.name,
      expression: compileDeletingCondition(c),
    })),
    schedule: d.schedule,
  };
  if (d.useNamespaceSelector && d.namespaceMatchExpressions.length > 0) {
    spec.matchConstraints.namespaceSelector = {
      matchExpressions: d.namespaceMatchExpressions.map(e => ({
        key: e.key,
        operator: e.operator,
        values: e.values.split(',').map(v => v.trim()).filter(Boolean),
      })),
    };
  }
  return { apiVersion: 'policies.kyverno.io/v1alpha1', kind: 'DeletingPolicy', metadata, spec };
}

function buildImageValidating(state: PolicyFormState, metadata: any): object {
  const d = state.imageValidating;
  const spec: any = {
    webhookConfiguration: { timeoutSeconds: d.timeoutSeconds },
    evaluation: { background: { enabled: d.backgroundEnabled } },
    validationActions: d.validationActions,
    matchConstraints: buildMatchConstraints(state),
  };
  const variables = buildVariables(d.variables ?? []);
  if (variables.length) spec.variables = variables;
  const matchConditions = buildMatchConditions(d.matchConditions ?? []);
  if (matchConditions.length) spec.matchConditions = matchConditions;
  spec.matchImageReferences = d.matchImageReferences.map(r => ({ glob: r.glob }));
  spec.validations = d.validations.map(buildValidationEntry);
  if (d.attestors.length > 0) {
    spec.attestors = d.attestors.map(a => {
      if (a.type === 'notary') {
        return { name: a.name, notary: { certs: { value: a.certValue } } };
      }
      return { name: a.name, cosign: { key: { value: a.keyValue } } };
    });
  }
  return { apiVersion: 'policies.kyverno.io/v1alpha1', kind: 'ImageValidatingPolicy', metadata, spec };
}

function buildCluster(state: PolicyFormState, metadata: any): object {
  const d = state.cluster;
  const rules = d.rules.map(rule => {
    const base: any = {
      name: rule.name,
      match: {
        any: rule.matchAny.map(m => ({
          resources: {
            kinds: m.kinds,
            ...(m.operations.length ? { operations: m.operations } : {}),
            ...(m.namespaces.length ? { namespaces: m.namespaces } : {}),
          },
        })),
      },
    };
    const body = rule.body;
    if (body.type === 'validate') {
      if (body.mode === 'cel') {
        base.validate = {
          cel: {
            expressions: body.celExpressions.map(buildValidationEntry),
          },
        };
      } else {
        try {
          base.validate = { message: body.message, pattern: body.pattern };
        } catch {
          base.validate = { message: body.message, pattern: body.pattern };
        }
      }
    } else if (body.type === 'mutate') {
      base.mutate = { patchStrategicMerge: body.patchStrategicMerge };
    } else if (body.type === 'generate') {
      base.generate = {
        apiVersion: body.apiVersion,
        kind: body.kind,
        name: body.name,
        ...(body.namespace ? { namespace: body.namespace } : {}),
        data: body.data,
      };
    }
    return base;
  });

  return {
    apiVersion: 'kyverno.io/v1',
    kind: state.scope === 'cluster' ? 'ClusterPolicy' : 'Policy',
    metadata,
    spec: {
      validationFailureAction: d.validationFailureAction,
      background: d.background,
      rules,
    },
  };
}

// ── Main export ────────────────────────────────────────────────────────────────

export function buildPolicyObject(state: PolicyFormState): object {
  const metadata = buildMetadata(state);
  switch (state.type) {
    case 'validating':      return buildValidating(state, metadata);
    case 'mutation':        return buildMutation(state, metadata);
    case 'generating':      return buildGenerating(state, metadata);
    case 'deleting':        return buildDeleting(state, metadata);
    case 'imageValidating': return buildImageValidating(state, metadata);
    case 'cluster':         return buildCluster(state, metadata);
    default:                return {};
  }
}
