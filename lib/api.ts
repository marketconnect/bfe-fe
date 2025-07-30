import { User, LoginResponse, CreateUserResponse, MessageResponse, GetFilesResponse } from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
const BASE_PATH = `${API_URL}/api/v1`;

export const login = async (username: string, password: string): Promise<LoginResponse> => {
  const response = await fetch(`${BASE_PATH}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to login');
  }

  return response.json();
};

export const createUser = async (
  token: string,
  username: string,
  password: string,
  isAdmin: boolean
): Promise<CreateUserResponse> => {
  const response = await fetch(`${BASE_PATH}/admin/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ username, password, is_admin: isAdmin }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'An unknown error occurred' }));
    throw new Error(error.message || 'Failed to create user');
  }

  return response.json();
};

export const assignPermission = async (
  token: string,
  userId: number,
  folderPrefix: string
): Promise<MessageResponse> => {
  const response = await fetch(`${BASE_PATH}/admin/permissions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ user_id: userId, folder_prefix: folderPrefix }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to assign permission');
  }

  return response.json();
};

export const getFiles = async (token: string): Promise<GetFilesResponse> => {
  const response = await fetch(`${BASE_PATH}/files`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'An unknown error occurred' }));
    throw new Error(error.message || 'Failed to fetch files');
  }

  return response.json();
};

export const getUsers = async (token: string): Promise<User[]> => {
  const response = await fetch(`${BASE_PATH}/admin/users`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'An unknown error occurred' }));
    throw new Error(error.message || 'Failed to fetch users');
  }

  return response.json();
};

export const updateAdminSelf = async (token: string, username?: string, password?: string): Promise<MessageResponse> => {
  const body: { username?: string; password?: string } = {};
  if (username) body.username = username;
  if (password) body.password = password;

  const response = await fetch(`${BASE_PATH}/admin/self`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'An unknown error occurred' }));
    throw new Error(error.message || 'Failed to update admin account');
  }

  return response.json();
};

export const deleteUser = async (token: string, userId: number): Promise<MessageResponse> => {
  const response = await fetch(`${BASE_PATH}/admin/users/${userId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'An unknown error occurred' }));
    throw new Error(error.message || 'Failed to delete user');
  }

  return response.json();
};

export const revokePermission = async (token: string, permissionId: number): Promise<MessageResponse> => {
  const response = await fetch(`${BASE_PATH}/admin/permissions/${permissionId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'An unknown error occurred' }));
    throw new Error(error.message || 'Failed to revoke permission');
  }

  return response.json();
};
