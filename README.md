# A11Y Pulse

A11Y Pulse is a modern, automated accessibility monitoring tool designed for web developers, designers, and QA teams to ensure websites meet WCAG 2.1 AA standards.

With A11Y Pulse, users can:

- Register & manage monitored URLs
- Run automated accessibility tests using axe-core and custom AI checks
- Generate accessibility reports (PDF) with violations and smart suggestions
- Track historical results and improvement trends over time
- Get accessibility scores to prioritize and measure WCAG 2.1 AA compliance

## Tech stack
- Next.js (Frontend + API routes)
- MariaDB + Prisma (Database layer)
- Puppeteer + axe-core (Testing engine)
- NextAuth (OAuth) for user authentication

## Local development

### 1.Prerequisites
 - Docker
 - Node.js
 - Git

### 2.Clone the repository
```bash
git clone https://github.com/your-org/a11y-pulse.git
cd a11y-pulse
```
### 3.Configure environment
Create a .env file in the project root:
```bash
DATABASE_URL=mysql://a11y:a11y@database:3306/a11y_pulse
NEXTAUTH_URL=http://a11y-pulse.lndo.site
NEXTAUTH_SECRET=your-secret-key
```
### 4.Start Docker container
```bash
./start
```
This will spin up:
- A Next.js app container (appserver)
- MariaDB (database)

### 5.Install dependencies
```bash
npm install
```

### 6.Set up the database
Run initial schema migration:
```bash
./migrate
```

Your app should now be available at:
👉 http://localhost:3000

Restart only frontend
```angular2html
docker compose exec app npm run dev
```
