# Changelog

Todos los cambios relevantes del theme se documentan en este archivo. Cada agente debe leerlo antes de trabajar y actualizarlo al finalizar una modificación.

El formato se inspira en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y las fechas usan `AAAA-MM-DD`.

## Unreleased

### Modificado

- Objetivo (2026-09-30): ajustar la altura y el contenido de las cards de `AM Medio + Carrusel 60/40` para que queden centradas y más bajas que el medio principal, sin recortar textos largos.
- Archivos: `sections/am--media-product-carousel.liquid`, `blocks/am--media-carousel-card.liquid` y `CHANGELOG.md`.
- Impacto: el editor dispone de altura de cards en escritorio (50–90% del medio, 75% inicial) y móvil/tablet (260–520 px, 360 px inicial), padding textual (0–40 px, 16 px inicial) y fondo/texto opcionales compartidos por productos y bloques. Las imágenes llegan al borde y las cards crecen si el contenido supera la altura elegida. Los estilos del carrusel externo ya no añaden espacio al carrusel interno de productos; el solapamiento se calcula con una unidad de ancho de sección válida en el navegador. Los componentes nativos de producto, Quick Add y navegación se conservan.

### Validación

- Los schemas JSON y las referencias Liquid/settings de sección y bloque validaron correctamente. Una maqueta local del DOM en Chrome comprobó 50%, 75% y 90% en escritorio, 260, 360 y 520 px en móvil/tablet, ambos tipos de card, fondo/padding activados y desactivados, texto largo, una card y solapamientos 0%, 8% y 15% con ancho completo y de página. La galería de producto mantiene la imagen principal y la secundaria dentro de su viewport; no había storefront ni Theme Editor local para probar las interacciones reales.
- `shopify.cmd theme check --path .` inspeccionó 317 archivos sin errores y con las 29 advertencias preexistentes. Tras emitir el resumen, la CLI volvió a cerrarse por una aserción interna de Node.

### Reversión

- Retirar los seis settings de card, sus variables y reglas de estilo específicas restaura la altura y el contenido anteriores; no se modificaron templates ni datos administrados por Shopify.

### Añadido

- Objetivo: `AM Medio + Carrusel 60/40` combina imagen o video principal con texto y dos CTA sobre un carrusel de productos elegidos o cards editoriales, en columnas 60/40 de escritorio y apilado en móvil.
- Archivos: `sections/am--media-product-carousel.liquid`, `blocks/am--media-carousel-card.liquid` y `CHANGELOG.md`.
- Impacto: la nueva sección se agrega mediante un preset sin editar templates JSON. Expone ancho completo o de página, medio y portada, fuente del carrusel, autoplay, bucle y flechas chevron. El modo Productos reutiliza la card estática de Pitch y muestra placeholders solo en el editor cuando la lista está vacía; el modo Bloques permite reordenar cards y elegir texto sobre o debajo de la imagen. El selector de productos permanece visible en ambos modos porque Shopify no permite `visible_if` para `product_list`.

### Modificado

- Objetivo: las cards del carrusel avanzan sobre el borde final de la imagen o video en escritorio, como en la referencia, sin desplazar el fondo de la columna 40%.
- Archivos: `sections/am--media-product-carousel.liquid` y `CHANGELOG.md`.
- Impacto: el nuevo ajuste `Solapamiento del carrusel` permite de 0% a 15% del ancho real de la sección, con 8% por defecto. El valor 0 conserva la disposición anterior; hasta 1023 px se mantiene el apilado sin solapamiento. El contenido superpuesto al medio reserva espacio para las cards.

### Validación

- Los schemas de la sección y el bloque se parsearon como JSON, sus referencias Liquid corresponden a IDs existentes y el JavaScript embebido aprobó `node --check`.
- El schema y el contrato Liquid del solapamiento validaron su rango, default y referencia a setting. Se revisó estáticamente el desplazamiento con ambos anchos de sección y los valores 0%, 8% y 15%.
- `shopify theme check --path .` inspeccionó 317 archivos sin errores y mantuvo 29 advertencias preexistentes. La CLI emitió una aserción interna de Node al cerrar después del resumen.
- El validador de la skill Shopify Liquid no pudo iniciar por la dependencia ausente `@shopify/theme-check-common`; se usó Theme Check como verificación de Liquid y schema.
- No había preview local disponible para completar interacciones en navegador; quedan por verificar visualmente el ajuste 60/40, el arrastre táctil, la selección en el editor y la reproducción del video en storefront.

### Reversión

- Eliminar la sección y el bloque retira la capacidad nueva; no hay migración ni cambios en datos administrados por Shopify.
- Retirar `carousel_overlap` y sus reglas CSS de escritorio elimina el solapamiento sin modificar bloques ni templates JSON.

### Añadido

- Objetivo: cada diapositiva de `AM Presentación numerada` puede convertir opcionalmente su CTA en Quick Add mediante `Agregar producto al hacer clic` y `Producto del CTA`.
- Archivos: `sections/am--numbered-slideshow.liquid`, `snippets/am--numbered-slideshow-quick-add.liquid`, `assets/am--numbered-slideshow.css`, `assets/quick-add.js`, `docs/theme-architecture.md` y `CHANGELOG.md`.
- Impacto: la función queda desactivada por defecto. Con un producto accesible, una variante única se agrega directamente y los productos con opciones abren Quick Buy; si Shopify resuelve el producto como vacío, el CTA conserva su enlace configurado. El carrito mantiene sus eventos, anuncios y preferencia global de apertura del drawer.
- Objetivo: `AM Presentación numerada` permite activar hasta tres hotspots de producto por diapositiva, con posiciones independientes, título y enlace opcionales, imagen alternativa al hover y los tres modos de interacción de `Product Hotspots`. También incorpora numeración romana visual opcional y una animación respirante configurable por diapositiva para destacar sus hotspots.
- Archivos: `sections/am--numbered-slideshow.liquid`, `assets/am--numbered-slideshow.css`, `assets/am--numbered-slideshow.js`, `snippets/product-hotspot.liquid`, `assets/product-hotspot.css`, `assets/product-hotspot.js`, `blocks/_hotspot-product.liquid`, `sections/product-hotspots.liquid`, `snippets/quick-add.liquid`, `docs/theme-architecture.md` y `CHANGELOG.md`.
- Impacto: los tres hotspots, la numeración romana y la animación quedan desactivados por defecto y no alteran las instancias existentes ni requieren editar templates JSON. Cada slide comparte una sola capa de imagen hover; el producto sigue siendo obligatorio en storefront, mientras el Theme Editor conserva un marcador para configuraciones activas sin producto accesible. La numeración romana conserva índices arábigos accesibles y el halo solo se ejecuta en la diapositiva activa, se oculta durante la interacción y respeta `prefers-reduced-motion`.

### Modificado

- El CTA de producto de `AM Presentación numerada` usa un formulario dedicado con un solo botón visible y texto plano. Conserva el mismo layout de título y enlace que las diapositivas normales, sin incorporar el icono ni la animación duplicada de Quick Add para cards.
- `snippets/quick-add.liquid` conserva su contrato de presentación original; la URL explícita permanece como capacidad de `QuickAddComponent` para abrir productos multivariante desde el CTA del slideshow.
- El markup y los estilos de hotspot pasan a un snippet y asset compartidos sin cambiar el schema de `Product Hotspots`. Quick Add acepta un `instance_id` opcional para generar formularios únicos cuando una diapositiva contiene varios hotspots, y el slideshow cierra previews y restaura la imagen base al cambiar de slide.
- Shopify no admite `visible_if` en settings de tipo `product`: cada selector de producto permanece visible, mientras texto, URL, imagen hover y posiciones sí se ocultan hasta activar su checkbox.
- Los controles de la presentación pueden mostrarse con contadores CSS `upper-roman` hasta el límite de 12 diapositivas. El halo usa exclusivamente `transform` y `opacity`, sin modificar el tamaño ni la posición del hotspot.

### Validación

- El schema, los IDs y el contrato Liquid/settings/JavaScript del CTA Quick Add se verificaron mediante controles automatizados; `node --check assets/quick-add.js` y `git diff --check` fueron aprobados, sin cambios en templates ni configuración administrada.
- `shopify.cmd theme check --path .` inspeccionó 315 archivos sin errores y mantuvo 29 advertencias preexistentes; la CLI cerró con su aserción interna de Node después de emitir el resumen. El validador de Shopify Liquid no pudo iniciar porque falta la dependencia local `@shopify/theme-check-common`.
- El contrato estático confirmó un solo CTA renderizado por rama, sin markup de icono/checkmark, y la restauración exacta de `snippets/quick-add.liquid`. El QA remoto no pudo repetirse porque el preview redirige a `/password` y el navegador automatizado no obtuvo un canal CDP utilizable.
- Los schemas Liquid se parsearon como JSON y un control automatizado confirmó IDs únicos, 26 settings funcionales por slide, checkboxes desactivados, posiciones predeterminadas 25%/50%, 50%/50% y 75%/50%, tres modos de interacción y compatibilidad exacta del schema anterior de `Product Hotspots`.
- El contrato Liquid/CSS confirmó los defaults `false` de `use_roman_numerals` y `animate_hotspots`, la numeración visual `I`–`XII` sin alterar los nombres accesibles y la activación del halo únicamente en slides activos, con pausa durante hover, foco o card abierta y cancelación bajo movimiento reducido.
- `node --check assets/product-hotspot.js`, `node --check assets/am--numbered-slideshow.js` y `git diff --check` fueron aprobados; no hay cambios en `templates/` ni `config/`.
- `shopify.cmd theme check --path .` inspeccionó 314 archivos sin errores y mantuvo 29 advertencias preexistentes; la CLI volvió a emitir su aserción interna de Node después del resumen.
- El validador de la skill Shopify Liquid no pudo iniciar porque falta la dependencia local `@shopify/theme-check-common`; se utilizó Theme Check como fallback oficial sin instalar ni modificar dependencias.
- El chequeo `checkJs` estricto no pudo ejecutarse porque `tsc` no está instalado en el entorno. No se inició `shopify theme dev` para evitar subir el theme a una tienda no identificada; responsive, foco, estados inactivos y fallbacks de imagen se revisaron estáticamente.

