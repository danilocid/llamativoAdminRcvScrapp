import { Injectable, Logger } from '@nestjs/common';
import { chromium, Browser, Page } from 'playwright';
import { PurchaseApiData } from './dto/purchases-api.interface';

@Injectable()
export class SiiScraperService {
  private readonly logger = new Logger(SiiScraperService.name);

  private readonly SII_LOGIN_URL =
    'https://zeusr.sii.cl//AUT2000/InicioAutenticacion/IngresoRutClave.html?https://misiir.sii.cl/cgi_misii/siihome.cgi';

  private readonly RCV_APP_URL = 'https://www4.sii.cl/consdcvinternetui';

  /** Mensajes típicos del SII cuando el período consultado no tiene datos. */
  private readonly EMPTY_PATTERNS = [
    'no se encontraron',
    'no existen',
    'no hay información',
    'no hay informacion',
    'sin registros',
    'sin documentos',
    'sin resultados',
    'no hay datos',
    'ningún registro',
    'ningun registro',
    '0 resultados',
  ];

  /** Mensajes de error del SII: ahí sí fallamos (no es un período vacío). */
  private readonly ERROR_PATTERNS = [
    'no fue posible',
    'intente nuevamente',
    'intente más tarde',
    'intente mas tarde',
    'vuelva a intentar',
    'error al',
    'problemas técnicos',
    'problemas tecnicos',
  ];

