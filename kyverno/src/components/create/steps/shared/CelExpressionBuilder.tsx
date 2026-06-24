import { Icon } from '@iconify/react';
import {
  Autocomplete,   Box, Button, Chip, FormControl,
FormControlLabel,
IconButton,   InputLabel, MenuItem, Paper, Select, Stack,
Switch, TextField, Tooltip, Typography, } from '@mui/material';
import React from 'react';
import { compileCelExpression } from '../../buildPolicyObject';
import {
CelCondition, CelConditionGroup,   CelExpressionItem, CelOperator,
makeCelCondition,   makeCelExpression, makeCelGroup,
} from '../../types';

// ── Field suggestions (common K8s/CEL paths) ──────────────────────────────────

const FIELD_SUGGESTIONS = [
  'object.metadata.name',
  'object.metadata.namespace',
  'object.metadata.labels',
  'object.metadata.annotations',
  'object.metadata.creationTimestamp',
  'object.spec.replicas',
  'object.spec.containers',
  'object.spec.serviceAccountName',
  'object.spec.hostNetwork',
  'object.spec.hostPID',
  'object.spec.hostIPC',
  'object.spec.volumes',
  'object.spec.nodeSelector',
  'object.spec.tolerations',
  'object.spec.securityContext',
  'object.spec.type',
  'object.spec.selector',
  'object.spec.template',
  'object.spec.schedule',
  'object.spec.source',
  'object.spec.destination',
];

const OPERATORS: { value: CelOperator; label: string; needsValue: boolean; hint: string }[] = [
  { value: 'equals', label: '== equals', needsValue: true, hint: 'object.spec.replicas == 3' },
  { value: 'notEquals', label: '!= not equals', needsValue: true, hint: 'object.spec.type != "NodePort"' },
  { value: 'greaterThan', label: '> greater than', needsValue: true, hint: 'object.spec.replicas > 0' },
  { value: 'lessThan', label: '< less than', needsValue: true, hint: 'object.spec.replicas < 10' },
  { value: 'greaterOrEqual', label: '>= greater or eq', needsValue: true, hint: 'object.spec.replicas >= 1' },
  { value: 'lessOrEqual', label: '<= less or eq', needsValue: true, hint: 'object.spec.replicas <= 5' },
  { value: 'has', label: 'has field', needsValue: false, hint: 'has(object.spec.source)' },
  { value: 'notHas', label: 'does not have', needsValue: false, hint: '!has(object.spec.chart)' },
  { value: 'startsWith', label: 'starts with', needsValue: true, hint: 'object.metadata.name.startsWith("prod-")' },
  { value: 'endsWith', label: 'ends with', needsValue: true, hint: 'object.metadata.name.endsWith("-prod")' },
  { value: 'contains', label: 'contains', needsValue: true, hint: 'object.metadata.name.contains("prod")' },
  { value: 'matches', label: 'matches regex', needsValue: true, hint: 'object.metadata.name.matches(".*-prod$")' },
  { value: 'in', label: 'in list', needsValue: true, hint: 'object.spec.type in [ClusterIP, NodePort]' },
  { value: 'sizeEquals', label: 'count ==', needsValue: true, hint: 'size(object.spec.containers) == 4' },
  { value: 'sizeGreater', label: 'count >', needsValue: true, hint: 'size(object.spec.containers) > 1' },
  { value: 'sizeLess', label: 'count <', needsValue: true, hint: 'size(object.spec.containers) < 10' },
  { value: 'allMatch', label: 'all items match', needsValue: true, hint: 'object.spec.containers.all(e, e.image != "")' },
  { value: 'anyMatch', label: 'any item matches', needsValue: true, hint: 'object.spec.containers.exists(e, e.name == "app")' },
  { value: 'raw', label: '{ } raw CEL', needsValue: true, hint: 'Write any valid CEL expression' },
];

// ── Single condition row ───────────────────────────────────────────────────────

interface ConditionRowProps {
  condition: CelCondition;
  onChange: (c: CelCondition) => void;
  onRemove: () => void;
  showRemove: boolean;
}

