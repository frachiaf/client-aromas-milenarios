# Changelog

Todos los cambios relevantes del theme se documentan en este archivo. Cada agente debe leerlo antes de trabajar y actualizarlo al finalizar una modificación.

El formato se inspira en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y las fechas usan `AAAA-MM-DD`.

## Unreleased

### Modificado

- Objetivo: `AM Video + Carrusel` permite elegir una relación de aspecto común para el medio principal y todas las diapositivas.
- Archivos: `sections/am--video-with-carousel.liquid`, `assets/am--video-with-carousel.css`, `CHANGELOG.md`.
- Impacto: el selector existente `section_height` conserva su ID y pasa a llamarse “Relación de aspecto”; ofrece Automática, 21:9, 16:9, 4:3, 1:1 y 3:4, con 16:9 como default para nuevas secciones. Cuando se selecciona una proporción, se aplica en escritorio, tablet y móvil y los medios se recortan con `object-fit: cover`; Automática preserva las dimensiones intrínsecas, incluidos los videos de diapositivas.
- Objetivo: el CTA general del carrusel incorpora un rango para ajustar únicamente su margen superior entre 0 y 120 px.
- Impacto: `carousel_button_margin_top` conserva los 24 px actuales por defecto; el wrapper mantiene su ancho del 90%, centrado horizontal y alineación interna controlada por “Posición del botón”.
- Objetivo: `AM Video + Carrusel` permite limitar la imagen de fondo al área de contenido, dejando el encabezado fuera de su cobertura.
- Impacto: el nuevo checkbox `background_image_on_content` está desactivado por defecto; al activarlo traslada visualmente la imagen a `.am--video-with-carousel__content`, mantiene el color sobre toda la sección y conserva las capas animadas de nieve en la raíz.
- Objetivo: los bloques `Grupo` y la sección `AM Video + Carrusel` permiten configurar una imagen de fondo específica para móvil.
- Archivos: `blocks/group.liquid`, `snippets/group.liquid`, `snippets/background-media.liquid`, `sections/am--video-with-carousel.liquid`, `assets/am--video-with-carousel.css` y `CHANGELOG.md`.
- Impacto: hasta 749 px, `Grupo` usa una fuente móvil mediante `<picture>` sin descargar simultáneamente la imagen de escritorio; hasta 767 px, `AM Video + Carrusel` cambia su fondo CSS preservando las capas de nieve y la opción de limitarlo al contenido. En ambos componentes la imagen principal funciona como fallback y una imagen móvil configurada por sí sola también evita mostrar un fondo vacío.

### Validación

- El schema JSON y el contrato Liquid validaron el ID preservado, el nuevo default y las seis opciones de `section_height`; el contrato CSS confirma que el marco proporcional y el ajuste `cover` no están limitados a escritorio.
- El schema JSON y el contrato Liquid/CSS de `carousel_button_margin_top` validaron sus valores mínimo, predeterminado y máximo (0, 24 y 120 px); el wrapper conserva `margin-inline: auto` y el botón mantiene `justify-content: var(--am-button-align)`.
- El schema y el contrato Liquid/CSS de `background_image_on_content` validaron los estados desactivado, activo, sin imagen y combinado con nieve; el contenido usa `cover` centrado y sin repetición, mientras la raíz conserva tres capas animadas y excluye la imagen base.
- Los schemas JSON y el contrato Liquid/CSS de `background_image_mobile` validaron correctamente; el bloque pasa el setting explícitamente al snippet compartido, el `<source>` móvil declara `srcset`, `sizes`, ancho y alto, y la sección conserva los fallbacks en sus variantes normal, con nieve y con fondo sobre el contenido.
- `git diff --check` fue aprobado.
- `shopify.cmd theme check --path .` inspeccionó 313 archivos sin errores y reportó 29 advertencias existentes; mantiene `ExcessiveSettingsCount` en esta sección, ahora con 50 settings funcionales. La CLI volvió a mostrar una aserción interna de Node al cerrar tras emitir el resumen.
- El validador de la skill Shopify Liquid no pudo iniciar porque falta la dependencia local `@shopify/theme-check-common`.
- La comprobación visual en navegador no se ejecutó: el entorno bloqueó `shopify theme dev` porque el comando podía subir el theme a una tienda o cuenta no identificada. El `<picture>` y la cascada de la variable móvil se verificaron estáticamente para sus breakpoints y combinaciones con fallback, nieve y fondo limitado al contenido.

