export type PolicyType = 'deleting' | 'generating' | 'validating' | 'imageValidating' | 'mutation' | 'cluster';
export type PolicyScope = 'cluster' | 'namespace';

export interface PolicyAnnotations {
  title: string;
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  subject: string;
  description: string;
  minversion: string;
}

export interface ResourceRule {
  id: string;
  apiGroups: string[];
  apiVersions: string[];
  operations: string[];
  resources: string[];
}

export type CelOperator =
  | 'equals' | 'notEquals'
  | 'lessThan' | 'greaterThan' | 'lessOrEqual' | 'greaterOrEqual'
  | 'has' | 'notHas'
  | 'startsWith' | 'endsWith' | 'contains' | 'matches'
  | 'sizeEquals' | 'sizeGreater' | 'sizeLess'
  | 'in' | 'allMatch' | 'anyMatch' | 'raw';

export interface CelCondition {
  id: string;
  fieldPath: string;
  operator: CelOperator;
  value: string;
  /** Iteration variable name for allMatch/anyMatch (e.g. `e`, `container`). Defaults to `e`. */
  loopVar?: string;
}

export interface CelConditionGroup {
  id: string;
  conditions: CelCondition[];
}

export interface CelExpressionItem {
  id: string;
  groups: CelConditionGroup[];
  useRaw: boolean;
  rawExpression: string;
  message: string;
  /** When true, message is treated as a CEL messageExpression instead of a static string */
  messageIsExpression?: boolean;
}

// Match conditions (CEL preconditions that gate when a policy runs)
export interface MatchConditionItem {
  id: string;
  name: string;
  groups: CelConditionGroup[];
  useRaw: boolean;
  rawExpression: string;
}

// Policy-level CEL variables (reusable named expressions)
export interface PolicyVariable {
  id: string;
  name: string;
  expression: string;
}

// Validating
export interface ValidatingFormData {
  validationActions: string[];
  backgroundEnabled: boolean;
  variables: PolicyVariable[];
  matchConditions: MatchConditionItem[];
  validations: CelExpressionItem[];
}

// Mutation
export interface MutationPatch {
  id: string;
  expression: string;
}

export interface MutatingFormData {
  reinvocationPolicy: 'Never' | 'IfNeeded';
  patches: MutationPatch[];
}

// Generating
export interface GeneratingFormData {
  synchronizeEnabled: boolean;
  variables: PolicyVariable[];
  generateExpression: string;
}

// Deleting
export interface DeletingConditionItem {
  id: string;
  name: string;
  groups: CelConditionGroup[];
  useRaw: boolean;
  rawExpression: string;
}

export interface NamespaceSelectorExpr {
  id: string;
  key: string;
  operator: string;
  values: string;
}

export interface DeletingFormData {
  conditions: DeletingConditionItem[];
  schedule: string;
  useNamespaceSelector: boolean;
  namespaceMatchExpressions: NamespaceSelectorExpr[];
}

// ImageValidating
export interface Attestor {
  id: string;
  name: string;
  type: 'notary' | 'cosign';
  certValue: string;
  keyValue: string;
}

export interface ImageRef {
  id: string;
  glob: string;
}

export interface ImageValidatingFormData {
  timeoutSeconds: number;
  backgroundEnabled: boolean;
  validationActions: string[];
  variables: PolicyVariable[];
  matchConditions: MatchConditionItem[];
  matchImageReferences: ImageRef[];
  attestors: Attestor[];
  validations: CelExpressionItem[];
}

// Cluster Policy (kyverno.io/v1) rules
export interface ClusterMatchItem {
  id: string;
  kinds: string[];
  operations: string[];
  namespaces: string[];
}

export interface ClusterValidateBody {
  type: 'validate';
  mode: 'cel' | 'pattern';
  celExpressions: CelExpressionItem[];
  message: string;
  pattern: string;
}

export interface ClusterMutateBody {
  type: 'mutate';
  patchStrategicMerge: string;
}

