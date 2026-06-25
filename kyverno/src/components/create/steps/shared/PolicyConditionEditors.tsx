import { Icon } from '@iconify/react';
import {
  Box, Button, Chip, Collapse,
IconButton, Menu, MenuItem, Paper, Stack, TextField, Tooltip, Typography, } from '@mui/material';
import React from 'react';
import {
makeId, makeMatchCondition, makePolicyVariable,
  MatchConditionItem, PolicyVariable, } from '../../types';
import { CelExpressionBuilder } from './CelExpressionBuilder';

// Ready-to-use variable examples, adapted from real Kyverno policies. Picking one
// fills in a sensible name + expression the user can tweak.
const VARIABLE_EXAMPLES: { label: string; description: string; name: string; expression: string }[] = [
  {
    label: 'Current namespace name',
    description: "object.metadata.name",
    name: 'targetNs',
    expression: 'object.metadata.name',
  },
  {
    label: 'Requesting user',
    description: 'request.userInfo.username',
    name: 'username',
    expression: 'request.userInfo.username',
  },
  {
    label: "Fetch this object's namespace",
    description: "resource.Get('v1', 'namespaces', '', object.metadata.namespace)",
    name: 'namespaceData',
    expression: "resource.Get('v1', 'namespaces', '', object.metadata.namespace)",
  },
  {
    label: 'Namespace labels',
    description: 'labels of the resource namespace',
    name: 'namespaceLabels',
    expression: "resource.Get('v1', 'namespaces', '', object.metadata.namespace).metadata.labels",
  },
  {
    label: 'Label value (with default)',
    description: "read a label, fall back to a default when missing",
    name: 'teamLabel',
    expression:
      "has(object.metadata.labels) && 'team' in object.metadata.labels ? object.metadata.labels['team'] : 'unknown'",
  },
  {
    label: 'Has annotation?',
    description: 'true when a specific annotation is present',
    name: 'hasInjectAnnotation',
    expression:
      "has(object.metadata.annotations) && object.metadata.annotations.exists(k, k == 'linkerd.io/inject')",
  },
  {
    label: 'Workload containers (by kind)',
    description: 'containers for Pod / CronJob / other workloads',
    name: 'containers',
    expression:
      'object.kind == "Pod" ? object.spec.containers :\nobject.kind == "CronJob" ? object.spec.jobTemplate.spec.template.spec.containers :\nobject.spec.template.spec.containers',
  },
  {
    label: 'Fetch a ConfigMap',
    description: "resource.Get('v1', 'configmaps', ns, name)",
    name: 'configMap',
    expression: "resource.Get('v1', 'configmaps', object.metadata.namespace, 'my-config')",
  },
];

// ── Section wrapper: collapsible, optional, with count badge ────────────────────

interface OptionalSectionProps {
  title: string;
  hint: string;
  count: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function OptionalSection({ title, hint, count, defaultOpen, children }: OptionalSectionProps) {
  const [open, setOpen] = React.useState(defaultOpen ?? count > 0);

  return (
    <Paper
      variant="outlined"
      sx={{ p: 1.5, mb: 2, borderRadius: 2, background: 'rgba(255,255,255,0.015)' }}
    >
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ cursor: 'pointer' }}
        onClick={() => setOpen(o => !o)}
      >
        <Icon icon={open ? 'mdi:chevron-down' : 'mdi:chevron-right'} style={{ fontSize: '1.2rem' }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{title}</Typography>
        {count > 0 && (
          <Box
            sx={{
              minWidth: 20, height: 20, px: 0.75, borderRadius: 10,
              bgcolor: 'primary.main', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.7rem', fontWeight: 700,
            }}
          >
            {count}
          </Box>
        )}
        <Box flex={1} />
        <Tooltip title={hint}>
          <Icon icon="mdi:information-outline" style={{ fontSize: '1rem', opacity: 0.6 }} />
        </Tooltip>
      </Stack>
      <Collapse in={open} timeout="auto" unmountOnExit>
        <Box sx={{ pt: 1.5 }}>{children}</Box>
      </Collapse>
    </Paper>
  );
}

// ── Match Conditions editor (editable table of named CEL preconditions) ─────────

interface MatchConditionsEditorProps {
  conditions: MatchConditionItem[];
  onChange: (conditions: MatchConditionItem[]) => void;
}

export function MatchConditionsEditor({ conditions, onChange }: MatchConditionsEditorProps) {
  const update = (idx: number, c: MatchConditionItem) => {
    const next = [...conditions];
    next[idx] = c;
    onChange(next);
  };
  const remove = (idx: number) => onChange(conditions.filter((_, i) => i !== idx));
  const add = () => onChange([...conditions, makeMatchCondition()]);

  return (
    <OptionalSection
      title="Match Conditions (preconditions)"
      hint="CEL preconditions decide WHEN this policy runs. The policy is only evaluated if every match condition is true. All conditions are combined with AND."
      count={conditions.length}
    >
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
        Gate the policy so it only runs when these expressions are true. Useful to scope to specific
        resources (e.g. only run when an owner reference is missing). All rows must pass (AND).
      </Typography>

      {conditions.length === 0 && (
        <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 1.5, fontStyle: 'italic' }}>
          No match conditions — the policy runs for every matched resource.
        </Typography>
      )}

      {conditions.map((c, i) => (
        <Paper key={c.id} variant="outlined" sx={{ p: 1.5, mb: 1.5, borderRadius: 2 }}>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
            <Box
              sx={{
                width: 22, height: 22, borderRadius: 1, flexShrink: 0,
                bgcolor: 'rgba(99,102,241,0.15)', color: 'primary.main',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.72rem', fontWeight: 700,
              }}
            >
              {i + 1}
            </Box>
            <TextField
              size="small"
              label="Condition name"
              required
              value={c.name}
              sx={{ width: 260 }}
              onChange={e => update(i, { ...c, name: e.target.value })}
              placeholder="not-created-by-cronjob"
              helperText="Unique identifier (used in the generated YAML)"
            />
            <Box flex={1} />
            <IconButton size="small" onClick={() => remove(i)} color="error">
              <Icon icon="mdi:delete" style={{ fontSize: '1.1rem' }} />
            </IconButton>
          </Stack>
          <CelExpressionBuilder
            showMessage={false}
            label="When this is true"
            item={{ id: c.id, groups: c.groups, useRaw: c.useRaw, rawExpression: c.rawExpression, message: '' }}
            onChange={updated =>
              update(i, { ...c, groups: updated.groups, useRaw: updated.useRaw, rawExpression: updated.rawExpression })
            }
          />
        </Paper>
      ))}

      <Button
        size="small"
        variant="outlined"
        startIcon={<Icon icon="mdi:plus" />}
        onClick={add}
        sx={{ textTransform: 'none', fontSize: '0.75rem' }}
      >
        Add match condition
      </Button>
    </OptionalSection>
  );
}

