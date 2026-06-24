import { Icon } from '@iconify/react';
import { Box, Button, Chip,Divider, FormControl, FormControlLabel, IconButton, InputLabel, MenuItem, Paper, Select, Stack, Switch, TextField, Typography } from '@mui/material';
import React from 'react';
import { Attestor, DeletingConditionItem, DeletingFormData, GeneratingFormData, ImageRef, ImageValidatingFormData, makeCelGroup,makeId, MutatingFormData, MutationPatch, PolicyVariable, ValidatingFormData } from '../types';
import { CelExpressionBuilder,CelExpressionList } from './shared/CelExpressionBuilder';
import { MatchConditionsEditor, VariablesEditor } from './shared/PolicyConditionEditors';

// ── VALIDATING ─────────────────────────────────────────────────────────────────
interface ValidatingBodyProps {
  data: ValidatingFormData;
  onChange: (d: ValidatingFormData) => void;
}
export function ValidatingBody({ data, onChange }: ValidatingBodyProps) {
  const ACTIONS = ['Audit', 'Deny', 'Warn'];
  const toggleAction = (a: string) => {
    const next = data.validationActions.includes(a)
      ? data.validationActions.filter(x => x !== a)
      : [...data.validationActions, a];
    onChange({ ...data, validationActions: next });
  };
  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mr: 1 }}>Validation Actions:</Typography>
        {ACTIONS.map(a => (
          <Chip
            key={a}
            label={a}
            clickable
            color={data.validationActions.includes(a) ? (a === 'Deny' ? 'error' : a === 'Warn' ? 'warning' : 'info') : 'default'}
            variant={data.validationActions.includes(a) ? 'filled' : 'outlined'}
            onClick={() => toggleAction(a)}
          />
        ))}
      </Stack>
      <FormControlLabel
        sx={{ mb: 2 }}
        control={<Switch checked={data.backgroundEnabled} onChange={e => onChange({ ...data, backgroundEnabled: e.target.checked })} />}
        label="Background scanning enabled"
      />
      <Divider sx={{ mb: 2 }} />
      <VariablesEditor variables={data.variables ?? []} onChange={v => onChange({ ...data, variables: v })} />
      <MatchConditionsEditor conditions={data.matchConditions ?? []} onChange={c => onChange({ ...data, matchConditions: c })} />
      <Divider sx={{ mb: 2 }} />
      <CelExpressionList items={data.validations} onChange={v => onChange({ ...data, validations: v })} label="Validation Expressions" />
    </Box>
  );
}

// ── MUTATING ───────────────────────────────────────────────────────────────────
interface MutatingBodyProps {
  data: MutatingFormData;
  onChange: (d: MutatingFormData) => void;
}
export function MutatingBody({ data, onChange }: MutatingBodyProps) {
  const updatePatch = (idx: number, p: MutationPatch) => {
    const next = [...data.patches]; next[idx] = p; onChange({ ...data, patches: next });
  };
  const removePatch = (idx: number) => onChange({ ...data, patches: data.patches.filter((_, i) => i !== idx) });
  const addPatch = () => onChange({ ...data, patches: [...data.patches, { id: makeId(), expression: '' }] });

  return (
    <Box>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Reinvocation Policy</InputLabel>
          <Select label="Reinvocation Policy" value={data.reinvocationPolicy}
            onChange={e => onChange({ ...data, reinvocationPolicy: e.target.value as any })}>
            <MenuItem value="Never">Never</MenuItem>
            <MenuItem value="IfNeeded">IfNeeded</MenuItem>
          </Select>
        </FormControl>
      </Stack>
      <Divider sx={{ mb: 2 }} />
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Mutation Patches</Typography>
        <Button size="small" startIcon={<Icon icon="mdi:plus" />} onClick={addPatch} sx={{ textTransform: 'none' }}>Add patch</Button>
      </Stack>
      {data.patches.map((p, i) => (
        <Paper key={p.id} variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Patch {i + 1} — ApplyConfiguration</Typography>
            {data.patches.length > 1 && <IconButton size="small" onClick={() => removePatch(i)} color="error"><Icon icon="mdi:delete" fontSize="small" /></IconButton>}
          </Stack>
          <TextField fullWidth multiline minRows={5} size="small" label="CEL ApplyConfiguration Expression"
            value={p.expression}
            onChange={e => updatePatch(i, { ...p, expression: e.target.value })}
            placeholder={`Object{\n  metadata: Object.metadata{\n    labels: { "my-label": "true" }\n  }\n}`}
            inputProps={{ style: { fontFamily: 'monospace', fontSize: '0.82rem' } }}
            helperText="CEL expression returning the object patch (ApplyConfiguration format)"
          />
        </Paper>
      ))}
    </Box>
  );
}

