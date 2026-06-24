import { Button, Menu, MenuItem } from '@mui/material';
import { useEffect, useState, useMemo } from 'react';
import {
  ensureKyvernoPoliciesRepoCached,
  getPolicyTemplatesFromRepo,
  PolicyTemplate,
} from '../templates/policiesRepoCache';


import { CreateResourceButton } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { KubeObject, KubeObjectInterface } from '@kinvolk/headlamp-plugin/lib/K8s/cluster';

import { Icon } from '@iconify/react';


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


export function PolicyTemplatesMenu({ policyKind, defaultTemplates = [] }: PolicyTemplatesMenuProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [templates, setTemplates] = useState<PolicyTemplate[]>(defaultTemplates);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

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
              <span data-policy-create onClick={e => e.stopPropagation()}>
                <PolicyCreateButton samplePolicyObj={template.policy} />
              </span>
            </MenuItem>
          ))
        )}
      </Menu>
      <Button
        sx={{ marginTop: '10px' }}
        onClick={e => setAnchorEl(e.currentTarget)}
        disabled={isSyncing}
        startIcon={<Icon icon="mdi:plus-circle" />    }
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
      </Button>
    </>
  );
}