### Reversión

- Restaurar el label, opciones y default de `section_height`, junto con las reglas de proporción limitadas a escritorio, devuelve el comportamiento anterior sin migrar configuraciones guardadas.
- Retirar `carousel_button_margin_top`, su variable CSS y restaurar `margin: 1.5rem auto 0` devuelve el espaciado fijo anterior.
- Retirar `background_image_on_content`, su clase modificadora y las reglas CSS asociadas restaura el fondo exclusivo del contenedor raíz.
- Retirar `background_image_mobile`, su parámetro en los snippets y las reglas responsive asociadas restaura el uso de una única imagen de fondo sin requerir migraciones de datos.

### Añadido

- `AM Video + Carrusel` incorpora un botón general configurable para todo el carrusel, renderizado debajo de las cards y sus controles cuando la etiqueta y el enlace están completos.
- Archivos: `sections/am--video-with-carousel.liquid`, `assets/am--video-with-carousel.css`, `CHANGELOG.md`.
- Impacto: el Theme Editor expone `Etiqueta del botón general` y `Enlace del botón general` bajo “Contenido del carrusel”; las instancias existentes no muestran el nuevo CTA porque ambos settings quedan vacíos por defecto. El storefront conserva los CTA individuales de cada card, usa el botón primario nativo de Pitch para el CTA general y hereda la alineación del setting existente “Posición del botón”.

### Validación

- El schema JSON de `sections/am--video-with-carousel.liquid` validó correctamente y el contrato Liquid/schema confirma `carousel_button_label` y `carousel_button_link` con render condicionado por ambos valores.
- `git diff --check` fue aprobado.
- `shopify.cmd theme check --path .` inspeccionó 313 archivos sin errores y reportó 29 advertencias; se mantiene la advertencia nueva `ExcessiveSettingsCount` porque la sección declara 47 settings tras sumar el CTA general y se preservaron settings históricos por compatibilidad editorial. La CLI cerró con una aserción interna de Node al finalizar el resumen.
- El validador de la skill Shopify Liquid no pudo iniciar porque falta la dependencia local `@shopify/theme-check-common`.
- La comprobación responsive en navegador no se ejecutó desde este entorno; el CSS del wrapper fue verificado estáticamente para alinear el botón debajo del viewport del carrusel con `--am-button-align`, sin tocar autoplay, flechas ni CTA individuales.

### Reversión

- Retirar `carousel_button_label`, `carousel_button_link`, el render del CTA global y su wrapper CSS restaura el carrusel anterior sin migrar datos editoriales.

### Corregido

- `AM Video + Carrusel` reserva desde el render inicial la proporción intrínseca de cada diapositiva configurada con video Shopify y precarga sus metadatos, evitando cambios de altura al descubrir el medio.
- Archivos: `sections/am--video-with-carousel.liquid`, `assets/am--video-with-carousel.css`.
- Impacto: los videos de diapositivas mantienen la reproducción exclusiva del item activo; solo se solicitan metadatos, no los archivos completos, y no se modifican schema ni templates JSON administrados por Shopify.

### Validación

- `shopify.cmd theme check --path .` finalizó correctamente y `git diff --check` fue aprobado.
- La comprobación visual responsive no pudo completarse: el preview local no logra subir el theme por referencias preexistentes a videos Shopify no aplicables en `templates/index.json` y `templates/product.velas.json`; la automatización de navegador además cerró su canal CDP al iniciarse.

### Reversión

- Restaurar `preload: 'none'` y retirar la variable de proporción y sus reglas CSS devuelve la carga y el dimensionamiento anteriores sin migrar datos editoriales.

