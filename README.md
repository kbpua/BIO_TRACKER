# BioSample Tracker (Prototype)

Frontend-only prototype of a biological sample database system for client presentation. Built with React (Vite), React Router, and Tailwind CSS. All data is mock data in memory; no backend or database.

## Run locally

```bash
npm install
npm run dev
```

Open the URL shown in the terminal (e.g. http://localhost:5173).

## Test login accounts

| Role       | Email                     | Password    |
|-----------|----------------------------|-------------|
| Admin     | admin@biosample.com        | admin123    |
| Researcher| researcher@biosample.com   | research123 |
| Student   | student@biosample.com      | student123  |
| Pending   | pending@biosample.com      | pending123  |

Log in as each role to see role-based menus, buttons, and permissions.

## Features

- **Role-based UI**: Admin, Researcher, Student. Sidebar and actions change by role.
- **Dashboard**: Stats (samples, projects, organisms; admin sees users and pending approvals) and recent activity feed.
- **Samples**: Table with search and filters (organism, type, project, status). Add/Edit/Delete (by role), Export CSV (by role). Row click opens detail view.
- **Projects & Organisms**: Tables; Admin can add/edit/delete.
- **User Management** (Admin only): Approve pending accounts, change roles, deactivate, delete.
- **Export**: CSV (Admin + Researcher). Filtered export on Samples page; full export on Export Data page.

## Tech stack

- React 18, Vite 6, React Router 6, Tailwind CSS 3.
