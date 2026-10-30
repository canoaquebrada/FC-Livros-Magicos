# FC Artes Digitais — versión México (es-MX)

Esta carpeta **mx/** contiene una copia independiente del sistema FC Livros Mágicos, adaptada al español de México para el **cuestionario de fotos** y el panel de administración de fotos.

## Incluye
- Interfaz de fotos, categorías, estilos y poses en español.
- Validaciones, avisos de límites y mensajes de WhatsApp en español.
- Pantallas principales del panel de fotos traducidas.
- Archivos, recursos de catálogo y funcionalidad original conservados.

## Sin cambios
- Versión de Brasil: permanece intacta en la raíz del repositorio.
- Prompts de generación de imágenes e identidad, marca de agua, lógica de negocio, almacenamiento, límites y flujo de pago.
- Módulo de libros infantiles (permanece en portugués).
- Moneda y precio: la promoción existente sigue diciendo **R$ 9,90**. No se convirtió a MXN, ni se configuró SPEI.

## Despliegue independiente en Vercel
Crea un **nuevo proyecto de Vercel** conectado a este repositorio y selecciona **mx** en **Root Directory**. Deja el proyecto brasileño con su configuración actual. Configura en el nuevo proyecto las variables de entorno necesarias para la generación de imágenes, almacenamiento y administración.

Desde la carpeta mx:

```sh
npm install
npm run build
npm run validate
npm run smoke
```

Requiere Node.js 20+.

**WhatsApp en México:** solicita y captura los números con su prefijo internacional **+52**. La lógica actual asume +55 cuando alguien ingresa 10 dígitos sin prefijo; por eso, hasta adaptar esta regla comercial aparte, el número mexicano debe incluir +52.

**Nota:** se tradujo el flujo de fotos; los libros infantiles y sus textos permanecen en portugués, tal como se había solicitado.
