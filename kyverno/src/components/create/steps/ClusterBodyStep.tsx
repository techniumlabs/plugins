import { Icon } from '@iconify/react';
import {
  Box, Button, Chip,   Divider, FormControl,
FormControlLabel, IconButton,   InputLabel, MenuItem, Paper, Select, Stack,
Switch, TextField, ToggleButton,
ToggleButtonGroup, Typography, } from '@mui/material';
import React from 'react';
import {
  ClusterFormData, ClusterGenerateBody, ClusterMatchItem,   ClusterMutateBody, ClusterRule, ClusterRuleBody,
ClusterValidateBody,
  makeCelExpression, makeId,
} from '../types';
import { CelExpressionList } from './shared/CelExpressionBuilder';

const K8S_KINDS = ['Pod', 'Deployment', 'StatefulSet', 'DaemonSet', 'ReplicaSet', 'Service', 'ConfigMap', 'Secret', 'Namespace', 'Ingress', 'NetworkPolicy', 'ServiceAccount', 'Job', 'CronJob', 'PersistentVolumeClaim', 'ClusterRole', 'ClusterRoleBinding', 'Role', 'RoleBinding'];
const OPERATIONS = ['CREATE', 'UPDATE', 'DELETE'];

function MatchEditor({ match, onChange }: { match: ClusterMatchItem; onChange: (m: ClusterMatchItem) => void }) {
  const [kindInput, setKindInput] = React.useState('');

  const addKind = (k: string) => {
    const trimmed = k.trim();
    if (trimmed && !match.kinds.includes(trimmed)) {
      onChange({ ...match, kinds: [...match.kinds, trimmed] });
    }
    setKindInput('');
  };

  return (
    <Box>
      {/* Kinds */}
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
        Resource Kinds
      </Typography>
      <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mb: 0.5 }}>
        {match.kinds.map(k => (
          <Chip key={k} label={k} size="small" onDelete={() => onChange({ ...match, kinds: match.kinds.filter(x => x !== k) })} color="primary" variant="outlined" />
        ))}
      </Stack>
      <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
        <TextField size="small" value={kindInput} onChange={e => setKindInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addKind(kindInput); } }}
          placeholder="Add kind..." sx={{ flex: 1 }} />
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, flex: 2 }}>
          {K8S_KINDS.filter(k => !match.kinds.includes(k)).slice(0, 6).map(k => (
            <Chip key={k} label={k} size="small" clickable onClick={() => addKind(k)} variant="outlined" />
          ))}
        </Box>
      </Stack>

      {/* Operations */}
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
        Operations
      </Typography>
      <FormControl size="small" sx={{ minWidth: 280, mb: 1 }}>
        <Select multiple value={match.operations} onChange={e => onChange({ ...match, operations: e.target.value as string[] })}
          renderValue={sel => (
            <Stack direction="row" gap={0.5}>{(sel as string[]).map(v => <Chip key={v} label={v} size="small" />)}</Stack>
          )}>
          {OPERATIONS.map(op => <MenuItem key={op} value={op}>{op}</MenuItem>)}
        </Select>
      </FormControl>

      {/* Namespaces (optional) */}
      <TextField size="small" label="Namespaces (optional, comma-sep)" fullWidth
        value={match.namespaces.join(', ')}
        onChange={e => onChange({ ...match, namespaces: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
        placeholder="default, kube-system" />
    </Box>
  );
}

function ValidateBodyEditor({ body, onChange }: { body: ClusterValidateBody; onChange: (b: ClusterRuleBody) => void }) {
  return (
    <Box>
      <ToggleButtonGroup value={body.mode} exclusive size="small"
        onChange={(_, v) => { if (v) onChange({ ...body, mode: v }); }} sx={{ mb: 2 }}>
        <ToggleButton value="cel">CEL Expressions</ToggleButton>
        <ToggleButton value="pattern">Pattern (YAML)</ToggleButton>
      </ToggleButtonGroup>

      {body.mode === 'cel' ? (
        <CelExpressionList items={body.celExpressions} onChange={v => onChange({ ...body, celExpressions: v })} label="CEL Expressions" />
      ) : (
        <Box>
          <TextField fullWidth multiline minRows={6} size="small" label="Pattern (YAML)"
            value={body.pattern} onChange={e => onChange({ ...body, pattern: e.target.value })}
            placeholder="spec:\n  containers:\n  - resources:\n      requests:\n        memory: '?*'"
            inputProps={{ style: { fontFamily: 'monospace', fontSize: '0.82rem' } }}
            helperText="Use Kyverno pattern syntax. ?* means any non-empty value." />
          <TextField fullWidth size="small" label="Error message" sx={{ mt: 1.5 }}
            value={body.message} onChange={e => onChange({ ...body, message: e.target.value })} />
        </Box>
      )}
    </Box>
  );
}

function MutateBodyEditor({ body, onChange }: { body: ClusterMutateBody; onChange: (b: ClusterRuleBody) => void }) {
  return (
    <TextField fullWidth multiline minRows={8} size="small" label="patchStrategicMerge (YAML)"
      value={body.patchStrategicMerge} onChange={e => onChange({ ...body, patchStrategicMerge: e.target.value })}
      placeholder={`metadata:\n  annotations:\n    +(cluster-autoscaler.kubernetes.io/safe-to-evict): "true"`}
      inputProps={{ style: { fontFamily: 'monospace', fontSize: '0.82rem' } }}
      helperText="Use + prefix for conditional patches (only if missing). Use Kyverno anchors like =(field) for conditional matching." />
  );
}

function GenerateBodyEditor({ body, onChange }: { body: ClusterGenerateBody; onChange: (b: ClusterRuleBody) => void }) {
  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={2}>
        <TextField size="small" label="apiVersion" value={body.apiVersion} onChange={e => onChange({ ...body, apiVersion: e.target.value })} sx={{ flex: 1 }} placeholder="networking.k8s.io/v1" />
        <TextField size="small" label="kind" value={body.kind} onChange={e => onChange({ ...body, kind: e.target.value })} sx={{ flex: 1 }} placeholder="NetworkPolicy" />
      </Stack>
      <Stack direction="row" spacing={2}>
        <TextField size="small" label="name" value={body.name} onChange={e => onChange({ ...body, name: e.target.value })} sx={{ flex: 1 }} placeholder="default-deny" />
        <TextField size="small" label="namespace (optional)" value={body.namespace} onChange={e => onChange({ ...body, namespace: e.target.value })} sx={{ flex: 1 }} />
      </Stack>
      <TextField fullWidth multiline minRows={6} size="small" label="Data (YAML/JSON)"
        value={body.data} onChange={e => onChange({ ...body, data: e.target.value })}
        placeholder="spec:\n  podSelector: {}\n  policyTypes:\n    - Ingress\n    - Egress"
        inputProps={{ style: { fontFamily: 'monospace', fontSize: '0.82rem' } }} />
    </Stack>
  );
}

