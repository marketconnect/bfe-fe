'use client';

import React, { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import * as api from '@/lib/api';
import ProtectedRoute from '@/components/ProtectedRoute';
import { User } from '@/lib/types';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

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
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [generatedUsername, setGeneratedUsername] = useState('');
  const [userToReset, setUserToReset] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [allFolders, setAllFolders] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState<{ [key: number]: boolean }>({});
  const params = useParams();
  const lang = params.lang || 'en';
  const { data: dictionary, error: dictError } = useSWR(`/dictionaries/${lang}.json`, fetcher);

  const fetchUsers = async () => {
    if (!token) return;
    try {
      const userData = await api.getUsers(token);
      setUsers(userData);
    } catch (err: any) {
      setError(dictionary?.adminPanel?.errors?.fetchUsers || err.message);
    }
  };

  const fetchAllFolders = async () => {
    if (!token) return;
    try {
      const folderData = await api.getAllFolders(token);
      setAllFolders(folderData.folders || []);
    } catch (err: any) {
      console.error(`${dictionary?.adminPanel?.errors?.fetchFolders || 'Failed to fetch folder list'}: ${err.message}`);
    }
  };

  useEffect(() => {
    if (dictionary) fetchUsers();
    if (dictionary) fetchAllFolders();
  }, [token, dictionary]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.dropdown-container')) {
        setShowDropdown({});
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

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
      showMessage(dictionary.adminPanel.messages.adminUpdated);
      setIsSettingsOpen(false);
      setAdminForm({ username: '', password: '' });
      setTimeout(() => logout(), 2000);
    } catch (err) {
      handleError(err, dictionary.adminPanel.errors.updateAdmin);
    }
  };

  const handleNewUserFormChange = (e: ChangeEvent<HTMLInputElement>) => {
    setNewUserForm({ ...newUserForm, [e.target.name]: e.target.value });
  };

  const handleCreateUser = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      const response = await api.createUser(token, newUserForm.username, newUserForm.password, newUserForm.alias, false);
      showMessage(dictionary.adminPanel.messages.userCreated.replace('{username}', newUserForm.username));
      const createdUsername = newUserForm.username;
      setNewUserForm({ username: '', password: '', alias: '' });
      fetchUsers();
      if (response.password) {
        setGeneratedPassword(response.password);
        setGeneratedUsername(createdUsername);
        setShowPasswordModal(true);
      }
    } catch (err) {
      handleError(err, dictionary.adminPanel.errors.createUser);
    }
  };

  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!token || !userToReset || !newPassword) return;
    try {
      const response = await api.resetUserPassword(token, userToReset.id, newPassword);
      showMessage(dictionary.adminPanel.messages.passwordReset.replace('{username}', userToReset.alias || userToReset.username));
      const resetUsername = userToReset.username;
      setUserToReset(null);
      setNewPassword('');
      if (response.password) {
        setGeneratedPassword(response.password);
        setGeneratedUsername(resetUsername);
        setShowPasswordModal(true);
      }
    } catch (err) {
      handleError(err, dictionary.adminPanel.errors.resetPassword);
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!token || !confirm(dictionary.adminPanel.confirmDeleteUser)) return;
    try {
      await api.deleteUser(token, userId);
      showMessage(dictionary.adminPanel.messages.userDeleted);
      fetchUsers();
    } catch (err) {
      handleError(err, dictionary.adminPanel.errors.deleteUser);
    }
  };

  const handlePermissionFormChange = (userId: number, value: string) => {
    setPermissionForms({ ...permissionForms, [userId]: value });
  };

  const toggleDropdown = (userId: number) => {
    setShowDropdown(prev => ({
      ...Object.keys(prev).reduce((acc, key) => ({ ...acc, [key]: false }), {}),
      [userId]: !prev[userId]
    }));
  };

  const selectFolder = (userId: number, folder: string) => {
    setPermissionForms({ ...permissionForms, [userId]: folder });
    setShowDropdown({ ...showDropdown, [userId]: false });
  };

  const handleAddPermission = async (e: FormEvent, userId: number) => {
    e.preventDefault();
    const folderPrefix = permissionForms[userId];
    if (!token || !folderPrefix) return;

    const user = users.find(u => u.id === userId);
    if (user && (user.permissions || []).some(p => p.folderPrefix === folderPrefix)) {
      handleError({ message: dictionary.adminPanel.errors.permissionExists }, dictionary.adminPanel.errors.addPermission);
      return;
    }

    try {
      await api.assignPermission(token, userId, folderPrefix);
      showMessage(dictionary.adminPanel.messages.permissionAdded);
      fetchUsers();
    } catch (err) {
      handleError(err, dictionary.adminPanel.errors.addPermission);
    }
  };

  const handleRevokePermission = async (permissionId: number) => {
    if (!token || !confirm(dictionary.adminPanel.confirmRevokePermission)) return;
    try {
      await api.revokePermission(token, permissionId);
      showMessage(dictionary.adminPanel.messages.permissionRevoked);
      fetchUsers();
    } catch (err) {
      handleError(err, dictionary.adminPanel.errors.revokePermission);
    }
  };

  if (!dictionary) return <div>Loading...</div>;
  if (dictError) return <div>Failed to load translations.</div>;

  return (
    <div className="w-full max-w-4xl font-inter">
      <div className="flex justify-end items-center space-x-4 mb-6">
        <LanguageSwitcher />
        <button onClick={() => setIsSettingsOpen(true)} title={dictionary.adminPanel.updateAccountTitle} className="p-2 rounded-full hover:bg-gray-200 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>

      <h1 className="text-3xl font-bold mb-6 text-center text-bfe-orange font-montserrat">{dictionary.adminPanel.title}</h1>
      {message && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4" role="alert">{message}</div>}
      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">{error}</div>}

      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-[fadeIn_0.2s_ease-in-out]">
          <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md relative">
            <h2 className="text-2xl font-bold mb-4">{dictionary.adminPanel.updateAccountTitle}</h2>
            <form onSubmit={handleAdminFormSubmit} className="space-y-4">
              <input type="text" name="username" value={adminForm.username} onChange={handleAdminFormChange} placeholder={`${dictionary.adminPanel.usernamePlaceholder} (optional)`} className="w-full p-2 border rounded bg-gray-100 border-gray-300" />
              <input type="password" name="password" value={adminForm.password} onChange={handleAdminFormChange} placeholder={`${dictionary.adminPanel.passwordPlaceholder} (optional)`} className="w-full p-2 border rounded bg-gray-100 border-gray-300" />
              <button type="submit" className="w-full btn-primary">{dictionary.adminPanel.updateAccountButton}</button>
            </form>
            <button onClick={() => setIsSettingsOpen(false)} className="w-full btn-secondary mt-2">
              {dictionary.adminPanel.backButton}
            </button>
          </div>
        </div>
      )}

      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-[fadeIn_0.2s_ease-in-out]">
          <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md relative text-gray-800">
            <h2 className="text-2xl font-bold mb-4">{dictionary.adminPanel.passwordModalTitle}</h2>
            <p className="mb-4 text-sm text-gray-600">{dictionary.adminPanel.passwordModalNotice}</p>
            <div className="bg-gray-100 p-4 rounded-md font-mono text-sm mb-4 space-y-2">
              <div><strong>login:</strong> {generatedUsername}</div>
              <div><strong>password:</strong> {generatedPassword}</div>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => navigator.clipboard.writeText(`login: ${generatedUsername}\npassword: ${generatedPassword}`)}
                className="flex-1 btn-secondary"
              >
                {dictionary.adminPanel.copyButton}
              </button>
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setGeneratedPassword('');
                  setGeneratedUsername('');
                }}
                className="flex-1 btn-primary"
              >
                {dictionary.adminPanel.closeButton}
              </button>
            </div>
          </div>
        </div>
      )}

      {userToReset && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-[fadeIn_0.2s_ease-in-out]">
          <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md relative">
            <h2 className="text-2xl font-bold mb-4">{dictionary.adminPanel.resetPasswordTitle.replace('{username}', userToReset.alias || userToReset.username)}</h2>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <input type="password" name="newPassword" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder={dictionary.adminPanel.newPasswordPlaceholder} className="w-full p-2 border rounded bg-gray-100 border-gray-300" required />
              <button type="submit" className="w-full btn-primary">{dictionary.adminPanel.resetPasswordButton}</button>
            </form>
            <button onClick={() => setUserToReset(null)} className="w-full btn-secondary mt-2">{dictionary.adminPanel.backButton}</button>
          </div>
        </div>
      )}

      <div className="mb-8">
        <div className="bg-white border border-gray-200 p-6 rounded-lg animate-[fadeIn_0.3s_ease-in-out] max-w-md mx-auto">
          <h2 className="text-2xl font-bold mb-4">{dictionary.adminPanel.createUserTitle}</h2>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <input type="text" name="alias" value={newUserForm.alias} onChange={handleNewUserFormChange} placeholder="Имя" className="w-full p-2 border rounded bg-gray-100 border-gray-300" />
            <input type="text" name="username" value={newUserForm.username} onChange={handleNewUserFormChange} placeholder="login" className="w-full p-2 border rounded bg-gray-100 border-gray-300" required />
            <input type="password" name="password" value={newUserForm.password} onChange={handleNewUserFormChange} placeholder={dictionary.adminPanel.passwordPlaceholder} className="w-full p-2 border rounded bg-gray-100 border-gray-300" required />
            <button type="submit" className="w-full btn-primary">{dictionary.adminPanel.createUserButton}</button>
          </form>
        </div>
      </div>

      <div className="bg-white border border-gray-200 p-6 rounded-lg animate-[fadeIn_0.3s_ease-in-out] mt-8">
        <h2 className="text-2xl font-bold mb-4">{dictionary.adminPanel.manageUsersTitle}</h2>
        <div className="space-y-6">
          {users.map(user => (
            <div key={user.id} className="bg-white border border-gray-200 p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow animate-[fadeIn_0.3s_ease-in-out]">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-xl font-semibold text-gray-800 font-montserrat">{user.alias || user.username}</h3>
                  <div className="flex items-center text-sm text-gray-500 mt-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span>{user.username}</span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setUserToReset(user)}
                    className="p-2 rounded-full hover:bg-blue-50 text-blue-500 hover:text-blue-700 transition-colors"
                    title={dictionary.adminPanel.resetPasswordButton}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDeleteUser(user.id)}
                    className="p-2 rounded-full hover:bg-red-50 text-red-500 hover:text-red-700 transition-colors"
                    title={dictionary.adminPanel.deleteUserTitle}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <h4 className="font-semibold text-gray-700 mb-3 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-bfe-orange" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.031 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  {dictionary.adminPanel.permissionsTitle}
                </h4>
                {user.permissions && user.permissions.length > 0 ? (
                  <div className="space-y-2 mb-4">
                    {user.permissions.map(perm => (
                      <div key={perm.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                        <div className="flex items-center">
                          <span className="mr-2">📁</span>
                          <span className="font-mono text-sm text-gray-700">{perm.folderPrefix}</span>
                        </div>
                        <button
                          onClick={() => handleRevokePermission(perm.id)}
                          className="p-1 rounded-full hover:bg-red-50 text-red-500 hover:text-red-700 transition-colors"
                          title={dictionary.adminPanel.revokePermissionButtonTitle}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 mb-4 italic">{dictionary.adminPanel.noPermissions}</p>
                )}
              </div>

              <div className="border-t border-gray-100 pt-4">
                <h5 className="text-sm font-medium text-gray-600 mb-2">{dictionary.adminPanel.addPermissionTitle}</h5>
                <form onSubmit={(e) => handleAddPermission(e, user.id)} className="flex items-center space-x-3">
                  <div className="flex-grow relative">
                    <div className="relative dropdown-container">
                      <input
                        type="text"
                        value={permissionForms[user.id] || ''}
                        onChange={(e) => handlePermissionFormChange(user.id, e.target.value)}
                        placeholder={dictionary.adminPanel.folderPrefixPlaceholder}
                        className="w-full p-3 pr-10 border rounded-lg bg-gray-50 border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-bfe-orange focus:border-transparent"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => toggleDropdown(user.id)}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {showDropdown[user.id] && allFolders.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                          {allFolders.map(folder => (
                            <button
                              key={folder}
                              type="button"
                              onClick={() => selectFolder(user.id, folder)}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
                            >
                              📁 {folder}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="p-3 bg-bfe-orange text-white rounded-lg hover:bg-bfe-orange-light transition-colors flex items-center justify-center"
                    title={dictionary.adminPanel.addPermissionButtonTitle}
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

const Page = () => (
  <ProtectedRoute adminRequired>
    <AdminPanel />
  </ProtectedRoute>
);

export default Page;
