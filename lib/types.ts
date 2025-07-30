export interface Permission {
  ID: number;
  CreatedAt: string;
  UpdatedAt: string;
  DeletedAt: string | null;
  UserID: number;
  FolderPrefix: string;
}

export interface User {
  ID: number;
  CreatedAt: string;
  UpdatedAt: string;
  DeletedAt: string | null;
  Username: string;
  IsAdmin: boolean;
  Permissions: Permission[];
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

export interface GetFilesResponse {
  files: Array<{
    key: string;
    url: string;
  }>;
}
