import { requireAuth } from '@/server/guard';
import { getProfile } from '@/modules/usuarios/profile-service';
import { ProfileForm } from '@/components/ProfileForm';

export const dynamic = 'force-dynamic';

export default async function PerfilPage() {
  const user = await requireAuth();
  const profile = await getProfile(user.id);

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Meu perfil</h1>
      <p className="mt-1 text-sm text-slate-600">
        Atualize seus dados cadastrais, sua foto e sua senha de acesso.
      </p>

      <ProfileForm profile={profile} />
    </div>
  );
}
