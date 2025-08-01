# File Service Frontend

This is a Next.js-based frontend application for the File Service system. It provides a user interface for file management with role-based access control.

## Features

- User authentication
- Admin panel for user management
- File browsing and downloading
- Permission management for folders
- Responsive design using Tailwind CSS

## Prerequisites

Before you begin, ensure you have installed:
- Node.js (v18 or higher)
- npm (v9 or higher)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/marketconnect/bfe-fe.git
cd bfe-fe
```

2. Install dependencies:
```bash
npm install
```

3. Install additional required dependencies:
```bash
npm install -D autoprefixer@latest
```

4. Create environment configuration:
```bash
cp .env.local.example .env.local
```

5. Configure the API endpoint in `.env.local`:
```bash
NEXT_PUBLIC_API_URL=http://localhost:8080  # Replace with your backend API URL
```

## Development

To start the development server:

```bash
npm run dev
```

The application will be available at:
- http://localhost:3000 (or next available port if 3000 is occupied)

## Project Structure

```
├── app/                    # Next.js app directory
│   ├── admin/             # Admin panel
│   ├── dashboard/         # User dashboard
│   ├── login/            # Login page
│   └── layout.tsx        # Root layout
├── components/            # Reusable components
├── context/              # React context providers
├── hooks/               # Custom React hooks
├── lib/                 # Utility functions and API
└── public/             # Static assets
```

## Key Components

- `AuthContext.tsx`: Manages authentication state
- `ProtectedRoute.tsx`: Route protection component
- `api.ts`: API integration functions

## Available Scripts

- `npm run dev`: Start development server
- `npm run build`: Build for production
- `npm run start`: Start production server
- `npm run lint`: Run linting

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| NEXT_PUBLIC_API_URL | Backend API URL | http://localhost:8080 |

## Dependencies

Key dependencies include:
- Next.js 14.2.4
- React 18
- Tailwind CSS 3.4.1
- JWT Decode 4.0.0

## Development Dependencies

- TypeScript
- ESLint
- PostCSS
- Autoprefixer

## Backend Requirements

This frontend application requires a backend service running with the following features:
- Authentication endpoint
- User management API
- File management API
- Permission management API

The backend should be running and accessible at the URL specified in `NEXT_PUBLIC_API_URL`.

## Browser Support

The application supports modern browsers including:
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

<!-- npm -->
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt install -y nodejs   # положит /usr/bin/node и /usr/bin/npm


which node   # → /usr/bin/node
which npm    # → /usr/bin/npm
node -v      # → v20.x.x
npm -v       # → 10.x.x (или 9.x.x)


cd /var/lib/bfe-fe
npm ci --omit=dev
npm run build