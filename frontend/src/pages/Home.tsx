import React, { useEffect, useState } from 'react';
import { healthService } from '../services/health.service';
import { HealthStatus } from '../types/health';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, CheckCircle2, AlertCircle, Server, Activity, Gamepad2 } from 'lucide-react';

export const Home: React.FC = () => {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await healthService.checkHealth();
      setHealth(data);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('No fue posible establecer comunicacion con el servidor.');
      }
      setHealth(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-2xl text-primary mb-2">
            <Gamepad2 className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
            Plataforma de Gamificacion
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Fase 1: Scaffolding y Verificacion de Conectividad Base
          </p>
        </div>

        <Card className="shadow-lg border-slate-200 dark:border-slate-800">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Server className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                <CardTitle className="text-xl">Estado de la API</CardTitle>
              </div>
              <div>
                {loading ? (
                  <Badge variant="outline" className="animate-pulse">
                    Comprobando...
                  </Badge>
                ) : health ? (
                  <Badge variant="success" className="gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Conectado
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> Error
                  </Badge>
                )}
              </div>
            </div>
            <CardDescription>
              Comprobacion en tiempo real del endpoint <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-xs">/api/health</code>
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {health && (
              <div className="rounded-md bg-slate-100 dark:bg-slate-900 p-4 space-y-2 text-sm">
                <div className="flex justify-between items-center text-slate-700 dark:text-slate-300">
                  <span className="font-medium flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-emerald-500" /> Servidor:
                  </span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">{health.status.toUpperCase()}</span>
                </div>
                <div className="flex justify-between items-center text-slate-600 dark:text-slate-400 text-xs">
                  <span>Marca temporal:</span>
                  <span className="font-mono">{new Date(health.timestamp).toLocaleTimeString()}</span>
                </div>
                {health.environment && (
                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-400 text-xs">
                    <span>Entorno:</span>
                    <span className="font-mono">{health.environment}</span>
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="rounded-md bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/50 p-4 text-sm text-red-700 dark:text-red-300">
                <p className="font-medium mb-1">Fallo de comunicacion</p>
                <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
                <p className="text-xs mt-2 text-slate-500 dark:text-slate-400">
                  Verificar que el servicio backend se encuentre en ejecucion en el puerto configurado.
                </p>
              </div>
            )}
          </CardContent>

          <CardFooter className="flex justify-end pt-2">
            <Button
              onClick={fetchHealth}
              disabled={loading}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Reintentar
            </Button>
          </CardFooter>
        </Card>

        <div className="grid grid-cols-2 gap-3 text-xs text-slate-500 dark:text-slate-400 text-center">
          <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50">
            <span className="font-semibold block text-slate-700 dark:text-slate-300">Frontend</span>
            React 18 + Vite + Tailwind + shadcn/ui
          </div>
          <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50">
            <span className="font-semibold block text-slate-700 dark:text-slate-300">Backend</span>
            Node.js + Express + Prisma + PostgreSQL
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
