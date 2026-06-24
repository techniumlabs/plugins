import { Icon } from '@iconify/react';
import {
  Box, Button, Collapse,
IconButton, Paper, Stack, TextField, Tooltip, Typography, } from '@mui/material';
import React from 'react';
import {
makeMatchCondition, makePolicyVariable,
  MatchConditionItem, PolicyVariable, } from '../../types';
import { CelExpressionBuilder } from './CelExpressionBuilder';

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

  return (
    <OptionalSection
      title="Variables"
      hint="Named CEL expressions you can reference elsewhere as variables.<name>. Useful for fetching related resources or computing reusable values."
      count={variables.length}
    >
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
        Define reusable values once and reference them as <code>variables.&lt;name&gt;</code> in
        match conditions and validation expressions.
      </Typography>

      {variables.length === 0 && (
        <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 1.5, fontStyle: 'italic' }}>
          No variables defined.
        </Typography>
      )}

      {variables.map((v, i) => (
        <Stack key={v.id} direction="row" spacing={1.5} alignItems="flex-start" sx={{ mb: 1.5 }}>
          <TextField
            size="small"
            label="Name"
            value={v.name}
            sx={{ flex: 1 }}
            onChange={e => update(i, { ...v, name: e.target.value })}
            placeholder="namespaceData"
          />
          <TextField
            size="small"
            label="CEL expression"
            value={v.expression}
            sx={{ flex: 2 }}
            multiline
            onChange={e => update(i, { ...v, expression: e.target.value })}
            placeholder="resource.Get('v1', 'namespaces', '', request.namespace)"
            inputProps={{ style: { fontFamily: 'monospace', fontSize: '0.8rem' } }}
          />
          <IconButton size="small" onClick={() => remove(i)} color="error" sx={{ mt: 0.5 }}>
            <Icon icon="mdi:delete" style={{ fontSize: '1.1rem' }} />
          </IconButton>
        </Stack>
      ))}

      <Button
        size="small"
        variant="outlined"
        startIcon={<Icon icon="mdi:plus" />}
        onClick={add}
        sx={{ textTransform: 'none', fontSize: '0.75rem' }}
      >
        Add variable
      </Button>
    </OptionalSection>
  );
}
