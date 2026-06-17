import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  getOwnProfile,
  updateOwnProfile,
  type CustomerProfile,
  type OwnProfileUpdateBody,
} from '../api/customers';
import { ApiError } from '../api/http';
import { StatusBadge } from '../components/StatusBadge';
import { Layout } from '../components/Layout';

type EditFields = {
  fullName: string;
  phone: string;
  jobTitle: string;
};

export function ProfilePage() {
  const { state } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editFields, setEditFields] = useState<EditFields>({ fullName: '', phone: '', jobTitle: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const accessToken = state.accessToken ?? '';

  const loadProfile = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getOwnProfile(accessToken);
      setProfile(data);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        void navigate('/login', { replace: true });
      } else {
        setError(err instanceof ApiError ? err.message : 'Failed to load your profile.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, navigate]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const startEdit = () => {
    if (!profile) return;
    setEditFields({
      fullName: profile.fullName,
      phone: profile.phone ?? '',
      jobTitle: profile.jobTitle ?? '',
    });
    setSaveError(null);
    setSaveSuccess(false);
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!profile) return;
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const body: OwnProfileUpdateBody = {
        fullName: editFields.fullName.trim() || undefined,
        phone: editFields.phone.trim() || null,
        jobTitle: editFields.jobTitle.trim() || null,
      };
      const updated = await updateOwnProfile(accessToken, body);
      setProfile(updated);
      setIsEditing(false);
      setSaveSuccess(true);
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : 'Failed to save changes.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="p-6">
          <div role="alert" className="rounded-md bg-red-50 p-4 text-sm text-red-700 border border-red-200">
            {error}
          </div>
        </div>
      </Layout>
    );
  }

  if (!profile) return null;

  return (
    <Layout>
      <div className="p-6 max-w-2xl">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-3">
              My Profile
              <StatusBadge status={profile.status} />
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">{profile.email}</p>
          </div>
          {!isEditing && (
            <button
              onClick={startEdit}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50"
            >
              Edit
            </button>
          )}
        </div>

        {saveSuccess && (
          <div role="status" className="mb-4 rounded-md bg-green-50 p-4 text-sm text-green-700 border border-green-200">
            Profile updated successfully.
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">
            Contact Details
          </h3>

          {isEditing ? (
            <div className="space-y-4">
              <Field label="Display name">
                <input
                  type="text"
                  value={editFields.fullName}
                  onChange={(e) => setEditFields((f) => ({ ...f, fullName: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </Field>
              <Field label="Phone">
                <input
                  type="tel"
                  value={editFields.phone}
                  onChange={(e) => setEditFields((f) => ({ ...f, phone: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="+1 555 123 4567"
                />
              </Field>
              <Field label="Job title">
                <input
                  type="text"
                  value={editFields.jobTitle}
                  onChange={(e) => setEditFields((f) => ({ ...f, jobTitle: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </Field>

              <p className="text-xs text-gray-500">
                Email address and account role can only be changed by an administrator.
              </p>

              {saveError && <p className="text-sm text-red-600">{saveError}</p>}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => void handleSave()}
                  disabled={isSaving || !editFields.fullName.trim()}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSaving ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <dl className="space-y-3">
              <DetailRow label="Display name" value={profile.fullName} />
              <DetailRow label="Email" value={profile.email} />
              <DetailRow label="Phone" value={profile.phone ?? '—'} />
              <DetailRow label="Job title" value={profile.jobTitle ?? '—'} />
              <DetailRow label="Organization" value={profile.organizationName ?? '—'} />
              <DetailRow label="Role" value={profile.role} />
              <DetailRow
                label="Member since"
                value={new Date(profile.createdAt).toLocaleDateString()}
              />
            </dl>
          )}
        </div>
      </div>
    </Layout>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="text-sm font-medium text-gray-900 text-right ml-4">{value}</dd>
    </div>
  );
}