  /**
   * Extrae los registros de compras del RCV del SII para un mes/año dados.
   *
   * Las fallas reales (login, página rota, error del SII) se lanzan como
   * excepción. Un período sin compras en el SII devuelve `[]` (la tabla del
   * resumen no se renderiza), no es un error.
   */
  async scrapePurchases(mes: number, anio: number): Promise<PurchaseApiData[]> {
    this.logger.log(`Iniciando scraping RCV SII para ${mes}/${anio}`);

    const rut = process.env.SII_RUT;
    const clave = process.env.SII_PASSWORD;

    if (!rut || !clave) {
      throw new Error(
        'Variables de entorno SII_RUT y SII_PASSWORD no configuradas',
      );
    }

    let browser: Browser | null = null;

    try {
      const launchOptions: any = {
        headless: true,
        timeout: 120000,
        args: [
          '--no-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-extensions',
        ],
      };

      if (process.env.CHROME_BIN) {
        launchOptions.executablePath = process.env.CHROME_BIN;
      }

      browser = await chromium.launch(launchOptions);

      const page = await browser.newPage();
      page.setDefaultTimeout(20000);

      await this.login(page, rut, clave);
      this.logger.log(`URL post-login: ${page.url()}`);
      this.logger.log(`Titulo post-login: ${await page.title()}`);

      await page.goto(this.RCV_APP_URL, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(5000);
      this.logger.log(`URL post-RCV: ${page.url()}`);
      this.logger.log(`Titulo post-RCV: ${await page.title()}`);

      await this.selectPeriod(page, mes, anio);
      this.logger.log(`URL post-periodo: ${page.url()}`);

      await this.waitForResumenData(page);

      const data = await this.extractFromResumenAndDetail(page);

      this.logger.log(`Scraping completado, ${data.length} registros extraidos`);
      return data;
    } catch (error) {
      this.logger.error(`Error en scraping SII: ${(error as Error).message}`);
      this.logger.error(`Stack: ${(error as Error).stack}`);
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  private async screenshot(page: Page, name: string): Promise<void> {
    try {
      const buffer = await page.screenshot({ fullPage: true });
      const base64 = buffer.toString('base64');
      this.logger.log(
        `SCREENSHOT_${name}=${base64.substring(0, 200)}...`,
      );
    } catch (e) {
      this.logger.warn(
        `No se pudo tomar screenshot ${name}: ${(e as Error).message}`,
      );
    }
  }

  private async logPageContent(page: Page, label: string): Promise<void> {
    try {
      const html = await page.content();
      const bodyText = await page.evaluate(
        () => document.body?.innerText?.substring(0, 1000) || '',
      );
      this.logger.log(`PAGE_CONTENT_${label}: ${bodyText}`);
      this.logger.debug(`HTML ${label}: ${html.substring(0, 500)}`);
    } catch (e) {
      this.logger.warn(
        `No se pudo obtener contenido ${label}: ${(e as Error).message}`,
      );
    }
  }

  private async login(
    page: Page,
    rut: string,
    clave: string,
  ): Promise<void> {
    this.logger.log('Navegando a pagina de login SII');
    await page.goto(this.SII_LOGIN_URL, { waitUntil: 'domcontentloaded' });
    this.logger.log(`URL login page: ${page.url()}`);

    const rutInput = page.locator('#rutcntr');
    const rutVisible = await rutInput.isVisible().catch(() => false);
    if (!rutVisible) {
      this.logger.error('Input #rutcntr no encontrado en pagina de login');
      await this.logPageContent(page, 'LOGIN_PAGE');
      throw new Error('Login SII: input RUT no encontrado');
    }

    await rutInput.fill(rut);
    await page.locator('#clave').fill(clave);
    await page.locator('#bt_ingresar').click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);
    this.logger.log(`URL post-click-login: ${page.url()}`);

    const errorEl = page.locator('#textoError');
    const hasError = await errorEl.isVisible().catch(() => false);
    if (hasError) {
      const errorText = await errorEl.innerText();
      this.logger.error(`Error de login SII: ${errorText}`);
      throw new Error(`Login SII fallo: ${errorText}`);
    }
    this.logger.log('Login completado');
  }

  private async dismissModal(page: Page): Promise<void> {
    await page
      .evaluate(() => {
        const modal = document.getElementById('esperaDialog');
        if (modal) {
          modal.style.display = 'none';
          modal.classList.remove('in');
        }
        document
          .querySelectorAll('.modal-backdrop')
          .forEach((el) => el.remove());
        document.body.classList.remove('modal-open');
      })
      .catch(() => {});
  }

  private async selectPeriod(
    page: Page,
    mes: number,
    anio: number,
  ): Promise<void> {
    this.logger.log(`Seleccionando periodo ${mes}/${anio}`);

    const monthSelect = page.locator('#periodoMes');
    const monthVisible = await monthSelect.isVisible().catch(() => false);
    if (!monthVisible) {
      this.logger.error('Select #periodoMes no encontrado. HTML de la pagina:');
      await this.logPageContent(page, 'NO_MONTH_SELECT');
      throw new Error('Select #periodoMes no visible');
    }

    const monthOptions = await monthSelect
      .locator('option')
      .allTextContents();
    this.logger.log(`Opciones de mes: ${monthOptions.join(', ')}`);
    await monthSelect.selectOption(mes.toString().padStart(2, '0'));
    this.logger.log(`Mes seleccionado: ${mes}`);

    const yearSelect = page.locator('select[ng-model="periodoAnho"]');
    const yearVisible = await yearSelect.isVisible().catch(() => false);
    if (!yearVisible) {
      this.logger.error('Select anio no encontrado');
      await this.logPageContent(page, 'NO_YEAR_SELECT');
      throw new Error('Select anio no visible');
    }

    const yearOptions = await yearSelect.locator('option').allTextContents();
    this.logger.log(`Opciones de anio: ${yearOptions.join(', ')}`);
    await yearSelect.selectOption(String(anio));
    this.logger.log(`Anio seleccionado: ${anio}`);

    const submitBtn = page.locator(
      'button[type="submit"]:has-text("Consultar")',
    );
    const btnVisible = await submitBtn.isVisible().catch(() => false);
    if (!btnVisible) {
      this.logger.error('Boton Consultar no encontrado');
      throw new Error('Boton Consultar no visible');
    }
    await submitBtn.click();
    this.logger.log('Boton Consultar clickeado');
  }

  private async waitForResumenData(page: Page): Promise<void> {
    this.logger.log('Esperando datos del resumen...');

    // Espera filas del resumen o un mensaje de "sin datos" del SII.
    // El timeout es largo porque la Raspberry Pi es lenta.
    try {
      await page.waitForFunction(
        (patterns: string[]) => {
          const rows = document.querySelectorAll(
            'table[ng-if*="resumenRegistro"] tbody tr',
          );
          if (rows.length > 0) return true;
          const text = (document.body?.innerText || '').toLowerCase();
          return patterns.some((p) => text.includes(p));
        },
        this.EMPTY_PATTERNS,
        { timeout: 45000 },
      );
    } catch {
      this.logger.warn(
        'Sin filas del resumen tras 45s, diagnosticando la pagina...',
      );
    }

    let rowCount = await page
      .locator('table[ng-if*="resumenRegistro"] tbody tr')
      .count();

    if (rowCount === 0) {
      // Confirmación: un texto de ayuda del SII podría parecer "sin datos".
      await page.waitForTimeout(3000);
      rowCount = await page
        .locator('table[ng-if*="resumenRegistro"] tbody tr')
        .count();
    }

    if (rowCount > 0) {
      this.logger.log(`Datos del resumen cargados: ${rowCount} filas`);
      await this.dismissModal(page);
      await page.waitForTimeout(1000);
      return;
    }

    // Sin filas: puede ser un período vacío o un fallo de la página.
    const diag = await this.diagnoseEmptyPage(page);

    if (diag.error) {
      await this.logPageContent(page, 'SII_ERROR');
      throw new Error(`El SII respondio con un error: "${diag.error}"`);
    }

    if (diag.vacio) {
      this.logger.log(
        `El SII no tiene datos para el periodo (mensaje: "${diag.vacio}")`,
      );
      await this.dismissModal(page);
      return;
    }

    if (diag.tieneSelectMes && diag.url.includes('consdcvinternetui')) {
      this.logger.warn(
        `El resumen quedo sin filas tras consultar; se asume periodo vacio. Texto: ${diag.texto.replace(/\s+/g, ' ')}`,
      );
      await this.dismissModal(page);
      return;
    }

    this.logger.error(
      'Timeout esperando datos del resumen. Guardando contenido de pagina...',
    );
    await this.logPageContent(page, 'RESUMEN_TIMEOUT');

    const allTables = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('table')).map((t) => ({
        id: t.id,
        class: t.className,
        rows: t.rows.length,
      }));
    });
    this.logger.log(`Tablas en pagina: ${JSON.stringify(allTables)}`);

