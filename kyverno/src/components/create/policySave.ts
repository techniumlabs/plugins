import { ApiProxy, clusterAction } from '@kinvolk/headlamp-plugin/lib';

// Map each policy kind to its REST resource (plural) name for building dry-run URLs.
const POLICY_KIND_PLURALS: Record<string, string> = {
  ValidatingPolicy: 'validatingpolicies',
  MutatingPolicy: 'mutatingpolicies',
  GeneratingPolicy: 'generatingpolicies',
  DeletingPolicy: 'deletingpolicies',
  ImageValidatingPolicy: 'imagevalidatingpolicies',
  ClusterPolicy: 'clusterpolicies',
  Policy: 'policies',
};

/**
 * Server-side validation via a dry-run POST: the API server checks the schema and
 * runs admission webhooks without persisting anything. Resolves if the policy is
 * valid, rejects with the API error message if not. Uses the same path/body as the
 * real apply so a passing validation means the create/update will be accepted.
 */
export async function validatePolicy(policyJson: object): Promise<void> {
  const obj = policyJson as any;
  const apiVersion: string | undefined = obj?.apiVersion;
  const plural = POLICY_KIND_PLURALS[obj?.kind ?? ''];
  if (!apiVersion || !plural) {
    throw new Error(`Cannot validate: unknown policy kind "${obj?.kind ?? ''}".`);
  }
  const ns: string | undefined = obj?.metadata?.namespace;
  const base = `/apis/${apiVersion}/${ns ? `namespaces/${ns}/` : ''}${plural}`;
  // autoLogoutOnAuthError = false so a 403 surfaces as a validation error instead of logging out.
  await ApiProxy.post(`${base}?dryRun=All`, obj as any, false);
}

interface ApplyCallbacks {
  onSuccess?: () => void;
  onError?: (message: string) => void;
}

/**
 * Build a clusterAction that applies (creates or updates) a policy, mirroring
 * Headlamp's EditorDialog save: the user gets the standard applying/applied/failed
 * notifications. `onSuccess` runs only after a successful apply; `onError` runs on
 * failure (the error is also rethrown so clusterAction shows its error snackbar).
 *
 * Dispatch the returned value: `dispatch(makeApplyPolicyAction(obj, cbs) as any)`.
 */
export function makeApplyPolicyAction(policyJson: object, cbs: ApplyCallbacks = {}) {
  const obj = policyJson as any;
  const name = obj?.metadata?.name || obj?.kind || 'policy';
  return clusterAction(
    async () => {
      try {
        await ApiProxy.apply(obj);
      } catch (err: any) {
        const msg = err?.message || `Failed to apply ${name}.`;
        cbs.onError?.(msg);
        // Rethrow so clusterAction reports the failure via its error snackbar.
        throw new Error(msg);
      }
      cbs.onSuccess?.();
    },
    {
      startMessage: `Applying ${name}…`,
      cancelledMessage: `Cancelled applying ${name}.`,
      successMessage: `Applied ${name}.`,
      errorMessage: `Failed to apply ${name}.`,
    }
  );
}