function ConditionRow({ condition, onChange, onRemove, showRemove }: ConditionRowProps) {
  const op = OPERATORS.find(o => o.value === condition.operator) ?? OPERATORS[0];

  return (
    <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ mb: 1 }}>
      {/* Field path */}
      <Autocomplete
        freeSolo
        options={FIELD_SUGGESTIONS}
        value={condition.fieldPath}
        onInputChange={(_, v) => onChange({ ...condition, fieldPath: v })}
        sx={{ flex: 2, minWidth: 200 }}
        renderInput={params => (
          <TextField {...params} size="small" label="Field path" placeholder="object.spec.replicas" />
        )}
      />

      {/* Operator */}
      <FormControl size="small" sx={{ flex: 1, minWidth: 160 }}>
        <InputLabel>Operator</InputLabel>
        <Select
          label="Operator"
          value={condition.operator}
          onChange={e => onChange({ ...condition, operator: e.target.value as CelOperator })}
        >
          {OPERATORS.map(o => (
            <MenuItem key={o.value} value={o.value}>
              <Tooltip title={o.hint} placement="right">
                <span>{o.label}</span>
              </Tooltip>
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Iteration variable for all/exists */}
      {(condition.operator === 'allMatch' || condition.operator === 'anyMatch') && (
        <TextField
          size="small"
          label="Item var"
          value={condition.loopVar ?? 'e'}
          onChange={e => onChange({ ...condition, loopVar: e.target.value })}
          placeholder="e"
          sx={{ width: 90 }}
          helperText="used in body"
        />
      )}

      {/* Value */}
      {op.needsValue && (
        <TextField
          size="small"
          label={
            condition.operator === 'in'
              ? 'Values (comma-sep)'
              : condition.operator === 'raw'
              ? 'CEL expression'
              : condition.operator === 'allMatch' || condition.operator === 'anyMatch'
              ? `Body (use "${condition.loopVar ?? 'e'}")`
              : 'Value'
          }
          value={condition.value}
          onChange={e => onChange({ ...condition, value: e.target.value })}
          placeholder={op.hint}
          sx={{ flex: 2 }}
          multiline={condition.operator === 'raw' || condition.operator === 'allMatch' || condition.operator === 'anyMatch'}
          minRows={condition.operator === 'raw' ? 2 : 1}
        />
      )}

      {/* Remove */}
      {showRemove && (
        <IconButton size="small" onClick={onRemove} color="error" sx={{ mt: 0.5 }}>
          <Icon icon="mdi:delete" style={{ fontSize: '1.1rem' }} />
        </IconButton>
      )}
    </Stack>
  );
}

// ── Condition group (AND group) ────────────────────────────────────────────────

interface ConditionGroupProps {
  group: CelConditionGroup;
  groupIndex: number;
  onChange: (g: CelConditionGroup) => void;
  onRemove: () => void;
  showRemove: boolean;
}

function ConditionGroupBlock({ group, groupIndex, onChange, onRemove, showRemove }: ConditionGroupProps) {
  const updateCondition = (idx: number, c: CelCondition) => {
    const conditions = [...group.conditions];
    conditions[idx] = c;
    onChange({ ...group, conditions });
  };

  const removeCondition = (idx: number) => {
    onChange({ ...group, conditions: group.conditions.filter((_, i) => i !== idx) });
  };

  const addCondition = () => {
    onChange({ ...group, conditions: [...group.conditions, makeCelCondition()] });
  };

  return (
    <Paper
      variant="outlined"
      sx={{ p: 1.5, mb: 1.5, borderRadius: 2, background: 'rgba(255,255,255,0.03)', position: 'relative' }}
    >
      {groupIndex > 0 && (
        <Chip
          label="OR"
          size="small"
          color="warning"
          sx={{ position: 'absolute', top: -12, left: 12, fontWeight: 700, fontSize: '0.65rem' }}
        />
      )}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
          {groupIndex === 0 ? 'Condition' : `OR Condition ${groupIndex + 1}`}
        </Typography>
        {showRemove && (
          <IconButton size="small" onClick={onRemove} color="error">
            <Icon icon="mdi:delete" style={{ fontSize: '1.1rem' }} />
          </IconButton>
        )}
      </Stack>

      {group.conditions.map((c, i) => (
        <Box key={c.id}>
          {i > 0 && (
            <Typography variant="caption" color="primary" sx={{ display: 'block', ml: 1, mb: 0.5, fontWeight: 700 }}>
              AND
            </Typography>
          )}
          <ConditionRow
            condition={c}
            onChange={updated => updateCondition(i, updated)}
            onRemove={() => removeCondition(i)}
            showRemove={group.conditions.length > 1}
          />
        </Box>
      ))}

      <Button
        size="small"
        startIcon={<Icon icon="mdi:plus" />}
        onClick={addCondition}
        sx={{ mt: 0.5, textTransform: 'none', fontSize: '0.75rem' }}
      >
        AND condition
      </Button>
    </Paper>
  );
}

// ── Main CelExpressionBuilder ──────────────────────────────────────────────────

interface CelExpressionBuilderProps {
  item: CelExpressionItem;
  onChange: (item: CelExpressionItem) => void;
  label?: string;
  showMessage?: boolean;
}

