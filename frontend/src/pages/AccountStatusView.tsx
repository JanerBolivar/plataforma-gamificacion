import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, ShieldAlert, LogOut } from 'lucide-react';

interface AccountStatusViewProps {
  status: 'PENDING' | 'BLOCKED';
}

export const AccountStatusView: React.FC<AccountStatusViewProps> = ({ status }) => {
  const { user, logout } = useAuth();

  const isPending = status === 'PENDING';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
      <Card className="w-full max-w-lg shadow-lg border-slate-200 dark:border-slate-800">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center">
            {isPending ? (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/50 rounded-full text-amber-600 dark:text-amber-400">
                <Clock className="w-8 h-8" />
              </div>
            ) : (
              <div className="p-3 bg-red-50 dark:bg-red-950/50 rounded-full text-red-600 dark:text-red-400">
                <ShieldAlert className="w-8 h-8" />
              </div>
            )}
          </div>
          <CardTitle className="text-xl">
            {isPending ? 'Cuenta Pendiente de Activacion' : 'Cuenta Suspendida'}
          </CardTitle>
          <CardDescription>
            {isPending
              ? `Hola ${user?.firstName || ''}, su cuenta ha sido registrada en la plataforma.`
              : `La cuenta asociada a ${user?.email || ''} se encuentra restringida.`}
          </CardDescription>
        </CardHeader>

        <CardContent className="text-sm text-slate-600 dark:text-slate-400 text-center space-y-3">
          {isPending ? (
            <p>
              Por motivos de seguridad y control de acceso, un administrador de la institucion
              debe autorizar y activar su perfil antes de poder acceder a las partidas y actividades.
            </p>
          ) : (
            <p>
              El acceso a la plataforma ha sido suspendido temporal o definitivamente por un administrador.
              Por favor contacte al area administrativa para mayor informacion.
            </p>
          )}
        </CardContent>

        <CardFooter className="flex justify-center border-t border-slate-100 dark:border-slate-900 pt-4">
          <Button variant="outline" onClick={logout} className="gap-2">
            <LogOut className="w-4 h-4" />
            Cerrar Sesion
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default AccountStatusView;