### Pendiente

### Añadido

- `AM Explorador interactivo`, `AM Video + Carrusel` y `AM Presentación numerada` permiten elegir en escritorio una altura automática, pequeña (21:9), mediana (16:9) o grande (4:3) para sus marcos visuales.
- `AM Presentación numerada` permite ajustar entre 50% y 100% el ancho centrado de las diapositivas y su panel informativo en escritorio; móvil y tablet conservan el ancho completo.
- `AM Video + Carrusel` permite ajustar en escritorio los anchos del medio y de la columna completa del carrusel entre 20% y 80%, además de distribuir ambas columnas al inicio, centro, final o con tres variantes de espaciado.
- `AM Video + Carrusel` permite ocultar en conjunto las flechas, el control de pausa/reproducción y las barras de progreso sin desactivar el autoplay.
- Los CTA textuales de `AM Explorador interactivo`, `AM Presentación numerada` y `AM Video + Carrusel` usan directamente el botón primario nativo de Pitch, sin un selector editorial de estilo.

### Modificado

- Archivos: `sections/am--hover-explorer.liquid`, `sections/am--video-with-carousel.liquid`, `sections/am--numbered-slideshow.liquid`, `assets/am--hover-explorer.css`, `assets/am--video-with-carousel.css` y `assets/am--numbered-slideshow.css`.
- Impacto: las instancias existentes mantienen su presentación mediante los defaults `auto` y `100%`; las proporciones y el recorte con `object-fit: cover` solo se activan desde 1024 px, sin modificar templates JSON, JavaScript ni datos editoriales.
- Impacto: `AM Video + Carrusel` conserva por defecto los anchos 40%/38% y `space-around`; desde 1024 px permite ampliarlos sin el límite anterior de 680 px y los reduce proporcionalmente si no caben en una fila. Sus imágenes comunican al navegador el ancho editorial configurado y el layout apilado de tablet/móvil no cambia.
- La interfaz completa de los schemas de `AM Divisor de color`, `AM Explorador interactivo`, `AM Presentación numerada` y `AM Video + Carrusel` se tradujo al español sin cambiar IDs, values ni contenido editorial predeterminado.
- Archivos: `sections/am--color-divider.liquid`, `sections/am--hover-explorer.liquid`, `sections/am--numbered-slideshow.liquid`, `sections/am--video-with-carousel.liquid`, `assets/am--hover-explorer.css`, `assets/am--numbered-slideshow.css` y `assets/am--video-with-carousel.css`.
- Impacto: las instancias existentes conservan controles visibles y adoptan colores, tipografía, bordes, espaciado y hover del botón primario del esquema activo. Los settings históricos de apariencia del CTA de video se preservan por compatibilidad, aunque ya no modifican el storefront.

### Validación

- Los tres schemas JSON y el contrato de `section_height` y `slide_width_desktop` fueron validados; `shopify theme check --path .` inspeccionó 313 archivos sin errores y mantuvo 24 advertencias preexistentes de `ValidScopedCSSClass`; `git diff --check` fue aprobado.
- El schema de `AM Video + Carrusel` validó `media_width_desktop`, `slide_width_desktop` y `content_justify_desktop`, incluidos sus defaults, rangos y seis valores permitidos; Theme Check volvió a finalizar sin errores, con las mismas 24 advertencias preexistentes.
- El validador de la skill no pudo iniciar porque el entorno no dispone de `@shopify/theme-check-common`; Theme Check cubrió la validación Liquid y de schemas del theme.
- El preview local respondió HTTP 200. En 1440 px, el ancho simulado de 50% quedó centrado en 690 px, el marco 21:9 midió 690 × 296 px y los dos marcos de `AM Video + Carrusel` respetaron 4:3 con `object-fit: cover`; en 768 px y 390 px las diapositivas recuperaron el ancho completo y los medios su proporción natural.
- El preview activo respondió HTTP 200 y renderizó los defaults 40%/38%/`space-around`, una presentación numerada configurada al 85% y los dos CSS actualizados. Las aserciones de flexión confirmaron que 80% + 80% permanece en una fila y se reduce a 658 px por columna en 1440 px y 450 px en 1024 px; la automatización visual no pudo iniciarse porque el entorno cerró el canal CDP.
- Los cuatro schemas JSON, el setting nuevo de controles y el contrato Liquid/schema fueron validados correctamente; todos los CTA textuales usan la clase `button` sin overrides visuales locales.
- `shopify theme check --path .` inspeccionó 313 archivos sin errores y mantuvo 24 advertencias preexistentes de `ValidScopedCSSClass`; `git diff --check` fue aprobado.

