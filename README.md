# Plataforma de Gamificacion Educativa

Plataforma web integral para la gamificacion, dinamizacion de dinámicas de aprendizaje y evaluacion interactiva de competencias en entornos tridimensionales en tiempo real. Disenada para su implementacion y uso academico en la **Universidad de la Amazonia** (Florencia, Caquetá, Colombia).

Desarrollada y concebida por **Janer Fabian Muñoz Bolivar** (Ingeniero de Sistemas, Consultor de Software e Infraestructura, Maestrante en Analítica de Datos).

---

## 1. Resumen Ejecutivo y Proposito

El proyecto ofrece un ecosistema inmersivo en el navegador web que combina mecanicas de videojuegos, exploracion espacial 3D, desafios colaborativos por equipos y dinamicas de evaluacion basadas en cartas de conocimiento (preguntas tecnicas, adivinanzas y retos de tiburones).

### Objetivos Principales

1. **Inmersion y Aprendizaje Activo:** Permitir a estudiantes y docentes interactuar en escenarios tridimensionales tematicos (iniciando con la "Isla del Pantano"), resolviendo retos academicos contextualizados en el entorno.
2. **Gestion de Partidas y Equipos:** Administrar salas de juego (lobbies), formacion de escuadras, asignacion de roles y monitoreo de progreso en tiempo real.
3. **Alto Rendimiento en Equipos de Pocos Recursos:** Optimizacion rigurosa de texturas, audio procedural sintetizado mediante Web Audio API y computacion eficiente de colisiones con `three-mesh-bvh` para ejecucion fluida en computadores de laboratorio y dispositivos estandar.
4. **Seguridad y Trazabilidad:** Autenticacion institucional mediante Microsoft Entra ID (OAuth 2.0 / OIDC), emision de tokens JWT en cookies HttpOnly y control de acceso basado en roles (`ADMIN`, `TEACHER`, `STUDENT`).

---

## 2. Pila Tecnologica (Tech Stack)

### Backend
- **Entorno de Ejecucion:** Node.js 20 LTS
- **Lenguaje:** TypeScript 5
- **Framework Web:** Express 4.x
- **Capa de Persistencia (ORM):** Prisma ORM 5.x
- **Base de Datos Relacional:** PostgreSQL 16
- **Autenticacion:** Microsoft Entra ID (OAuth 2.0 / OpenID Connect) + JWT (JSON Web Tokens)
- **Seguridad:** Helmet, CORS restringido, Cookie-Parser, express-rate-limit, Zod

### Frontend
- **Libreria de Interfaz:** React 18
- **Herramienta de Construccion:** Vite 8 con soporte TypeScript
- **Motor 3D y Renderizado:** Three.js (r187)
- **Fisicas y Colisiones Complejas:** `three-mesh-bvh` (v0.9.18) con `StaticGeometryGenerator`
- **Audio del Juego:** Web Audio API (sintesis procedural nativa sin descarga de archivos pesados)
- **Estilos y Componentes:** TailwindCSS 3, Lucide React, Radix UI (shadcn/ui)

### Infraestructura y DevOps
- **Contenedores:** Docker y Docker Compose
- **Servidor Web Cliente:** Nginx Alpine (en contenedor de produccion)
- **Red Aislada:** Red interna `gamificacion-net` con persistencia de volumenes

---

## 3. Arquitectura del Sistema

El monorepo cuenta con una separacion estricta entre la capa de presentacion 3D (SPA en React) y el servidor de servicios empresariales (API REST en Express con Prisma).

### Diagrama de Arquitectura de Alto Nivel

```mermaid
flowchart TD
    subgraph Cliente["Cliente Web (Navegador)"]
        UI["Interfaz React / TailwindCSS"]
        ThreeCanvas["Three.js (Canvas 3D)"]
        BVH["three-mesh-bvh (Fisica y Colisiones)"]
        WebAudio["Web Audio API (Sintesis Procedural)"]
        MapEditor["Editor de Mapas (F2)"]
    end

    subgraph BackendAPI["Backend REST (Node.js + Express)"]
        AuthMiddleware["Middleware Auth & Roles (JWT)"]
        AuthRoutes["Rutas /api/auth (OAuth Microsoft)"]
        MatchRoutes["Rutas /api/matches (Salas y Equipos)"]
        UserRoutes["Rutas /api/users"]
        PrismaService["Prisma ORM"]
    end

    subgraph Persistencia["Base de Datos"]
        PostgresDB[("PostgreSQL 16")]
    end

    subgraph Identidad["Proveedor de Identidad"]
        MicrosoftOAuth["Microsoft Entra ID (OIDC)"]
    end

    UI --> ThreeCanvas
    ThreeCanvas --> BVH
    ThreeCanvas --> WebAudio
    UI --> MapEditor

    UI -- "Peticiones HTTP con Cookies HttpOnly" --> AuthMiddleware
    AuthMiddleware --> AuthRoutes
    AuthMiddleware --> MatchRoutes
    AuthMiddleware --> UserRoutes
    AuthRoutes -- "Validacion de Token OIDC" --> MicrosoftOAuth
    AuthRoutes --> PrismaService
    MatchRoutes --> PrismaService
    UserRoutes --> PrismaService
    PrismaService --> PostgresDB
```

