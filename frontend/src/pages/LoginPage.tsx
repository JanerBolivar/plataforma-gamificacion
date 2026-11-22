import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LogIn } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

export const LoginPage: React.FC = () => {
  const { loginWithMicrosoft } = useAuth();
  const [searchParams] = useSearchParams();
  const errorParam = searchParams.get('error');

  const getErrorMessage = (error: string | null) => {
    switch (error) {
      case 'oauth_failed':
        return 'La autorizacion con Microsoft fue cancelada o rechazada.';
      case 'missing_code':
        return 'No se recibio el codigo de verificacion de Microsoft.';
      case 'authentication_failed':
        return 'Error al procesar el inicio de sesion con el servidor.';
      default:
        return error ? 'Ocurrio un problema durante la autenticacion.' : null;
    }
  };

  const errorMessage = getErrorMessage(errorParam);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Plataforma Educativa
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Acceso institucional mediante Microsoft Entra ID
          </p>
        </div>

        <Card className="shadow-lg border-slate-200 dark:border-slate-800">
          <CardHeader className="text-center">
            <CardTitle className="text-lg">Iniciar Sesion</CardTitle>
            <CardDescription>
              Utilice su cuenta de correo electronico institucional o de Microsoft para ingresar.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {errorMessage && (
              <div className="rounded-md bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/50 p-3 text-sm text-red-700 dark:text-red-300 text-center">
                {errorMessage}
              </div>
            )}

            <Button
              onClick={loginWithMicrosoft}
              className="w-full py-6 flex items-center justify-center gap-3 text-base font-medium"
            >
              <LogIn className="w-5 h-5" />
              Iniciar sesion con Microsoft
            </Button>
          </CardContent>

          <CardFooter className="flex justify-center border-t border-slate-100 dark:border-slate-900 pt-4">
            <p className="text-xs text-slate-400 text-center">
              Sistema de autenticacion unica OAuth 2.0 / OIDC
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default LoginPage;