### Reversión

- Retirar `section_height`, `slide_width_desktop`, las variables y las reglas CSS asociadas restaura las alturas naturales y el ancho completo sin migrar templates ni valores existentes.
- Retirar `media_width_desktop`, `content_justify_desktop` y el `slide_width_desktop` de `AM Video + Carrusel`, junto con sus variables y reglas desktop, restaura los anchos fijos 40%/38%, el límite de 680 px y `space-around`; retirar `__info` del selector compartido devuelve su ancho completo.
- Retirar `show_slider_controls` y sus condiciones Liquid restaura los controles anteriores; restaurar las clases y reglas locales de los CTA devuelve su presentación previa. Revertir las cadenas de schema devuelve la interfaz del editor al inglés sin afectar los valores guardados.

### Modificado

- Los bloques Product Hotspots obtienen el producto exclusivamente desde `block.settings.product`. Esto permite que los hotspots configurados rendericen su producto, disponibilidad y `quick-add-component` fuera de un contexto de producto.
- La etiqueta "VER MÁS" se mide a ancho intrínseco fuera del flujo del botón. En hover o foco de escritorio reemplaza el punto por una píldora centrada con el texto completo; al salir restaura el hotspot circular y en dispositivos táctiles permanece compacto.
- La medición anterior quedaba condicionada por el ancho cero y la escala del estado oculto, y el layout flex volvía a comprimir el botón al diámetro del círculo. Ahora usa el `scrollWidth` intrínseco del label, vuelve a medir al cargar fuentes o cambiar el texto y evita `flex-shrink`, por lo que no recorta etiquetas personalizadas.
- En el modo "Compra rápida al hacer clic", un hotspot con producto disponible entrega su URL explícitamente al modal global Quick Add; la card local queda reservada para productos reales agotados, un modal ausente o una carga fallida.
- Los product settings que Shopify resuelve vacíos por estar sin publicar o fuera del mercado ya no generan hotspots ni cards placeholder en storefront. En Theme Editor conservan un marcador no interactivo y seleccionable con estado "No disponible".
- Se añadió la etiqueta traducible del texto hover de Quick Buy a los schemas regionales, evitando referencias de traducción incompletas en Theme Check.
- `product-hotspot.js` declara los tipos JSDoc de sus campos privados y eventos, cancela animaciones y observers al desmontarse, y limita hover/imagen alternativa a desktop con puntero fino y sin entrada táctil.
- El posicionamiento de la card se calcula de forma sincrónica: se eliminó la espera artificial restante de 100 ms y `showDialog()` evita aperturas duplicadas.
- El contenido editorial de Product Hotspots permite elegir alineación automática, inicio, centro o final. La opción automática conserva la alineación derivada de sus nueve posiciones y las opciones lógicas inicio/final son compatibles con RTL.
- La imagen alternativa de Product Hotspots se oculta al cambiar de hotspot y solo reaparece después de que la nueva URL cargue y se decodifique. Las solicitudes se identifican y cachean por URL, por lo que una respuesta tardía o fallida no puede mostrar momentáneamente la imagen del hotspot anterior.
- Los tres modos de interacción desktop tienen flujos excluyentes: hover/foco con Quick Add al click, preview alternable al click o Quick Add directo con fallback. Solo puede permanecer una card abierta y su trigger sincroniza `aria-expanded`, cierre por Escape, click exterior y salida del foco.

