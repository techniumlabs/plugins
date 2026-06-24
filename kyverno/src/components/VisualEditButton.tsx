import { ActionButton, ButtonStyle } from '@kinvolk/headlamp-plugin/lib/components/common';
import { KubeObject } from '@kinvolk/headlamp-plugin/lib/k8s/KubeObject';
import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { PolicyCreateDialog } from './create/PolicyCreateDialog';
import { makeApplyPolicyAction, validatePolicy } from './create/policySave';

interface VisualEditButtonProps {
  item: KubeObject;
  buttonStyle?: ButtonStyle;
  afterConfirm?: () => void;
}

/**
 * Menu/row action that opens the visual policy builder pre-filled with an existing
 * policy's JSON, letting the user edit and save it. Saving applies the change as an
 * update (the built object is merged onto the original so identity metadata such as
 * resourceVersion/uid/labels is preserved). The dialog closes only on a successful save.
 */
export function VisualEditButton({ item, buttonStyle, afterConfirm }: VisualEditButtonProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dispatch = useDispatch();

  const original: any = item?.jsonData ?? {};

  // Merge the freshly-built object onto the original so the spec/annotations from the
  // form replace the old ones, while the resource identity is preserved:
  // - apiVersion/kind stay as the original (an edit must target the same resource),
  // - resourceVersion/uid/labels/creationTimestamp/etc. are kept from the original.
  const mergeWithOriginal = (built: any) => ({
    ...built,
    apiVersion: original.apiVersion ?? built.apiVersion,
    kind: original.kind ?? built.kind,
    metadata: { ...(original.metadata ?? {}), ...(built.metadata ?? {}) },
  });

  const closeAll = () => {
    setError(null);
    setOpen(false);
    afterConfirm?.();
  };

  const handleSave = (built: object) => {
    setError(null);
    dispatch(
      makeApplyPolicyAction(mergeWithOriginal(built), {
        onSuccess: closeAll,
        onError: setError,
      }) as any
    );
  };

  const handleValidate = (built: object) => validatePolicy(mergeWithOriginal(built));

  return (
    <>
      <ActionButton
        description="Visual Edit"
        buttonStyle={buttonStyle}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        icon="mdi:pencil-box-outline"
      />
      {open && (
        <PolicyCreateDialog
          open={open}
          initialPolicy={original}
          onClose={closeAll}
          onCreate={handleSave}
          onValidate={handleValidate}
          errorMessage={error}
        />
      )}
    </>
  );
}
