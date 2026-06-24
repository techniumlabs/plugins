import { Icon } from '@iconify/react';
import {
  Autocomplete, Box, Button, Chip, CircularProgress, Collapse, FormControl,
Grid, InputLabel, MenuItem, Paper, Select, Stack,
TextField, ToggleButton, ToggleButtonGroup,   Tooltip,   Typography, } from '@mui/material';
import React from 'react';
import { getPolicyTemplatesFromRepo, PolicyTemplate } from '../../../templates/policiesRepoCache';
import { parsePolicyToFormState, POLICY_TYPE_TO_KINDS } from '../parsePolicyToFormState';
import { makeDefaultFormState, PolicyFormState, PolicyScope,PolicyType } from '../types';

const POLICY_TYPES: { value: PolicyType; label: string; icon: string; description: string; apiVersion: string }[] = [
  { value: 'validating',      label: 'Validating',       icon: '✅', description: 'Validate resources using CEL expressions', apiVersion: 'policies.kyverno.io/v1alpha1' },
  { value: 'mutation',        label: 'Mutating',          icon: '✏️', description: 'Mutate resources using CEL ApplyConfiguration', apiVersion: 'policies.kyverno.io/v1alpha1' },
  { value: 'generating',      label: 'Generating',        icon: '⚙️', description: 'Generate downstream resources automatically', apiVersion: 'policies.kyverno.io/v1alpha1' },
  { value: 'deleting',        label: 'Deleting',          icon: '🗑️', description: 'Clean up resources on a schedule', apiVersion: 'policies.kyverno.io/v1alpha1' },
  { value: 'imageValidating', label: 'Image Validating',  icon: '🔐', description: 'Verify image signatures and attestations', apiVersion: 'policies.kyverno.io/v1alpha1' },
  { value: 'cluster',         label: 'Cluster Policy',    icon: '☸️', description: 'Traditional kyverno.io/v1 ClusterPolicy/Policy', apiVersion: 'kyverno.io/v1' },
];

const SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
const COMMON_SUBJECTS = ['Pod', 'Deployment', 'Service', 'Namespace', 'ConfigMap', 'Secret', 'Ingress', 'StatefulSet', 'DaemonSet', 'CronJob', 'Job', 'ServiceAccount'];
const COMMON_CATEGORIES = ['Best Practices', 'Security', 'Multi-Tenancy', 'Other', 'Pod Security', 'Network', 'Storage', 'RBAC'];

// ── Template picker ─────────────────────────────────────────────────────────

interface TemplatePickerProps {
  type: PolicyType;
  appliedTitle: string | null;
  onApply: (template: PolicyTemplate) => void;
  onClear: () => void;
}

