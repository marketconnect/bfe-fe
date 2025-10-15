import { User, LoginResponse, CreateUserResponse, ResetPasswordResponse, MessageResponse, GetFilesResponse, GetAllFoldersResponse, GenerateUploadUrlResponse, RequestArchiveResponse, GetArchiveStatusResponse, PresignedInfoResponse } from './types';

// const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';
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
    const errorData = await response.json().catch(() => ({ error: 'An unknown error occurred' }));
    throw new Error(errorData.details || errorData.error || 'Failed to login');
  }

  return response.json();
};

export const createUser = async (
  token: string,
  username: string,
  password: string,
  alias: string,
  email: string,
  isAdmin: boolean,
  sendAuthByEmail: boolean,
  notifyByEmail: boolean
): Promise<CreateUserResponse> => {
  const response = await fetch(`${BASE_PATH}/admin/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ username, password, alias, email, is_admin: isAdmin, sendAuthByEmail, notifyByEmail }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'An unknown error occurred' }));
    throw new Error(errorData.details || errorData.error || 'Failed to create user');
  }

  return response.json();
};

export const updateUserNotifySetting = async (
  token: string,
  userId: string,
  notifyByEmail: boolean,
  email: string,
): Promise<MessageResponse> => {
  const response = await fetch(`${BASE_PATH}/admin/users/${userId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ notifyByEmail, email }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'An unknown error occurred' }));
    throw new Error(errorData.details || errorData.error || 'Failed to update notification setting');
  }

  return response.json();
};

export const resetUserPassword = async (
  token: string,
  userId: string,
  password: string
): Promise<ResetPasswordResponse> => {
  const response = await fetch(`${BASE_PATH}/admin/users/${userId}/password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ password }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'An unknown error occurred' }));
    throw new Error(errorData.details || errorData.error || 'Failed to reset password');
  }

  return response.json();
};

export const assignPermission = async (
  token: string,
  userId: string,
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
    const errorData = await response.json().catch(() => ({ error: 'An unknown error occurred' }));
    throw new Error(errorData.details || errorData.error || 'Failed to assign permission');
  }

  return response.json();
};

export const getFiles = async (token: string, path: string = ''): Promise<GetFilesResponse> => {
  let url = `${BASE_PATH}/files`;
  if (path) {
    const params = new URLSearchParams({ path });
    url += `?${params.toString()}`;
  }
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'An unknown error occurred' }));
    throw new Error(errorData.details || errorData.error || 'Failed to fetch files');
  }

  const raw = await response.json();

  const normalize = (data: any): GetFilesResponse => {
    const path = data?.path ?? '';
    const folders: string[] = Array.isArray(data?.folders) ? data.folders : [];
    const filesRaw: any[] = Array.isArray(data?.files) ? data.files : [];
    const files = filesRaw.map((f) => {
      const accessListRaw: any[] = Array.isArray(f?.accessList ?? f?.access_list) ? (f.accessList ?? f.access_list) : [];
      const accessList = accessListRaw.map((a) => ({
        username: a?.username ?? '',
        alias: a?.alias ?? '',
        lastViewedAt: a?.lastViewedAt ?? a?.last_viewed_at ?? null,
      }));
      return {
        key: f?.key ?? '',
        url: f?.url ?? undefined,
        createdAt: f?.createdAt ?? f?.created_at ?? undefined,
        accessType: f?.accessType ?? f?.access_type ?? undefined,
        accessList,
      };
    });
    return { path, folders, files };
  };

  return normalize(raw);
};

export const requestArchive = async (
  token: string,
  keys: string[],
  folders: string[]): Promise<RequestArchiveResponse> => {
  const response = await fetch(`${BASE_PATH}/archive`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ keys, folders }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'An unknown error occurred' }));
    throw new Error(errorData.details || errorData.error || 'Failed to download archive');
  }

  return response.json();
};

export const getArchiveStatus = async (
  token: string,
  jobId: string
): Promise<GetArchiveStatusResponse> => {
  const response = await fetch(`${BASE_PATH}/archive/status/${jobId}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'An unknown error occurred' }));
    throw new Error(errorData.details || errorData.error || 'Failed to get archive status');
  }

  return response.json();
};

export const downloadArchive = async (
  token: string,
  keys: string[],
  folders: string[]
): Promise<{ urls: Record<string, string> }> => {
  const response = await fetch(`${BASE_PATH}/archive`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ keys, folders }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'An unknown error occurred' }));
    throw new Error(errorData.details || errorData.error || 'Failed to get download URLs');
  }

  return response.json();
};

export const getAllFolders = async (token: string): Promise<GetAllFoldersResponse> => {
    const response = await fetch(`${BASE_PATH}/admin/storage/folders`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'An unknown error occurred' }));
    throw new Error(errorData.details || errorData.error || 'Failed to fetch folders');
  }

  return response.json();
};