### Reversión

- Retirar los dos settings del CTA, su snippet dedicado, el render condicional y el fallback `data-product-url` restaura los enlaces anteriores sin migrar datos ni modificar templates JSON.
- Retirar los settings y el render por slide, las clases y keyframes de numeración/animación, restaurar el markup/estilos internos de `Product Hotspots` y eliminar el parámetro opcional `instance_id` devuelve el comportamiento anterior sin migrar datos ni modificar templates JSON.

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

## 2026-10-31 — Textos de regalos y ajuste de imágenes de Quick Buy

### Añadido

- Objetivo: personalizar la etiqueta de cada regalo y su comunicación de gratuidad en drawer y página. Cada nivel agrega `am_progress_1_gift_label`, `am_progress_2_gift_label` o `am_progress_3_gift_label`; `am_progress_gift_free_text` comparte el texto «GRATIS». Los campos vacíos usan traducciones y las líneas sin un nivel reconocible conservan «Regalo». Un producto repetido admite etiquetas distintas según su marca.
- El precio unitario actual del regalo aparece tachado junto al texto configurado. El nuevo checkbox `am_progress_gift_only_free`, desactivado por defecto, omite la fila del precio unitario y reemplaza el importe de la derecha únicamente por ese texto. Los textos se escapan y admiten saltos de línea visuales sin desbordar. No cambian precios reales, cantidades, elegibilidad ni reconciliación.
- Archivos: `config/settings_schema.json`, `snippets/cart-products.liquid`, los 51 locales, `tests/am-commerce.test.mjs`, `docs/cart-tier-gifts.md`, guía técnica y este changelog. Se preservaron los cambios pendientes de estilos del drawer y upsell; sin cambios en datos administrados, productos o publicación.

### Corregido

- Objetivo: llenar el marco principal de Quick Buy sin espacios internos arriba y abajo. Desde 750 px, con la galería de miniaturas activa, `snippets/quick-add-modal-styles.liquid` aplica dimensiones completas y `object-fit: cover` exclusivamente a la imagen principal, con recorte proporcional y su punto focal. Conserva miniaturas, navegación, selección de variantes, videos/modelos y el comportamiento móvil y de PDP.

### Validación

- El subset de tiers aprobó 70 comprobaciones en Chromium con Liquid/assets reales: etiquetas por nivel, producto repetido, textos especiales escapados, precio cero tachado incluso con compare-at, texto compartido, ambos modos a 390/1440 px en drawer/página, textos largos, defaults vacíos y conservación de productos normales. Incluye las regresiones previas de regalos y recuperación del carrito.
- El subset de galería aprobó 50 comprobaciones, sin escrituras de carrito: imágenes a marco completo con origen grilla/carrusel a 750/1024/1440 px y viewport de 1024×420, miniaturas, teclado, variantes, reapertura y regresiones de videos, previews de modelos, móvil, hotspots, upsell y PDP. Se revisaron capturas de ambos modos de regalos y de Quick Buy.
- Theme Check terminó con cero errores y las 30 advertencias preexistentes. Sintaxis de la suite y JSON/settings/locales validados; no se modificaron los módulos de carrito. Sin preview autenticado ni publicación; la persistencia en Theme Editor real sigue pendiente.

### Reversión

- Desactivar el checkbox recupera los importes numéricos; vaciar los textos restaura las traducciones predeterminadas. Retirar las reglas específicas de la imagen principal recupera el ajuste contenido de Quick Buy. No requiere migraciones.

## 2026-10-31 — Regalos automáticos por nivel del carrito

### Añadido

- Objetivo: convertir opcionalmente los niveles de beneficios en regalos automáticos acumulables, con una unidad por nivel y retiro al perder su umbral, conservando el total con descuentos y servicios pagos. Los pickers globales `am_progress_1_product`, `am_progress_2_product` y `am_progress_3_product` empiezan vacíos. Un nivel sin producto conserva su comunicación anterior de envío, descuento u otro beneficio.
- Los productos elegidos quedan reservados por ID incluso con el nivel desactivado. Requieren una sola variante gratuita, disponible y con reglas que permitan una unidad, distinta de los servicios pagos. Cada línea usa `_am_tier_gift: 1|2|3`; repetir un producto en dos niveles crea líneas independientes. El editor muestra ayuda para configuraciones incompatibles y se actualiza la explicación de los beneficios en los 20 locales de schema.
- Drawer y página muestran regalos sin enlaces, selector de cantidad ni papelera. Se omiten las acciones de compra desde Liquid en Buy buttons, ATC compartido, barra fija, Quick Add/Quick Buy, hotspots, slideshow, upsell y Quick Order, independientemente del template o `?view=...`. Los productos normales, incluidos otros gratuitos, mantienen su flujo.
- El módulo de reglas se integra a la cola existente para serializar altas, cantidades, descuentos y servicios. La configuración JSON se actualiza con las secciones y tiene respaldo global para el modo Página sin un carrito montado. La reconciliación usa claves actuales, comprueba precio/disponibilidad por Ajax antes del alta, confirma respuestas inciertas, corrige cantidades/duplicados/copias sin marca y limpia regalos y servicios al retirar el último producto normal. Las secciones publicadas corresponden al estado final, incluidas las altas causadas por servicios pagos.
- Pagar verifica el carrito antes de continuar. Un regalo rechazado o no disponible no bloquea la compra normal; un carrito que no puede verificarse conserva el bloqueo existente y permite reintentar sin un bucle de consultas. Se preservan apertura, scroll, foco y anuncios; el feedback vive en el resumen compartido, también cuando los servicios están desactivados.
- Archivos: nuevos `assets/am--tier-gifts.js`, `snippets/am--is-tier-gift-product.liquid`, `snippets/am--tier-gift-config.liquid`, `tests/am-tier-gifts.test.mjs` y `docs/cart-tier-gifts.md`; integración en los controladores de regalos/carrito/Product Form/descuentos/Quick Order, listado/resumen/servicios/upsell/scripts del carrito, componentes compartidos de compra, secciones de producto y Quick Order, schema global, los 51 locales, suite de comercio, guía técnica y este changelog.
- Alcance: gestión exclusivamente en el theme, sin Functions ni modificaciones del checkout. Las propiedades privadas son identificación, no autorización; solicitudes directas, JavaScript desactivado y recorridos que saltan el carrito pueden eludirla. El procedimiento documenta productos Unlisted, publicación solo en Online Store, límites de Basic y necesidad de validación de Shopify para imponer reglas del lado servidor. Sin cambios en settings guardados, templates, section groups, mercados, productos, pedidos ni publicación del theme.

### Validación

- `node tests/am-tier-gifts.test.mjs` aprobó 17 escenarios de fronteras, acumulación, moneda, reserva con niveles desactivados, servicios, productos gratuitos normales, marcas, duplicados, cantidades, precio, variantes, respuestas perdidas, stock, consultas fallidas y prevención de oscilaciones con descuentos.
- `AM_QA_TIERS_ONLY=1 node tests/am-commerce.test.mjs` aprobó 39 comprobaciones en Chromium con Liquid/assets reales y respuestas de tienda locales: drawer/página a 390/1440 px, regalos repetidos, manipulación de líneas, servicios, descuentos, moneda, desactivación, ayuda del editor, guards Liquid/JS, ambos templates de producto, preflight de checkout y recuperación de un carrito ilegible sin reintentos continuos. Se revisaron capturas móviles y de escritorio de las líneas bloqueadas.
- La suite completa final `node tests/am-commerce.test.mjs` aprobó 545 comprobaciones y 61 escrituras locales, sin excepciones de navegador. El subset de upsell aprobó además 106 comprobaciones. Las pruebas esperan las cards después de una recarga y el fin de animaciones antes de reabrir el drawer; se preservaron las regresiones de servicios, mensajes, foco, scroll, Quick Buy, carruseles y hotspots.
- Theme Check terminó con cero errores y las 30 advertencias preexistentes. Sintaxis JavaScript, los 51 locales JSON/JSONC, IDs únicos, compatibilidad de los 165 settings previos y `git diff --check` aprobados. El validador adicional de la skill no pudo iniciar por la dependencia ausente `@shopify/theme-check-common`; Shopify CLI cubrió Liquid y schemas.
- No se verificaron guardado de pickers ni checkout reales: `shopify theme info --json` falló por EPERM al acceder a su configuración local. Queda pendiente el QA de tienda con productos reales y repetir checkout al migrar de Development a Basic. Las pruebas no crearon productos ni pedidos ni modificaron un carrito remoto.

### Reversión

- Desactivar la barra o los niveles retira sus regalos cuando el carrito vuelve a reconciliarse; vaciar todos los pickers libera la reserva de los productos. Retirar el código deja de gestionar líneas ya existentes, cuyas propiedades persisten en Shopify: desactivar y limpiar antes de esa reversión. No requiere migrar datos administrados.

## 2026-10-31 — Ancho del drawer y miniaturas de Quick Buy

### Añadido

