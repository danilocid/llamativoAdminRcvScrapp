import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, InternalServerErrorException } from '@nestjs/common';
import { RcvService } from './rcv.service';
import { SiiScraperService } from './sii-scraper.service';
import { BackendClientService } from './backend-client.service';

describe('RcvService', () => {
  let service: RcvService;
  let backendClient: jest.Mocked<BackendClientService>;

  const registro = {
    Nro: '',
    'Tipo Doc': '33',
    'Tipo Compra': 'Del Giro',
    'RUT Proveedor': '12345678-9',
    'Razon Social': 'Proveedor Test',
    Folio: '100',
    'Fecha Docto': '15/01/2025',
    'Fecha Recepcion': '15/01/2025',
    'Fecha Acuse': '',
    'Monto Exento': '0',
    'Monto Neto': '100000',
    'Monto IVA Recuperable': '19000',
    'Monto Iva No Recuperable': '0',
    'Codigo IVA No Rec.': '0',
    'Monto Total': '119000',
    'Monto Neto Activo Fijo': '0',
    'IVA Activo Fijo': '0',
    'IVA uso Comun': '0',
    'Impto. Sin Derecho a Credito': '0',
    'IVA No Retenido': '0',
    'Tabacos Puros': '0',
    'Tabacos Cigarrillos': '0',
    'Tabacos Elaborados': '0',
    'NCE o NDE sobre Fact. de Compra': '',
    'Codigo Otro Impuesto': '0',
    'Valor Otro Impuesto': '0',
    'Tasa Otro Impuesto': '0',
  };

  const mockScraper = { scrapePurchases: jest.fn() };
  const mockBackendClient = { sendPurchases: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RcvService,
        { provide: SiiScraperService, useValue: mockScraper },
        { provide: BackendClientService, useValue: mockBackendClient },
      ],
    }).compile();

    service = module.get<RcvService>(RcvService);
    backendClient = module.get(BackendClientService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sync', () => {
    it('scrapea y envía los registros al backend', async () => {
      mockScraper.scrapePurchases.mockResolvedValue([registro]);
      mockBackendClient.sendPurchases.mockResolvedValue({
        serverResponseCode: 200,
        serverResponseMessage: 'Importación procesada',
        data: { purchasesCreated: 1 },
      });

      const result = await service.sync(1, 2025);

      expect(result.serverResponseCode).toBe(200);
      expect(result.data.registrosExtraidos).toBe(1);
      expect(result.data.backend.purchasesCreated).toBe(1);
      expect(backendClient.sendPurchases).toHaveBeenCalledWith(
        1,
        2025,
        [registro],
      );
    });

    it('envía también cuando no hay registros (para notificar al backend)', async () => {
      mockScraper.scrapePurchases.mockResolvedValue([]);
      mockBackendClient.sendPurchases.mockResolvedValue({
        serverResponseCode: 200,
        data: { purchasesCreated: 0 },
      });

      const result = await service.sync(6, 2026);

      expect(result.data.registrosExtraidos).toBe(0);
      expect(backendClient.sendPurchases).toHaveBeenCalledWith(6, 2026, []);
    });

    it('lanza 500 cuando el scraping falla y no envía nada al backend', async () => {
      mockScraper.scrapePurchases.mockRejectedValue(
        new Error('Login SII fallo'),
      );

      await expect(service.sync(1, 2025)).rejects.toThrow(
        InternalServerErrorException,
      );
      expect(backendClient.sendPurchases).not.toHaveBeenCalled();
    });

    it('rechaza una segunda sincronización mientras hay una en curso', async () => {
      mockScraper.scrapePurchases.mockReturnValue(new Promise(() => {}));

      const pending = service.sync(1, 2025);

      await expect(service.sync(1, 2025)).rejects.toThrow(ConflictException);

      // limpia la promesa pendiente para no dejar el "running" activo
      pending.catch(() => undefined);
    });
  });

  describe('preview', () => {
    it('devuelve los registros sin enviarlos al backend', async () => {
      mockScraper.scrapePurchases.mockResolvedValue([registro]);

      const result = await service.preview(3, 2025);

      expect(result.serverResponseCode).toBe(200);
      expect(result.data.registros).toEqual([registro]);
      expect(backendClient.sendPurchases).not.toHaveBeenCalled();
    });

    it('lanza 500 cuando el scraping falla', async () => {
      mockScraper.scrapePurchases.mockRejectedValue(new Error('boom'));

      await expect(service.preview(3, 2025)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});
