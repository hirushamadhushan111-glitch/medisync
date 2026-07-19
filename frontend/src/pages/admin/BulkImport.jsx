/**
 * BulkImport.jsx — admin CSV import of patients.
 * Download the template, choose a CSV (≤500 rows), upload, and review
 * the per-row result summary (created / skipped / errors).
 */
import { useRef, useState } from 'react';
import { Upload, FileSpreadsheet, CheckCircle, XCircle, AlertCircle, Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import adminService from '../../api/services/AdminApiService';

// Example CSV the admin can download and fill in.
const CSV_TEMPLATE = [
  'name,email,phone,NIC,password,dateOfBirth,gender,age,address,bloodGroup,emergencyName,emergencyPhone,emergencyRelation',
  'John Doe,john@example.com,0771234567,123456789V,Password123,1990-05-15,male,34,123 Main St,A+,Jane Doe,0779876543,spouse',
  'Mary Smith,mary@example.com,0712345678,987654321V,,1985-08-20,female,38,456 Oak Ave,O-,,,',
].join('\n');

// Download the CSV template in the browser.
const downloadTemplate = () => {
  const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'patient_import_template.csv';
  a.click();
  URL.revokeObjectURL(url);
};

// Page component.
const BulkImport = () => {
  const { t } = useTranslation();
  const fileRef          = useRef(null);
  const [file, setFile]  = useState(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState(null);
  const [error, setError]       = useState('');

  // Check the chosen file is a CSV and stage it.
  const handleFile = (f) => {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.csv')) {
      setError(t('bulkImport.csvOnly2'));
      return;
    }
    setFile(f);
    setResult(null);
    setError('');
  };

  // Drag-and-drop version of handleFile.
  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  // Upload the CSV and show the per-row results.
  const handleSubmit = async () => {
    if (!file) { setError(t('bulkImport.selectFirst')); return; }
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await adminService.importPatients(file);
      setResult(res);
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
    } catch (err) {
      setError(err.response?.data?.message || t('bulkImport.failedImport'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pl-56 pt-16 min-h-screen">
      <div className="p-6 max-w-3xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
            <Upload size={20} className="text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">{t('bulkImport.title')}</h1>
            <p className="text-sm text-gray-500">{t('bulkImport.subtitle')}</p>
          </div>
        </div>

        {/* CSV rules card + template download */}
        <div className="bg-blue-50 rounded-2xl p-4 mb-5 border border-blue-100">
          <h3 className="text-sm font-semibold text-blue-800 mb-2">{t('bulkImport.csvFormat')}</h3>
          <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
            <li><strong>{t('bulkImport.requiredCols')}</strong></li>
            <li><strong>{t('bulkImport.optionalCols')}</strong></li>
            <li>{t('bulkImport.defaultPassword')}</li>
            <li>{t('bulkImport.duplicateSkip')}</li>
            <li>{t('bulkImport.maxRows')}</li>
          </ul>
          <button type="button" onClick={downloadTemplate}
            className="mt-3 flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:text-blue-900 transition-colors">
            <Download size={13} /> {t('bulkImport.downloadTemplate')}
          </button>
        </div>

        {/* Drag-and-drop zone (also opens the file picker on click);
            border colour shows the state: dragging / file chosen / empty */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={`cursor-pointer rounded-2xl border-2 border-dashed flex flex-col items-center justify-center py-12 px-6 transition-colors ${
            dragging ? 'border-blue-400 bg-blue-50' : file ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50'
          }`}
        >
          {file ? (
            <>
              <FileSpreadsheet size={40} className="text-green-500 mb-3" />
              <p className="font-medium text-gray-800">{file.name}</p>
              <p className="text-xs text-gray-400 mt-1">{(file.size / 1024).toFixed(1)} KB — {t('bulkImport.clickToChange')}</p>
            </>
          ) : (
            <>
              <Upload size={40} className="text-gray-300 mb-3" />
              <p className="font-medium text-gray-600">{t('bulkImport.dropHere')}</p>
              <p className="text-xs text-gray-400 mt-1">{t('bulkImport.csvOnly')}</p>
            </>
          )}
          <input ref={fileRef} type="file" accept=".csv,text/csv,application/vnd.ms-excel" className="hidden"
            onChange={(e) => handleFile(e.target.files[0])} />
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border-l-4 border-red-400 text-red-700 rounded-xl p-3 text-sm mt-4">
            <AlertCircle size={15} className="flex-shrink-0" />
            {error}
          </div>
        )}

        <button type="button" onClick={handleSubmit} disabled={loading || !file}
          className="mt-4 w-full h-11 rounded-xl font-semibold text-sm bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
          {loading ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              {t('bulkImport.importing')}
            </>
          ) : (
            <><Upload size={15} /> {t('bulkImport.importBtn')}</>
          )}
        </button>

        {/* Results card: created/skipped/error counts + per-row error list */}
        {result && (
          <div className="mt-5 bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-800 mb-4">{t('bulkImport.importResults')}</h3>
            <p className="text-sm text-gray-500 mb-4">{result.message}</p>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-green-50 rounded-xl p-3 text-center">
                <CheckCircle size={20} className="text-green-500 mx-auto mb-1" />
                <div className="text-2xl font-bold text-green-700">{result.created}</div>
                <div className="text-xs text-green-600">{t('bulkImport.created')}</div>
              </div>
              <div className="bg-amber-50 rounded-xl p-3 text-center">
                <AlertCircle size={20} className="text-amber-500 mx-auto mb-1" />
                <div className="text-2xl font-bold text-amber-700">{result.skipped}</div>
                <div className="text-xs text-amber-600">{t('bulkImport.skipped')}</div>
              </div>
              <div className="bg-red-50 rounded-xl p-3 text-center">
                <XCircle size={20} className="text-red-500 mx-auto mb-1" />
                <div className="text-2xl font-bold text-red-700">{result.errors?.length || 0}</div>
                <div className="text-xs text-red-600">{t('bulkImport.errors')}</div>
              </div>
            </div>

            {result.errors && result.errors.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-red-700 mb-2">{t('bulkImport.rowErrors')}</h4>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {result.errors.map((e, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs bg-red-50 rounded-lg px-3 py-2">
                      <span className="font-medium text-red-600 flex-shrink-0">Row {e.row}:</span>
                      <span className="text-red-700">{e.error}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BulkImport;