// ── GENERATING ─────────────────────────────────────────────────────────────────
interface GeneratingBodyProps {
  data: GeneratingFormData;
  onChange: (d: GeneratingFormData) => void;
}
export function GeneratingBody({ data, onChange }: GeneratingBodyProps) {
  const updateVar = (idx: number, v: PolicyVariable) => {
    const next = [...data.variables]; next[idx] = v; onChange({ ...data, variables: next });
  };
  const removeVar = (idx: number) => onChange({ ...data, variables: data.variables.filter((_, i) => i !== idx) });
  const addVar = () => onChange({ ...data, variables: [...data.variables, { id: makeId(), name: '', expression: '' }] });

  return (
    <Box>
      <FormControlLabel sx={{ mb: 2 }}
        control={<Switch checked={data.synchronizeEnabled} onChange={e => onChange({ ...data, synchronizeEnabled: e.target.checked })} />}
        label="Synchronize (keep generated resources in sync)"
      />
      <Divider sx={{ mb: 2 }} />
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Variables</Typography>
        <Button size="small" startIcon={<Icon icon="mdi:plus" />} onClick={addVar} sx={{ textTransform: 'none' }}>Add variable</Button>
      </Stack>
      {data.variables.map((v, i) => (
        <Paper key={v.id} variant="outlined" sx={{ p: 2, mb: 1.5, borderRadius: 2 }}>
          <Stack direction="row" spacing={1.5} alignItems="flex-start">
            <TextField size="small" label="Variable name" value={v.name} sx={{ flex: 1 }}
              onChange={e => updateVar(i, { ...v, name: e.target.value })} placeholder="targetNs" />
            <TextField size="small" label="CEL expression" value={v.expression} sx={{ flex: 2 }}
              onChange={e => updateVar(i, { ...v, expression: e.target.value })}
              placeholder='object.metadata.name'
              inputProps={{ style: { fontFamily: 'monospace' } }} />
            {data.variables.length > 1 && (
              <IconButton size="small" onClick={() => removeVar(i)} color="error" sx={{ mt: 0.5 }}>
                <Icon icon="mdi:delete" style={{ fontSize: '1.1rem' }} />
              </IconButton>
            )}
          </Stack>
        </Paper>
      ))}
      <Divider sx={{ my: 2 }} />
      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>Generate Expression</Typography>
      <TextField fullWidth multiline minRows={3} size="small" label="generator.Apply(...) expression"
        value={data.generateExpression}
        onChange={e => onChange({ ...data, generateExpression: e.target.value })}
        placeholder="generator.Apply(variables.targetNs, variables.downstream)"
        inputProps={{ style: { fontFamily: 'monospace', fontSize: '0.82rem' } }}
        helperText="Use generator.Apply(namespace, downstream) to create resources in the target namespace"
      />
    </Box>
  );
}

// ── DELETING ───────────────────────────────────────────────────────────────────
interface DeletingBodyProps {
  data: DeletingFormData;
  onChange: (d: DeletingFormData) => void;
}

const CRON_PRESETS = [
  { label: 'Every minute',  value: '* * * * *' },
  { label: 'Every hour',    value: '0 * * * *' },
  { label: 'Daily midnight',value: '0 0 * * *' },
  { label: 'Weekly',        value: '0 0 * * 0' },
];

