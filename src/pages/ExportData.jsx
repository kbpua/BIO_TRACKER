import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { Link } from 'react-router-dom';
import { exportSamplesCSV, exportSamplesPDF } from '../utils/export';
import { getVisibleSamples } from '../utils/visibility';

export default function ExportData() {
  const { canExportCSV, canExportPDF, user } = useAuth();
  const { samples, organisms, projects } = useData();

  if (!canExportCSV && !canExportPDF) {
    return (
      <div className="max-w-md mx-auto mt-12 text-center">
        <h1 className="text-xl font-semibold text-gray-800 mb-2">Access Denied</h1>
        <p className="text-gray-600 mb-4">You do not have permission to export data.</p>
        <Link to="/dashboard" className="text-mint-600 font-medium hover:underline">Return to Dashboard</Link>
      </div>
    );
  }

  const visibleSamples = getVisibleSamples(samples, projects, user);

  const handleExportCSV = () => exportSamplesCSV(visibleSamples, organisms, projects);
  const handleExportPDF = () => exportSamplesPDF(visibleSamples, organisms, projects);

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">Export Data</h1>
      <p className="text-gray-600 mb-6">
        Export the full sample dataset. To export only filtered results, go to the Samples page, apply filters, and use the Export buttons there.
      </p>
      <div className="bg-white rounded-xl border border-mint-100 shadow-sm p-6 space-y-4">
        <p className="text-sm text-gray-500">Total samples: <span className="font-semibold text-gray-800">{visibleSamples.length}</span></p>
        <div className="flex flex-wrap gap-3">
          {canExportCSV && (
            <button
              type="button"
              onClick={handleExportCSV}
              className="px-4 py-2 bg-mint-600 text-white font-medium rounded-lg hover:bg-mint-700"
            >
              Export CSV
            </button>
          )}
          {canExportPDF && (
            <button
              type="button"
              onClick={handleExportPDF}
              className="px-4 py-2 bg-white border border-mint-300 text-mint-700 font-medium rounded-lg hover:bg-mint-50"
            >
              Export PDF
            </button>
          )}
        </div>
        <Link to="/samples" className="inline-block text-sm text-mint-600 hover:text-mint-800 font-medium">
          → Go to Samples to filter and export
        </Link>
      </div>
    </div>
  );
}