- Objetivo: configurar el ancho del carrito y navegar los medios de Quick Buy desde el editor. `am_drawer_width`, en Carrito > Drawer, permite 30–50 rem con paso de 1 y valor inicial de 30 rem, desde 750 px y limitado a 95vw. Usa una variable exclusiva del diálogo; móvil conserva su ancho completo y `--sidebar-width` permanece intacta.
- `am_quick_buy_show_thumbnails`, en Tarjetas de producto y activado inicialmente, muestra desde 750 px un medio principal contenido en la altura disponible y una fila horizontal de miniaturas debajo. Reutiliza los medios ordenados/filtrados y el slideshow nativo, responde a variantes y reinicia la galería al reabrir. Funciona desde cards, hotspots y upsell aunque los botones globales de Quick Add estén desactivados. Sin medios conserva los detalles y con uno solo omite controles; desactivarlo recupera el apilado anterior. Móvil conserva su presentación compacta.
- Las miniaturas se preparan en un template inerte, sin descargar sus imágenes en la PDP. Solo se adapta la copia del modal, retirando grilla duplicada y zoom. Las slides inactivas quedan `inert`; videos/modelos usan sus componentes nativos y se pausan al cambiar de medio o cerrar. Se corrige el escape del HTML de `image_tag` en los controles compartidos para mostrar imágenes reales en lugar de texto.
- La fuente mantiene el setting existente `cart_price_font`, compartido por importes de línea y totales de drawer/página. El precio unitario debajo del nombre conserva su fuente. Se añaden etiquetas y ayudas en los 20 locales de schema, con español/inglés propios y respaldo inglés para los demás idiomas.
- Archivos: `config/settings_schema.json`, `snippets/header-actions.liquid`, `snippets/quick-add-modal.liquid`, `snippets/quick-add-modal-styles.liquid`, `snippets/product-media-gallery-content.liquid`, `snippets/slideshow-controls.liquid`, `assets/quick-add.js`, `assets/media-gallery.js`, los 20 `locales/*.schema.json`, `tests/am-commerce.test.mjs`, guía técnica y este changelog. Sin cambios en settings guardados, templates, section groups, mercados ni datos comerciales; sin publicación.

### Validación

- `node tests/am-commerce.test.mjs` aprobó 507 comprobaciones y 37 escrituras locales, sin excepciones de navegador. Incluye los anchos 30/40/50 rem a 749/750/1024/1440 px en carrito vacío/lleno, grilla/carrusel de origen, clic/teclado, variantes, reapertura, fila larga, cero/uno/varios medios, desactivación, móvil, templates inertes, hotspots y upsell. Un video WebM generado localmente verificó reproducción y pausa; el modelo conservó su preview y template nativos. Las capturas revisadas incluyen el modal en un viewport de 1024×420 px. Se conservan las regresiones de regalos, beneficios, foco, scroll, descuentos, cantidades y carruseles.
- Theme Check terminó con cero errores y las 30 advertencias preexistentes. Los 21 JSON/JSONC y sus contratos validaron, conservando todos los settings y traducciones anteriores; sintaxis JavaScript y `git diff --check` aprobados. El validador adicional de la skill no pudo iniciar por la dependencia ausente `@shopify/theme-check-common`; Shopify CLI cubrió Liquid y schemas.
- No se verificó guardado en Theme Editor real: `shopify theme info --json` encontró EPERM al acceder a la configuración local de la CLI. El visor 3D real y Safari/iOS físicos quedan pendientes; las respuestas de tienda y el video de QA fueron locales.

### Reversión

- Seleccionar 30 rem y desactivar las miniaturas recupera la presentación anterior del drawer y Quick Buy. Retirar los settings y su integración elimina la capacidad sin migraciones; la corrección del HTML de miniaturas es independiente y puede conservarse.

## 2026-10-31 — Upsell y beneficios en el drawer vacío

### Añadido

- Objetivo: ofrecer recomendaciones y mostrar los beneficios pendientes antes de agregar el primer producto. El drawer conserva título/cierre y barra arriba, seguidos del mensaje vacío y el upsell dentro del viewport desplazable. No muestra resumen ni checkout hasta tener productos; mantiene colores, colección, orden, controles, Quick Buy y activaciones existentes.
- El nuevo checkbox `am_drawer_hide_continue_shopping`, en Carrito > Drawer, oculta Seguir comprando por defecto. Desactivarlo recupera el botón con su enlace configurado. La etiqueta se incorpora a los 20 locales de schema, en español/inglés y con respaldo inglés en los demás idiomas. La página conserva su botón y no incorpora upsell ni progreso vacío.
- La barra vacía parte de cero, sin niveles completados y con el importe completo del primer beneficio pendiente, manteniendo las validaciones de moneda y umbrales. Quitar la última línea del drawer espera la respuesta confirmada y no inserta un template optimista con datos anteriores; la página mantiene su flujo. Header y referencia accesible son estables en las transiciones AJAX.
- Archivos: `snippets/header-actions.liquid`, `snippets/cart-products.liquid`, `snippets/am--cart-upsell.liquid`, `snippets/am--cart-progress.liquid`, `assets/am--cart.css`, `assets/component-cart-items.js`, `config/settings_schema.json`, los 20 locales de schema, `tests/am-commerce.test.mjs`, guía técnica y este changelog. Sin cambios en templates, section groups, settings guardados, mercados o productos; sin publicación.

### Validación

- `AM_QA_EMPTY_ONLY=1 node tests/am-commerce.test.mjs` aprobó 48 comprobaciones y cinco escrituras locales con Liquid/assets reales en Chromium: carga diferida, seis anchos de 320 a 1837 px y viewport de 390×420, orden, geometría, progreso cero, ambos valores del checkbox, moneda/niveles inválidos, desactivación, candidatos/errores/reintento, scroll/foco, aislamiento de página y transiciones con Agregar/Quick Buy/eliminación/cierre durante solicitud. Se revisaron capturas del drawer vacío en móvil, escritorio y viewport bajo.
- El subset de regresión `AM_QA_UPSELL_ONLY=1 node tests/am-commerce.test.mjs` aprobó 106 comprobaciones y siete escrituras locales. La suite espera el documento nuevo al navegar y un periodo sin scroll antes de probar el bucle después de swipe, evitando interactuar con el documento saliente o con la inercia del gesto; no se modificó el carrusel.
- La suite completa final `node tests/am-commerce.test.mjs` aprobó 442 comprobaciones y 37 escrituras locales, sin excepciones de navegador, incluidas las regresiones de regalos, descuentos, progreso, cantidades, Quick Buy, upsell, carrusel y hotspots. Sintaxis JavaScript y `git diff --check` aprobados.
- Theme Check terminó con cero errores y las 30 advertencias preexistentes. Los 21 JSON/JSONC modificados validaron y conservaron todas las traducciones anteriores. El validador adicional de la skill no pudo iniciar por `@shopify/theme-check-common` ausente. No se verificó guardado en Theme Editor real: `shopify theme info --json` encontró EPERM en la configuración local de la CLI.

### Reversión

- Desactivar el nuevo checkbox restaura Seguir comprando en el drawer vacío. Revertir el render compartido, sus estilos y las condiciones de upsell/progreso recupera el estado vacío anterior; restaurar el template optimista y retirar el guard de la última línea devuelve la transición anterior. No requiere migraciones.

## 2026-10-31 — Nota compacta y bucle del upsell

### Modificado

- Objetivo: homogeneizar a 4 px la separación de título, De, Para, Mensaje, precio y acciones de la nota personalizada, exclusivamente en drawer. Se neutralizan los márgenes acumulados y se ocultan contenedores de propiedades vacíos; precio y acciones mantienen su ubicación. Los otros productos, servicios y la página conservan su presentación.
- Ver más/Ver menos, Editar y papelera usan una altura visual de línea y zonas interactivas extendidas de 44 px, sin inflar los espacios alrededor del precio. La última nota conserva 12 px al final para impedir que el footer recorte esas zonas. Se mantienen alineación, ellipsis, etiquetas y foco.
- El mensaje solo se recorta durante la transición. En reposo permite sus áreas táctiles extendidas, mientras el texto plegado conserva su propio recorte. Si aparece el scrollbar al expandir, se recalcula el destino y se anima desde la altura actual durante el tiempo restante de los 250 ms; se conservan inversión, movimiento reducido y estado AJAX.
- El upsell activa el bucle nativo en ambos sentidos con más de un candidato: Siguiente desde el final vuelve al primero y Anterior desde el inicio vuelve al último. Mantiene 1,2 cards, swipe y navegación manual; una sola card ocupa el ancho completo sin flechas ni bucle. No se agregan settings, traducciones o propiedades; no se publica el theme.
- Archivos: `assets/am--cart.css`, `assets/am--cart-message.js`, `sections/am--cart-upsell.liquid`, `tests/am-commerce.test.mjs`, guía técnica y este changelog.

### Validación

- Pruebas de separación por geometría en mensajes cortos, largos, multilínea y sin espacios; apertura/cierre reversible, recorte temporal, toque real fuera de la fila visual y conservación de la página. Navegación del upsell con dos y ocho productos a 390/1440 px, ambos extremos, teclado, clics consecutivos, movimiento reducido y AJAX; regresiones responsive de 320 a 1837 px.
- `node tests/am-commerce.test.mjs` aprobó 396 comprobaciones y 32 escrituras locales, sin excepciones de navegador. Se revisó la captura móvil de la nota compacta; el hit testing también comprobó ambos extremos de las zonas de mensaje, edición y papelera junto al footer.
- Sintaxis JavaScript, Liquid/schema mediante Theme Check y `git diff --check` aprobados. Theme Check conserva cero errores y 30 advertencias preexistentes. El validador adicional de la skill no pudo iniciar por la dependencia ausente `@shopify/theme-check-common`; Shopify CLI cubrió la validación del theme. No se verificó guardado en Theme Editor real.

### Reversión

- Retirar los estilos exclusivos de la nota y restaurar el viewport de mensaje devuelve la densidad anterior. Pasar `infinite: false` en el upsell restablece los límites de navegación. No requiere migraciones.

## 2026-10-31 — Confirmación de regalos sin texto visible en drawer

### Corregido