function ClusterRuleEditor({ rule, onChange, onRemove, showRemove }: {
  rule: ClusterRule; onChange: (r: ClusterRule) => void; onRemove: () => void; showRemove: boolean;
}) {
  const bodyType = rule.body.type;

  const changeBodyType = (type: 'validate' | 'mutate' | 'generate') => {
    if (type === 'validate') onChange({ ...rule, body: { type: 'validate', mode: 'cel', celExpressions: [makeCelExpression()], message: '', pattern: '' } });
    else if (type === 'mutate') onChange({ ...rule, body: { type: 'mutate', patchStrategicMerge: '' } });
    else onChange({ ...rule, body: { type: 'generate', apiVersion: '', kind: '', name: '', namespace: '', data: '' } });
  };

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <TextField size="small" label="Rule name" value={rule.name}
          onChange={e => onChange({ ...rule, name: e.target.value })}
          sx={{ width: 260 }} placeholder="validate-resources" />
        {showRemove && <IconButton size="small" onClick={onRemove} color="error"><Icon icon="mdi:delete" /></IconButton>}
      </Stack>

      {/* Match */}
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: 'text.secondary' }}>MATCH</Typography>
      {rule.matchAny.map((m, i) => (
        <Paper key={m.id} variant="outlined" sx={{ p: 1.5, mb: 1, borderRadius: 1, background: 'rgba(255,255,255,0.02)' }}>
          <MatchEditor match={m} onChange={updated => {
            const next = [...rule.matchAny]; next[i] = updated; onChange({ ...rule, matchAny: next });
          }} />
        </Paper>
      ))}
      <Button size="small" startIcon={<Icon icon="mdi:plus" />} onClick={() => onChange({ ...rule, matchAny: [...rule.matchAny, { id: makeId(), kinds: [], operations: ['CREATE', 'UPDATE'], namespaces: [] }] })}
        sx={{ textTransform: 'none', fontSize: '0.75rem', mb: 2 }}>
        Add match (OR)
      </Button>

      <Divider sx={{ mb: 2 }} />

      {/* Rule type selector */}
      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.secondary', alignSelf: 'center', mr: 1 }}>RULE TYPE:</Typography>
        {(['validate', 'mutate', 'generate'] as const).map(t => (
          <Chip key={t} label={t} clickable
            color={bodyType === t ? 'primary' : 'default'}
            variant={bodyType === t ? 'filled' : 'outlined'}
            onClick={() => changeBodyType(t)}
          />
        ))}
      </Stack>

      {/* Body editor */}
      {bodyType === 'validate' && (
        <ValidateBodyEditor body={rule.body as ClusterValidateBody} onChange={b => onChange({ ...rule, body: b })} />
      )}
      {bodyType === 'mutate' && (
        <MutateBodyEditor body={rule.body as ClusterMutateBody} onChange={b => onChange({ ...rule, body: b })} />
      )}
      {bodyType === 'generate' && (
        <GenerateBodyEditor body={rule.body as ClusterGenerateBody} onChange={b => onChange({ ...rule, body: b })} />
      )}
    </Paper>
  );
}