- El modal global de Quick Add ahora se renderiza siempre una vez desde `layout/theme.liquid`, aunque la preferencia global oculte los botones en tarjetas de producto.
- `QuickAddComponent.open()` carga y monta el producto antes de abrir el modal y devuelve `opened`, `unavailable`, `failed` o `aborted`; Product Hotspots espera ese resultado para usar su card solo como fallback.
- En el modo de escritorio “Compra rápida al hacer clic”, el hotspot revela una etiqueta configurable al hover o foco. El valor inicial es `VER MÁS` y en dispositivos táctiles se mantiene compacto.

### Documentado

- Se documentó el contrato, el modal global único, el fetch+morph y los fallbacks de Quick Add en `docs/theme-architecture.md`.
- Se documentó la matriz de los tres modos desktop y el contrato de carga segura de imágenes hover en Product Hotspots.
- `AGENTS.md` exige inspeccionar cambios staged, unstaged y untracked al cerrar una tarea, y entregar un único commit message general en formato Conventional Commits sin ejecutar el commit automáticamente.

### Archivos

- `layout/theme.liquid`, `assets/quick-add.js`, `assets/product-hotspot.js`, `blocks/_hotspot-product.liquid`, `sections/product-hotspots.liquid`, `locales/*.schema.json`, `AGENTS.md`, `CHANGELOG.md` y `docs/theme-architecture.md`.

### Validación

- `node --check` para `assets/quick-add.js` y `assets/product-hotspot.js`, validación JSON de los schemas y `git diff --check` aprobados.
- El validador de la skill no pudo iniciar por una dependencia ausente (`@shopify/theme-check-common`). Theme Check detectó las referencias regionales y el atributo dimensional que se corrigieron; las ejecuciones posteriores no devolvieron resultado antes del límite interactivo de 60 segundos.
- El preview anterior mostró un bloque configurado como `vela-oceano` usando el placeholder, lo que confirmó que `closest.product` no estaba disponible en esa sección.
- La inspección autenticada previa a la corrección confirmó un único `#quick-add-dialog`, cinco hotspots con `data-product-url=""` y respuestas 404 para los handles de vela configurados. Un producto publicado de control respondió 200 e incluyó `[data-product-grid-content]`.
- En una captura intermedia, el storefront del mismo preview omitió correctamente los hotspots mientras esos productos seguían inaccesibles y conservó una única instancia global de `#quick-add-dialog`.
- El chequeo `checkJs` con `strictNullChecks`, `noImplicitAny` y `noUncheckedIndexedAccess` pasó de 17 a cero diagnósticos para `assets/product-hotspot.js`; `node --check` también fue aprobado.
- La corrección de la píldora "VER MÁS" conserva cero diagnósticos `checkJs`, sintaxis JavaScript válida, `git diff --check` limpio y aprobación del Theme Check de Shopify para el JavaScript y la sección; el schema JSON original de Product Hotspots permanece intacto.
- El QA final del preview confirmó que Shopify sirve el asset minificado corregido sin el delay de 100 ms, con guards de puntero fino/touch y limpieza de ciclo de vida. Los cinco hotspots actuales resuelven URL y producto reales, contienen `quick-add-component`, usan `click-quick-buy` y comparten un único modal global; `vela-oceano` respondió 200 con `[data-product-grid-content]` y formulario de producto.
- La automatización de interacción no obtuvo un canal CDP utilizable, por lo que no pudo ejecutar el click real ni la emulación touch desde este entorno.
- La regla de entrega documenta el formato, alcance global y tipos permitidos del commit sugerido; contempla `git status --short`, `git diff`, `git diff --cached` y archivos nuevos, y diferencia expresamente la sugerencia de la autorización para ejecutar `git commit`.
- El schema de Product Hotspots acepta `overlay_content_alignment` con los valores `auto`, `start`, `center` y `end`; reutiliza traducciones existentes y no requiere cambios en templates JSON ni JavaScript.
- Shopify Theme Check aprobó el markup, los estilos lógicos y el schema del nuevo control de alineación editorial.
- `node --check` y el chequeo `checkJs` estricto aprobaron `assets/product-hotspot.js` sin diagnósticos; los schemas de sección y bloque conservaron sus values válidos.