// ── Variables editor (named reusable CEL expressions) ───────────────────────────

interface VariablesEditorProps {
  variables: PolicyVariable[];
  onChange: (variables: PolicyVariable[]) => void;
}

export function VariablesEditor({ variables, onChange }: VariablesEditorProps) {
  const update = (idx: number, v: PolicyVariable) => {
    const next = [...variables];
    next[idx] = v;
    onChange(next);
  };
  const remove = (idx: number) => onChange(variables.filter((_, i) => i !== idx));
  const add = () => onChange([...variables, makePolicyVariable()]);

  const [menuAnchor, setMenuAnchor] = React.useState<null | HTMLElement>(null);
  const insertExample = (ex: (typeof VARIABLE_EXAMPLES)[number]) => {
    // Avoid name clashes by suffixing if the name already exists.
    let name = ex.name;
    let n = 2;
    while (variables.some(v => v.name === name)) name = `${ex.name}${n++}`;
    onChange([...variables, { id: makeId(), name, expression: ex.expression }]);
    setMenuAnchor(null);
  };

  return (
    <OptionalSection
      title="Variables"
      hint="Named CEL expressions you can reference elsewhere as variables.<name>. Useful for fetching related resources or computing reusable values."
      count={variables.length}
    >
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
        Define a value once, then reference it as <code>variables.&lt;name&gt;</code> in match
        conditions and validation expressions. Not sure where to start? Use <strong>Examples</strong>.
      </Typography>

      {variables.length === 0 && (
        <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 1.5, fontStyle: 'italic' }}>
          No variables defined.
        </Typography>
      )}

      {variables.map((v, i) => (
        <Paper key={v.id} variant="outlined" sx={{ p: 1.5, mb: 1.5, borderRadius: 2 }}>
          {/* Name row + how to reference it + delete */}
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <Box
              sx={{
                width: 22, height: 22, borderRadius: 1, flexShrink: 0,
                bgcolor: 'rgba(99,102,241,0.15)', color: 'primary.main',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.72rem', fontWeight: 700,
              }}
            >
              {i + 1}
            </Box>
            <TextField
              size="small"
              label="Name"
              value={v.name}
              sx={{ width: 220 }}
              onChange={e => update(i, { ...v, name: e.target.value })}
              placeholder="namespaceData"
            />
            {v.name && (
              <Tooltip title="Reference this variable in other expressions">
                <Chip
                  size="small"
                  variant="outlined"
                  label={`variables.${v.name}`}
                  sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}
                />
              </Tooltip>
            )}
            <Box flex={1} />
            <IconButton size="small" onClick={() => remove(i)} color="error">
              <Icon icon="mdi:delete" style={{ fontSize: '1.1rem' }} />
            </IconButton>
          </Stack>

          {/* Expression — full width, readable monospace, grows with content */}
          <TextField
            fullWidth
            size="small"
            label="Value (CEL expression)"
            value={v.expression}
            multiline
            minRows={2}
            maxRows={12}
            onChange={e => update(i, { ...v, expression: e.target.value })}
            placeholder="resource.Get('v1', 'namespaces', '', object.metadata.namespace)"
            inputProps={{ style: { fontFamily: 'monospace', fontSize: '0.85rem', lineHeight: 1.5 } }}
          />
        </Paper>
      ))}

      <Stack direction="row" spacing={1}>
        <Button
          size="small"
          variant="outlined"
          startIcon={<Icon icon="mdi:plus" />}
          onClick={add}
          sx={{ textTransform: 'none', fontSize: '0.75rem' }}
        >
          Add variable
        </Button>
        <Button
          size="small"
          variant="text"
          startIcon={<Icon icon="mdi:lightbulb-on-outline" />}
          onClick={e => setMenuAnchor(e.currentTarget)}
          sx={{ textTransform: 'none', fontSize: '0.75rem' }}
        >
          Examples
        </Button>
      </Stack>

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
        {VARIABLE_EXAMPLES.map(ex => (
          <MenuItem key={ex.label} onClick={() => insertExample(ex)} sx={{ display: 'block', py: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>{ex.label}</Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontFamily: 'monospace', display: 'block', whiteSpace: 'normal', maxWidth: 460 }}
            >
              {ex.description}
            </Typography>
          </MenuItem>
        ))}
      </Menu>
    </OptionalSection>
  );
}