- Objetivo: retirar del drawer el texto persistente «Actualizamos tu carrito» después de modificar regalos. `feedback()` aplica la utilidad existente `visually-hidden` exclusivamente a confirmaciones exitosas dentro de `cart-drawer-component`; conserva el anuncio accesible sin reservar espacio en el footer. Cubre agregar, editar, eliminar y recuperar operaciones confirmadas tras respuestas inciertas.
- Los errores siguen visibles con `role="alert"`; una operación posterior limpia su mensaje y estilos. Limpiar feedback vacía y oculta el contenedor y retira la clase de ocultación visual. La página de carrito mantiene sus confirmaciones visibles. No se agregaron settings, traducciones ni cambios en propiedades del carrito; no se publicó el theme.
- Archivos: `assets/am--cart-gifts.js`, `tests/am-commerce.test.mjs`, `docs/theme-architecture.md` y este changelog.

### Validación

- Pruebas ampliadas para confirmaciones accesibles sin espacio en el footer a 390/1440 px, altas/edición/bajas, limpieza al iniciar otra operación, errores visibles, reintento exitoso, respuestas recuperadas y conservación del mensaje visible en la página.
- `node tests/am-commerce.test.mjs` aprobó 359 comprobaciones y 32 escrituras locales, sin excepciones de navegador. Incluye las regresiones previas de notas, scroll, upsell, progreso, carrusel y hotspots.
- Sintaxis JavaScript y `git diff --check` aprobados. Theme Check: cero errores y las 30 advertencias preexistentes. El validador adicional de la skill no pudo iniciar por `@shopify/theme-check-common` ausente; Shopify CLI validó el theme completo.

### Reversión

- Retirar el toggle de `visually-hidden` en `feedback()` restaura las confirmaciones visibles del drawer. No requiere migraciones.

## 2026-10-31 — Distribución y acciones de la nota del drawer

### Corregido

- Objetivo: presentar `Mensaje: texto… Ver más` en una sola fila al plegar, con espacio reservado para el control y un único ellipsis. Al expandir, Mensaje permanece junto al comienzo y Ver menos sigue al final del texto cuando entra; se conservan saltos de línea, transición reversible de 250 ms y movimiento reducido. La medición incluye ahora el control inline y mantiene la expansión al actualizar cantidades, reiniciándola al editar el mensaje.
- Solo en drawer, De/Para/Mensaje reciben un espacio visible después de los dos puntos y peso 600 exclusivamente en sus etiquetas. Editar mensaje se muestra una única vez, antes de la papelera en la fila de controles, y se retira del acordeón de regalos. Las restricciones de eliminación permanecen intactas. Editar y Ver más/Ver menos usan cursor pointer y acentúan el subrayado al hover/foco visible, conservando áreas táctiles e indicador de foco.
- Archivos: nuevo `snippets/am--gift-edit-button.liquid` para compartir la etiqueta y el contrato de edición; cambios en `snippets/am--gift-line-details.liquid`, `snippets/cart-products.liquid`, `snippets/am--cart-gifts.liquid`, `assets/am--cart-message.js`, `assets/am--cart.css`, `tests/am-commerce.test.mjs`, guía técnica y este changelog.
- Compatibilidad: la página conserva mensaje completo y sus acciones de edición anteriores. Se reutilizan `is_drawer`, etiquetas administrables y `data-am-gift-edit`; no se agregan settings ni traducciones. Scroll y upsell conservan su comportamiento. Sin cambios en JSON administrados o propiedades guardadas; sin publicación del theme.

### Validación

- El subset `AM_QA_DETAILS_ONLY=1 node tests/am-commerce.test.mjs` aprobó 48 comprobaciones con Liquid/assets reales en Chromium: geometría de etiquetas/texto/control, único ellipsis, pesos y espacios, mensaje corto/largo/multilínea/sin espacios, Ver menos inline, animación reversible, teclado, foco, hover, AJAX, restricciones de papelera y aislamiento de página; conserva las regresiones de scroll y colores. Se revisaron capturas móviles de nota abierta/cerrada.
- La suite completa `node tests/am-commerce.test.mjs` aprobó 349 comprobaciones y 32 escrituras locales, sin excepciones de navegador, incluidas edición/eliminación de nota y regresiones de progreso, upsell, carrusel y hotspots. La comprobación de reset de hotspots ahora despacha y comprueba la selección en la misma evaluación para impedir que un nuevo hover entre ambas altere su resultado; el componente no cambió.
- Sintaxis de los ocho scripts pendientes, 52 JSON/JSONC y 144 schemas Liquid aprobados; los valores anteriores de los 51 locales se conservaron. `git diff --check` aprobado y JSON administrados intactos.
- Theme Check: cero errores y 30 advertencias preexistentes. El validador adicional de la skill Shopify no pudo iniciar por la dependencia ausente `@shopify/theme-check-common`; Shopify CLI validó Liquid y el theme completo. No se verificó guardado en Theme Editor real.

### Reversión

- Restaurar los snippets del detalle/listado/acordeón, el componente de mensaje y sus estilos devuelve la distribución anterior. No requiere migraciones ni cambios en propiedades de línea.

## 2026-10-30 — Mensajes plegables, scroll del drawer y colores de upsell

### Añadido

- Objetivo: reducir el espacio de la nota personalizada y facilitar el acceso al final de los productos sin cambiar la página de carrito. El drawer muestra el mensaje en una línea con ellipsis y Ver más/Ver menos solo cuando hace falta. La transición de altura dura 250 ms, admite inversión y respeta movimiento reducido; mantiene saltos de línea al expandir y nunca cambia las propiedades guardadas. Cantidades conservan el estado y editar el mensaje lo reinicia.
- El nuevo botón flotante con chevrón aparece cuando quedan más de 2 px por desplazar en el body, baja suavemente hasta el final y se oculta al llegar. Está fuera de la máscara del viewport, conserva header/footer y funciona con o sin upsell. Responde a scroll, redimensionado, expansión de notas y actualizaciones AJAX; movimiento reducido evita la animación. Si se oculta estando enfocado, devuelve el foco al viewport sin mover la página.
- Cuatro selectores en Carrito > Drawer permiten elegir fondo/texto de cards y fondo/texto de Agregar. Los valores vacíos preservan la apariencia existente y los explícitos se mantienen en hover/foco. Las actualizaciones de color conservan productos y scroll; encabezado, flechas y Quick Buy mantienen sus colores.
- Archivos: nuevo `assets/am--cart-message.js`; integración en `assets/am--cart-gifts.js`, `assets/cart-drawer.js`, `assets/am--cart.css`, `assets/am--cart-upsell.css`, snippets de listado/detalle de regalos/header/upsell/scripts, `config/settings_schema.json`, los 51 locales, `tests/am-commerce.test.mjs`, guía técnica y este changelog.
- Compatibilidad: `is_drawer` es opcional en el listado y detalle de nota; la página conserva su contenido completo. No se modificaron templates, section groups, mercados, settings guardados, productos, pedidos ni propiedades del carrito. No se publicó el theme.

### Validación

- El subset `AM_QA_DETAILS_ONLY=1 node tests/am-commerce.test.mjs` aprobó 35 comprobaciones con Liquid/assets reales en Chromium, sin excepciones. Cubre texto corto/largo/multilínea y sin espacios, ellipsis, expansión/cierre/reversión, teclado, movimiento reducido, conservación y edición por morph, aislamiento de página, scroll suave/instantáneo, foco, overflow dinámico y colores independientes, hover, foco visible, deshabilitado, valores vacíos y ausencia de nuevas solicitudes de recomendaciones. Se revisaron capturas móviles de nota abierta/cerrada.
- La suite ampliada completa `node tests/am-commerce.test.mjs` aprobó 336 comprobaciones y 32 escrituras de carrito locales, sin excepciones de navegador. Incluye las regresiones anteriores de carrito, upsell, Quick Buy, progreso, hotspots y hover del carrusel; los seis anchos de 320 a 1837 px y el viewport bajo conservaron checkout y límites del drawer.
- Theme Check: cero errores y las 30 advertencias preexistentes. Sintaxis JavaScript, schemas, cuatro colores sin defaults, JSONC y conservación de traducciones anteriores en los 51 locales validados localmente; whitespace aprobado y datos administrados intactos. El validador adicional de la skill no pudo iniciar por la dependencia ausente `@shopify/theme-check-common`; Shopify CLI cubrió Liquid y schemas. No se verificó guardado en Theme Editor real ni se accedió a datos comerciales remotos.

### Reversión

- Vaciar los cuatro colores devuelve el estilo previo. Retirar el componente de mensaje y el wrapper/control del body restaura la presentación y navegación anteriores. No hay migraciones de datos ni cambios que revertir en propiedades de línea.

## 2026-10-30 — Carrusel sin desbordes y upsell del drawer

### Corregido

- Objetivo: eliminar el overflow horizontal al hover/foco de `AM Medio + Carrusel 60/40`. Las flechas exteriores ahora reservan un gutter que contiene su animación nativa. La inspección previa del storefront confirmó aproximadamente 11 px de desborde durante la entrada de la flecha derecha; no se recorta el documento ni se modifican galerías internas.
- El progreso del drawer comparte ambos márgenes con el header y distribuye indicadores/etiquetas en columnas simétricas. El relleno interpola hasta los centros de los hitos y completa al alcanzar el último importe, con checks y accesibilidad sincronizados. La página mantiene su escala y geometría anteriores.

### Añadido