### Reversión

- Restaurar la asignación anterior del producto, el render de placeholders, los estilos y la medición de etiqueta en Product Hotspots revierte esta corrección sin modificar IDs ni `block_order`.
- Restaurar el intercambio inmediato de `src` y los listeners anteriores revierte la carga segura y la coordinación de previews sin modificar settings ni datos guardados.

### Corregido

- Se eliminó una llave CSS sobrante de Product Hotspots que impedía que se aplicaran las reglas de tamaño del diálogo.
- La card de preview ahora usa un ancho responsive de 260–330 px, limitado a 90vw, con una grilla que no colapsa el texto ni el contenido de producto.

### Archivos

- `sections/product-hotspots.liquid`.

### Impacto

- Los hotspots con producto conservan una card legible en desktop y viewports estrechos.
- Los hotspots sin producto siguen mostrando el placeholder solo en Theme Editor y permanecen ocultos en el storefront según la lógica existente.

### Validación

- `node --check assets/product-hotspot.js`, validación JSON de los schemas de sección y bloque, y `git diff --check` aprobados.
- Theme Check se ejecutó desde la raíz, pero no devolvió un resultado dentro del límite interactivo de 55 segundos.

### Reversión

- Restaurar las reglas de diálogo de `sections/product-hotspots.liquid` elimina esta corrección sin afectar los settings ni los datos del editor.

### Añadido

- La sección Product Hotspots admite una imagen alternativa por hotspot al hover, contenido editorial sobre la imagen y nueve posiciones para ese contenido.
- El click de un hotspot con producto disponible abre el modal Quick Buy en desktop y dispositivos táctiles; los hotspots sin Quick Add conservan su diálogo informativo.
- Se añadió el modo de interacción desktop para elegir entre preview al hover con Quick Buy al click, preview al click o Quick Buy al click.
- El cambio de imagen de hover ya no espera una precarga artificial y su fundido se redujo a 150 ms.

### Archivos

- `sections/product-hotspots.liquid`, `blocks/_hotspot-product.liquid`, `assets/product-hotspot.js`.
- `locales/en.default.schema.json`, `locales/es.schema.json`.

### Impacto

- El merchant puede configurar las nuevas opciones desde Theme Editor sin modificar templates JSON existentes.
- La imagen principal se mantiene como fallback cuando no hay imagen de hover o el dispositivo no admite hover.

### Validación

- `node --check assets/product-hotspot.js` y controles estáticos de settings/atributos nuevos aprobados.
- Los schemas Liquid y las claves nuevas en los 20 archivos `*.schema.json` fueron verificados de forma estática.
- `git diff --check` aprobado.
- Theme Check completo se ejecutó desde la raíz, pero excedió el límite interactivo antes de devolver su resultado.
- El QA remoto del preview no pudo completarse porque el navegador automatizado no obtuvo un canal CDP utilizable en este entorno.

### Reversión

- Eliminar los nuevos settings y restaurar los tres archivos funcionales para volver al comportamiento anterior.

## 2026-08-22 — Personalización visual de secciones AM

### Añadido

- `AM Numbered Slideshow` permite configurar imágenes de fondo independientes para desktop y mobile; la imagen desktop funciona como fallback cuando no se define una variante mobile.
- `AM Video + Carousel` permite alinear las tarjetas en una misma posición, desactivar la transición suave entre slides y elegir el color de fondo de cada tarjeta.
- Cada slider item de `AM Video + Carousel` permite elegir entre una imagen o un video alojado en Shopify sin perder el medio configurado al alternar el selector.
- `AM Color Divider` crea transiciones decorativas de ancho completo, onduladas o en degradado, usando el fondo y el color de texto de un esquema nativo. Permite invertir los colores y ajustar alturas independientes para desktop y mobile.
- `AM Hover Explorer`, `AM Numbered Slideshow` y `AM Video + Carousel` incorporan un modo opcional de color scheme que reemplaza los colores manuales con los tokens nativos del theme.