---

## 4. Modelo de Datos (Esquema Prisma)

El esquema relacional implementado en `backend/prisma/schema.prisma` soporta la estructura de usuarios, sesiones de juego, equipos y miembros.

```mermaid
erDiagram
    User ||--o{ Match : "organiza (host)"
    User ||--o{ MatchParticipant : "participa"
    User ||--o{ TeamInvitation : "envia/recibe"
    Match ||--o{ Team : "contiene"
    Match ||--o{ MatchParticipant : "inscribe"
    Team ||--o{ MatchParticipant : "agrupa"
    Team ||--o{ TeamInvitation : "genera"

    User {
        String id PK
        String email UK
        String name
        Role role "ADMIN | TEACHER | STUDENT"
        UserStatus status "ACTIVE | INACTIVE | PENDING"
        String microsoftId UK
        DateTime createdAt
        DateTime updatedAt
    }

    Match {
        String id PK
        String title
        String description
        String code UK
        MatchStatus status "DRAFT | LOBBY | IN_PROGRESS | FINISHED | CANCELLED"
        Int maxPlayers
        Int maxTeams
        String hostId FK
        Json settings
        DateTime createdAt
        DateTime updatedAt
    }

    Team {
        String id PK
        String name
        String color
        Int score
        String matchId FK
        DateTime createdAt
    }

    MatchParticipant {
        String id PK
        String matchId FK
        String userId FK
        String teamId FK
        Int score
        Boolean isReady
        DateTime joinedAt
    }

    TeamInvitation {
        String id PK
        String teamId FK
        String inviterId FK
        String inviteeId FK
        InvitationStatus status "PENDING | ACCEPTED | REJECTED"
        DateTime createdAt
    }
```

---

## 5. El Entorno 3D: "Isla del Pantano"

El modulo de juego cliente (`frontend/src/game/`) implementa un entorno de exploracion tridimensional optimizado:

### Caracteristicas Tecnicas y Mecanicas

1. **Geometria y Colisiones con `three-mesh-bvh`:**
   - La totalidad de objetos estaticos (terreno base, chozas, empalizadas, troncos y accesorios) se fusionan en una malla de colision unica mediante `StaticGeometryGenerator`.
   - Se indexa una estructura BVH (*Bounding Volume Hierarchy*) que permite evaluar raycasting y proyecciones de capsulas del jugador a 60 FPS con precision milimetrica de triangulos.
2. **Acceso a la Choza Elevada mediante Parkour de Troncos:**
   - Para resolver la accesibilidad a la puerta elevada de la choza ceremonial sin requerir rampas artificiales que danan la armonia visual, se implemento una progresion de troncos de madera en disposicion escalonada (*Sky Run*).
   - El jugador debe saltar secuencialmente entre los troncos para alcanzar la plataforma superior.
3. **Texturizado Ligero Procedural:**
   - Texturas de pasto y terreno sintetizadas mediante shaders matematicos livianos, evitando la descarga de pesados atlas de texturas 4K.
4. **Agua Dinamica y Niebla:**
   - Superficie acuatica en las cotas inferiores con ondulacion senoidal y niebla ambiental volumetrica caracteristica del pantano.
5. **Audio Procedural (Web Audio API):**
   - El modulo `AudioManager.ts` genera sintetizadores de sonido en tiempo real:
     - Ruido blanco filtrado para pasos sobre pasto.
     - Ondas liquidas y filtros paso-bajo con resonancia para chapoteo en agua.
     - Osciladores modulados para saltos y amortiguacion de caidas.
6. **Seguridad y Limites del Mapa:**
   - Muro perimetral invisible de colision para impedir la salida del escenario.
   - Algoritmo de deteccion de vacio: si el jugador desciende por debajo de `Y = -10.0`, el sistema reubica al jugador en la posicion inicial de aparicion de forma segura.
7. **Editor de Mapas en Vivo (`F2`):**
   - Herramienta para disenadores de niveles que permite seleccionar cualquier objeto del escenario, desplazarlo en los tres ejes con *Gizmos* (TransformControls), rotarlo, escalar y descargar el archivo `pantano-map.json` actualizado.

### Tabla de Controles del Usuario

| Control / Tecla | Accion en el Juego |
|-----------------|--------------------|
| `W`, `A`, `S`, `D` / Flechas | Movimiento direccional (adelante, izquierda, atras, derecha) |
| `Shift` (sostenido) | Correr (aumento de velocidad de traslacion) |
| `Espacio` | Saltar |
| `Clic izquierdo` | Bloquear cursor del raton (*Pointer Lock*) e iniciar control de camara |
| `Alt` o Boton Menu | Abrir/Cerrar menu de pausa (compatible con modo Pantalla Completa) |
| `F2` | Activar / Desactivar el Editor de Escenario en tiempo real |
| `Escape` | Liberar puntero de raton a nivel de navegador |

