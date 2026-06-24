import { Icon } from '@iconify/react';
import {
Box,   Dialog, DialogTitle, IconButton,   Stack, Typography,
useTheme, } from '@mui/material';
import React from 'react';
import { parsePolicyToFormState } from './parsePolicyToFormState';
import { PolicyCreateForm } from './PolicyCreateForm';
import { makeDefaultFormState } from './types';

export interface PolicyCreateDialogProps {
  open: boolean;
  onClose: () => void;
  /** Called with the fully-built K8s JSON object when user clicks the submit button.
   *  The caller is responsible for closing the dialog on success. */
  onCreate: (policyJson: object) => void;
  /** Pre-select a policy type when opening (ignored when initialPolicy is provided). */
  initialType?: any;
  /** Existing policy to edit. When provided, the form is pre-filled from it. */
  initialPolicy?: object | null;
  /** Error from the save attempt. When set, the dialog stays open and shows it. */
  errorMessage?: string | null;
  /** Server-side validation (dry-run). Resolves if valid, rejects if invalid. */
  onValidate?: (policyJson: object) => Promise<void>;
  /** Header title. Defaults to a create-oriented title. */
  title?: string;
  /** Submit button label. Defaults to "Create Policy". */
  submitLabel?: string;
}

export function PolicyCreateDialog({
  open, onClose, onCreate, initialType, initialPolicy, errorMessage, onValidate, title, submitLabel,
}: PolicyCreateDialogProps) {

  const theme = useTheme();
  const isEdit = !!initialPolicy;

  const initialState = React.useMemo(() => {
    if (initialPolicy) {
      return parsePolicyToFormState(initialPolicy);
    }
    const s = makeDefaultFormState();
    if (initialType) s.type = initialType;
    return s;
  }, [initialType, initialPolicy, open]);

  // Do NOT close here — closing happens only after a successful apply, handled by
  // the caller via onCreate. On error the dialog stays open to show the message.
  const handleCreate = (policyJson: object) => {
    onCreate(policyJson);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          height: '90vh',
          maxHeight: 860,
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 3,
          background: theme.palette.mode === 'dark'
            ? 'linear-gradient(135deg, #0f0f1e 0%, #1a1a2e 100%)'
            : '#fff',
          border: '1px solid',
          borderColor: 'rgba(99,102,241,0.2)',
          overflow: 'hidden',
        },
      }}
    >
      {/* Header */}
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pb: 1,
          background: 'linear-gradient(90deg, rgba(99,102,241,0.12) 0%, transparent 100%)',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: 2,
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(99,102,241,0.4)',
            }}
          >
            <Icon icon="mdi:shield-check" style={{ color: '#fff', fontSize: 20 }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
              {title ?? (isEdit ? 'Edit Kyverno Policy' : 'Create Kyverno Policy')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {isEdit ? 'Edit and save this policy visually' : 'Build and configure a policy visually'}
            </Typography>
          </Box>
        </Stack>
        <IconButton onClick={onClose} size="small">
          <Icon icon="mdi:close" />
        </IconButton>
      </DialogTitle>

      {/* Form — takes all remaining height */}
      <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <PolicyCreateForm
          initialState={initialState}
          onSubmit={handleCreate}
          onCancel={onClose}
          errorMessage={errorMessage}
          onValidate={onValidate}
          submitLabel={submitLabel ?? (isEdit ? 'Save Changes' : 'Create Policy')}
        />
      </Box>
    </Dialog>
  );
}