### Modificado

- Las tres secciones AM usan las familias tipográficas de párrafo, H2 y H3 configuradas globalmente en Pitch, conservando los tamaños propios de cada composición.
- El selector de fuente genérica del botón de `AM Video + Carousel` se retiró para evitar que sus botones ignoren la tipografía elegida en el theme.
- Los videos de slider se muestran con su poster nativo, autoplay silencioso y loop. El componente reproduce solo el slide activo, pausa y reinicia los demás, y suspende la reproducción cuando la pestaña queda oculta o la sección se desmonta.
- Archivos: `sections/am--color-divider.liquid`, `sections/am--hover-explorer.liquid`, `sections/am--numbered-slideshow.liquid`, `sections/am--video-with-carousel.liquid`, `assets/am--hover-explorer.css`, `assets/am--numbered-slideshow.css`, `assets/am--video-with-carousel.css` y `assets/am--video-with-carousel.js`.
- Impacto: el Theme Editor conserva el aspecto existente por defecto y expone los nuevos controles sin modificar templates ni datos administrados por Shopify.

### Validación

- Los tres schemas JSON y el contrato entre `section.settings` y sus IDs fueron validados correctamente.
- `node --check` aprobó los tres módulos JavaScript asociados; el análisis `checkJs` no reportó diagnósticos nuevos en los métodos de reproducción del carrusel.
- `shopify theme check --path .` finalizó sin errores en las secciones AM; reportó 24 advertencias preexistentes de `ValidScopedCSSClass` en otros ocho archivos.
- El schema confirmó `media_type` con default `image` y settings condicionales válidos para imagen y video.
- El schema de `AM Color Divider` validó sus estilos `wave` y `gradient`, preset agregable, inversión de colores y alturas responsive; Theme Check inspeccionó 313 archivos sin errores nuevos.
- `git diff --check` y la revisión responsive/estática de las variantes de fondo, color scheme, alineación, transición y medios fueron aprobadas.

### Reversión

- Retirar los nuevos settings y modificadores Liquid/CSS restaura los fondos y el carrusel anteriores; los valores manuales de color permanecen guardados y vuelven a aplicarse al desactivar el color scheme.
- Retirar `media_type`, `video` y la coordinación de reproducción restaura los slider items de imagen sin requerir migraciones de templates.
- Eliminar `sections/am--color-divider.liquid` retira el nuevo divisor sin afectar templates ni datos existentes del Theme Editor.

## 2026-08-02 — Baseline de documentación

### Añadido

- Se incorporó `AGENTS.md` como protocolo común para agentes y colaboradores.
- Se incorporó `docs/theme-architecture.md` como mapa técnico del theme y sus convenciones.
- Se estableció este changelog como registro obligatorio de cambios futuros.

### Estado conocido

- Theme base: Shopify Pitch 3.5.1.
- Historial Git disponible: un único commit inicial (`361f182`). No se reconstruye historial previo no verificable.
- Arquitectura actual: layout Liquid, templates JSON, section groups para header/footer, secciones, bloques anidables, snippets compartidos, assets modulares, configuración y locales.

### Validación

- La documentación enlaza el protocolo, el historial y la guía técnica en el orden de lectura requerido.
- No se modificó Liquid, JavaScript, CSS, schemas, templates ni configuración del theme.

### Reversión

- Revertir únicamente los tres documentos de gobernanza si se decide retirar este proceso; no hay impacto en el storefront.

## Plantilla para cambios futuros

```md
## AAAA-MM-DD — Título breve

### Añadido | Modificado | Corregido | Eliminado

- Objetivo y comportamiento logrado.
- Archivos: `ruta/archivo.ext`.
- Impacto: editor, storefront, datos o compatibilidad.

### Validación

- Comando, prueba manual y resultado.

### Reversión

- Cómo deshacer el cambio y cualquier consideración necesaria.
```
