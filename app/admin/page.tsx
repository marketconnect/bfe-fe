'use client';

import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { createUser, assignPermission } from '@/lib/api';
import ProtectedRoute from '@/components/ProtectedRoute';

const AdminPage = () => {
  const { token } = useAuth();
  const [createUserForm, setCreateUserForm] = useState({ username: '', password: '', isAdmin: false });
  const [assignPermForm, setAssignPermForm] = useState({ userId: '', folderPrefix: '' });
  const [message, setMessage] = useState('');

  const handleCreateUserChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setCreateUserForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleAssignPermChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setAssignPermForm(prev => ({ ...prev, [name]: value }));
  };

  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    if (!token) return;
    try {
      const data = await createUser(token, createUserForm.username, createUserForm.password, createUserForm.isAdmin);
      setMessage(`User created successfully with ID: ${data.user_id}`);
      setCreateUserForm({ username: '', password: '', isAdmin: false });
    } catch (error: any) {
      setMessage(`Error: ${error.message}`);
    }
  };

  const handleAssignPermSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    if (!token) return;
    try {
      const data = await assignPermission(token, parseInt(assignPermForm.userId), assignPermForm.folderPrefix);
      setMessage(data.message);
      setAssignPermForm({ userId: '', folderPrefix: '' });
    } catch (error: any) {
      setMessage(`Error: ${error.message}`);
    }
  };

  return (
    <div className="container mx-auto p-4 grid grid-cols-1 md:grid-cols-2 gap-8">
      <div>
        <h2 className="text-2xl font-bold mb-4">Create User</h2>
        <form onSubmit={handleCreateUserSubmit} className="space-y-4">
          <input
            type="text"
            name="username"
            value={createUserForm.username}
            onChange={handleCreateUserChange}
            placeholder="Username"
            className="w-full p-2 border rounded"
            required
          />
          <input
            type="password"
            name="password"
            value={createUserForm.password}
            onChange={handleCreateUserChange}
            placeholder="Password"
            className="w-full p-2 border rounded"
            required
          />
          <div className="flex items-center">
            <input
              type="checkbox"
              name="isAdmin"
              checked={createUserForm.isAdmin}
              onChange={handleCreateUserChange}
              className="mr-2"
            />
            <label>Is Admin?</label>
          </div>
          <button type="submit" className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600">Create User</button>
        </form>
      </div>
      <div>
        <h2 className="text-2xl font-bold mb-4">Assign Permission</h2>
        <form onSubmit={handleAssignPermSubmit} className="space-y-4">
          <input
            type="number"
            name="userId"
            value={assignPermForm.userId}
            onChange={handleAssignPermChange}
            placeholder="User ID"
            className="w-full p-2 border rounded"
            required
          />
          <input
            type="text"
            name="folderPrefix"
            value={assignPermForm.folderPrefix}
            onChange={handleAssignPermChange}
            placeholder="Folder Prefix (e.g., user-files/alex/)"
            className="w-full p-2 border rounded"
            required
          />
          <button type="submit" className="w-full bg-green-500 text-white p-2 rounded hover:bg-green-600">Assign Permission</button>
        </form>
      </div>
      {message && <p className="mt-4 text-center col-span-1 md:col-span-2">{message}</p>}
    </div>
  );
};

export default function Admin() {
  return (
    <ProtectedRoute adminRequired={true}>
      <AdminPage />
    </ProtectedRoute>
  );
}