function TemplatePicker({ type, appliedTitle, onApply, onClear }: TemplatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [allTemplates, setAllTemplates] = React.useState<PolicyTemplate[]>([]);
  const [loaded, setLoaded] = React.useState(false);

  const kinds = POLICY_TYPE_TO_KINDS[type] ?? [];
  const templates = React.useMemo(
    () => allTemplates.filter(t => kinds.includes(t.policy?.kind as string)),
    [allTemplates, kinds]
  );

  const load = React.useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const all = await getPolicyTemplatesFromRepo(undefined, forceRefresh);
      setAllTemplates(all);
      setLoaded(true);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !loaded && !loading) void load(false);
  };

  return (
    <Paper variant="outlined" sx={{ p: 1.5, mb: 3, borderRadius: 2, background: 'rgba(99,102,241,0.04)' }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ cursor: 'pointer' }} onClick={handleToggle}>
        <Icon icon="mdi:file-document-multiple-outline" style={{ fontSize: '1.2rem' }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          Start from a template (optional)
        </Typography>
        {appliedTitle && (
          <Chip
            size="small"
            color="primary"
            label={appliedTitle}
            onDelete={e => { (e as any).stopPropagation?.(); onClear(); }}
            sx={{ maxWidth: 280 }}
          />
        )}
        <Box flex={1} />
        <Icon icon={open ? 'mdi:chevron-up' : 'mdi:chevron-down'} style={{ fontSize: '1.3rem' }} />
      </Stack>

      <Collapse in={open} timeout="auto" unmountOnExit>
        <Box sx={{ pt: 1.5 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
            Pick a ready-made <strong>{type}</strong> policy to pre-fill the form. You can edit every
            field afterwards and then create it.
          </Typography>

          <Stack direction="row" spacing={1} alignItems="center">
            <Autocomplete
              sx={{ flex: 1 }}
              size="small"
              loading={loading}
              options={templates}
              getOptionLabel={o => o.title || o.name}
              isOptionEqualToValue={(o, v) => o.id === v.id}
              onChange={(_, value) => { if (value) onApply(value); }}
              renderOption={(props, option) => (
                <li {...props} key={option.id}>
                  <Stack>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{option.title || option.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {option.policy?.kind} · {option.name}
                    </Typography>
                  </Stack>
                </li>
              )}
              renderInput={params => (
                <TextField
                  {...params}
                  placeholder={loading ? 'Loading templates...' : `Search ${templates.length} template(s)...`}
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {loading ? <CircularProgress size={16} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />
            <Tooltip title="Refresh templates from the Kyverno repository">
              <span>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => void load(true)}
                  disabled={loading}
                  sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
                >
                  Sync
                </Button>
              </span>
            </Tooltip>
          </Stack>

          {error && (
            <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1 }}>
              {error}
            </Typography>
          )}
          {loaded && !loading && templates.length === 0 && !error && (
            <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 1, fontStyle: 'italic' }}>
              No templates available for this policy type.
            </Typography>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
}

interface Step1BasicInfoProps {
  state: PolicyFormState;
  onChange: (state: PolicyFormState) => void;
}

export function Step1BasicInfo({ state, onChange }: Step1BasicInfoProps) {
  const [appliedTitle, setAppliedTitle] = React.useState<string | null>(null);

  const set = (partial: Partial<PolicyFormState>) => onChange({ ...state, ...partial });
  const setAnn = (partial: Partial<PolicyFormState['annotations']>) =>
    onChange({ ...state, annotations: { ...state.annotations, ...partial } });

  const selectType = (type: PolicyType) => {
    // Switching type manually invalidates any applied template.
    setAppliedTitle(null);
    set({ type });
  };

  const applyTemplate = (template: PolicyTemplate) => {
    onChange(parsePolicyToFormState(template.policy));
    setAppliedTitle(template.title || template.name);
  };

  const clearTemplate = () => {
    setAppliedTitle(null);
    onChange({ ...makeDefaultFormState(), type: state.type, scope: state.scope });
  };

  return (
    <Box>
      {/* ── Policy Type ── */}
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
        Policy Type
      </Typography>
      <Grid container spacing={1.5} sx={{ mb: 3 }}>
        {POLICY_TYPES.map(t => (
          <Grid item xs={12} sm={6} md={4} key={t.value}>
            <Box
              onClick={() => selectType(t.value)}
              sx={{
                p: 1.5,
                borderRadius: 2,
                border: '2px solid',
                borderColor: state.type === t.value ? 'primary.main' : 'divider',
                background: state.type === t.value ? 'rgba(99,102,241,0.08)' : 'transparent',
                cursor: 'pointer',
                transition: 'all 0.15s',
                '&:hover': { borderColor: 'primary.light', background: 'rgba(99,102,241,0.04)' },
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                <Typography sx={{ fontSize: '1.2rem' }}>{t.icon}</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{t.label}</Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                {t.description}
              </Typography>
              <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.disabled', fontSize: '0.68rem' }}>
                {t.apiVersion}
              </Typography>
            </Box>
          </Grid>
        ))}
      </Grid>

      {/* ── Template picker ── */}
      <TemplatePicker
        type={state.type}
        appliedTitle={appliedTitle}
        onApply={applyTemplate}
        onClear={clearTemplate}
      />

      {/* ── Scope ── */}
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
        Scope
        <Tooltip title="Cluster-scoped applies to all namespaces. Namespaced applies only to one namespace.">
          <Icon icon="mdi:information-outline" style={{ marginLeft: 4, fontSize: 16, verticalAlign: 'middle', color: 'inherit' }} />
        </Tooltip>
      </Typography>
      <ToggleButtonGroup
        value={state.scope}
        exclusive
        onChange={(_, v) => { if (v) set({ scope: v as PolicyScope }); }}
        size="small"
        sx={{ mb: 3 }}
      >
        <ToggleButton value="cluster">🌐 Cluster-scoped (recommended)</ToggleButton>
        <ToggleButton value="namespace">📁 Namespaced</ToggleButton>
      </ToggleButtonGroup>

      {/* ── Basic fields ── */}
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
        Identity
      </Typography>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={state.scope === 'namespace' ? 6 : 12}>
          <TextField
            fullWidth
            size="small"
            label="Policy Name"
            required
            value={state.name}
            onChange={e => set({ name: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '') })}
            placeholder="my-policy-name"
            helperText="Lowercase letters, numbers, and hyphens only"
          />
        </Grid>
        {state.scope === 'namespace' && (
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              size="small"
              label="Namespace"
              required
              value={state.namespace}
              onChange={e => set({ namespace: e.target.value })}
              placeholder="default"
            />
          </Grid>
        )}
      </Grid>

      {/* ── Annotations ── */}
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
        Annotations (optional)
      </Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth size="small" label="Title"
            value={state.annotations.title}
            onChange={e => setAnn({ title: e.target.value })}
            placeholder="Require Resource Limits"
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth size="small">
            <InputLabel>Severity</InputLabel>
            <Select label="Severity" value={state.annotations.severity} onChange={e => setAnn({ severity: e.target.value as any })}>
              {SEVERITIES.map(s => <MenuItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</MenuItem>)}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth size="small" label="Category"
            value={state.annotations.category}
            onChange={e => setAnn({ category: e.target.value })}
            placeholder="Best Practices"
            inputProps={{ list: 'categories' }}
          />
          <datalist id="categories">
            {COMMON_CATEGORIES.map(c => <option key={c} value={c} />)}
          </datalist>
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth size="small" label="Subject"
            value={state.annotations.subject}
            onChange={e => setAnn({ subject: e.target.value })}
            placeholder="Pod"
            inputProps={{ list: 'subjects' }}
          />
          <datalist id="subjects">
            {COMMON_SUBJECTS.map(s => <option key={s} value={s} />)}
          </datalist>
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth size="small" label="Min Kyverno Version"
            value={state.annotations.minversion}
            onChange={e => setAnn({ minversion: e.target.value })}
            placeholder="1.14.0"
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth size="small" label="Description" multiline minRows={2}
            value={state.annotations.description}
            onChange={e => setAnn({ description: e.target.value })}
            placeholder="Describe what this policy enforces..."
          />
        </Grid>
      </Grid>
    </Box>
  );
}
