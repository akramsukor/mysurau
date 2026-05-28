// Placeholder — replaced in Slice 4
import { useParams } from 'react-router-dom';

export default function DetailPage() {
  const { auditId } = useParams();
  return (
    <div className="dash-placeholder">
      <h2>Request #{auditId}</h2>
      <p>Detail / compare view coming in Slice 4.</p>
    </div>
  );
}
