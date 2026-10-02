import { SiiScraperService } from './sii-scraper.service';

type Scenario =
  | 'rows'
  | 'empty-message'
  | 'empty-silent'
  | 'sii-error'
  | 'broken';

const DIAGS: Record<
  Exclude<Scenario, 'rows'>,
  {
    url: string;
    texto: string;
    tieneSelectMes: boolean;
    error: string | null;
    vacio: string | null;
  }
> = {
  'empty-message': {
    url: 'https://www4.sii.cl/consdcvinternetui/index.jsp',
    texto: 'no se encontraron registros para el periodo consultado',
    tieneSelectMes: true,
    error: null,
    vacio: 'no se encontraron',
  },
  'empty-silent': {
    url: 'https://www4.sii.cl/consdcvinternetui/index.jsp',
    texto: 'consulta de compras',
    tieneSelectMes: true,
    error: null,
    vacio: null,
  },
  'sii-error': {
    url: 'https://www4.sii.cl/consdcvinternetui/index.jsp',
    texto: 'no fue posible completar la solicitud',
    tieneSelectMes: true,
    error: 'no fue posible',
    vacio: null,
  },
  broken: {
    url: 'about:blank',
    texto: '',
    tieneSelectMes: false,
    error: null,
    vacio: null,
  },
};

function makePage(scenario: Scenario) {
  const rowCount = scenario === 'rows' ? 3 : 0;

  return {
    waitForFunction: jest.fn(async () => {
      if (scenario === 'rows') return undefined;
      throw new Error('Timeout esperando filas del resumen');
    }),
    locator: jest.fn(() => ({ count: async () => rowCount })),
    waitForTimeout: jest.fn(async () => undefined),
    evaluate: jest.fn(async (fn: (...args: any[]) => unknown, arg?: unknown) => {
      if (arg) {
        return scenario === 'rows'
          ? undefined
          : DIAGS[scenario as Exclude<Scenario, 'rows'>];
      }
      if (String(fn).includes('document.body')) {
        return 'texto de la pagina';
      }
      return [];
    }),
    content: jest.fn(async () => '<html></html>'),
  };
}

describe('SiiScraperService - waitForResumenData', () => {
  let service: SiiScraperService;

  beforeEach(() => {
    service = new SiiScraperService();
  });

  const waitFor = (scenario: Scenario) =>
    (service as any).waitForResumenData(makePage(scenario));

  it('resuelve cuando el resumen tiene filas', async () => {
    await expect(waitFor('rows')).resolves.toBeUndefined();
  });

  it('resuelve cuando el SII muestra un mensaje de sin datos', async () => {
    await expect(waitFor('empty-message')).resolves.toBeUndefined();
  });

  it('resuelve cuando el periodo esta vacio sin mensaje (formulario operativo)', async () => {
    await expect(waitFor('empty-silent')).resolves.toBeUndefined();
  });

  it('lanza error cuando el SII devuelve un mensaje de error', async () => {
    await expect(waitFor('sii-error')).rejects.toThrow(
      'El SII respondio con un error',
    );
  });

  it('lanza error cuando la pagina no cargo', async () => {
    await expect(waitFor('broken')).rejects.toThrow(
      'Timeout esperando datos del resumen',
    );
  });
});
