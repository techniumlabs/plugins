import { Icon } from '@iconify/react';
import {
Alert,
  Box, Button, CircularProgress, Divider, IconButton, Stack, Step, StepLabel, Stepper, TextField, Tooltip, Typography,
} from '@mui/material';
import React, { useState } from 'react';
import { buildPolicyObject } from './buildPolicyObject';
import { ClusterBody } from './steps/ClusterBodyStep';
import {
DeletingBody, GeneratingBody, ImageValidatingBody,
MutatingBody,   ValidatingBody, } from './steps/PolicyBodySteps';
import { ResourceRuleEditor } from './steps/shared/ResourceRuleEditor';
import { Step1BasicInfo } from './steps/Step1_BasicInfo';
import { makeDefaultFormState,PolicyFormState } from './types';

const STEPS = ['Basic Info', 'Match Constraints', 'Policy Body', 'Review & Create'];

const JSON_BOX_SX = {
  m: 0,
  p: 2,
  borderRadius: 2,
  background: 'rgba(15, 15, 30, 0.85)',
  border: '1px solid rgba(99,102,241,0.25)',
  color: '#a5f3fc',
  fontFamily: 'monospace',
  fontSize: '0.78rem',
  overflowX: 'auto',
  maxHeight: 480,
  overflowY: 'auto',
  lineHeight: 1.6,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-all',
} as const;

interface ReviewStepProps {
  generatedText: string;
  manualJson: string | null;
  editing: boolean;
  jsonError: string | null;
  onToggleEdit: () => void;
  onChangeJson: (value: string) => void;
  onReset: () => void;
}

