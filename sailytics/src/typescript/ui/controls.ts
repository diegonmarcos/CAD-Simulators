import type { Config, PropulsionMode } from '../types/index';

type ControlCallback = () => void;

function getElement<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Element #${id} not found`);
  return el as T;
}

function formatValue(id: string, value: number): string {
  switch (id) {
    case 'tws':
    case 'bs':
      return `${value} kts`;
    case 'mass':
      return `${value} kg`;
    case 'sarea':
      return `${value} m\u00B2`;
    case 'rh':
      return `${value} m`;
    case 'twd':
    case 'hdg':
      return `${value}\u00B0T`;
    case 'decl':
      return `${Math.abs(value)}\u00B0${value >= 0 ? 'E' : 'W'}`;
    case 'sang':
      return `${value}\u00B0`;
    case 'rpm':
      return `${value}`;
    default:
      return `${value}`;
  }
}

const INPUT_IDS = ['tws', 'twd', 'decl', 'bs', 'hdg', 'mass', 'sang', 'sarea', 'rpm', 'rh'] as const;

type SetModeFn = (mode: PropulsionMode) => void;

export function initControls(cfg: Config, onChange: ControlCallback): SetModeFn {
  // Slider bindings
  for (const id of INPUT_IDS) {
    const input = getElement<HTMLInputElement>(id);
    const display = getElement<HTMLSpanElement>(`disp-${id}`);

    input.addEventListener('input', () => {
      const val = parseFloat(input.value);
      (cfg as unknown as Record<string, number>)[id] = val;
      display.textContent = formatValue(id, val);
      onChange();
    });
  }

  // Mode buttons
  const setMode = (mode: PropulsionMode) => {
    cfg.mode = mode;
    document.querySelectorAll('.btn-mode').forEach((b) => b.classList.remove('active'));
    getElement(`mode-${mode}`).classList.add('active');
    getElement('ui-sail').style.display = mode === 'sail' || mode === 'hybrid' ? 'block' : 'none';
    getElement('ui-rotor').style.display = mode === 'rotor' || mode === 'hybrid' ? 'block' : 'none';
    onChange();
  };

  getElement('mode-sail').addEventListener('click', () => setMode('sail'));
  getElement('mode-rotor').addEventListener('click', () => setMode('rotor'));
  getElement('mode-hybrid').addEventListener('click', () => setMode('hybrid'));

  return setMode;
}

/**
 * Initialize 2D/3D view toggle
 */
export function initViewToggle(): void {
  const btn2d = getElement('view-2d');
  const btn3d = getElement('view-3d');
  const panel2d = getElement('viewport-2d');
  const panel3d = getElement('viewport-3d');

  function setView(view: '2d' | '3d'): void {
    document.querySelectorAll('.btn-view').forEach((b) => b.classList.remove('active'));

    if (view === '2d') {
      btn2d.classList.add('active');
      panel2d.classList.remove('viewport__panel--hidden');
      panel3d.classList.add('viewport__panel--hidden');
    } else {
      btn3d.classList.add('active');
      panel3d.classList.remove('viewport__panel--hidden');
      panel2d.classList.add('viewport__panel--hidden');
    }

    // Trigger resize for Three.js when switching to 3D
    window.dispatchEvent(new Event('resize'));
  }

  btn2d.addEventListener('click', () => setView('2d'));
  btn3d.addEventListener('click', () => setView('3d'));
}