- Controles exclusivos en Ajustes del tema > Carrito > Drawer: richtext debajo de Pagar, apertura inicial de regalos, visibilidad de descuentos y upsell con colección, título y orden. Texto y colección empiezan vacíos; regalos cerrados, descuentos ocultos y upsell desactivado. Los controles existentes conservan el comportamiento de la página y ahora explican su alcance.
- Upsell bajo los productos y antes de las acciones de regalo, con imagen, título, precio/compare-at y Agregar. Muestra 1,2 slides con swipe/flechas manuales o una card completa sin flechas. Solicita la colección con el orden nativo Más vendidos o precio ascendente/descendente; entrega hasta ocho candidatos entre sus primeros 50, excluyendo agotados, productos presentes y servicios de regalo. No incluye reseñas ni requiere backend o tokens.
- Carga al abrir, conservación del scroll durante cantidades, invalidación por composición/configuración y cancelación de respuestas obsoletas. Altas y Quick Buy comparten la cola de carrito; la intención durante selección de variante no puede duplicarse ni usar una variante de la página subyacente. Las respuestas de formularios desmontados actualizan el carrito y no reabren el drawer si el cliente lo cerró. Los diálogos apilados conservan bloqueo de scroll y retorno de foco.
- Archivos: nueva sección auxiliar `sections/am--cart-upsell.liquid`, snippets `am--cart-upsell`/`am--cart-upsell-card` y assets `am--cart-upsell.js`/`.css`; ajustes en la sección media/carrusel, resumen/regalos/progreso del carrito, header, scripts/import map, carga de assets, controladores de carrito/Product Form/Quick Add/dialog, schema global, los 51 locales, suite de comercio y guía de arquitectura.
- Compatibilidad: sin cambios en templates, section groups, settings guardados, mercados, productos o promociones. La página de carrito conserva sus componentes y preferencias. La configuración editorial y los productos reales se eligen en Shopify.

### Validación

- `node tests/am-commerce.test.mjs` aprobó 302 comprobaciones en Chromium y 31 escrituras de carrito locales, sin excepciones de navegador. Un subset final de 75 comprobaciones verificó también límites reales del viewport después de terminar la animación de apertura y generó capturas estables revisadas en 390/1440 px. Incluye fronteras monetarias/RTL, settings independientes, richtext/checkout en viewport bajo, tres órdenes, filtrado, ocho candidatos, 1,2 slides a 320/390/749/750/1440/1837 px, swipe, flechas, errores/reintento, cantidad/cache, altas, Quick Buy, doble envío, variante pendiente, fuentes retiradas, reordenación, cierre y respuestas obsoletas. El carrusel real de sección no desbordó durante hover/foco en esos seis anchos.
- La revisión aislada del lifecycle del upsell aprobó 13 comprobaciones de desconexión/reconexión, cancelación, invalidación y estilos. Schemas, defaults, JSONC y conservación de todas las traducciones anteriores en los 51 locales fueron comprobados localmente; sintaxis JavaScript y whitespace válidos.
- Theme Check finalizó sin errores y con las 30 advertencias preexistentes. El validador adicional de la skill no pudo iniciar por la dependencia ausente `@shopify/theme-check-common`; se utilizó Shopify CLI local.
- Sin publicación ni verificación del guardado en Theme Editor real: `shopify theme info --json` no pudo acceder a su almacenamiento local por EPERM. Las pruebas nuevas usan Liquid/assets reales y respuestas de tienda locales; no modifican el carrito remoto ni crean pedidos.

### Reversión

- Desactivar el upsell y vaciar el texto retira los componentes opcionales. Los controles del drawer permiten restaurar regalos abiertos y descuentos visibles. Revertir la sección media/carrusel y la rama `is_drawer` del progreso restaura su presentación anterior. No hay migraciones de datos ni nuevas propiedades en líneas de carrito.

## 2026-10-30 — Alineación de niveles y carga de regalos

### Corregido

- Objetivo: centrar los números/checks sobre sus etiquetas y eliminar la animación que aparecía debajo de «Convertir en regalo» al actualizar el carrito.
- Archivos: `assets/am--cart.css`, `assets/am--cart-gifts.js`, `snippets/am--cart-progress.liquid`, `tests/am-commerce.test.mjs`, `docs/theme-architecture.md` y este changelog.
- Impacto: indicadores y etiquetas comparten el mismo centro, con espacio reservado para la última etiqueta y soporte RTL. Los hitos conservan su posición al final de cada tramo y el relleno mantiene la escala monetaria existente, tanto en drawer como en página.
- Carga: se retira el pseudo-elemento del contenedor de regalos que reaccionaba a cualquier operación del carrito. Las altas, ediciones y bajas desde las opciones de regalo muestran carga sobre el checkbox correspondiente; guardar la tarjeta mantiene su indicador en el botón. Este estado se libera también después de errores y reconciliaciones, sin añadir altura al acordeón. Las demás operaciones conservan los estados de carga nativos.
- Compatibilidad: sin cambios en settings, textos, productos, datos administrados ni promociones.

### Validación

- La suite local `node tests/am-commerce.test.mjs` aprobó 172 comprobaciones en Chromium sin excepciones: centrado y geometría con uno/dos/tres niveles, importes de frontera, etiquetas largas, RTL, anchos de 320/390/749/750/1440 px, solicitudes demoradas de cantidad/envoltorio/tarjeta, altura estable y limpieza del estado tras éxito/error. Se revisó una captura móvil generada por la suite.
- Theme Check local: cero errores y 30 advertencias preexistentes. Las pruebas usan respuestas de tienda locales; no se publicó ni se comprobó una tienda remota.

## 2026-10-30 — Drawer compacto y progreso por tramos

### Corregido

- Objetivo: unificar «Convertir en regalo» con «Descuentos», aumentar el espacio útil para productos y hacer coincidir el relleno de beneficios con sus marcadores.
- Archivos: `snippets/cart-summary.liquid`, `snippets/am--cart-gifts.liquid`, `snippets/am--cart-progress.liquid`, `snippets/header-actions.liquid`, `snippets/am--cart-features.liquid`, `assets/am--cart.css`, `tests/am-commerce.test.mjs` y guía de arquitectura.
- Impacto en ambas vistas: regalos y descuentos comparten el acordeón nativo, tipografía, hover e icono +/−; un único contenedor de acciones administra bordes y separadores, incluida la nota general opcional. Conservan labels configurables y estado tras cambios AJAX. La barra interpola el importe dentro de tramos iguales de los niveles activos; marcadores, checks y valor accesible coinciden al alcanzar cada umbral.
- Impacto exclusivo del drawer: gutters de 16/20 px, header con padding vertical de 8 px, barra más baja, 12 px antes del primer producto y entre filas, gaps del footer de 8 px y opciones de regalo más juntas. El listado y el contenido auxiliar conservan scroll independiente; el footer se limita al 55% del área restante y mantiene checkout accesible. Se respetan controles táctiles de 44 px, el ancho actual y la densidad de la página de carrito.
- Compatibilidad: sin nuevos settings, cambios en datos administrados ni modificaciones de la lógica de regalos. Se preservaron los cambios previos de ancho del sidebar y fondo del slideshow.

### Validación

- `node tests/am-commerce.test.mjs` aprobó 141 comprobaciones en Chromium sin excepciones: acordeones equivalentes, separadores, nota general, estados AJAX, uno/dos/tres niveles con umbrales desiguales, valores un centavo antes/después, geometría de marcadores, regresión por cantidad y descuento, labels largos y responsive a 320/390/749/750/1440 px, incluido viewport bajo.
- Comparación con una copia previa del código y descuentos habilitados: en el fixture de 390×900 px se ganaron aproximadamente 84 px para productos con los acordeones cerrados y 100 px con ambos abiertos. Las capturas y métricas se generaron en el directorio temporal.
- Theme Check local terminó con cero errores y las 30 advertencias preexistentes; `git diff --check` aprobado. La revisión automática rechazó el validador remoto porque enviaría código privado fuera del entorno; se completó la validación de forma local. No se publicó ni se probó un storefront remoto; las pruebas utilizan respuestas de tienda locales.

### Reversión

- Restaurar los archivos de presentación de esta entrada devuelve la densidad y la escala anteriores. No hay migración de settings ni datos de carrito.

## 2026-10-29 — Regalos y beneficios del carrito, cards circulares y hotspots

### Añadido

- Objetivo: ofrecer envoltorio y tarjeta pagos por pedido en drawer y página de carrito, una barra informativa de hasta tres beneficios y un estilo circular de product card configurable por sección.
- Archivos: nuevos `snippets/am--cart-gifts.liquid`, `snippets/am--cart-features.liquid`, `snippets/am--gift-line-details.liquid`, `snippets/am--cart-progress.liquid`, `assets/am--cart-gifts.js`, `assets/am--cart.css` y `tests/am-commerce.test.mjs`; integración en layout, import map, resumen/productos del carrito, header y página de carrito; settings globales, 23 schemas de sección y los 51 locales; documentación de arquitectura.
- Impacto en el editor: los dos grupos globales permiten elegir productos, imagen, labels, placeholders, textos del modal, umbrales y comunicación por nivel. Los servicios y la barra quedan desactivados; las cards mantienen Original por defecto. Las selecciones y configuraciones existentes no se migran ni se modifican templates, section groups, mercados o datos guardados.
- Impacto en storefront: cada servicio administra una unidad identificada mediante `_am_gift_service`. La tarjeta conserva De/Para/Mensaje en propiedades de línea, con edición, eliminación y límite de 400 caracteres. El modal único conserva el scroll del drawer y el foco; los borradores viven solo en memoria. Los cambios muestran carga, se serializan con cantidades y consultan el estado confirmado ante errores. Eliminar el último producto normal retira también servicios; quitar una línea sincroniza su checkbox. La nota general del pedido se conserva.
- Impacto en la barra: usa el total con descuentos, incluidos servicios, con mensajes pendientes/alcanzados, tokens `{amount}` y `{benefit}`, regresión de niveles y estado final. Solo se muestra en la moneda de la tienda; no aplica promociones. El footer conserva checkout accesible y ofrece scroll independiente en espacios reducidos.
- Impacto en cards: Circular muestra medios 1:1 y habilita Quick Add al hover/foco o de forma visible en táctil, preservando variantes, badges y controles. Se comparte entre grillas, carruseles, recomendaciones y bloques anidados; conserva el layout del carrusel 60/40 y las galerías principales.

### Corregido