export function DeletingBody({ data, onChange }: DeletingBodyProps) {
  const updateCond = (idx: number, c: DeletingConditionItem) => {
    const next = [...data.conditions]; next[idx] = c; onChange({ ...data, conditions: next });
  };
  const removeCond = (idx: number) => onChange({ ...data, conditions: data.conditions.filter((_, i) => i !== idx) });
  const addCond = () => onChange({ ...data, conditions: [...data.conditions, { id: makeId(), name: '', groups: [makeCelGroup()], useRaw: false, rawExpression: '' }] });

  return (
    <Box>
      {/* Schedule */}
      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Schedule (Cron)</Typography>
      <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
        {CRON_PRESETS.map(p => (
          <Chip key={p.value} label={p.label} size="small" clickable
            color={data.schedule === p.value ? 'primary' : 'default'}
            variant={data.schedule === p.value ? 'filled' : 'outlined'}
            onClick={() => onChange({ ...data, schedule: p.value })}
          />
        ))}
      </Stack>
      <TextField size="small" label="Cron expression" value={data.schedule}
        onChange={e => onChange({ ...data, schedule: e.target.value })}
        sx={{ mb: 2, width: 200 }}
        placeholder="* * * * *"
        inputProps={{ style: { fontFamily: 'monospace' } }}
        helperText="min hour dom month dow"
      />
      <Divider sx={{ mb: 2 }} />

      {/* Conditions */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Delete Conditions</Typography>
        <Button size="small" startIcon={<Icon icon="mdi:plus" />} onClick={addCond} sx={{ textTransform: 'none' }}>Add condition</Button>
      </Stack>
      {data.conditions.map((c, i) => (
        <Paper key={c.id} variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
            <TextField size="small" label="Condition name" value={c.name} sx={{ width: 200 }}
              onChange={e => updateCond(i, { ...c, name: e.target.value })} placeholder="is-empty" />
            {data.conditions.length > 1 && (
              <IconButton size="small" onClick={() => removeCond(i)} color="error"><Icon icon="mdi:delete" style={{ fontSize: '1.1rem' }} /></IconButton>
            )}
          </Stack>
          <CelExpressionBuilder
            showMessage={false}
            item={{ id: c.id, groups: c.groups, useRaw: c.useRaw, rawExpression: c.rawExpression, message: '' }}
            onChange={updated => updateCond(i, { ...c, groups: updated.groups, useRaw: updated.useRaw, rawExpression: updated.rawExpression })}
            label="Condition Expression"
          />
        </Paper>
      ))}
    </Box>
  );
}

// ── IMAGE VALIDATING ───────────────────────────────────────────────────────────
interface ImageValidatingBodyProps {
  data: ImageValidatingFormData;
  onChange: (d: ImageValidatingFormData) => void;
}
export function ImageValidatingBody({ data, onChange }: ImageValidatingBodyProps) {
  const ACTIONS = ['Audit', 'Deny', 'Warn'];
  const toggleAction = (a: string) => {
    const next = data.validationActions.includes(a) ? data.validationActions.filter(x => x !== a) : [...data.validationActions, a];
    onChange({ ...data, validationActions: next });
  };

  const updateRef = (idx: number, r: ImageRef) => { const n = [...data.matchImageReferences]; n[idx] = r; onChange({ ...data, matchImageReferences: n }); };
  const removeRef = (idx: number) => onChange({ ...data, matchImageReferences: data.matchImageReferences.filter((_, i) => i !== idx) });
  const addRef = () => onChange({ ...data, matchImageReferences: [...data.matchImageReferences, { id: makeId(), glob: '' }] });

  const updateAttestor = (idx: number, a: Attestor) => { const n = [...data.attestors]; n[idx] = a; onChange({ ...data, attestors: n }); };
  const removeAttestor = (idx: number) => onChange({ ...data, attestors: data.attestors.filter((_, i) => i !== idx) });
  const addAttestor = () => onChange({ ...data, attestors: [...data.attestors, { id: makeId(), name: `attestor-${data.attestors.length + 1}`, type: 'notary', certValue: '', keyValue: '' }] });

  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mr: 1 }}>Validation Actions:</Typography>
        {ACTIONS.map(a => (
          <Chip key={a} label={a} clickable
            color={data.validationActions.includes(a) ? (a === 'Deny' ? 'error' : a === 'Warn' ? 'warning' : 'info') : 'default'}
            variant={data.validationActions.includes(a) ? 'filled' : 'outlined'}
            onClick={() => toggleAction(a)}
          />
        ))}
      </Stack>
      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <TextField size="small" label="Webhook Timeout (seconds)" type="number" value={data.timeoutSeconds}
          onChange={e => onChange({ ...data, timeoutSeconds: Number(e.target.value) })} sx={{ width: 220 }} />
        <FormControlLabel control={<Switch checked={data.backgroundEnabled} onChange={e => onChange({ ...data, backgroundEnabled: e.target.checked })} />} label="Background scanning" />
      </Stack>
      <Divider sx={{ mb: 2 }} />

      {/* Image references */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Match Image References</Typography>
        <Button size="small" startIcon={<Icon icon="mdi:plus" />} onClick={addRef} sx={{ textTransform: 'none' }}>Add glob</Button>
      </Stack>
      {data.matchImageReferences.map((r, i) => (
        <Stack key={r.id} direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <TextField size="small" fullWidth label={`Image glob ${i + 1}`} value={r.glob}
            onChange={e => updateRef(i, { ...r, glob: e.target.value })}
            placeholder="ghcr.io/your-org/*" />
          {data.matchImageReferences.length > 1 && <IconButton size="small" onClick={() => removeRef(i)} color="error"><Icon icon="mdi:delete" style={{ fontSize: '1.1rem' }} /></IconButton>}
        </Stack>
      ))}
      <Divider sx={{ my: 2 }} />

      {/* Attestors */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Attestors (optional)</Typography>
        <Button size="small" startIcon={<Icon icon="mdi:plus" />} onClick={addAttestor} sx={{ textTransform: 'none' }}>Add attestor</Button>
      </Stack>
      {data.attestors.map((a, i) => (
        <Paper key={a.id} variant="outlined" sx={{ p: 2, mb: 1.5, borderRadius: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
            <Stack direction="row" spacing={1.5}>
              <TextField size="small" label="Attestor name" value={a.name} onChange={e => updateAttestor(i, { ...a, name: e.target.value })} />
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Type</InputLabel>
                <Select label="Type" value={a.type} onChange={e => updateAttestor(i, { ...a, type: e.target.value as any })}>
                  <MenuItem value="notary">Notary</MenuItem>
                  <MenuItem value="cosign">Cosign</MenuItem>
                </Select>
              </FormControl>
            </Stack>
            <IconButton size="small" onClick={() => removeAttestor(i)} color="error"><Icon icon="mdi:delete" style={{ fontSize: '1.1rem' }} /></IconButton>
          </Stack>
          {a.type === 'notary' ? (
            <TextField fullWidth multiline minRows={4} size="small" label="PEM Certificate"
              value={a.certValue} onChange={e => updateAttestor(i, { ...a, certValue: e.target.value })}
              placeholder="-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"
              inputProps={{ style: { fontFamily: 'monospace', fontSize: '0.78rem' } }} />
          ) : (
            <TextField fullWidth multiline minRows={3} size="small" label="Public Key"
              value={a.keyValue} onChange={e => updateAttestor(i, { ...a, keyValue: e.target.value })}
              placeholder="-----BEGIN PUBLIC KEY-----\n..."
              inputProps={{ style: { fontFamily: 'monospace', fontSize: '0.78rem' } }} />
          )}
         </Paper>
      ))}
      <Divider sx={{ mb: 2 }} />
      <VariablesEditor variables={data.variables ?? []} onChange={v => onChange({ ...data, variables: v })} />
      <MatchConditionsEditor conditions={data.matchConditions ?? []} onChange={c => onChange({ ...data, matchConditions: c })} />
      <Divider sx={{ mb: 2 }} />
      <CelExpressionList items={data.validations} onChange={v => onChange({ ...data, validations: v })} label="Validation Expressions" />
    </Box>
  );
}
