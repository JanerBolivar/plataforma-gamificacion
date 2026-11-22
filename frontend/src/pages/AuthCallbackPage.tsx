import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export const AuthCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // La cookie ya fue enviada por el navegador via Set-Cookie desde el backend.
    // Consultamos el perfil para verificar la sesion.
    refreshUser()
      .then(() => {
        navigate('/', { replace: true });
      })
      .catch(() => {
        setError('Error al validar la sesion del usuario.');
        setTimeout(() => navigate('/login?error=invalid_session', { replace: true }), 2500);
      });
  }, [refreshUser, navigate]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-md">
        <CardHeader className="text-center">
          <CardTitle className="text-lg">Procesando Autenticacion</CardTitle>
          <CardDescription>
            {error ? error : 'Validando credenciales y preparando sesion de usuario...'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4 mx-auto" />
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthCallbackPage;
