import { clusterAction } from '@kinvolk/headlamp-plugin/lib';
import {
  ActionButton,
  ButtonStyle,
  ConfirmDialog,
} from '@kinvolk/headlamp-plugin/lib/components/common';
import { KubeObject } from '@kinvolk/headlamp-plugin/lib/k8s/KubeObject';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';

interface GenerateOnetimeButtonProps {
  item: KubeObject;
  buttonStyle?: ButtonStyle;
  afterConfirm?: () => void;
}

export function GenerateOneTimeButton(props: GenerateOnetimeButtonProps) {
  const { item, buttonStyle, afterConfirm } = props;
  const [openDialog, setOpenDialog] = useState(false);
  const { t } = useTranslation(['translation']);
  const dispatch = useDispatch();

  const name = item?.jsonData?.metadata?.name || item?.kind || 'policy';

  function setGenerateExisting(enabled: boolean) {
    return item.patch({ spec: { evaluation: { generateExisting: { enabled } } } });
  }

  function handleConfirm() {
    setOpenDialog(false);
    afterConfirm?.();

    // Dispatch a clusterAction so the user gets the standard
    // applying/applied/failed snackbar notifications (with an undo grace period),
    // instead of patching directly and waiting on a timeout.
    dispatch(
      clusterAction(
        async () => {
          // Toggle off first if already enabled so the change re-triggers generation.
          if (item?.jsonData?.spec?.evaluation?.generateExisting?.enabled) {
            await setGenerateExisting(false);
          }
          await setGenerateExisting(true);
        },
        {
          startMessage: t('Generating resources for {{ name }}…', { name }),
          cancelledMessage: t('Cancelled generating resources for {{ name }}.', { name }),
          successMessage: t('Generated resources for {{ name }}.', { name }),
          errorMessage: t('Failed to generate resources for {{ name }}.', { name }),
        }
      ) as any
    );
  }

  return (
    <>
      <ActionButton
        description={t('Generate Onetime')}
        buttonStyle={buttonStyle}
        onClick={() => setOpenDialog(true)}
        icon="mdi:update"
      />
      <ConfirmDialog
        open={openDialog}
        title={t('Generate Onetime')}
        description={t('Are you sure you want to generate onetime?')}
        handleClose={() => setOpenDialog(false)}
        onConfirm={handleConfirm}
        cancelLabel={t('Cancel')}
        confirmLabel={t('Update')}
      />
    </>
  );
}
