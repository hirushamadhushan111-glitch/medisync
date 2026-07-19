/**
 * RolePermissions.jsx — admin permission matrix (UC20).
 *
 * A checkbox grid of permission keys × roles. Unticking DENIES that
 * permission for the role (deny-only overlay enforced by the backend's
 * authMiddleware); admin's own column is locked so admins can't lock
 * themselves out. Reset restores the defaults.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyRound, Lock, RotateCcw } from 'lucide-react';
import { adminService } from '../../api';
import Toast from '../../components/Toast.jsx';

const ROLE_STYLES = {
  patient: 'bg-blue-100 text-blue-700',
  doctor:  'bg-green-100 text-green-700',
  staff:   'bg-amber-100 text-amber-700',
  admin:   'bg-purple-100 text-purple-700',
};

const ROLES = ['patient', 'doctor', 'staff', 'admin'];

// Page component.
const RolePermissions = () => {
  const { t } = useTranslation();
  const [catalog, setCatalog] = useState([]);
  const [defaults, setDefaults] = useState({});
  const [manageable, setManageable] = useState([]);
  const [matrix, setMatrix] = useState({});
  const [saved, setSaved] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Fetch the permission catalog + saved matrix.
  const load = async () => {
    setLoading(true); setError('');
    try {
      const data = await adminService.getRolePermissions();
      setCatalog(data.catalog);
      setDefaults(data.defaults);
      setManageable(data.manageableRoles);
      setMatrix(data.roles);
      setSaved(data.roles);
    } catch (err) {
      setError(err.response?.data?.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // A permission can only be toggled if the role has it by default (deny-only overlay).
  const isAvailable = (role, key) => (defaults[role] || []).includes(key);
  // Admin column is locked — admins can't remove their own access.
  const isEditable = (role, key) => manageable.includes(role) && isAvailable(role, key);
  // Is this permission currently ticked for the role?
  const hasPermission = (role, key) => (matrix[role] || []).includes(key);

  // Tick/untick one permission for one role.
  const toggle = (role, key) => {
    if (!isEditable(role, key)) return;
    setMatrix((prev) => {
      const current = prev[role] || [];
      const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key];
      return { ...prev, [role]: next };
    });
  };

  // Restore a role's checkboxes to the defaults.
  const resetRole = (role) => {
    setMatrix((prev) => ({ ...prev, [role]: [...(defaults[role] || [])] }));
  };

  // Roles whose ticks differ from what's saved — enables the Save button.
  const changedRoles = manageable.filter(
    (role) => JSON.stringify([...(matrix[role] || [])].sort()) !== JSON.stringify([...(saved[role] || [])].sort())
  );

  // Save every changed role to the server.
  const saveAll = async () => {
    setSaving(true); setError(''); setMessage('');
    try {
      for (const role of changedRoles) {
        await adminService.updateRolePermissions(role, matrix[role]);
      }
      setSaved(matrix);
      setMessage(t('rolePerms.saved'));
    } catch (err) {
      setError(err.response?.data?.message || t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pl-56 pt-16 min-h-screen bg-blue-50">
      <div className="p-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center">
            <KeyRound size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-blue-900">{t('rolePerms.title')}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{t('rolePerms.subtitle')}</p>
          </div>
        </div>

        <Toast error={error} message={message} onClearError={() => setError('')} onClearMessage={() => setMessage('')} />

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div>
              <div className="text-base font-bold text-blue-900">{t('rolePerms.matrixTitle')}</div>
              <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                <Lock size={11} /> {t('rolePerms.adminLocked')}
              </div>
            </div>
            <button type="button" onClick={saveAll} disabled={saving || changedRoles.length === 0}
              className="h-10 px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-colors disabled:opacity-50">
              {saving ? t('common.loading') : t('rolePerms.saveBtn')}
              {changedRoles.length > 0 && !saving && ` (${changedRoles.length})`}
            </button>
          </div>

          {/* Permission matrix: one row per permission, one column per role.
              Each cell: "—" (not available to that role), purple tick (admin,
              locked), or a toggle (patient/doctor/staff — deny-only). */}
          {loading ? (
            <div className="text-center text-gray-400 py-10">{t('common.loading')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-blue-50">
                    <th className="text-left text-xs font-bold text-blue-900 uppercase tracking-wide px-4 py-3 border-b-2 border-blue-100">
                      {t('rolePerms.permission')}
                    </th>
                    {ROLES.map((role) => (
                      <th key={role} className="text-center text-xs font-bold px-4 py-3 border-b-2 border-blue-100">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${ROLE_STYLES[role]}`}>
                            {t(`rolePerms.role_${role}`)}
                          </span>
                          {manageable.includes(role) ? (
                            <button type="button" onClick={() => resetRole(role)}
                              title={t('rolePerms.resetDefaults')}
                              className="text-[10px] text-gray-400 hover:text-blue-600 flex items-center gap-0.5 transition-colors">
                              <RotateCcw size={9} /> {t('rolePerms.reset')}
                            </button>
                          ) : (
                            <span className="text-[10px] text-gray-300 flex items-center gap-0.5"><Lock size={9} /> {t('rolePerms.locked')}</span>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {catalog.map((key) => (
                    <tr key={key} className="border-b border-gray-50 hover:bg-blue-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-900">{t(`rolePerms.perm_${key}`)}</div>
                        <div className="text-[10px] text-gray-400 font-mono">{key}</div>
                      </td>
                      {ROLES.map((role) => (
                        <td key={role} className="px-4 py-3 text-center">
                          {!isAvailable(role, key) ? (
                            <span className="text-gray-200 text-xs">—</span>
                          ) : !manageable.includes(role) ? (
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-purple-100 text-purple-600 text-xs font-bold">✓</span>
                          ) : (
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input type="checkbox" className="sr-only peer"
                                checked={hasPermission(role, key)} onChange={() => toggle(role, key)} />
                              <div className="w-8 h-4 bg-gray-200 rounded-full peer peer-checked:bg-blue-600 after:absolute after:top-0.5 after:left-0.5 after:w-3 after:h-3 after:bg-white after:rounded-full after:transition-all peer-checked:after:translate-x-4" />
                            </label>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-800">
            {t('rolePerms.helpNote')}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RolePermissions;
