export interface Permission {
  id: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
  adminId: string;
  folderPrefix: string;
}

export interface User {
  id: string;
  createdAt: string;
  updatedAt: string;
  username: string;
  alias: string;
  email?: string;
  isAdmin: boolean;
  notifyByEmail: boolean;
  permissions: Permission[];
}
export interface LoginResponse {
  token: string;
}

export interface CreateUserResponse {
  message: string;
  user_id: number;
  password?: string;
}

export interface ResetPasswordResponse {
  message: string;
  password?: string;
}

export interface MessageResponse {
  message: string;
}

export interface FileWithURL {
  key: string;
  url?: string;
}

export interface FileAccessEntry {
  username: string;
  alias?: string;
  lastViewedAt: string | null;
}

export interface FileEntry extends FileWithURL {
  createdAt?: string;
  accessType?: string;
  accessList?: FileAccessEntry[];
}

export interface GetFilesResponse {
  path: string;
  folders: string[];
  files: FileEntry[];
}

export interface GetAllFoldersResponse {
  folders: string[];
}

export interface GenerateUploadUrlResponse {
  uploadUrl: string;
  objectKey: string;
}

export interface Upload {
  id: string;
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

export interface RequestArchiveResponse {
  jobId: string;
  status: string;
}

export interface GetArchiveStatusResponse {
  jobId: string;
  status: string; // PENDING, PROCESSING, COMPLETED, FAILED
  downloadUrl?: string;
  error?: string;
}

export type PresignedInfoResponse = {
  url: string;
  status?: never;
  pages?: never;
} | {
  url?: never;
  status: 'converted';
  pages: string[];
};