- Archivos: `sections/product-hotspots.liquid`, `assets/product-hotspot.js` y `assets/product-hotspot.css`.
- Product Hotspots oculta en desktop los puntos no activos al mostrar un medio alternativo y los restaura al volver a la base. Coordina foco, salida del puntero, fundidos, errores y selección del editor. La corrección se activa exclusivamente en la sección independiente; el slideshow y el modo móvil mantienen sus contratos.

### Validación

- Theme Check completo terminó con cero errores y 30 advertencias; una copia temporal del HEAD confirmó las mismas categorías y cantidades preexistentes. El validador de Shopify aprobó los 96 archivos de theme modificados o nuevos. Sintaxis de los cuatro módulos afectados y la suite, claves JSON únicas, conservación de los 51 locales anteriores, compatibilidad de los 23 schemas y `git diff --check` aprobados. Sin cambios en datos administrados.
- `node tests/am-commerce.test.mjs` aprobó 73 comprobaciones en Chromium, sin excepciones de navegador, usando Liquid y assets reales con respuestas de carrito locales. Incluye altas/edición/cancelación/borrados, límites de mensaje, claves cambiantes, doble click, respuesta perdida, actualización externa concurrente, fallback de render, progreso ascendente/descendente, moneda distinta y ayuda de editor. Comprueba footer/modal/cards a 320, 390, 749, 750 y 1440 px, viewport bajo de 500 px, los tres modos desktop de hotspots, foco, reinicio, selección simulada de editor, movimiento reducido, consumidor sin opt-in y puntero táctil.
- La consulta no interactiva `shopify theme info --json` falló al acceder al almacenamiento local de la CLI y no permitió identificar un preview autenticado. No se inició un preview remoto ni se publicó el theme. Queda pendiente verificar en Shopify real los productos elegidos, precios/inventario de tienda, persistencia del pedido y cambios/reordenación desde Theme Editor; las respuestas de carrito y las imágenes de QA son fixtures locales.

### Reversión

- Desactivar servicios/barra y seleccionar Original retira las capacidades visuales opcionales. Retirar el código no migra datos: las líneas ya agregadas mantienen sus propiedades en Shopify y dejarían de gestionarse automáticamente. Revertir los cambios de hotspots restaura la visibilidad anterior sin modificar coordenadas ni bloques.

## 2026-10-29 — Beneficios, total de compra y reseñas manuales en PDP

### Añadido

- Objetivo: ofrecer dos bloques independientes de producto conectables a metafields, una lista de beneficios compartidos por template, el total de compra opcional en el ATC principal y una sección de reseñas manuales responsive según las referencias.
- Archivos: `blocks/am--product-summary.liquid`, `blocks/am--product-highlights.liquid`, `blocks/am--shared-benefits.liquid`, `blocks/_am--benefit-item.liquid`, `snippets/am--highlight-items.liquid`, `snippets/am--benefits-styles.liquid`, `sections/am--manual-reviews.liquid` y `assets/am--atc-total.js`.
- Integración: `blocks/_product-details.liquid`, `blocks/add-to-cart.liquid`, `snippets/add-to-cart-button.liquid`, `snippets/product-information-content.liquid`, `sections/product-information.liquid`, `assets/product-form.js`, `snippets/scripts.liquid` y los 51 archivos `locales/*.json`. Se actualizan también `AGENTS.md`, `docs/theme-architecture.md` y este changelog.
- Impacto en el editor: los bloques son agregables y reordenables; cada metafield vacío oculta solo su propio bloque en storefront y mantiene una ayuda seleccionable en el editor. La lista de producto usa checks circulares, borde y separadores; la compartida contiene ítems de texto e icono nativo. Permiten heredar o elegir un esquema y ajustar el espaciado vertical. El merchant crea/carga los metafields y conecta las fuentes dinámicas; no se fijan namespaces ni se modifican templates, settings guardados o datos de tienda.
- Impacto en la compra: «Mostrar total en el botón» queda desactivado por defecto. Al activarlo muestra precio de venta de variante × cantidad válida y responde a cambios de variante, cantidad y límites del carrito. Conserva formato y código de moneda del theme, excluye descuentos de carrito y selling plans, y se oculta mientras la selección está pendiente o el botón está deshabilitado. Su contexto externo no se copia a Quick Buy; compra rápida, cards, productos destacados y barra fija conservan su presentación.
- Impacto en reseñas: sección agregable con imagen desktop/móvil, esquemas independientes de sección/tarjetas y reseñas con texto, nombre, dato adicional, puntuación 1–5 y distintivo opcional. Desktop muestra imagen izquierda y carrusel derecha; móvil muestra título, cards, flechas e imagen. Usa navegación nativa manual con límites, cards que crecen con el texto y tres ejemplos editables identificados como tales, sin verificación inicial. Sin imagen se omite el marco; sin reseñas con texto se oculta la sección en storefront.
- Gobernanza y traducciones: `AGENTS.md` exige preguntar dudas o ambigüedades relevantes y no asumir requisitos, contenido ni preferencias. Se añaden claves equivalentes a todos los locales sin reformatear los existentes; español e inglés tienen textos propios y el resto dispone de respaldo en inglés para las nuevas capacidades.

### Validación

- Chrome local con LiquidJS, los componentes Liquid/CSS/JavaScript reales y adaptadores para filtros de Shopify aprobó 70 comprobaciones de metafields independientes, saltos/HTML, entidades, variantes, cantidad, reglas, agotados, carrito, formatos ARS/USD/JPY/KWD, aislamiento de compra rápida/producto destacado, remontaje y reseñas responsive. Se probaron flechas con límites, swipe táctil real, activación por teclado, movimiento reducido, selección y reordenación simuladas en el editor, texto largo, imagen móvil/fallback y una sola reseña, sin excepciones de navegador ni overflow a 320/390/749/750/1440 px.
- Theme Check: cero errores y las 30 advertencias preexistentes. Los schemas, rangos, contratos, JSONC de locales, import map y sintaxis JavaScript se verificaron localmente; `git diff --check` aprobado.
- El validador adicional de la skill Shopify no pudo iniciar por la dependencia ausente `@shopify/theme-check-common`; se utilizó Shopify CLI local. No había storefront ni Theme Editor reales activos: el guardado de fuentes dinámicas, selección/reordenación y configuración con datos de tienda siguen pendientes de prueba en Shopify; los productos y las respuestas de carrito del QA fueron locales.

### Reversión

- Desactivar el total y retirar los nuevos bloques/sección desde el editor permite dejar de usarlos. Revertir los archivos de esta entrada elimina la capacidad; no hay migraciones, cambios de precios ni modificaciones de templates o configuración administrada.

## 2026-10-27 — Videos alternativos en Product Hotspots

### Añadido

- Objetivo: permitir videos alternativos por hotspot en hover de escritorio o selección móvil, en loop, muteados, sin controles y desde cero en cada activación.
- Archivos: `blocks/_hotspot-product.liquid`, `snippets/product-hotspot.liquid`, `assets/product-hotspot.js`, los 20 archivos `locales/*.schema.json`, `docs/theme-architecture.md` y `CHANGELOG.md`.
- Impacto en el editor: cada bloque incorpora `hover_video` y `hover_video_mobile`, ambos de tipo video Shopify y vacíos por defecto, con etiquetas y ayudas traducidas. Se conservan los IDs, presets e imágenes guardadas. La grilla admite también hotspots configurados únicamente con video; no se modificaron templates ni datos administrados por Shopify.
- Impacto en storefront: escritorio prioriza video sobre imagen; móvil prioriza video móvil, imagen móvil y medio de escritorio. Los videos se cargan bajo demanda desde templates inertes, usan `playsinline` y comparten los fundidos de 400 ms. Salir del hover, cerrar o cambiar selección pausa inmediatamente; la capa conserva el último fotograma durante su salida y libera/reinicia la fuente al retirarse. Los errores de fuente/reproducción usan la imagen de respaldo o la principal conservando los controles. Se descartan cargas y reproducciones tardías, se limpia al desmontar o cambiar breakpoint, y la pestaña oculta pausa/libera el video; al volver solo reinicia una selección o hover vigente. Quick Buy mantiene la selección y el slideshow conserva sus opciones de imagen. Movimiento reducido evita fundidos y mantiene el video.

### Validación

- Los schemas de bloque/sección y las traducciones JSONC validaron IDs y claves únicos, ambos settings de tipo video y compatibilidad de todos los settings/presets previos. `node --check` y `checkJs` estricto aprobaron el JavaScript.
- Chrome local con LiquidJS, el snippet y la sección reales, adaptadores para los filtros de medios y un clip WebM real con audio aprobó 46 comprobaciones: carga bajo demanda, prioridad por dispositivo, loop, silencio, reproducción inline sin controles, reinicio, errores y rechazo de `play()`, cierre durante carga y resolución tardía de reproducción, selección rápida, cierres desde punto/grilla, los tres modos desktop, Quick Buy/foco, editor, desmontaje/remontaje, pestaña oculta y restauración, breakpoint, movimiento reducido y geometría sin overflow a 320/390/749/750/1440 px.
- Las suites de regresión vigentes de fundidos, carreras de carga, controles de cierre y slideshow compartido aprobaron la selección móvil, Quick Buy, retorno del foco, halo, posiciones extremas/textos largos, fallbacks, lifecycle y los cinco anchos anteriores, sin excepciones de navegador.
- `shopify.cmd theme check --path . --output json` finalizó con cero errores y las 30 advertencias preexistentes, sin incidencias en los archivos de hotspots. El validador de la skill Shopify no pudo iniciar por la dependencia ausente `@shopify/theme-check-common`; se utilizó Shopify CLI local sin transmitir código.
- No había storefront ni Theme Editor reales activos. El guardado de los selectores de video en Shopify y la reproducción en Safari/iOS físicos quedan pendientes; el contenido y las respuestas de producto del QA fueron locales.

### Reversión

