// Shared mapping from pending_approval.action → display metadata.
// Consumed by both Queue (chip + filter) and DetailPage (header chip).
const META = {
  request_add:    { label: 'Add request',    chipCls: 'dash-chip--blue'  },
  request_change: { label: 'Change request', chipCls: 'dash-chip--amber' },
  request_delete: { label: 'Delete request', chipCls: 'dash-chip--red'   },
};

const FALLBACK = { label: 'Unknown', chipCls: 'dash-chip--grey' };

export function actionMeta(action) {
  return META[action] ?? FALLBACK;
}

export const ACTION_FILTER_OPTIONS = [
  { value: '',               label: 'All actions'    },
  { value: 'request_add',    label: 'Add request'    },
  { value: 'request_change', label: 'Change request' },
  { value: 'request_delete', label: 'Delete request' },
];