export interface ClusterGenerateBody {
  type: 'generate';
  apiVersion: string;
  kind: string;
  name: string;
  namespace: string;
  data: string;
}

export type ClusterRuleBody = ClusterValidateBody | ClusterMutateBody | ClusterGenerateBody;

export interface ClusterRule {
  id: string;
  name: string;
  matchAny: ClusterMatchItem[];
  body: ClusterRuleBody;
}

export interface ClusterFormData {
  validationFailureAction: 'Audit' | 'Enforce';
  background: boolean;
  rules: ClusterRule[];
}

// Main form state
export interface PolicyFormState {
  type: PolicyType;
  scope: PolicyScope;
  name: string;
  namespace: string;
  annotations: PolicyAnnotations;
  resourceRules: ResourceRule[];
  validating: ValidatingFormData;
  mutation: MutatingFormData;
  generating: GeneratingFormData;
  deleting: DeletingFormData;
  imageValidating: ImageValidatingFormData;
  cluster: ClusterFormData;
}

// ── Factories ──────────────────────────────────────────────────────────────────
export function makeId(): string {
  return Math.random().toString(36).slice(2, 9);
}

export function makeResourceRule(): ResourceRule {
  return { id: makeId(), apiGroups: [''], apiVersions: ['v1'], operations: ['CREATE', 'UPDATE'], resources: ['pods'] };
}

export function makeCelCondition(): CelCondition {
  return { id: makeId(), fieldPath: 'object.metadata.name', operator: 'equals', value: '', loopVar: 'e' };
}

export function makeCelGroup(): CelConditionGroup {
  return { id: makeId(), conditions: [makeCelCondition()] };
}

export function makeCelExpression(): CelExpressionItem {
  return { id: makeId(), groups: [makeCelGroup()], useRaw: false, rawExpression: '', message: '', messageIsExpression: false };
}

export function makeMatchCondition(): MatchConditionItem {
  return { id: makeId(), name: '', groups: [makeCelGroup()], useRaw: false, rawExpression: '' };
}

export function makePolicyVariable(): PolicyVariable {
  return { id: makeId(), name: '', expression: '' };
}

export function makeDefaultFormState(): PolicyFormState {
  return {
    type: 'validating',
    scope: 'cluster',
    name: '',
    namespace: '',
    annotations: { title: '', category: '', severity: 'medium', subject: 'Pod', description: '', minversion: '1.14.0' },
    resourceRules: [makeResourceRule()],
    validating: { validationActions: ['Audit'], backgroundEnabled: false, variables: [], matchConditions: [], validations: [makeCelExpression()] },
    mutation: { reinvocationPolicy: 'Never', patches: [{ id: makeId(), expression: '' }] },
    generating: {
      synchronizeEnabled: true,
      variables: [{ id: makeId(), name: 'targetNs', expression: 'object.metadata.name' }],
      generateExpression: 'generator.Apply(variables.targetNs, variables.downstream)',
    },
    deleting: {
      conditions: [{ id: makeId(), name: 'check', groups: [makeCelGroup()], useRaw: false, rawExpression: '' }],
      schedule: '* * * * *',
      useNamespaceSelector: false,
      namespaceMatchExpressions: [],
    },
    imageValidating: {
      timeoutSeconds: 30,
      backgroundEnabled: false,
      validationActions: ['Deny'],
      variables: [],
      matchConditions: [],
      matchImageReferences: [{ id: makeId(), glob: 'ghcr.io/your-org/*' }],
      attestors: [],
      validations: [makeCelExpression()],
    },
    cluster: {
      validationFailureAction: 'Audit',
      background: true,
      rules: [{
        id: makeId(),
        name: 'rule-1',
        matchAny: [{ id: makeId(), kinds: ['Pod'], operations: ['CREATE', 'UPDATE'], namespaces: [] }],
        body: { type: 'validate', mode: 'cel', celExpressions: [makeCelExpression()], message: '', pattern: '' },
      }],
    },
  };
}