export function CelExpressionBuilder({ item, onChange, label = 'Expression', showMessage = true }: CelExpressionBuilderProps) {
  const compiled = compileCelExpression(item);

  const updateGroup = (idx: number, g: CelConditionGroup) => {
    const groups = [...item.groups];
    groups[idx] = g;
    onChange({ ...item, groups });
  };

  const removeGroup = (idx: number) => {
    onChange({ ...item, groups: item.groups.filter((_, i) => i !== idx) });
  };

  const addGroup = () => {
    onChange({ ...item, groups: [...item.groups, makeCelGroup()] });
  };

  return (
    <Box>
      {/* Mode toggle */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{label}</Typography>
        <Tooltip title={item.useRaw ? 'Switch to visual builder' : 'Switch to raw CEL editor'}>
          <Button
            size="small"
            variant="outlined"
            startIcon={item.useRaw ? <Icon icon="mdi:tune" /> : <Icon icon="mdi:code-tags" />}
            onClick={() => onChange({ ...item, useRaw: !item.useRaw })}
            sx={{ textTransform: 'none', fontSize: '0.72rem' }}
          >
            {item.useRaw ? 'Visual builder' : 'Raw CEL'}
          </Button>
        </Tooltip>
      </Stack>

      {item.useRaw ? (
        /* Raw CEL textarea */
        <TextField
          fullWidth
          multiline
          minRows={3}
          size="small"
          label="CEL Expression"
          value={item.rawExpression}
          onChange={e => onChange({ ...item, rawExpression: e.target.value })}
          placeholder="has(object.spec.source) && object.spec.replicas > 0"
          sx={{ fontFamily: 'monospace', mb: 1 }}
          inputProps={{ style: { fontFamily: 'monospace', fontSize: '0.82rem' } }}
        />
      ) : (
        /* Visual builder */
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            Build the rule with simple rows. Rows inside a block are joined with <strong>AND</strong>;
            separate blocks are joined with <strong>OR</strong>. Switch to <strong>Raw CEL</strong> for full control.
          </Typography>
          {item.groups.map((g, i) => (
            <ConditionGroupBlock
              key={g.id}
              group={g}
              groupIndex={i}
              onChange={g2 => updateGroup(i, g2)}
              onRemove={() => removeGroup(i)}
              showRemove={item.groups.length > 1}
            />
          ))}

          <Button
            size="small"
            variant="outlined"
            color="warning"
            startIcon={<Icon icon="mdi:plus" />}
            onClick={addGroup}
            sx={{ textTransform: 'none', fontSize: '0.75rem', mb: 1 }}
          >
            OR condition group
          </Button>

          {/* Preview */}
          {compiled && (
            <Paper
              variant="outlined"
              sx={{
                p: 1, mt: 1, borderRadius: 1,
                background: 'rgba(99,102,241,0.06)',
                borderColor: 'rgba(99,102,241,0.3)',
              }}
            >
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.3 }}>
                Generated CEL:
              </Typography>
              <Typography
                variant="caption"
                sx={{ fontFamily: 'monospace', color: 'primary.main', wordBreak: 'break-all' }}
              >
                {compiled}
              </Typography>
            </Paper>
          )}
        </Box>
      )}

      {/* Message field — supports static text or a CEL messageExpression */}
      {showMessage && (
        <Box sx={{ mt: 1.5 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
              {item.messageIsExpression ? 'Message (CEL expression)' : 'Error message'}
            </Typography>
            <FormControlLabel
              sx={{ m: 0 }}
              control={
                <Switch
                  size="small"
                  checked={!!item.messageIsExpression}
                  onChange={e => onChange({ ...item, messageIsExpression: e.target.checked })}
                />
              }
              label={
                <Typography variant="caption" color="text.secondary">
                  Dynamic (CEL)
                </Typography>
              }
            />
          </Stack>
          <TextField
            fullWidth
            size="small"
            value={item.message}
            onChange={e => onChange({ ...item, message: e.target.value })}
            placeholder={
              item.messageIsExpression
                ? `"Image " + image + " is not allowed"`
                : 'Describe what this validation enforces'
            }
            multiline={item.messageIsExpression}
            inputProps={
              item.messageIsExpression ? { style: { fontFamily: 'monospace', fontSize: '0.82rem' } } : undefined
            }
          />
        </Box>
      )}
    </Box>
  );
}

// ── Multi-expression list (for validations[]) ──────────────────────────────────

interface CelExpressionListProps {
  items: CelExpressionItem[];
  onChange: (items: CelExpressionItem[]) => void;
  label?: string;
}

export function CelExpressionList({ items, onChange, label = 'Validation Expressions' }: CelExpressionListProps) {
  const update = (idx: number, item: CelExpressionItem) => {
    const next = [...items];
    next[idx] = item;
    onChange(next);
  };

  const remove = (idx: number) => onChange(items.filter((_, i) => i !== idx));
  const add = () => onChange([...items, makeCelExpression()]);

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{label}</Typography>
        <Button size="small" startIcon={<Icon icon="mdi:plus" />} onClick={add} sx={{ textTransform: 'none' }}>
          Add expression
        </Button>
      </Stack>

      {items.map((item, i) => (
        <Paper key={item.id} variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
              Expression {i + 1}
            </Typography>
            {items.length > 1 && (
              <IconButton size="small" onClick={() => remove(i)} color="error">
                <Icon icon="mdi:delete" style={{ fontSize: '1.1rem' }} />
              </IconButton>
            )}
          </Stack>
          <CelExpressionBuilder item={item} onChange={updated => update(i, updated)} />
        </Paper>
      ))}
    </Box>
  );
}