interface ClusterBodyProps {
  data: ClusterFormData;
  onChange: (d: ClusterFormData) => void;
}

export function ClusterBody({ data, onChange }: ClusterBodyProps) {
  const updateRule = (idx: number, rule: ClusterRule) => {
    const next = [...data.rules]; next[idx] = rule; onChange({ ...data, rules: next });
  };
  const removeRule = (idx: number) => onChange({ ...data, rules: data.rules.filter((_, i) => i !== idx) });
  const addRule = () => onChange({
    ...data,
    rules: [...data.rules, {
      id: makeId(),
      name: `rule-${data.rules.length + 1}`,
      matchAny: [{ id: makeId(), kinds: ['Pod'], operations: ['CREATE', 'UPDATE'], namespaces: [] }],
      body: { type: 'validate', mode: 'cel', celExpressions: [makeCelExpression()], message: '', pattern: '' },
    }],
  });

  return (
    <Box>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Validation Failure Action</InputLabel>
          <Select label="Validation Failure Action" value={data.validationFailureAction}
            onChange={e => onChange({ ...data, validationFailureAction: e.target.value as any })}>
            <MenuItem value="Audit">Audit (log only)</MenuItem>
            <MenuItem value="Enforce">Enforce (block)</MenuItem>
          </Select>
        </FormControl>
        <FormControlLabel control={<Switch checked={data.background} onChange={e => onChange({ ...data, background: e.target.checked })} />} label="Background scanning" />
      </Stack>
      <Divider sx={{ mb: 2 }} />

      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Rules</Typography>
        <Button size="small" startIcon={<Icon icon="mdi:plus" />} onClick={addRule} sx={{ textTransform: 'none' }}>Add rule</Button>
      </Stack>

      {data.rules.map((rule, i) => (
        <ClusterRuleEditor key={rule.id} rule={rule} onChange={r => updateRule(i, r)}
          onRemove={() => removeRule(i)} showRemove={data.rules.length > 1} />
      ))}
    </Box>
  );
}