export const createFolder = async (token: string, folderPath: string): Promise<MessageResponse> => {
  const response = await fetch(`${BASE_PATH}/admin/storage/folders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ folderPath }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'An unknown error occurred' }));
    throw new Error(errorData.details || errorData.error || 'Failed to create folder');
  }

  return response.json();
};

export const generateUploadUrl = async (
  token: string,
  fileName: string,
  contentType: string,
  prefix: string
): Promise<GenerateUploadUrlResponse> => {
  const response = await fetch(`${BASE_PATH}/files/generate-upload-url`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ fileName, contentType, prefix }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'An unknown error occurred' }));
    throw new Error(errorData.details || errorData.error || 'Failed to generate upload URL');
  }

  return response.json();
};

// export const getUsers = async (token: string): Promise<User[]> => {
//   const response = await fetch(`${BASE_PATH}/admin/users`, {
//     headers: {
//       'Authorization': `Bearer ${token}`,
//     },
//   });

//   if (!response.ok) {
//     const errorData = await response.json().catch(() => ({ error: 'An unknown error occurred' }));
//     throw new Error(errorData.details || errorData.error || 'Failed to fetch users');
//   }

//   return response.json();
// };

export const getUsers = async (token: string): Promise<User[]> => {
  const response = await fetch(`${BASE_PATH}/admin/users`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'An unknown error occurred' }));
    throw new Error(errorData.details || errorData.error || 'Failed to fetch users');
  }

  const raw = await response.json();

  // Гарантируем массив
  const arr = Array.isArray(raw) ? raw : [];

  // Нормализуем snake_case -> camelCase и null -> разумные значения
  const normalizeUsers = (users: any[]): User[] =>
    users.map((u) => ({
      id: String(u.id),
      createdAt: u.createdAt ?? u.created_at ?? '',
      updatedAt: u.updatedAt ?? u.updated_at ?? '',
      username: u.username ?? '',
      alias: u.alias ?? '', // сервер может отдать null
      email: u.email ?? '',
      isAdmin: Boolean(u.isAdmin ?? u.is_admin),
      notifyByEmail: Boolean(u.notifyByEmail ?? u.notify_by_email),
      permissions: Array.isArray(u.permissions)
        ? u.permissions.map((p: any) => ({
            id: String(p.id),
            createdAt: p.createdAt ?? p.created_at ?? '',
            updatedAt: p.updatedAt ?? p.updated_at ?? '',
            userId: String(p.userId ?? p.user_id),
            adminId: String(p.adminId ?? p.admin_id ?? ''),
            folderPrefix: p.folderPrefix ?? p.folder_prefix ?? '',
          }))
        : [],
    }));

  return normalizeUsers(arr);
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
    const errorData = await response.json().catch(() => ({ error: 'An unknown error occurred' }));
    throw new Error(errorData.details || errorData.error || 'Failed to update admin account');
  }

  return response.json();
};

export const deleteUser = async (token: string, userId: string): Promise<MessageResponse> => {
  const response = await fetch(`${BASE_PATH}/admin/users/${userId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'An unknown error occurred' }));
    throw new Error(errorData.details || errorData.error || 'Failed to delete user');
  }

  return response.json();
};

export const revokePermission = async (token: string, permissionId: string): Promise<MessageResponse> => {
  const response = await fetch(`${BASE_PATH}/admin/permissions/${permissionId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'An unknown error occurred' }));
    throw new Error(errorData.details || errorData.error || 'Failed to revoke permission');
  }

  return response.json();
};


export const moveItems = async (token: string, sources: string[], destination: string): Promise<MessageResponse> => {
  const response = await fetch(`${BASE_PATH}/admin/storage/move`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ sources, destination }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'An unknown error occurred' }));
    throw new Error(errorData.details || errorData.error || 'Failed to move items');
  }

  return response.json();
};

export const getFreshFileUrl = async (token: string, key: string): Promise<string> => {
  const qs = new URLSearchParams({ key });
  const response = await fetch(`${BASE_PATH}/files/presign?` + qs.toString(), {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'An unknown error occurred' }));
    throw new Error(errorData.details || errorData.error || 'Failed to presign url');
  }
  const data = await response.json();
  return data.url as string;
};

export const getPresignedFileInfo = async (token: string, key: string): Promise<PresignedInfoResponse> => {
  const qs = new URLSearchParams({ key });
  const response = await fetch(`${BASE_PATH}/files/presign?` + qs.toString(), {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'An unknown error occurred' }));
    throw new Error(errorData.details || errorData.error || 'Failed to presign file info');
  }
  return response.json();
};

export const toProxy = (url: string) => {
  try {
      const u = new URL(url);
      if (u.hostname === 'storage.yandexcloud.net') {
          return `/s3proxy${u.pathname}${u.search}`;
      }
      return url;
  } catch {
      return url;
  }
};


export const deleteItems = async (token: string, keys: string[], folders: string[]): Promise<MessageResponse> => {
  const response = await fetch(`${BASE_PATH}/admin/storage/items`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ keys, folders }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'An unknown error occurred' }));
    throw new Error(errorData.details || errorData.error || 'Failed to delete items');
  }

  return response.json();
};

export const copyItems = async (token: string, sources: string[], destination: string): Promise<MessageResponse> => {
  const response = await fetch(`${BASE_PATH}/admin/storage/copy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ sources, destination }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'An unknown error occurred' }));
    throw new Error(errorData.details || errorData.error || 'Failed to copy items');
  }

  return response.json();
};

export const setPermissions = async (
  token: string,
  paths: string[],
  accessType: 'read_only' | 'read_and_download'
): Promise<MessageResponse> => {
  const response = await fetch(`${BASE_PATH}/admin/storage/permissions`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ paths, accessType }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'An unknown error occurred' }));
    throw new Error(errorData.details || errorData.error || 'Failed to set permissions');
  }

  return response.json();
};