- Vaciar los selectores de video recupera el uso de imágenes. Revertir los cambios de esta entrada retira la capacidad sin migrar datos ni modificar IDs editoriales.

## 2026-10-26 — Controles responsive independientes de la hero

### Añadido

- Objetivo: configurar los cuatro paddings, el alineamiento horizontal, la posición vertical y la altura de la hero de forma independiente en escritorio y móvil.
- Archivos: `sections/hero.liquid`, `snippets/hero-height-style.liquid`, los 20 archivos `locales/*.schema.json`, `docs/theme-architecture.md` y `CHANGELOG.md`.
- Impacto en el editor: los IDs, valores, opciones y presets existentes se conservan. Se añaden paddings laterales de escritorio y el checkbox `custom_mobile_layout` («Personalizar diseño móvil»), desactivado por defecto. Los controles móviles aparecen según la dirección efectiva del contenido, con baseline opcional en filas, cuatro paddings de 0–100 px y las seis alturas nativas. Los valores móviles iniciales son padding 0, alineamiento izquierdo, posición centrada, altura mediana y altura personalizada de 50%.
- Impacto en storefront: la personalización móvil se limita a 749 px; desde 750 px se usa escritorio. Al desactivarla se recupera el comportamiento anterior, incluido el escalado de padding. Se preservan la compensación del header, la selección de medios y los controles compartidos de dirección, ancho y separación. La altura personalizada usa `svh` como mínimo y el contenido largo puede ampliar la sección. La altura automática sin bloques se resuelve por breakpoint y respeta la proporción de la imagen activa. No se modificaron templates ni datos administrados por Shopify.

### Validación

- La comparación del schema confirmó IDs únicos, compatibilidad exacta de todos los settings previos y presets intactos. Los 20 locales JSONC y las claves nuevas validaron correctamente; las condiciones de visibilidad se evaluaron con Liquid para todas las combinaciones de checkbox, dirección y apilado móvil.
- `shopify.cmd theme check --path . --output json` finalizó con cero errores y 30 advertencias: las 29 preexistentes y una nueva `ExcessiveSettingsCount` por los 50 settings de la hero. Se preservan los controles históricos para mantener compatibilidad y se agrupan los nuevos mediante encabezados y condiciones; el cálculo compartido de altura evita una advertencia adicional de complejidad Liquid.
- Chrome local aprobó 108 casos a 390, 749, 750 y 1440 px usando LiquidJS, los snippets y el CSS reales del theme, con adaptadores de prueba para filtros de medios y `content_for`. Se verificaron la comparación con la presentación anterior al desactivar la personalización, los cuatro paddings y su escala, los ejes de fila/columna, las seis alturas, altura automática sin bloques por dispositivo, imágenes móviles de distinta proporción, reemplazo móvil por video, contenido largo, ausencia de overflow horizontal y offsets del header transparente.
- No había storefront ni Theme Editor reales activos: guardado y selección/reordenación en Shopify siguen pendientes. La revisión automática rechazó el validador remoto por la exportación de código privado; se utilizó Shopify CLI local sin transmitir los archivos.

### Reversión

- Desactivar «Personalizar diseño móvil» restaura la herencia anterior. Revertir esta entrada y retirar el snippet de altura y las claves nuevas elimina los controles responsive sin migraciones; los paddings laterales nuevos parten de 0 y no se editaron configuraciones administradas.

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

## 2026-10-25 — Imágenes y controles móviles de Product Hotspots

### Corregido — Recuperación del pulso y fundido de imágenes

- Objetivo: recuperar el halo del último hotspot al cerrar por toque conservando el foco, y suavizar los cambios de imagen en desktop/mobile sin pasar por la principal entre productos.
- Archivos: `assets/product-hotspot.js`, `assets/product-hotspot.css`, `docs/theme-architecture.md` y `CHANGELOG.md`.
- Impacto: la pausa por foco usa `:focus-visible` y el hover se limita al puntero fino; se conservan las pausas por selección/card y el ciclo de 2 segundos. El componente compartido crea dos capas decorativas sin cambiar Liquid ni settings. Mantiene la imagen actual durante carga/decodificación y funde la entrante durante 400 ms sobre la saliente opaca, que se retira al terminar. Las cargas corren en paralelo, los fundidos se serializan y se descartan selecciones pendientes obsoletas. Cierre, error o ausencia de imagen funden hacia la principal conservando las salidas; la limpieza de editor/breakpoint/desmontaje/slideshow continúa inmediata mediante `resetState()`. Movimiento reducido aplica el estado final sin animación y la caché sigue siendo bajo demanda.

### Validación — Pulso y fundidos

- `node --check` y `checkJs` estricto de los tres componentes JavaScript afectados por el trabajo acumulado aprobaron. Theme Check inspeccionó Liquid/schemas/locales sin errores y con las 29 advertencias preexistentes. El validador de la skill Shopify no pudo iniciar por la dependencia ausente `@shopify/theme-check-common`; se utilizó Shopify CLI.
- Chrome local con los assets reales y respuestas de producto de prueba verificó eventos táctiles reales: punto → imagen → X conserva el foco y reactiva el halo; el foco visible de teclado mantiene la pausa. Pasaron los fundidos principal/alternativa, A→B con saliente opaca, selección rápida, carga/fallo/imagen ausente, cierre durante carga/fundido, movimiento reducido, cambio de breakpoint y remontaje sin reactivar imágenes antiguas. También se verificaron la caché de precarga, el cambio a movimiento reducido durante un fundido, el hover real de mouse y la limpieza inmediata de ambos buffers al desactivar el slideshow.
- La regresión local verificó selección punto/grilla, X/Escape/exterior, Quick Buy y retorno de foco, cancelaciones, agotados/fallos, ocultación permanente, eventos simulados del editor, posiciones extremas/textos largos y ausencia de overflow a 320/390/749/750/1440 px. No había storefront ni Theme Editor reales disponibles; su comprobación sigue pendiente.

### Reversión — Pulso y fundidos

- Restaurar el manejo anterior de foco y la única capa hover elimina esta corrección; no hay migraciones ni cambios en templates o datos administrados.

### Modificado — Ocultación y cierre de la vista previa mobile

- Objetivo: ocultar los hotspots durante la selección mobile y permitir restaurar la imagen principal mediante una X junto a `Ver más`, Escape o click fuera del marco de imagen, conservando grilla y modal como controles de la selección.
- Archivos: `assets/product-hotspot.js`, `sections/product-hotspots.liquid`, `snippets/product-hotspot.liquid`, los 31 locales storefront, `docs/theme-architecture.md` y `CHANGELOG.md`.
- Impacto: solo con `mobile_preview_quick_buy` activo y hasta 749 px, los puntos se ocultan y su contenedor queda `inert` desde el comienzo de la selección. Restaurar libera los puntos y respeta la ocultación permanente configurada. La X usa el icono del theme, etiqueta traducida y área mínima de 44 px; acompaña también a `Ver producto` en agotados/fallos. El grupo conserva las coordenadas del centro de `Ver más`, suma 8 px de separación y mantiene ambos controles dentro de los 12 px interiores.
- El cierre exterior se limita al marco, exceptúa los botones de la grilla de esta sección y el modal Quick Buy, y no impide otras acciones ni mueve el foco del elemento pulsado. X/Escape desde los controles devuelven el foco al punto disponible, su botón de grilla o el marco. La selección de bloques en el editor restaura la principal y libera el marcador. El modo anterior y desktop mantienen su interacción; no se añadieron settings ni se editaron templates o datos administrados.

### Validación — Ocultación y cierre mobile

- `node --check` y `checkJs` estricto aprobaron el JavaScript; los schemas, referencias, locales JSONC y la nueva etiqueta en 31 idiomas validaron sin claves duplicadas. Theme Check finalizó sin errores y con las 29 advertencias preexistentes; `git diff --check` limpio. El validador de la skill Shopify no pudo iniciar por la dependencia ausente `@shopify/theme-check-common`; Theme Check cubrió Liquid y schemas.
- Chrome con assets reales y respuestas de producto locales verificó ocultación previa a la carga, exclusión de foco, restauración/foco por X y Escape, clicks interiores/exteriores, huecos de grilla, selección de otro producto, navegación del CTA general y modal real. El cierre durante carga descartó respuestas tardías de imagen y Quick Buy; agotados y fallos conservaron una salida visible. Pasaron también ocultación permanente, fallback de foco al marco, eventos simulados del editor y remontaje sin estados `inert` obsoletos.
- El grupo completo respetó los márgenes en centro y extremos a 320, 390 y 749 px, con texto largo y redimensionado. Las coordenadas siguieron refiriéndose al centro de `Ver más`; a 750/1440 px se conservó el preview desktop y el modo mobile anterior mantuvo su límite previo. No hubo excepciones del navegador. Storefront y Theme Editor reales siguen pendientes por no haber preview activo; la disposición editorial y los productos de prueba fueron locales.

### Reversión — Ocultación y cierre mobile

- Revertir esta entrada restaura los puntos visibles durante la selección, elimina la X y recupera el contenedor interactivo como límite exterior; no hay migración de settings ni IDs.

### Añadido — Hotspots pulsantes y Ver más sobre la imagen

