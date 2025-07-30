'use client';

import React, { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import { useAuth } from '@/hooks/useAuth';
import * as api from '@/lib/api';
import ProtectedRoute from '@/components/ProtectedRoute';
import { User } from '@/lib/types';

const AdminPanel = () => {
  const { token, logout } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [adminForm, setAdminForm] = useState({ username: '', password: '' });
  const [newUserForm, setNewUserForm] = useState({ username: '', password: '' });
  const [permissionForms, setPermissionForms] = useState<{ [key: number]: string }>({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const fetchUsers = async () => {
    if (!token) return;
    try {
      const userList = await api.getUsers(token);
      setUsers(userList);
    } catch (err: any) {
      setError(`Failed to fetch users: ${err.message}`);
    }
  };

  useEffect(() => {
    fetchUsers();
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
      await api.createUser(token, newUserForm.username, newUserForm.password, false);
      showMessage(`User '${newUserForm.username}' created successfully.`);
      setNewUserForm({ username: '', password: '' });
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
    try {
      await api.assignPermission(token, userId, folderPrefix);
      showMessage('Permission added successfully.');
      setPermissionForms({ ...permissionForms, [userId]: '' });
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
    <div className="container mx-auto p-4 w-full max-w-4xl">
      <h1 className="text-3xl font-bold mb-6 text-center">Admin Panel</h1>
      {message && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4" role="alert">{message}</div>}
      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        <div className="bg-gray-800 p-6 rounded-lg">
          <h2 className="text-2xl font-bold mb-4">Update My Account</h2>
          <form onSubmit={handleAdminFormSubmit} className="space-y-4">
            <input type="text" name="username" value={adminForm.username} onChange={handleAdminFormChange} placeholder="New Username (optional)" className="w-full p-2 border rounded bg-gray-700 border-gray-600" />
            <input type="password" name="password" value={adminForm.password} onChange={handleAdminFormChange} placeholder="New Password (optional)" className="w-full p-2 border rounded bg-gray-700 border-gray-600" />
            <button type="submit" className="w-full bg-purple-600 text-white p-2 rounded hover:bg-purple-700">Update Account</button>
          </form>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg">
          <h2 className="text-2xl font-bold mb-4">Create New User</h2>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <input type="text" name="username" value={newUserForm.username} onChange={handleNewUserFormChange} placeholder="Username" className="w-full p-2 border rounded bg-gray-700 border-gray-600" required />
            <input type="password" name="password" value={newUserForm.password} onChange={handleNewUserFormChange} placeholder="Password" className="w-full p-2 border rounded bg-gray-700 border-gray-600" required />
            <button type="submit" className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600">Create User</button>
          </form>
        </div>
      </div>

      <div className="bg-gray-800 p-6 rounded-lg">
        <h2 className="text-2xl font-bold mb-4">Manage Users</h2>
        <div className="space-y-6">
          {users.map(user => (
            <div key={user.ID} className="bg-gray-700 p-4 rounded-md">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-xl font-semibold">{user.Username} <span className="text-sm text-gray-400">(ID: {user.ID})</span></h3>
                <button onClick={() => handleDeleteUser(user.ID)} className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700">Delete User</button>
              </div>

              <h4 className="font-bold mt-2 mb-1 text-gray-300">Permissions:</h4>
              {user.Permissions && user.Permissions.length > 0 ? (
                <ul className="list-disc list-inside space-y-1 mb-3">
                  {user.Permissions.map(perm => (
                    <li key={perm.ID} className="flex justify-between items-center">
                      <span className="font-mono text-sm">{perm.FolderPrefix}</span>
                      <button onClick={() => handleRevokePermission(perm.ID)} className="text-red-400 hover:text-red-300 text-xs">Revoke</button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-400 mb-3">No permissions assigned.</p>
              )}

              <form onSubmit={(e) => handleAddPermission(e, user.ID)} className="flex items-center space-x-2">
                <input
                  type="text"
                  value={permissionForms[user.ID] || ''}
                  onChange={(e) => handlePermissionFormChange(user.ID, e.target.value)}
                  placeholder="Folder Prefix (e.g., user-files/alex/)"
                  className="flex-grow p-2 border rounded bg-gray-600 border-gray-500 text-sm"
                  required
                />
                <button type="submit" className="bg-green-600 text-white px-3 py-2 rounded text-sm hover:bg-green-700">Add</button>
              </form>
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
