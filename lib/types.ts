export interface Permission {
  id: number;
  createdAt: string;
  updatedAt: string;
  userId: number;
  folderPrefix: string;
}

export interface User {
  id: number;
  createdAt: string;
  updatedAt: string;
  username: string;
  alias: string;
  isAdmin: boolean;
  permissions: Permission[];
}

export interface LoginResponse {
  token: string;
}

export interface CreateUserResponse {
  message: string;
  user_id: number;
}

export interface MessageResponse {
  message: string;
}

export interface FileWithURL {
  key: string;
  url: string;
}

export interface GetFilesResponse {
  path: string;
  folders: string[];
  files: FileWithURL[];
}

export interface GetAllFoldersResponse {
  folders: string[];
}