---

## 6. Variables de Entorno

Copiar la plantilla `.env.example` tanto en la raiz como en las carpetas `backend/` y `frontend/`:

```env
# Configuracion General
NODE_ENV=production

# Base de datos PostgreSQL
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres_password_secure
POSTGRES_DB=gamificacion_db
POSTGRES_PORT=5432

# Backend API
PORT=4000
DATABASE_URL=postgresql://postgres:postgres_password_secure@localhost:5432/gamificacion_db?schema=public
CORS_ORIGIN=http://localhost:3000

# Microsoft Entra ID (OAuth 2.0)
MICROSOFT_CLIENT_ID=su-client-id-azure
MICROSOFT_CLIENT_SECRET=su-client-secret-azure
MICROSOFT_TENANT_ID=common
MICROSOFT_REDIRECT_URI=http://localhost:4000/api/auth/microsoft/callback

# Criptografia y JWT
JWT_SECRET=super_secret_jwt_key_universidad_amazonia_2026
JWT_EXPIRES_IN=8h
ADMIN_EMAILS=j.munoz@udla.edu.co

# Frontend Web
FRONTEND_URL=http://localhost:3000
FRONTEND_PORT=3000
VITE_API_URL=http://localhost:4000
```

---

## 7. Instalacion y Ejecucion

### Opcion A: Desarrollo Local (Paso a Paso)

#### 1. Iniciar la base de datos PostgreSQL
```bash
docker compose up -d db
```

#### 2. Configurar y poner en marcha el Backend
```bash
cd backend
cp .env.example .env
npm install
npx prisma generate
npx prisma db push
npm run dev
```
Servidor backend disponible en `http://localhost:4000`. Verificacion: `GET http://localhost:4000/api/health`.

#### 3. Configurar y poner en marcha el Frontend
```bash
cd ../frontend
cp .env.example .env
npm install
npm run dev
```
Aplicacion cliente disponible en `http://localhost:5173`.

---

### Opcion B: Despliegue con Docker Compose (Pila Completa)

Para construir y levantar el contenedor de base de datos, el backend compilado y el frontend empaquetado en Nginx:

```bash
# Iniciar servicios en segundo plano con reconstruccion de imagenes
docker compose up -d --build

# Comprobar estado de los contenedores
docker compose ps

# Monitorear logs de ejecucion
docker compose logs -f

# Detener todos los servicios
docker compose down
```

Accesos en modo contenedor:
- **Cliente Web:** `http://localhost:3000`
- **Servidor API:** `http://localhost:4000`
- **Healthcheck:** `http://localhost:4000/api/health`

---

## 8. Catalogo de la API REST

Todas las respuestas de la API siguen la estructura unificada `{ success: boolean, data?: any, error?: string }`.

| Metodo | Ruta | Descripcion | Acceso Requerido |
|--------|------|-------------|------------------|
| `GET` | `/api/health` | Estado del servicio y conexion a PostgreSQL | Publico |
| `GET` | `/api/auth/microsoft` | Inicia redireccion a login de Microsoft | Publico |
| `GET` | `/api/auth/microsoft/callback` | Callback OAuth2, emision de JWT y cookie | Publico |
| `GET` | `/api/auth/me` | Obtener perfil del usuario autenticado actual | Autenticado (`JWT`) |
| `POST` | `/api/auth/logout` | Revocar sesion y limpiar cookie de acceso | Autenticado (`JWT`) |
| `GET` | `/api/users` | Listado general de usuarios registrados | Rol `ADMIN` o `TEACHER` |
| `GET` | `/api/matches` | Lista de partidas activas o historicas | Autenticado |
| `POST` | `/api/matches` | Creacion de una nueva partida | Rol `ADMIN` o `TEACHER` |
| `GET` | `/api/matches/:id` | Detalle, participantes y estado de partida | Autenticado |
| `POST` | `/api/matches/join` | Unirse a una partida mediante codigo | Autenticado (`STUDENT`) |
| `POST` | `/api/matches/:id/teams` | Creacion de un equipo en la partida | Autenticado |
| `POST` | `/api/matches/:id/start` | Cambiar estado a `IN_PROGRESS` | Creador de la partida |
| `POST` | `/api/matches/:id/finish` | Finalizar partida y consolidar puntajes | Creador de la partida |

---

## 9. Creditos y Titularidad

- **Autor Intelectual y Desarrollador Principal:**  
  **Janer Fabian Muñoz Bolivar**  
  Ingeniero de Sistemas | Consultor de Software e Infraestructura | Maestrante en Analítica de Datos
- **Entidad Beneficiaria y de Aplicacion:**  
  **Universidad de la Amazonia** — Florencia, Caquetá, Colombia.
- **Licencia:** Software Propietario. Todos los derechos reservados. Consulte el archivo [LICENSE](file:///C:/Users/Janer/Documents/Desarrollo/Gamificaión/plataforma-gamificacion/LICENSE) para los terminos de propiedad intelectual y concesion de uso institucional.