- Objetivo: habilitar opcionalmente hotspots pulsantes y ubicar el CTA móvil `Ver más` sobre la imagen, con coordenadas propias por bloque y apertura del modal Quick Buy existente.
- Archivos: `sections/product-hotspots.liquid`, `blocks/_hotspot-product.liquid`, `snippets/product-hotspot.liquid`, `assets/product-hotspot.css`, `assets/product-hotspot.js`, `assets/am--numbered-slideshow.css`, `locales/*.json`, `docs/theme-architecture.md` y `CHANGELOG.md`.
- Impacto en el editor: el checkbox de sección `animate_hotspots` queda desactivado por defecto y actúa en escritorio/mobile. Cada bloque incorpora `mobile_quick_buy_x` y `mobile_quick_buy_y`, rangos 0–100% con paso 1 y valores iniciales de 50% y 85%; son independientes de la posición del punto y no requieren modificar templates ni datos administrados.
- Impacto en storefront: el modo `mobile_preview_quick_buy` conserva Hover Mobile como primera opción y hover desktop como respaldo. Su panel mantiene el ID y los eventos, pasa al interior del marco y usa el texto traducible `Ver más`, ancho de contenido y transición de opacidad/desplazamiento de 200 ms. Las coordenadas se ajustan al tamaño real del botón para mantener 12 px interiores y se recalculan al redimensionar, cambiar el contenido o mostrar `Ver producto`. La capa permite tocar los puntos fuera del CTA. Se preservan selección, restauración, cancelación de cargas, modal, foco y colores de la grilla.
- El halo de 2 segundos y su keyframe se centralizan en el CSS compartido. Conserva el pulso exclusivo de diapositivas activas del slideshow, se pausa/oculta durante selección, foco, hover real o preview abierta, respeta movimiento reducido y no altera el área interactiva ni anima marcadores vacíos de la sección.

### Validación — Hotspots pulsantes y CTA posicionable

- Schemas de sección/bloque, referencias a settings, defaults/rangos y los 51 locales JSONC validaron claves únicas y traducciones. `node --check assets/product-hotspot.js`, `checkJs` estricto de los tres componentes JavaScript afectados por el trabajo acumulado y `git diff --check` aprobaron.
- Theme Check finalizó con cero errores y las 29 advertencias preexistentes. El validador de la skill Shopify no pudo iniciar por la dependencia ausente `@shopify/theme-check-common`; Theme Check cubrió Liquid y schemas.
- Chrome con los assets reales verificó pulso desactivado/activado en escritorio/mobile, pausa por selección/foco/hover/card, movimiento reducido, tamaño de trigger constante y contrato de slide activo/inactivo. El CTA respetó los márgenes en centro y cuatro extremos a 320, 390 y 749 px, posiciones distintas por bloque, cambio de ancho sin perder selección y texto largo; a 750 y 1440 px se conservó el preview desktop.
- La regresión local del flujo mobile mantuvo selección punto/grilla, Hover Mobile/respaldo desktop, modal real, foco, doble toque, cancelación A→B, fallbacks, puntos ocultos, ausencia de overflow y eventos simulados del editor sin excepciones de navegador. No había storefront ni Theme Editor activos: las respuestas de producto y la disposición editorial fueron maquetas locales.

### Reversión — Hotspots pulsantes y CTA posicionable

- Desactivar `animate_hotspots` retira el pulso de esta sección. Restaurar los cambios de esta entrada devuelve el CTA al exterior del marco y la animación al CSS del slideshow, sin migrar IDs ni datos administrados.

### Añadido — Selección y Quick Buy mobile

- Objetivo: permitir hasta 749 px seleccionar un producto desde su punto o botón de grilla, mostrar su imagen alternativa y revelar un CTA de Quick Buy antes de la grilla, con transición de 200 ms y respeto por movimiento reducido.
- Archivos: `sections/product-hotspots.liquid`, `blocks/_hotspot-product.liquid`, `snippets/product-hotspot.liquid`, `assets/product-hotspot.css`, `assets/product-hotspot.js`, `assets/quick-add.js`, `assets/dialog.js`, `locales/*.json`, `docs/theme-architecture.md` y `CHANGELOG.md`.
- Impacto en el editor: `mobile_preview_quick_buy` activa el nuevo modo por sección; cada hotspot incorpora `use_mobile_position`, coordenadas mobile X/Y de 0–100% con valores iniciales de 50%, y colores opcionales de fondo/texto para su botón de grilla. Ambos checkboxes nuevos quedan desactivados; los colores vacíos mantienen el esquema. No se modificaron templates ni datos administrados por Shopify.
- Impacto en storefront: punto y grilla comparten selección e imagen; un segundo toque, Escape, click exterior, eliminación del bloque o cambio de breakpoint restauran la base y ocultan el CTA. Los puntos ocultos no desactivan la grilla. Sin imagen o ante un error de imagen, el CTA permanece disponible; productos agotados, modal ausente o carga fallida ofrecen un enlace visible al producto. El modal conserva la selección y devuelve el foco al CTA al cerrar. Las coordenadas nuevas también alcanzan al marcador del editor; los colores explícitos se conservan durante hover y selección.
- `QuickAddComponent.cancelOpen()` cancela solo la instancia correspondiente; `open()` espera a la apertura real y el guard opcional de `DialogComponent.showDialog()` evita aperturas obsoletas antes de bloquear el scroll. El modo anterior, los tres modos desktop y el slideshow conservan su contrato.

### Validación — Selección y Quick Buy mobile

- Los schemas de sección y bloque, sus referencias, los 20 locales schema y los 31 locales storefront validaron JSONC, claves únicas y nuevas traducciones/interpolaciones. `node --check` y `checkJs` estricto de `product-hotspot.js`, `quick-add.js` y `dialog.js` aprobaron sin diagnósticos; `git diff --check` limpio.
- `shopify.cmd theme check --path . --output json` finalizó con cero errores y las 29 advertencias preexistentes. El validador de la skill Shopify sigue sin poder iniciar por la dependencia ausente `@shopify/theme-check-common`; Theme Check cubrió Liquid y schemas.
- Chrome verificó los assets reales de hotspots, Quick Add y dialog con respuestas de producto locales: selección punto/grilla, CTA, transición/movimiento reducido, foco, bloqueo de doble toque, modal, falta de imagen/modal, imágenes fallidas y agotados. Las cancelaciones durante fetch/render/frame y el cambio A→B no abrieron productos obsoletos ni bloquearon el scroll; ocho pruebas específicas adicionales cubrieron esas carreras y el contrato declarativo de dialog.
- Las maquetas locales verificaron 320, 390, 749, 750 y 1440 px, colores independientes y persistentes en hover/selección, posiciones mobile de puntos/marcadores, ausencia de overflow, ocultación de puntos y eventos simulados de selección, reordenación, eliminación y remontaje del editor. También aprobaron la regresión de los tres modos desktop y el aislamiento entre contenedores, sin excepciones del navegador.
- No había storefront ni Theme Editor activos para comprobar productos/datos reales y guardado de ajustes en Shopify; el contenido de producto de estas pruebas fue una respuesta local mínima.

### Reversión — Selección y Quick Buy mobile

- Desactivar `mobile_preview_quick_buy` y `use_mobile_position`, y limpiar los colores opcionales, recupera la interacción y coordenadas anteriores. Revertir los cambios de esta entrada elimina la capacidad sin migraciones ni modificaciones de IDs editoriales.

### Añadido

- Objetivo: permitir una imagen móvil para la sección y una alternativa móvil por hotspot, mover título/texto arriba del medio y el CTA general al final, ocultar los puntos en móvil y activar sus imágenes desde botones en una grilla de dos columnas.
- Archivos: `sections/product-hotspots.liquid`, `blocks/_hotspot-product.liquid`, `snippets/product-hotspot.liquid`, `assets/product-hotspot.js`, `locales/*.schema.json`, `docs/theme-architecture.md` y `CHANGELOG.md`.
- Impacto en el editor: los cuatro controles de sección y los tres controles de cada hotspot conservan las instancias previas mediante checkboxes desactivados. Cada botón se habilita en su bloque y admite texto propio, con el título del producto como fallback. Requiere producto accesible e imagen hover o alternativa móvil; no se modificaron templates ni configuración administrada por Shopify.
- Impacto en storefront: hasta 749 px se elige la fuente de `<picture>` y, con altura automática, la proporción móvil. La imagen principal sirve como fallback; una imagen móvil por sí sola también funciona. Los botones se muestran debajo del medio, mantienen el orden de bloques y funcionan con los puntos ocultos. Un toque activa la alternativa móvil, con fallback a la imagen hover; otro toque, Escape, click exterior o cambio de breakpoint restaura la base. El CTA externo queda después de la grilla, y título/texto externos respetan la alineación editorial sin sombra.
- Los botones se renderizan desde el contexto del propio theme block mediante `<template>` y se reúnen en la grilla sin leer settings de bloques desde la sección padre. Reemplazar, eliminar o reordenar bloques actualiza la grilla; el bloque seleccionado en el editor puede mostrar temporalmente su punto aunque esté oculto en móvil. El slideshow conserva sus controles y modos de interacción.

### Validación

- Los schemas de sección/bloque y los 20 locales schema validaron JSON, claves únicas, referencias a settings y traducciones. `node --check assets/product-hotspot.js`, el chequeo estricto `checkJs` del componente y `git diff --check` fueron aprobados.
- `shopify.cmd theme check --path . --output json` finalizó sin errores y con las 29 advertencias preexistentes. El validador de la skill Shopify no pudo iniciar por la dependencia ausente `@shopify/theme-check-common`; Theme Check cubrió Liquid y schemas.
- Una maqueta local en Chrome con los assets reales verificó 320, 390, 749, 750 y 1440 px, las cuatro combinaciones de contenido/CTA externo, grilla con cantidad impar, ausencia de overflow, carga exclusiva de la fuente móvil, estados accesibles, puntos ocultos, alternancia/restauración de imagen, fallos y cargas tardías, hover y previews desktop. Los eventos simulados de selección, reordenación, eliminación y remontaje de bloques actualizaron la grilla sin excepciones del navegador.
- No había storefront ni Theme Editor activos para probar publicación, productos reales o selección/guardado en Shopify; el flujo Quick Buy no recibió cambios y su regresión local se comprobó con un adaptador de prueba.

### Reversión

- Desactivar los checkboxes y quitar las imágenes móviles recupera la disposición anterior desde el editor. Revertir los archivos anteriores retira la capacidad sin migrar IDs, bloques ni datos administrados.

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
