const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface LoginResponse {
  token: string;
}

interface CreateUserResponse {
  user_id: number;
}

interface AssignPermissionResponse {
  message: string;
}

interface GetFilesResponse {
  files: Array<{
    key: string;
    url: string;
  }>;
}

export const login = async (username: string, password: string): Promise<LoginResponse> => {
  const response = await fetch(`${API_URL}/auth/login`, {
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
  const response = await fetch(`${API_URL}/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ username, password, is_admin: isAdmin }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create user');
  }

  return response.json();
};

export const assignPermission = async (
  token: string,
  userId: number,
  folderPrefix: string
): Promise<AssignPermissionResponse> => {
  const response = await fetch(`${API_URL}/permissions`, {
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
  const response = await fetch(`${API_URL}/files`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch files');
  }

  return response.json();
};
