import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Gamepad2,
  BookOpen,
  Users,
  Trophy,
  Sparkles,
  ArrowRight,
  Shield,
  Compass,
  Layers,
  Cpu,
  LogIn,
  CheckCircle2,
  Target,
  TrendingUp,
  School,
  Flame,
  Award,
} from 'lucide-react';

export const Home: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-cyan-500 selection:text-white">
      {/* 1. Header / Navbar Superior */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-slate-950/80 border-b border-slate-800/80 px-4 sm:px-8 py-3.5 transition-all">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-tr from-cyan-600 to-blue-500 rounded-xl text-white shadow-lg shadow-cyan-500/20">
              <Gamepad2 className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-base sm:text-lg tracking-tight text-white block leading-none">
                Blue Ocean Frontier
              </span>
              <span className="text-[10px] sm:text-xs text-cyan-400 font-medium">
                Plataforma de Gamificación Educativa
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-xs text-slate-300 font-medium">
            <a href="#proyecto" className="hover:text-cyan-400 transition-colors">
              El Proyecto
            </a>
            <a href="#alianza" className="hover:text-cyan-400 transition-colors">
              Alianza & Laboratorio
            </a>
            <a href="#metodologia" className="hover:text-cyan-400 transition-colors">
              Estrategia del Océano Azul
            </a>
            <a href="#mundo3d" className="hover:text-cyan-400 transition-colors">
              Escenarios 3D
            </a>
            <a href="#tecnologia" className="hover:text-cyan-400 transition-colors">
              Tecnología
            </a>
          </nav>

          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => navigate('/matches')}
                  className="bg-cyan-600 hover:bg-cyan-500 text-white gap-1.5 text-xs shadow-md shadow-cyan-600/25 font-semibold"
                >
                  <Gamepad2 className="w-4 h-4" />
                  Ir al Lobby
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate('/welcome')}
                  className="border-slate-700 hover:bg-slate-800 text-slate-200 text-xs gap-1.5 hidden sm:flex"
                >
                  Mi Avatar
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                onClick={() => navigate('/login')}
                className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white gap-1.5 text-xs font-semibold shadow-md shadow-cyan-500/20"
              >
                <LogIn className="w-4 h-4" />
                Iniciar Sesión
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 sm:pt-20 sm:pb-28 border-b border-slate-900 bg-radial-gradient">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-cyan-900/20 via-slate-950 to-slate-950 -z-10" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-950/80 border border-cyan-800/60 text-cyan-300 text-xs font-medium backdrop-blur-md shadow-inner">
            <School className="w-3.5 h-3.5 text-cyan-400" />
            <span>Universidad de la Amazonia &bull; Laboratorio de Lúdica GEMA</span>
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white max-w-4xl mx-auto leading-tight sm:leading-none">
            Blue Ocean Frontier: <br />
            <span className="bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-500 bg-clip-text text-transparent">
              "Crea tu propio océano"
            </span>
          </h1>

          <p className="text-sm sm:text-lg text-slate-400 max-w-3xl mx-auto leading-relaxed">
            Plataforma virtual inmersiva en tres dimensiones para la apropiación dinámica de la{' '}
            <strong className="text-slate-200 font-semibold">Estrategia del Océano Azul</strong>, formulación de modelos de negocio innovadores y evaluación cooperativa de competencias en tiempo real.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
            {user ? (
              <Button
                size="lg"
                onClick={() => navigate('/matches')}
                className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-7 gap-2 shadow-xl shadow-cyan-500/25 text-sm"
              >
                Acceder al Lobby de Partidas
                <ArrowRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                size="lg"
                onClick={() => navigate('/login')}
                className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold px-7 gap-2 shadow-xl shadow-cyan-500/25 text-sm"
              >
                Ingresar a la Plataforma
                <LogIn className="w-4 h-4" />
              </Button>
            )}
            <a href="#metodologia">
              <Button
                size="lg"
                variant="outline"
                className="border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-200 text-sm font-medium gap-2"
              >
                <BookOpen className="w-4 h-4 text-cyan-400" />
                Explorar Metodología
              </Button>
            </a>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl mx-auto pt-10 text-left">
            <div className="p-3.5 rounded-xl border border-slate-800/80 bg-slate-900/40">
              <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold block">Modalidad</span>
              <span className="text-sm font-bold text-cyan-300">Multijugador Virtual</span>
            </div>
            <div className="p-3.5 rounded-xl border border-slate-800/80 bg-slate-900/40">
              <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold block">Capacidad</span>
              <span className="text-sm font-bold text-sky-300">Hasta 6 Equipos</span>
            </div>
            <div className="p-3.5 rounded-xl border border-slate-800/80 bg-slate-900/40">
              <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold block">Escuadras</span>
              <span className="text-sm font-bold text-blue-300">6 Usuarios por Equipo</span>
            </div>
            <div className="p-3.5 rounded-xl border border-slate-800/80 bg-slate-900/40">
              <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold block">Motor</span>
              <span className="text-sm font-bold text-teal-300">Three.js 3D & Colyseus</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Seccion: Que es el Proyecto y su Proposito */}
      <section id="proyecto" className="py-16 sm:py-24 max-w-6xl mx-auto px-4 sm:px-6 space-y-12">
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <Badge className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 text-xs">
            Propósito Formativo
          </Badge>
          <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-white">
            Transformando la Teoría Estratégica en Acción Vivencial
          </h2>
          <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
            La plataforma supera los límites de la enseñanza magistral unidireccional. A través de un mundo tridimensional interactivo, los estudiantes encarnan avatares y toman decisiones gerenciales en tiempo real, enfrentando las consecuencias de competir en océanos saturados o aventurarse en espacios sin competencia.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-slate-900/60 border-slate-800">
            <CardHeader className="space-y-2">
              <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-lg w-fit">
                <Compass className="w-5 h-5" />
              </div>
              <CardTitle className="text-base text-white">Inmersión y Exploración 3D</CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Entornos virtuales detallados donde los equipos exploran islas, recolectan tarjetas de conceptos clave y desbloquean portales de conocimiento.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="bg-slate-900/60 border-slate-800">
            <CardHeader className="space-y-2">
              <div className="p-2.5 bg-cyan-500/10 text-cyan-400 rounded-lg w-fit">
                <Users className="w-5 h-5" />
              </div>
              <CardTitle className="text-base text-white">Cooperación y Competencia Sana</CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Mecánicas multijugador sincronizadas que exigen deliberación interna entre compañeros de equipo para contestar preguntas y ganar oportunidades.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="bg-slate-900/60 border-slate-800">
            <CardHeader className="space-y-2">
              <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-lg w-fit">
                <Trophy className="w-5 h-5" />
              </div>
              <CardTitle className="text-base text-white">Evaluación Formativa y Trazabilidad</CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Monitoreo continuo de respuestas, puntajes acumulados, avances en el tablero y persistencia histórica de cada partida para retroalimentación docente.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* 4. Seccion: Alianza Institucional y Laboratorio de Ludica */}
      <section id="alianza" className="py-16 sm:py-24 bg-slate-900/40 border-y border-slate-800/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-12">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-10">
            <div className="space-y-5 lg:max-w-xl">
              <Badge className="bg-blue-500/10 text-blue-400 border border-blue-500/30 text-xs">
                Alianza Académica
              </Badge>
              <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-white leading-tight">
                Desarrollo en conjunto con el Laboratorio de Lúdica UNIAMAZONIA &bull; GEMA
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                Este proyecto representa el resultado de la sinergia entre el{' '}
                <strong className="text-white">Laboratorio de Lúdica UNIAMAZONIA - GEMA</strong>{' '}
                (Grupo De Estudios De Futuro En El Mundo Amazónico) y la innovación de software de vanguardia en la{' '}
                <strong className="text-white">Universidad de la Amazonia</strong> en Florencia, Caquetá, Colombia.
              </p>
              <p className="text-xs text-slate-400 leading-relaxed">
                El Laboratorio aportó la fundamentación pedagógica, la estructuración de formatos de juego, las matrices evaluativas y las dinámicas lúdicas basadas en el libro de W. Chan Kim y Renée Mauborgne, transformando los modelos teóricos de los océanos azules en reglas de juego medibles y motivantes.
              </p>
              <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center gap-4 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                  <span>Validado en aulas universitarias</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                  <span>Pedagogía activa y lúdica</span>
                </div>
              </div>
            </div>

            {/* Ficha de Autor y Direccion Tecnica */}
            <div className="w-full lg:max-w-md bg-gradient-to-br from-slate-900 via-slate-900/90 to-cyan-950/40 p-6 rounded-2xl border border-slate-800 shadow-xl space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center text-white font-bold text-lg shadow-md">
                  JM
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Janer Fabián Muñoz Bolívar</h3>
                  <p className="text-xs text-cyan-400 font-medium">Director Técnico & Desarrollador Principal</p>
                </div>
              </div>
              <div className="space-y-2 text-xs text-slate-300">
                <p className="flex items-center gap-2">
                  <Award className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                  <span>Ingeniero de Sistemas</span>
                </p>
                <p className="flex items-center gap-2">
                  <Cpu className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                  <span>Consultor de Software e Infraestructura</span>
                </p>
                <p className="flex items-center gap-2">
                  <TrendingUp className="w-3.5 h-3.5 text-teal-400 flex-shrink-0" />
                  <span>Maestrante en Analítica de Datos</span>
                </p>
                <p className="flex items-center gap-2 text-slate-400 pt-1">
                  <School className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                  <span>Universidad de la Amazonia &bull; Florencia, Caquetá</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Seccion Metodologia Pedagogica: Estrategia del Oceano Azul */}
      <section id="metodologia" className="py-16 sm:py-24 max-w-6xl mx-auto px-4 sm:px-6 space-y-16">
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <Badge className="bg-sky-500/10 text-sky-400 border border-sky-500/30 text-xs">
            Fundamento Metodológico
          </Badge>
          <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-white">
            Estrategia del Océano Azul en el Aula
          </h2>
          <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
            Basada en la teoría de W. Chan Kim y Renée Mauborgne y el caso paradigmático del{' '}
            <strong className="text-slate-200">Cirque du Soleil</strong> concebido por Guy Laliberté: la única manera de vencer a la competencia es dejar de tratar de vencerla.
          </p>
        </div>

        {/* Tabla Comparativa: Oceano Rojo vs Oceano Azul */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-gradient-to-b from-red-950/20 to-slate-900/60 border-red-900/40">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 text-red-400 font-bold text-base">
                <Flame className="w-5 h-5 text-red-500" />
                Océanos Rojos (Competencia Tradicional)
              </div>
              <CardDescription className="text-xs text-slate-400">
                El espacio conocido de mercado saturado y guerra de precios.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-slate-300">
              <p className="flex items-start gap-2">
                <span className="text-red-400 font-bold">&bull;</span>
                <span>Competir en el espacio de mercado existente.</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="text-red-400 font-bold">&bull;</span>
                <span>Explotar la demanda existente y luchar por cuota de mercado.</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="text-red-400 font-bold">&bull;</span>
                <span>Enfocarse en vencer a los rivales a través de la imitación.</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="text-red-400 font-bold">&bull;</span>
                <span>Elegir entre la disyuntiva de valor o bajo costo.</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="text-red-400 font-bold">&bull;</span>
                <span>Los productos se commoditizan y tiñen de sangre las aguas.</span>
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-b from-cyan-950/30 to-slate-900/60 border-cyan-800/40">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 text-cyan-400 font-bold text-base">
                <Sparkles className="w-5 h-5 text-cyan-400" />
                Océanos Azules (Innovación en Valor)
              </div>
              <CardDescription className="text-xs text-slate-400">
                El espacio inexplorado donde se crea nueva demanda y rentabilidad.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-slate-300">
              <p className="flex items-start gap-2">
                <span className="text-cyan-400 font-bold">&bull;</span>
                <span>Crear un espacio sin competencia en el mercado.</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="text-cyan-400 font-bold">&bull;</span>
                <span>Generar y capturar nueva demanda no aprovechada.</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="text-cyan-400 font-bold">&bull;</span>
                <span>Hacer que la competencia pierda toda relevancia e importancia.</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="text-cyan-400 font-bold">&bull;</span>
                <span>Romper la disyuntiva de valor y costo (diferenciación y bajo costo).</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="text-cyan-400 font-bold">&bull;</span>
                <span>Innovación en valor orientada a una experiencia superior.</span>
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Matriz de las Cuatro Acciones (ERIC) */}
        <div className="space-y-6">
          <div className="text-center space-y-1">
            <h3 className="text-xl font-bold text-white">Matriz de las Cuatro Acciones (E.R.I.C.)</h3>
            <p className="text-xs text-slate-400">
              Herramienta central de reconstrucción estratégica aplicada al caso del Circo.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl border border-red-900/40 bg-red-950/10 space-y-2">
              <div className="text-red-400 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded bg-red-500/20">Eliminar</span>
              </div>
              <h4 className="font-semibold text-sm text-white">¿Qué eliminar por completo?</h4>
              <p className="text-xs text-slate-400">
                Variables sobre las que la industria compite tradicionalmente: espectáculos con animales, pistas múltiples, estrellas del circo y concesiones en pasillos.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-amber-900/40 bg-amber-950/10 space-y-2">
              <div className="text-amber-400 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded bg-amber-500/20">Reducir</span>
              </div>
              <h4 className="font-semibold text-sm text-white">¿Qué reducir por debajo?</h4>
              <p className="text-xs text-slate-400">
                Variables que encarecen sin aportar valor excepcional: humor simple, payasos tradicionales, suspenso y peligro innecesario.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-blue-900/40 bg-blue-950/10 space-y-2">
              <div className="text-blue-400 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded bg-blue-500/20">Incrementar</span>
              </div>
              <h4 className="font-semibold text-sm text-white">¿Qué incrementar por encima?</h4>
              <p className="text-xs text-slate-400">
                Variables que elevan la calidad: un solo escenario central refinado, asientos confortables, simplicidad logística y ambiente de prestigio.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-emerald-900/40 bg-emerald-950/10 space-y-2">
              <div className="text-emerald-400 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded bg-emerald-500/20">Crear</span>
              </div>
              <h4 className="font-semibold text-sm text-white">¿Qué incorporar o crear?</h4>
              <p className="text-xs text-slate-400">
                Factores inéditos en la industria: producciones artísticas con argumento y tema central, música y danza en vivo, iluminación teatral y múltiples espectáculos.
              </p>
            </div>
          </div>
        </div>

        {/* Secuencia Estrategica Correcta */}
        <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/50 space-y-4">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-cyan-400" />
            <h3 className="font-bold text-base text-white">Secuencia Estratégica para Confirmar la Viabilidad</h3>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Para garantizar que una idea de océano azul sea comercialmente viable y sostenible, los equipos deben evaluar secuencialmente cuatro oportunidades en el juego:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800 space-y-1">
              <span className="text-cyan-400 font-bold block">1. Utilidad Comprador</span>
              <p className="text-slate-400 text-[11px]">¿Ofrece una utilidad excepcional que atraiga al grueso de los compradores?</p>
            </div>
            <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800 space-y-1">
              <span className="text-sky-400 font-bold block">2. Precio Estratégico</span>
              <p className="text-slate-400 text-[11px]">¿Es un precio accesible para la masa de clientes con capacidad de pago?</p>
            </div>
            <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800 space-y-1">
              <span className="text-blue-400 font-bold block">3. Costo Objetivo</span>
              <p className="text-slate-400 text-[11px]">¿Permite obtener rentabilidad sana sin que el costo determine el precio?</p>
            </div>
            <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800 space-y-1">
              <span className="text-teal-400 font-bold block">4. Adopción</span>
              <p className="text-slate-400 text-[11px]">¿Se identificaron y superaron los obstáculos y barreras organizacionales?</p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Seccion: Escenarios 3D y Experiencia de Juego */}
      <section id="mundo3d" className="py-16 sm:py-24 bg-slate-900/40 border-y border-slate-800/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-12">
          <div className="text-center space-y-3 max-w-3xl mx-auto">
            <Badge className="bg-teal-500/10 text-teal-400 border border-teal-500/30 text-xs">
              Mundo Lúdico Interactivo
            </Badge>
            <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-white">
              Los Escenarios de Blue Ocean Frontier
            </h2>
            <p className="text-sm text-slate-400">
              Un viaje en dos etapas secuenciales que articulan la exploración colaborativa y el desafío conceptual.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Escenario 1: Isla del Pantano */}
            <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-emerald-500/10 text-emerald-400 text-xs font-semibold">
                Etapa 1
              </div>
              <h3 className="text-xl font-bold text-white">La Isla del Pantano</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Escenario exterior de 600m² rodeado de agua y niebla crepuscular. Los equipos exploran la geografía irregular buscando y recolectando tarjetas de conocimiento dispersas con los fundamentos de los océanos azul y rojo.
              </p>
              <ul className="text-xs text-slate-400 space-y-1.5 pt-2">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  <span>Avatares humanoides con animaciones fluidas (caminar, correr, saltar).</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  <span>Desafíos de adivinanzas y activación del portal de teletransporte.</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  <span>Físicas precisas y prevención de caídas al agua con colisiones BVH.</span>
                </li>
              </ul>
            </div>

            {/* Escenario 2: La Carpa del Circo y la Tarima */}
            <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-amber-500/10 text-amber-400 text-xs font-semibold">
                Etapa 2 & Premiación
              </div>
              <h3 className="text-xl font-bold text-white">El Circo & La Tarima de Campeones</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Dentro de la carpa circense, los equipos reclaman atriles interactivos numerados (1 al 6). La ruleta central gira por turnos y presenta cartas evaluativas, eventos de tiburones y avance en el tablero.
              </p>
              <ul className="text-xs text-slate-400 space-y-1.5 pt-2">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                  <span>Tiburones Rojos y Azules que modifican oportunidades y turnos.</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                  <span>La meta corona con 1 oportunidad adicional hasta alcanzar las 3 de la victoria.</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                  <span>Teletransportación a la Tarima exterior flotante con confeti y podio festivo.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Seccion: Tecnologia y Rendimiento */}
      <section id="tecnologia" className="py-16 sm:py-24 max-w-6xl mx-auto px-4 sm:px-6 space-y-12">
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <Badge className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 text-xs">
            Arquitectura de Software
          </Badge>
          <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-white">
            Diseñada para Alto Rendimiento en Salas de Cómputo
          </h2>
          <p className="text-sm text-slate-400">
            Optimizada minuciosamente para ejecutar fluidamente en computadores estándar y redes académicas.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 space-y-2">
            <Cpu className="w-6 h-6 text-cyan-400" />
            <h4 className="font-bold text-sm text-white">Three.js & BVH</h4>
            <p className="text-xs text-slate-400">
              Árboles BVH acelerares con three-mesh-bvh para colisiones físicas sólidas a 60 FPS sin sobrecargar la CPU.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 space-y-2">
            <Layers className="w-6 h-6 text-blue-400" />
            <h4 className="font-bold text-sm text-white">Colyseus Multiplayer</h4>
            <p className="text-xs text-slate-400">
              Sincronización autoritativa en tiempo real por WebSockets para avatares, ruleta, turnos y marcadores.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 space-y-2">
            <Sparkles className="w-6 h-6 text-teal-400" />
            <h4 className="font-bold text-sm text-white">Web Audio Procedural</h4>
            <p className="text-xs text-slate-400">
              Sintetizador procedural nativo vía Web Audio API: pisadas, saltos y fanfarrias sin descargar megabytes de audio.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 space-y-2">
            <Shield className="w-6 h-6 text-indigo-400" />
            <h4 className="font-bold text-sm text-white">Microsoft Entra ID</h4>
            <p className="text-xs text-slate-400">
              Autenticación institucional OAuth 2.0 / OIDC con emisión de tokens JWT seguros en cookies HttpOnly.
            </p>
          </div>
        </div>
      </section>

      {/* 8. Footer Institucional */}
      <footer className="mt-auto border-t border-slate-900 bg-slate-950 py-12 px-4 sm:px-8 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-1 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2">
              <span className="font-bold text-slate-200">Universidad de la Amazonia</span>
              <span>&bull;</span>
              <span className="text-cyan-400 font-medium">Laboratorio de Lúdica GEMA</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Desarrollado y dirigido por <strong className="text-slate-300">Janer Fabián Muñoz Bolívar</strong>
            </p>
            <p className="text-[11px] text-slate-400">
              Florencia, Caquetá, Colombia &bull; {new Date().getFullYear()}
            </p>
          </div>

          <div className="flex items-center gap-4">
            {user ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate('/matches')}
                className="border-slate-800 hover:bg-slate-900 text-xs text-slate-300"
              >
                Lobby de Partidas
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => navigate('/login')}
                className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs"
              >
                Iniciar Sesión
              </Button>
            )}
            <a
              href="#proyecto"
              className="text-slate-400 hover:text-cyan-400 transition-colors text-xs"
            >
              Volver arriba
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
