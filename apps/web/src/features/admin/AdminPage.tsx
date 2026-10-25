/**
 * Panel de administracion.
 *
 * Tres secciones, una por cosa configurable:
 *   Catalogos -> las listas de valores y sus jerarquias
 *   Campos    -> que campos tiene el formulario de desvio
 *   Usuarios  -> quien entra y con que rol
 *
 * Solo accesible para ADMIN (lo filtra la navegacion y lo verifica la API en
 * cada endpoint: no alcanza con esconder el boton).
 */
import { useState } from 'react';
import { Database, SlidersHorizontal, Users } from 'lucide-react';
import { CatalogosTab } from './CatalogosTab';
import { CamposTab } from './CamposTab';
import { UsuariosTab } from './UsuariosTab';

const TABS = [
  { id: 'catalogos', label: 'Catalogos', Icono: Database, Componente: CatalogosTab },
  { id: 'campos', label: 'Campos del formulario', Icono: SlidersHorizontal, Componente: CamposTab },
  { id: 'usuarios', label: 'Usuarios', Icono: Users, Componente: UsuariosTab },
] as const;

export function AdminPage() {
  const [activa, setActiva] = useState<(typeof TABS)[number]['id']>('catalogos');
  const Activa = TABS.find((t) => t.id === activa)!.Componente;

  return (
    <div className="space-y-5">
      <div className="tira-scroll">
        {TABS.map(({ id, label, Icono }) => (
          <button
            key={id}
            onClick={() => setActiva(id)}
            className={`tira-item ${
              activa === id ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Icono size={16} />
            {label}
          </button>
        ))}
      </div>

      <Activa />
    </div>
  );
}