function ReviewStep({
  generatedText, manualJson, editing, jsonError, onToggleEdit, onChangeJson, onReset,
}: ReviewStepProps) {
  const displayText = manualJson ?? generatedText;
  const isManual = manualJson !== null;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          {editing ? 'Edit Policy JSON' : 'Generated Policy JSON'}
        </Typography>
        <Stack direction="row" spacing={0.5} alignItems="center">
          {isManual && (
            <Tooltip title="Discard manual edits and regenerate from the form">
              <IconButton size="small" onClick={onReset} color="warning">
                <Icon icon="mdi:refresh" style={{ fontSize: '1.1rem' }} />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title={editing ? 'Done editing' : 'Edit JSON manually'}>
            <IconButton
              size="small"
              onClick={onToggleEdit}
              color={editing ? 'primary' : 'default'}
            >
              <Icon icon={editing ? 'mdi:check' : 'mdi:pencil'} style={{ fontSize: '1.1rem' }} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      {editing ? (
        <TextField
          fullWidth
          multiline
          minRows={18}
          maxRows={26}
          value={displayText}
          onChange={e => onChangeJson(e.target.value)}
          error={!!jsonError}
          inputProps={{ style: { fontFamily: 'monospace', fontSize: '0.78rem', lineHeight: 1.6 } }}
        />
      ) : (
        <Box component="pre" sx={JSON_BOX_SX}>
          {displayText}
        </Box>
      )}

      {jsonError && <Alert severity="error" sx={{ mt: 1 }}>{jsonError}</Alert>}
      {isManual && !jsonError && (
        <Alert severity="warning" sx={{ mt: 1 }}>
          This JSON was edited manually and no longer reflects the form fields above. Use the
          refresh icon to regenerate from the form.
        </Alert>
      )}
    </Box>
  );
}

interface PolicyCreateFormProps {
  initialState?: PolicyFormState;
  onSubmit: (policyJson: object) => void;
  onCancel: () => void;
  /** Error from the apply/save attempt (keeps the dialog open and is shown to the user). */
  errorMessage?: string | null;
  /** Server-side validation (dry-run apply). Resolves if valid, rejects with an error if invalid. */
  onValidate?: (policyJson: object) => Promise<void>;
  /** Label for the final submit button. Defaults to "Create Policy". */
  submitLabel?: string;
}

export function PolicyCreateForm({ initialState, onSubmit, onCancel, errorMessage, onValidate, submitLabel = 'Create Policy' }: PolicyCreateFormProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [state, setState] = useState<PolicyFormState>(initialState ?? makeDefaultFormState());
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Review-step manual JSON editing.
  const [manualJson, setManualJson] = useState<string | null>(null);
  const [editingJson, setEditingJson] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Review-step server-side validation (dry-run).
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<{ ok: boolean; message: string } | null>(null);

  const isClusterType = state.type === 'cluster';

  // Generated JSON text from the current form state (used when not manually edited).
  const generatedText = React.useMemo(() => {
    try {
      return JSON.stringify(buildPolicyObject(state), null, 2);
    } catch (e: any) {
      return `// Error building policy: ${e?.message ?? 'unknown'}`;
    }
  }, [state]);

  const resetManualJson = () => {
    setManualJson(null);
    setEditingJson(false);
    setJsonError(null);
  };

  const handleToggleEditJson = () => {
    setEditingJson(prev => {
      const next = !prev;
      if (next && manualJson === null) setManualJson(generatedText);
      return next;
    });
  };

  const handleChangeJson = (value: string) => {
    setManualJson(value);
    setValidation(null);
    try {
      JSON.parse(value);
      setJsonError(null);
    } catch (e: any) {
      setJsonError(`Invalid JSON: ${e?.message ?? 'parse error'}`);
    }
  };

  // Build the policy object to submit/validate (manual JSON overrides the form).
  const buildObject = (): object => (manualJson !== null ? JSON.parse(manualJson) : buildPolicyObject(state));

  // Step 2 is "Match Constraints" for new types, "Rules (Match)" for cluster — but for cluster
  // we skip step 2 and do all rules in step 3
  const effectiveSteps = isClusterType
    ? ['Basic Info', 'Policy Rules', 'Review & Create']
    : STEPS;

  const canProceed = () => {
    if (activeStep === 0) return state.name.length > 0;
    return true;
  };

  const handleNext = () => setActiveStep(s => Math.min(s + 1, effectiveSteps.length - 1));
  const handleBack = () => {
    // Leaving the review step discards manual JSON edits so the form stays the source of truth.
    resetManualJson();
    setValidation(null);
    setActiveStep(s => Math.max(s - 1, 0));
  };

  const handleSubmit = () => {
    setSubmitError(null);
    try {
      onSubmit(buildObject());
    } catch (e: any) {
      setSubmitError(e?.message ?? 'Unknown error building policy');
    }
  };

  const handleValidate = async () => {
    if (!onValidate) return;
    setSubmitError(null);
    setValidation(null);
    let obj: object;
    try {
      obj = buildObject();
    } catch (e: any) {
      setSubmitError(e?.message ?? 'Unknown error building policy');
      return;
    }
    setValidating(true);
    try {
      await onValidate(obj);
      setValidation({ ok: true, message: 'Policy is valid — the API server accepted it (dry run).' });
    } catch (e: any) {
      setValidation({ ok: false, message: e?.message ?? 'Validation failed.' });
    } finally {
      setValidating(false);
    }
  };

  // Map step index to content — cluster has 3 steps, others have 4
  const renderStepContent = () => {
    if (activeStep === 0) {
      return <Step1BasicInfo state={state} onChange={setState} />;
    }

    if (isClusterType) {
      if (activeStep === 1) {
        return <ClusterBody data={state.cluster} onChange={d => setState({ ...state, cluster: d })} />;
      }
      if (activeStep === 2) {
        return (
          <ReviewStep
            generatedText={generatedText}
            manualJson={manualJson}
            editing={editingJson}
            jsonError={jsonError}
            onToggleEdit={handleToggleEditJson}
            onChangeJson={handleChangeJson}
            onReset={resetManualJson}
          />
        );
      }
    } else {
      if (activeStep === 1) {
        return (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Define which Kubernetes resources this policy applies to.
            </Typography>
            <ResourceRuleEditor rules={state.resourceRules} onChange={r => setState({ ...state, resourceRules: r })} />
          </Box>
        );
      }
      if (activeStep === 2) {
        if (state.type === 'validating')
          return <ValidatingBody data={state.validating} onChange={d => setState({ ...state, validating: d })} />;
        if (state.type === 'mutation')
          return <MutatingBody data={state.mutation} onChange={d => setState({ ...state, mutation: d })} />;
        if (state.type === 'generating')
          return <GeneratingBody data={state.generating} onChange={d => setState({ ...state, generating: d })} />;
        if (state.type === 'deleting')
          return <DeletingBody data={state.deleting} onChange={d => setState({ ...state, deleting: d })} />;
        if (state.type === 'imageValidating')
          return <ImageValidatingBody data={state.imageValidating} onChange={d => setState({ ...state, imageValidating: d })} />;
      }
      if (activeStep === 3) {
        return (
          <ReviewStep
            generatedText={generatedText}
            manualJson={manualJson}
            editing={editingJson}
            jsonError={jsonError}
            onToggleEdit={handleToggleEditJson}
            onChangeJson={handleChangeJson}
            onReset={resetManualJson}
          />
        );
      }
    }
    return null;
  };

  const isReviewStep = activeStep === effectiveSteps.length - 1;
  const isFirstStep = activeStep === 0;

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Stepper header */}
      <Box sx={{ px: 3, pt: 2, pb: 1 }}>
        <Stepper activeStep={activeStep} alternativeLabel>
          {effectiveSteps.map(label => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Box>

      <Divider />

      {/* Step content */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 3, py: 2 }}>
        {isReviewStep && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Review the generated policy JSON below. Click the <strong>pencil icon</strong> to edit it
            manually, then click <strong>Create Policy</strong> to submit.
          </Alert>
        )}
        {renderStepContent()}
        {validation && (
          <Alert severity={validation.ok ? 'success' : 'error'} sx={{ mt: 2 }}>
            {validation.message}
          </Alert>
        )}
        {submitError && <Alert severity="error" sx={{ mt: 2 }}>{submitError}</Alert>}
        {errorMessage && <Alert severity="error" sx={{ mt: 2 }}>{errorMessage}</Alert>}
      </Box>

      {/* Navigation */}
      <Divider />
      <Stack direction="row" justifyContent="space-between" sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onCancel} color="inherit" sx={{ textTransform: 'none' }}>
          Cancel
        </Button>
        <Stack direction="row" spacing={1}>
          {!isFirstStep && (
            <Button onClick={handleBack} variant="outlined" sx={{ textTransform: 'none' }}>
              Back
            </Button>
          )}
          {!isReviewStep ? (
            <Button
              onClick={handleNext}
              variant="contained"
              disabled={!canProceed()}
              sx={{ textTransform: 'none' }}
            >
              Next
            </Button>
          ) : (
            <>
              {onValidate && (
                <Button
                  onClick={handleValidate}
                  variant="outlined"
                  disabled={!!jsonError || validating}
                  startIcon={validating ? <CircularProgress size={16} /> : <Icon icon="mdi:shield-search" />}
                  sx={{ textTransform: 'none' }}
                >
                  {validating ? 'Validating…' : 'Validate'}
                </Button>
              )}
              <Button
                onClick={handleSubmit}
                variant="contained"
                color="success"
                disabled={!!jsonError || validating}
                sx={{ textTransform: 'none', fontWeight: 700 }}
              >
                {submitLabel}
              </Button>
            </>
          )}
        </Stack>
      </Stack>
    </Box>
  );
}