    throw new Error('Timeout esperando datos del resumen');
  }

  /**
   * Revisa el estado actual de la página para distinguir "período vacío"
   * de "la página no cargó".
   */
  private async diagnoseEmptyPage(
    page: Page,
  ): Promise<{
    url: string;
    texto: string;
    tieneSelectMes: boolean;
    error: string | null;
    vacio: string | null;
  }> {
    return await page.evaluate(
      ({ errors, empties }) => {
        const text = (document.body?.innerText || '').toLowerCase();
        const find = (list: string[]) =>
          list.find((p) => text.includes(p)) || null;
        return {
          url: location.href,
          texto: text.substring(0, 1500),
          tieneSelectMes: !!document.getElementById('periodoMes'),
          error: find(errors),
          vacio: find(empties),
        };
      },
      { errors: this.ERROR_PATTERNS, empties: this.EMPTY_PATTERNS },
    );
  }

  private async extractFromResumenAndDetail(
    page: Page,
  ): Promise<PurchaseApiData[]> {
    const allData: PurchaseApiData[] = [];

    const resumenRows = await page
      .locator('table[ng-if*="resumenRegistro"] tbody tr')
      .all();
    this.logger.log(`Filas en resumen: ${resumenRows.length}`);

    for (const row of resumenRows) {
      const link = row.locator('a[href*="detalle"]').first();
      const tipoDocText = await link.innerText().catch(() => '');
      const match = tipoDocText.match(/\((\d+)\)/);
      const tipoDocCode = match ? match[1] : '';
      const tipoDocName = tipoDocText.replace(/\s*\(\d+\)/, '').trim();

      this.logger.log(
        `Tipo documento: ${tipoDocName} (codigo: ${tipoDocCode})`,
      );

      if (link) {
        await this.dismissModal(page);

        await link.click({ force: true });
        await page.waitForTimeout(3000);
        await this.dismissModal(page);

        await page.waitForTimeout(3000);

        const detailData = await this.extractDetailTable(
          page,
          tipoDocCode,
          tipoDocName,
        );
        allData.push(...detailData);

        await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {});
        await page.waitForTimeout(2000);
        await this.dismissModal(page);
      }
    }

    return allData;
  }

  private async extractDetailTable(
    page: Page,
    tipoDocCode: string,
    tipoDocName: string,
  ): Promise<PurchaseApiData[]> {
    this.logger.log('Extrayendo tabla de detalle...');

    const table = page.locator('#tableCompra');
    const isVisible = await table.isVisible().catch(() => false);

    if (!isVisible) {
      this.logger.warn('#tableCompra no visible en esta pagina');
      return [];
    }

    const headers = await page
      .locator('#tableCompra thead th div.dataTables_sizing')
      .allTextContents();
    this.logger.log(`Headers reales: ${headers.join(' | ')}`);

    const rows = await page.locator('#tableCompra tbody tr').all();
    this.logger.log(`Filas de detalle: ${rows.length}`);

    const data: PurchaseApiData[] = [];

    for (const row of rows) {
      const cells = await row.locator('td').allTextContents();
      const cleanCells = cells.map((c) => c.trim());
      this.logger.log(
        `Fila (${cleanCells.length} celdas): ${cleanCells.join(' | ')}`,
      );

      if (cleanCells.length < 13) continue;

      const rowMap: Record<string, string> = {};
      for (let i = 0; i < headers.length && i < cleanCells.length; i++) {
        const key = headers[i].replace(/\s+/g, ' ').trim();
        rowMap[key] = cleanCells[i];
      }

      const rutLink = row.locator('td a[data-original-title]').first();
      const razonSocial =
        (await rutLink
          .getAttribute('data-original-title')
          .catch(() => '')) || '';

      data.push({
        Nro: '',
        'Tipo Doc': tipoDocCode,
        'Tipo Compra': rowMap['Tipo Compra'] || '',
        'RUT Proveedor': rowMap['RUT Proveedor'] || '',
        'Razon Social': razonSocial,
        Folio: rowMap['Folio'] || '',
        'Fecha Docto': rowMap['Fecha Docto.'] || rowMap['Fecha Docto'] || '',
        'Fecha Recepcion':
          rowMap['Fecha Recepci\u00f3n'] || rowMap['Fecha Recepcion'] || '',
        'Fecha Acuse': rowMap['Fecha Acuse Recibo'] || '',
        'Monto Exento': rowMap['Monto Exento'] || '0',
        'Monto Neto': rowMap['Monto Neto'] || '0',
        'Monto IVA Recuperable': rowMap['Monto IVA Recuperable'] || '0',
        'Monto Iva No Recuperable': rowMap['Monto Iva No Recuperable'] || '0',
        'Codigo IVA No Rec.':
          rowMap['C\u00f3digo Iva No Recuperable'] ||
          rowMap['Codigo Iva No Recuperable'] ||
          '0',
        'Monto Total': rowMap['Monto Total'] || '0',
        'Monto Neto Activo Fijo': rowMap['Monto Neto Activo Fijo'] || '0',
        'IVA Activo Fijo': rowMap['IVA Activo Fijo'] || '0',
        'IVA uso Comun':
          rowMap['IVA uso Com\u00f3n'] || rowMap['IVA uso Comun'] || '0',
        'Impto. Sin Derecho a Credito':
          rowMap['Impto. Sin Derecho a Cr\u00e9dito'] ||
          rowMap['Impto. Sin Derecho a Credito'] ||
          '0',
        'IVA No Retenido': rowMap['IVA No Retenido'] || '0',
        'Tabacos Puros': rowMap['Tabacos Puros'] || '0',
        'Tabacos Cigarrillos': rowMap['Tabacos Cigarrillos'] || '0',
        'Tabacos Elaborados': rowMap['Tabacos Elaborados'] || '0',
        'NCE o NDE sobre Fact. de Compra':
          rowMap['NCE o NDE sobre Fact. de Compra'] || '',
        'Codigo Otro Impuesto': rowMap['Total Otros Impuestos'] || '0',
        'Valor Otro Impuesto': '0',
        'Tasa Otro Impuesto': '0',
      });
    }

    this.logger.log(
      `Detalle de ${tipoDocName} (${tipoDocCode}): ${data.length} filas`,
    );

    return data;
  }
}
