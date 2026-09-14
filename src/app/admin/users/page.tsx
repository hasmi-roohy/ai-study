'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/apiFetch';
import { AdminPanel, AdminTable } from '@/components/admin/AdminUI';

interface AdminUser {
  id: string;
  email: string;
  name?: string;
  role: string;
  spaces: number;
  projects: number;
  overallProgress: number;
  lastActiveAt: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ users: AdminUser[] }>('/api/admin/users')
      .then((r) => setUsers(r.users))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div>
      <h1 className="mb-5 text-[15px] font-semibold text-[#E7EAF0]">Users</h1>
      <AdminPanel>
        {error && <p className="text-sm text-[#E2685F]">{error}</p>}
        {!error && users.length === 0 && <p className="text-sm text-[#7C8598]">No users yet.</p>}
        {users.length > 0 && (
          <AdminTable head={['User', 'Role', 'Spaces', 'Projects', 'Progress', 'Last active']}>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-[#232A38]">
                <td className="py-1.5 font-sans">{u.name ?? u.email}</td>
                <td>{u.role}</td>
                <td>{u.spaces}</td>
                <td>{u.projects}</td>
                <td>{u.overallProgress}%</td>
                <td className="text-[#7C8598]">{new Date(u.lastActiveAt).toLocaleString()}</td>
              </tr>
            ))}
          </AdminTable>
        )}
      </AdminPanel>
    </div>
  );
}
