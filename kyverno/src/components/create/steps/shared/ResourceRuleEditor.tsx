import { Icon } from '@iconify/react';
import {
  Autocomplete,
  Box, Button, Chip,   FormControl, IconButton, InputLabel, MenuItem,
Paper, Select, Stack,
TextField, Typography, } from '@mui/material';
import React from 'react';
import {makeResourceRule, ResourceRule } from '../../types';

const API_GROUP_SUGGESTIONS = ['', 'apps', 'batch', 'networking.k8s.io', 'rbac.authorization.k8s.io', 'policy', 'autoscaling', 'storage.k8s.io', 'kyverno.io', 'argoproj.io'];
const API_VERSION_SUGGESTIONS = ['v1', 'v1beta1', 'v1alpha1'];
const RESOURCE_SUGGESTIONS = ['pods', 'deployments', 'statefulsets', 'daemonsets', 'replicasets', 'services', 'configmaps', 'secrets', 'namespaces', 'ingresses', 'networkpolicies', 'serviceaccounts', 'clusterroles', 'clusterrolebindings', 'roles', 'rolebindings', 'jobs', 'cronjobs', 'persistentvolumeclaims', 'nodes'];
const OPERATIONS = ['CREATE', 'UPDATE', 'DELETE', 'CONNECT'];

interface ResourceRuleEditorProps {
  rules: ResourceRule[];
  onChange: (rules: ResourceRule[]) => void;
}

function StringChipInput({
  values,
  onChange,
  suggestions,
  label,
  placeholder,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  suggestions?: string[];
  label: string;
  placeholder?: string;
}) {
  const [inputValue, setInputValue] = React.useState('');

  const addValue = (v: string) => {
    const trimmed = v.trim();
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed]);
    }
    setInputValue('');
  };

  const removeValue = (v: string) => onChange(values.filter(x => x !== v));

  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
        {label}
      </Typography>
      <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mb: 0.5 }}>
        {values.map(v => (
          <Chip
            key={v}
            label={v === '' ? '(core)' : v}
            size="small"
            onDelete={() => removeValue(v)}
            color="primary"
            variant="outlined"
          />
        ))}
      </Stack>
      <Autocomplete
        freeSolo
        options={suggestions ?? []}
        inputValue={inputValue}
        onInputChange={(_, v) => setInputValue(v)}
        onChange={(_, v) => { if (v) addValue(v as string); }}
        renderInput={params => (
          <TextField
            {...params}
            size="small"
            placeholder={placeholder ?? `Add ${label.toLowerCase()}...`}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                addValue(inputValue);
              }
            }}
            onBlur={() => { if (inputValue) addValue(inputValue); }}
            sx={{ '& .MuiInputBase-root': { fontSize: '0.8rem' } }}
          />
        )}
      />
    </Box>
  );
}

function OperationsSelect({ values, onChange }: { values: string[]; onChange: (v: string[]) => void }) {
  return (
    <FormControl size="small" fullWidth>
      <InputLabel>Operations</InputLabel>
      <Select
        multiple
        label="Operations"
        value={values}
        onChange={e => onChange(e.target.value as string[])}
        renderValue={selected => (
          <Stack direction="row" flexWrap="wrap" gap={0.5}>
            {(selected as string[]).map(v => <Chip key={v} label={v} size="small" />)}
          </Stack>
        )}
      >
        {OPERATIONS.map(op => (
          <MenuItem key={op} value={op}>{op}</MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

export function ResourceRuleEditor({ rules, onChange }: ResourceRuleEditorProps) {
  const update = (idx: number, rule: ResourceRule) => {
    const next = [...rules];
    next[idx] = rule;
    onChange(next);
  };

  const remove = (idx: number) => onChange(rules.filter((_, i) => i !== idx));
  const add = () => onChange([...rules, makeResourceRule()]);

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Resource Rules</Typography>
        <Button size="small" startIcon={<Icon icon="mdi:plus" />} onClick={add} sx={{ textTransform: 'none' }}>
          Add rule
        </Button>
      </Stack>

      {rules.map((rule, i) => (
        <Paper key={rule.id} variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
              Resource Rule {i + 1}
            </Typography>
            {rules.length > 1 && (
              <IconButton size="small" onClick={() => remove(i)} color="error">
                <Icon icon="mdi:delete" style={{ fontSize: '1.1rem' }} />
              </IconButton>
            )}
          </Stack>

          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Box flex={1}>
                <StringChipInput
                  label="API Groups"
                  values={rule.apiGroups}
                  onChange={v => update(i, { ...rule, apiGroups: v })}
                  suggestions={API_GROUP_SUGGESTIONS}
                  placeholder='Add group (e.g. apps or "" for core)'
                />
              </Box>
              <Box flex={1}>
                <StringChipInput
                  label="API Versions"
                  values={rule.apiVersions}
                  onChange={v => update(i, { ...rule, apiVersions: v })}
                  suggestions={API_VERSION_SUGGESTIONS}
                  placeholder="Add version (e.g. v1)"
                />
              </Box>
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Box flex={1}>
                <StringChipInput
                  label="Resources"
                  values={rule.resources}
                  onChange={v => update(i, { ...rule, resources: v })}
                  suggestions={RESOURCE_SUGGESTIONS}
                  placeholder="Add resource (e.g. pods)"
                />
              </Box>
              <Box flex={1}>
                <OperationsSelect
                  values={rule.operations}
                  onChange={v => update(i, { ...rule, operations: v })}
                />
              </Box>
            </Stack>
          </Stack>
        </Paper>
      ))}
    </Box>
  );
}
