# 🛡️ CampusGuard — Smart Campus & Building Safety Platform

> **TechTrix'26 — Real-Time IoT & Campus Security Management System**  
> Built with Next.js 16, React 19, Tailwind CSS v4, Prisma SQLite, Socket.IO, and Caddy.

---

## 🌟 Key Features

* **📡 Live Sensor Monitoring:** Real-time temperature, smoke, air quality, and water leak metrics across all campus buildings with visual threshold indicators.
* **🚨 Automated Alert Center:** Threshold breach alerts, sound notifications, and acknowledgement workflows.
* **🆘 Emergency SOS Hub:** One-touch SOS dispatch, live incident logging, and automated escalation to campus security.
* **🚪 Security & Visitor Tracking:** Restricted-area access logs, automated visitor check-in/checkout, and visitor badge records.
* **🔧 Facility Maintenance:** Work-order requests, status tracking, proof-of-work uploads, and supervisor verification workflows.
* **🎭 Role-Based Views:** Switch between Admin, Security Guard, Facility Manager, and Visitor views.
* **⚡ Real-time Simulation Engine:** Background simulation service emitting live socket updates across buildings.

---

## 🚀 1-Click Deploy on Render

### Method 1: Using Render Blueprint (Recommended)
1. Go to **[Render Dashboard](https://dashboard.render.com/)**.
2. Click **New +** → **Blueprint**.
3. Connect your repository: `https://github.com/vicky232444-tech/campusguard`.
4. Render will automatically detect [`render.yaml`](render.yaml) and deploy the Docker web service.
5. Click **Apply**. Your app will be live with full HTTPS in ~2–3 minutes!

### Method 2: Manual Web Service
1. In Render, click **New +** → **Web Service**.
2. Select **Build and deploy from a Git repository** and pick `campusguard`.
3. Set **Language / Runtime** to **Docker**.
4. Set **Instance Type** to **Free**.
5. Add Environment Variables:
   - `PORT`: `10000`
   - `NODE_ENV`: `production`
   - `DATABASE_URL`: `file:../db/custom.db`
   - `INTERNAL_SECRET`: `campusguard-demo-secret`
6. Click **Deploy Web Service**!

---

## 💻 Local Development (Bun)

### Prerequisites
- [Bun](https://bun.sh/) (v1.2+)

### Run Locally:
```bash
# 1. Install root dependencies
bun install

# 2. Setup SQLite database
bun x prisma generate
bun x prisma db push --accept-data-loss

# 3. Start development server
bun dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🐳 Docker Deployment

To build and test the production container locally:
```bash
docker build -t campusguard .
docker run -p 10000:10000 campusguard
```
Open [http://localhost:10000](http://localhost:10000).

---

## 📦 Project Structure

```
├── Caddyfile              # Gateway proxy (routes port $PORT & XTransformPort socket.io)
├── Dockerfile             # Multi-stage Bun + Caddy container
├── render.yaml            # Render Blueprint deployment definition
├── start.sh               # Production startup orchestrator
├── db/
│   └── custom.db          # Seeded SQLite database
├── mini-services/
│   └── sim-service/       # Real-time sensor & socket.io event simulator
├── prisma/
│   └── schema.prisma      # Prisma ORM schema
├── public/                # Static assets & icons
└── src/
    ├── app/               # Next.js App Router (pages & API endpoints)
    ├── components/        # UI components & role views (shadcn/radix)
    └── lib/               # Database, auth, socket.io, and live store helpers
```
