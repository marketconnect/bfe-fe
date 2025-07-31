'use client';

import React, { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import * as api from '@/lib/api';
import ProtectedRoute from '@/components/ProtectedRoute';
import { User } from '@/lib/types';

const AdminPanel: React.FC = () => {
  const { token, logout } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [adminForm, setAdminForm] = useState({ username: '', password: '' });
  const [newUserForm, setNewUserForm] = useState({ username: '', password: '', alias: '' });
  const [permissionForms, setPermissionForms] = useState<{ [key: number]: string }>({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [allFolders, setAllFolders] = useState<string[]>([]);

  const fetchUsers = async () => {
    if (!token) return;
    try {
      const userData = await api.getUsers(token);
      setUsers(userData);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const fetchAllFolders = async () => {
    if (!token) return;
    try {
      const folderData = await api.getAllFolders(token);
      setAllFolders(folderData.folders || []);
    } catch (err: any) {
      // Non-critical error, so just log it or show a subtle warning
      console.error(`Failed to fetch folder list: ${err.message}`);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchAllFolders();
  }, [token]);

  const showMessage = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  };

  const handleError = (err: any, prefix: string) => {
    const errorMsg = `${prefix}: ${err.message}`;
    setError(errorMsg);
    setTimeout(() => setError(''), 5000);
  };

  const handleAdminFormChange = (e: ChangeEvent<HTMLInputElement>) => {
    setAdminForm({ ...adminForm, [e.target.name]: e.target.value });
  };

  const handleAdminFormSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      await api.updateAdminSelf(token, adminForm.username, adminForm.password);
      showMessage('Admin account updated. You may need to log in again.');
      setIsSettingsOpen(false);
      setAdminForm({ username: '', password: '' });
      setTimeout(() => logout(), 2000);
    } catch (err) {
      handleError(err, 'Failed to update admin');
    }
  };

  const handleNewUserFormChange = (e: ChangeEvent<HTMLInputElement>) => {
    setNewUserForm({ ...newUserForm, [e.target.name]: e.target.value });
  };

  const handleCreateUser = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      await api.createUser(token, newUserForm.username, newUserForm.password, newUserForm.alias, false);
      showMessage(`User '${newUserForm.username}' created successfully.`);
      setNewUserForm({ username: '', password: '', alias: '' });
      fetchUsers();
    } catch (err) {
      handleError(err, 'Failed to create user');
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!token || !confirm('Are you sure you want to delete this user and all their permissions?')) return;
    try {
      await api.deleteUser(token, userId);
      showMessage('User deleted successfully.');
      fetchUsers();
    } catch (err) {
      handleError(err, 'Failed to delete user');
    }
  };

  const handlePermissionFormChange = (userId: number, value: string) => {
    setPermissionForms({ ...permissionForms, [userId]: value });
  };

  const handleAddPermission = async (e: FormEvent, userId: number) => {
    e.preventDefault();
    const folderPrefix = permissionForms[userId];
    if (!token || !folderPrefix) return;

    const user = users.find(u => u.ID === userId);
    if (user && user.Permissions.some(p => p.FolderPrefix === folderPrefix)) {
      handleError({ message: 'Permission already exists.' }, 'Failed to add permission');
      return;
    }

    try {
      await api.assignPermission(token, userId, folderPrefix);
      showMessage('Permission added successfully.');
      fetchUsers();
    } catch (err) {
      handleError(err, 'Failed to add permission');
    }
  };

  const handleRevokePermission = async (permissionId: number) => {
    if (!token || !confirm('Are you sure you want to revoke this permission?')) return;
    try {
      await api.revokePermission(token, permissionId);
      showMessage('Permission revoked successfully.');
      fetchUsers();
    } catch (err) {
      handleError(err, 'Failed to revoke permission');
    }
  };

  return (
    <div className="container mx-auto p-4 w-full max-w-4xl font-inter relative">
      <div className="absolute top-4 right-4">
        <button onClick={() => setIsSettingsOpen(true)} title="Account Settings" className="p-2 rounded-full hover:bg-gray-200 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>

      <h1 className="text-3xl font-bold mb-6 text-center text-bfe-orange font-montserrat">Admin Panel</h1>
      {message && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4" role="alert">{message}</div>}
      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">{error}</div>}

      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-[fadeIn_0.2s_ease-in-out]">
          <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md relative">
            <h2 className="text-2xl font-bold mb-4">Update My Account</h2>
            <form onSubmit={handleAdminFormSubmit} className="space-y-4">
              <input type="text" name="username" value={adminForm.username} onChange={handleAdminFormChange} placeholder="New Username (optional)" className="w-full p-2 border rounded bg-gray-100 border-gray-300" />
              <input type="password" name="password" value={adminForm.password} onChange={handleAdminFormChange} placeholder="New Password (optional)" className="w-full p-2 border rounded bg-gray-100 border-gray-300" />
              <button type="submit" className="w-full btn-primary">Update Account</button>
            </form>
            <button onClick={() => setIsSettingsOpen(false)} className="w-full btn-secondary mt-2">
              Back
            </button>
          </div>
        </div>
      )}

      <div className="mb-8">
        <div className="bg-white border border-gray-200 p-6 rounded-lg animate-[fadeIn_0.3s_ease-in-out] max-w-md mx-auto">
          <h2 className="text-2xl font-bold mb-4">Create New User</h2>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <input type="text" name="username" value={newUserForm.username} onChange={handleNewUserFormChange} placeholder="Username" className="w-full p-2 border rounded bg-gray-100 border-gray-300" required />
            <input type="text" name="alias" value={newUserForm.alias} onChange={handleNewUserFormChange} placeholder="Alias (optional)" className="w-full p-2 border rounded bg-gray-100 border-gray-300" />
            <input type="password" name="password" value={newUserForm.password} onChange={handleNewUserFormChange} placeholder="Password" className="w-full p-2 border rounded bg-gray-100 border-gray-300" required />
            <button type="submit" className="w-full btn-primary">Create User</button>
          </form>
        </div>
      </div>

      <div className="bg-white border border-gray-200 p-6 rounded-lg animate-[fadeIn_0.3s_ease-in-out] mt-8">
        <h2 className="text-2xl font-bold mb-4">Manage Users</h2>
        <div className="space-y-6">
          {users.map(user => (
            <div key={user.ID} className="bg-white border border-gray-200 p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow animate-[fadeIn_0.3s_ease-in-out]">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-semibold text-gray-800 font-montserrat">{user.Username}</h3>
                  <p className="text-sm text-gray-500 mt-1">{user.Alias || `ID: ${user.ID}`}</p>
                </div>
                <button
                  onClick={() => handleDeleteUser(user.ID)}
                  className="p-2 rounded-full hover:bg-red-50 text-red-500 hover:text-red-700 transition-colors"
                  title="Delete User"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <h4 className="font-semibold text-gray-700 mb-3 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-bfe-orange" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.031 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  Permissions
                </h4>
                {user.Permissions && user.Permissions.length > 0 ? (
                  <div className="space-y-2 mb-4">
                    {user.Permissions.map(perm => (
                      <div key={perm.ID} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                        <div className="flex items-center">
                          <span className="mr-2">📁</span>
                          <span className="font-mono text-sm text-gray-700">{perm.FolderPrefix}</span>
                        </div>
                        <button
                          onClick={() => handleRevokePermission(perm.ID)}
                          className="p-1 rounded-full hover:bg-red-50 text-red-500 hover:text-red-700 transition-colors"
                          title="Revoke Permission"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 mb-4 italic">No permissions assigned.</p>
                )}
              </div>

              <div className="border-t border-gray-100 pt-4">
                <h5 className="text-sm font-medium text-gray-600 mb-2">Add New Permission</h5>
                <form onSubmit={(e) => handleAddPermission(e, user.ID)} className="flex items-center space-x-3">
                  <div className="flex-grow relative">
                    <input
                      list="folder-suggestions"
                      type="text"
                      value={permissionForms[user.ID] || ''}
                      onChange={(e) => handlePermissionFormChange(user.ID, e.target.value)}
                      placeholder="Folder Prefix (e.g., user-files/alex/)"
                      className="w-full p-3 border rounded-lg bg-gray-50 border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-bfe-orange focus:border-transparent"
                      required
                    />
                    <datalist id="folder-suggestions">
                      {allFolders.map(folder => (
                        <option key={folder} value={folder} />
                      ))}
                    </datalist>
                  </div>
                  <button
                    type="submit"
                    className="p-3 bg-bfe-orange text-white rounded-lg hover:bg-bfe-orange-light transition-colors flex items-center justify-center"
                    title="Add Permission"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Wrap the AdminPanel component with ProtectedRoute and export it as the default
const Page = () => (
  <ProtectedRoute adminRequired>
    <AdminPanel />
  </ProtectedRoute>
);

export default Page;
