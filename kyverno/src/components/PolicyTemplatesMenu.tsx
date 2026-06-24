import { Icon } from '@iconify/react';
import { CreateResourceButton } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { KubeObject, KubeObjectInterface } from '@kinvolk/headlamp-plugin/lib/K8s/cluster';
import { Button, Menu, MenuItem } from '@mui/material';
import { useEffect, useMemo,useState } from 'react';
import { useDispatch } from 'react-redux';
import {
  ensureKyvernoPoliciesRepoCached,
  getPolicyTemplatesFromRepo,
  PolicyTemplate,
} from '../templates/policiesRepoCache';
import { PolicyCreateDialog } from './create/PolicyCreateDialog';
import { makeApplyPolicyAction, validatePolicy } from './create/policySave';


interface PolicyTemplatesMenuProps {
  policyKind: string;
  defaultTemplates?: PolicyTemplate[];
}


export type PolicySampleObject = Omit<KubeObjectInterface, 'metadata'> & {
  metadata: Partial<import('@kinvolk/headlamp-plugin/lib/K8s/KubeMetadata').KubeMetadata>;
};

export const PolicyCreateButton = ({ samplePolicyObj }: { samplePolicyObj: PolicySampleObject | null }) => {
  const ResourceClassWithSample = useMemo(() => {
    const kind = samplePolicyObj?.kind ?? 'Policy';
    const apiVersion = samplePolicyObj?.apiVersion ?? 'kyverno.io/v1';
    const apiName = kind.toLowerCase() + 's';
    const isNamespaced = samplePolicyObj?.metadata?.namespace !== undefined;

    class SamplePolicyCRClass extends KubeObject<any> {
      static kind = kind;
      static apiName = apiName;
      static apiVersion = apiVersion;
      static isNamespaced = isNamespaced;
      static getBaseObject() {
        return samplePolicyObj ?? KubeObject.getBaseObject();
      }
    }

    return SamplePolicyCRClass;
  }, [samplePolicyObj]);

  return <CreateResourceButton resourceClass={ResourceClassWithSample} />;
};

const KIND_TO_POLICY_TYPE: Record<string, string> = {
  GeneratingPolicy: 'generating', ClusterGeneratingPolicy: 'generating',
  ValidatingPolicy: 'validating', ClusterValidatingPolicy: 'validating',
  MutatingPolicy: 'mutation', ClusterMutatingPolicy: 'mutation',
  DeletingPolicy: 'deleting', ClusterDeletingPolicy: 'deleting',
  ImageValidatingPolicy: 'imageValidating', ClusterImageValidatingPolicy: 'imageValidating',
  ClusterPolicy: 'cluster', Policy: 'cluster',
};

export function PolicyTemplatesMenu({ policyKind, defaultTemplates = [] }: PolicyTemplatesMenuProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [templates, setTemplates] = useState<PolicyTemplate[]>(defaultTemplates);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const dispatch = useDispatch();

  const openCreateDialog = () => {
    setCreateError(null);
    setCreateDialogOpen(true);
  };

  const closeCreateDialog = () => {
    setCreateError(null);
    setCreateDialogOpen(false);
  };

  // Server-side validation (dry-run). Resolves if valid, rejects if invalid.
  const handleValidatePolicy = (policyJson: object) => validatePolicy(policyJson);

  // Apply the built policy. The dialog closes ONLY when the apply succeeds; on
  // error it stays open and shows the message.
  const handleCreatePolicy = (policyJson: object) => {
    setCreateError(null);
    dispatch(
      makeApplyPolicyAction(policyJson, {
        onSuccess: () => {
          setCreateError(null);
          setCreateDialogOpen(false);
        },
        onError: setCreateError,
      }) as any
    );
  };

  const load = async (forceRefresh = false) => {

    setIsSyncing(true);
    await ensureKyvernoPoliciesRepoCached(forceRefresh);
    const loaded = await getPolicyTemplatesFromRepo(policyKind, forceRefresh);
    setTemplates(() => {
      const defaults = defaultTemplates.filter(d => !loaded.some(t => t.id === d.id));
      return [...defaults, ...loaded];
    });
    setIsSyncing(false);
  };

  useEffect(() => {
    void load(false);
  }, [policyKind, defaultTemplates]);

  return (
    <>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        {templates.length === 0 ? (
          <MenuItem disabled>No {policyKind} templates found</MenuItem>
        ) : (
          templates.map(template => (
            <MenuItem
              key={template.id}
              onClick={event => {
                const btn = event.currentTarget.querySelector(
                  '[data-policy-create] button'
                ) as HTMLButtonElement | null;
                btn?.click();
                setAnchorEl(null);
              }}
              sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}
            >
              <span>{template.title}</span>
              <span
                data-policy-create
                role="presentation"
                onClick={e => e.stopPropagation()}
                onKeyDown={e => e.stopPropagation()}
              >
                <PolicyCreateButton samplePolicyObj={template.policy} />
              </span>
            </MenuItem>
          ))
        )}
      </Menu>

      {/* ── Visual Policy Builder ── */}
      <Button
        // variant="contained"
        sx={{ marginTop: '10px', textTransform: 'none', fontWeight: 600 }}
        startIcon={<Icon icon="mdi:plus-circle" />}
        onClick={openCreateDialog}
      >
        {/* Create Policy */}
      </Button>

      {/* <Button
        sx={{ marginTop: '10px' }}
        onClick={e => setAnchorEl(e.currentTarget)}
        disabled={isSyncing}
        startIcon={<Icon icon="mdi:plus-circle" />}
      >
        Policy Templates ({templates.length})
      </Button>
      <Button
        sx={{ marginTop: '10px' }}
        onClick={() => void load(true)}
        disabled={isSyncing}
        startIcon={<span aria-hidden>{isSyncing ? '...' : '\u21bb'}</span>}
      >
        {isSyncing ? 'Syncing...' : 'Sync Policies'}
      </Button> */}

      {createDialogOpen && (
        <PolicyCreateDialog
          open={createDialogOpen}
          onClose={closeCreateDialog}
          initialType={KIND_TO_POLICY_TYPE[policyKind] ?? 'validating'}
          onCreate={handleCreatePolicy}
          errorMessage={createError}
          onValidate={handleValidatePolicy}
        />
      )}
    </>
  );
}
