# Sincronizador "Ventas NC GROUP"

Programa chico que corre en la PC de la oficina. Vigila la carpeta **Ventas NC GROUP** y cada factura o
nota de crédito (PDF o XML) que bajes del sistema de facturación se sube sola a la app, en
**Documentos → Facturación**.

- Revisa la carpeta (y sus subcarpetas) cada 30 segundos.
- Espera a que el archivo termine de bajarse antes de subirlo.
- La primera vez sube todo lo que ya había en la carpeta.
- No sube dos veces el mismo archivo; si el PDF y el XML son del mismo documento, queda uno solo.
- Si no hay internet, lo reintenta en la vuelta siguiente.
- Deja un registro en `sincronizar-ventas.log`.

## Instalación (una sola vez)

1. **Servidor**: en las variables de entorno del backend agregar
   - `BILLING_SYNC_TOKEN`: una clave larga cualquiera (por ejemplo, generada con un gestor de contraseñas).
   - `BILLING_COMPANY_RUT` (opcional): el RUT de NC GROUP, para no confundirlo con el RUT del cliente al leer los PDF.
2. **PC**: instalar [Node.js](https://nodejs.org) (versión LTS).
3. Copiar esta carpeta `sincronizar-ventas` a la PC (por ejemplo a `C:\NC GROUP\sincronizar-ventas`).
4. Copiar `config.example.json` como `config.json` y completar:
   - `apiUrl`: la URL del backend.
   - `token`: el mismo valor de `BILLING_SYNC_TOKEN`.
   - `folder`: la ruta de la carpeta, con barras dobles: `C:\\Users\\USUARIO\\Documents\\Ventas NC GROUP`.
5. Doble clic en `sincronizar-ventas.bat` para probar: tiene que decir `Vigilando ...` y los archivos subidos.
6. Doble clic en `instalar-inicio.bat` para que arranque solo cada vez que se prende la PC (corre sin ventana).

Para dejar de usarlo: borrar `Sincronizar Ventas NC GROUP.vbs` de la carpeta de Inicio
(`Win + R` → `shell:startup`).
