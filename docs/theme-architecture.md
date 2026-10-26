# Arquitectura del theme

## Contexto

Este repositorio contiene **Pitch 3.5.1** de Shopify. Es un theme Online Store 2.0 con templates JSON, section groups y theme blocks anidables. El código define capacidades y presentación; el Theme Editor conserva gran parte del contenido y la disposición como datos JSON.

## Flujo de render

```text
layout/theme.liquid
├─ sections/header-group.json → header-announcements, header
├─ content_for_layout
│  └─ templates/*.json → sections/*.liquid → blocks/*.liquid → snippets/*.liquid + assets/*
├─ sections/footer-group.json → footer, footer-utilities
└─ search / quick-add compartidos
```

- `layout/theme.liquid` contiene el documento HTML global, carga meta tags, estilos, fuentes, scripts, variables y esquemas de color. También renderiza header, footer, buscador y quick add.
- Cada `templates/*.json` asigna las secciones de una página y su orden. Las variantes como `product.velas.json` y `page.contact.json` representan templates alternativos.
- `sections/header-group.json` y `sections/footer-group.json` son los section groups globales; `layout/theme.liquid` los carga con `{% sections %}`.
- Los assets globales entran desde `snippets/stylesheets.liquid` y `snippets/scripts.liquid`; este último define los import maps de módulos JavaScript del theme.

## Capas y responsabilidades

| Capa | Responsabilidad | Regla de uso |
| --- | --- | --- |
| `layout/` | Estructura HTML y elementos globales. | Cambiar solo para comportamiento realmente global. |
| `templates/` | Instancias, orden y ajustes de secciones por tipo de página. | Conservar IDs, `order` y `block_order`. |
| `sections/` | Módulos de página configurables por el merchant. | Añadir schema y preset si debe agregarse desde el editor. |
| `blocks/` | Componentes reutilizables y anidables dentro de secciones/bloques. | Usar para contenido compuesto o configurable. |
| `snippets/` | Fragmentos de presentación o lógica reusable. | Renderizar con parámetros explícitos y LiquidDoc. |
| `assets/` | CSS, JavaScript, iconos y recursos estáticos. | Reutilizar módulos antes de crear uno nuevo. |
| `config/` | Schema global y valores guardados del theme. | Tratar los valores guardados como datos administrados. |
| `locales/` | Traducciones del storefront y schemas. | Añadir claves para texto visible nuevo. |

## Patrones propios de Pitch

### Secciones y bloques genéricos

- `sections/section.liquid` y `sections/_blocks.liquid` capturan `{% content_for 'blocks' %}` y delegan el contenedor visual a `snippets/section.liquid`.
- `blocks/group.liquid` repite el patrón: captura bloques hijos y los entrega a `snippets/group.liquid`. Esto permite componer layouts anidados con `group`, `text`, `image`, `button` y otros bloques existentes.
- Las secciones especializadas, como producto, colección, hero o header, pueden renderizar bloques estáticos mediante `{% content_for 'block' %}` y bloques configurables mediante `{% content_for 'blocks' %}`.
- Los bloques estáticos y snippets nuevos deben declarar su contrato mediante LiquidDoc. Los bloques que participan del editor deben conservar sus atributos Shopify en el wrapper correspondiente.

### Schemas y personalización

- El schema de una sección o bloque es su API pública para el Theme Editor. Primero definir el comportamiento, luego exponer únicamente settings necesarios, con defaults seguros y `visible_if` cuando corresponda.
- Incluir un `preset` en secciones y bloques que deban poder agregarse desde el editor. Sin preset, la instancia debe introducirse de forma explícita en el JSON y no será removible desde el editor.
- Un setting global pertenece a `config/settings_schema.json`; uno de contexto pertenece al schema de la sección o bloque. No usar settings globales para resolver un caso exclusivo de un componente.
- CSS y JS del componente deben coexistir con él mediante etiquetas Liquid cuando sea posible. En CSS/JS dentro de esas etiquetas no se evalúa Liquid; pasar valores mediante variables CSS, atributos o clases.

### Hero responsive

- `sections/hero.liquid` conserva los IDs históricos de escritorio y permite personalizar padding, alineamiento, posición y altura hasta 749 px mediante `custom_mobile_layout`, desactivado por defecto. Sin activarlo, móvil conserva los ajustes heredados y el comportamiento responsive anterior. El selector de medios móviles sigue siendo independiente.
- Los cuatro paddings usan propiedades lógicas y el escalado nativo de `spacing-style`: valores mayores a 20 px respetan `--spacing-scale`, con un mínimo de 20 px. Ancho, dirección y separación conservan sus controles compartidos; el layout móvil resuelve sus ejes según `content_direction` y `vertical_on_mobile`, con alineación de baseline opcional solo para filas.
- `snippets/hero-height-style.liquid` recibe `device`, `height` y `custom_height` explícitamente y genera la variable de altura mínima de cada viewport. La altura personalizada usa `svh`; el contenido puede ampliar la sección y se conserva la compensación del header. Las clases de altura automática sin bloques se aplican únicamente en su breakpoint para mantener la proporción del medio activo.

### Quick Add compartido

- `snippets/quick-add.liquid` renderiza el origen del flujo: un `quick-add-component`, el formulario de producto y sus datos de producto, variante y sección. Se puede usar en tarjetas y en hotspots; el parámetro opcional `instance_id` debe enviarse cuando un mismo bloque renderiza varios formularios para mantener IDs únicos.
- `AM Presentación numerada` usa un formulario de producto específico para mantener un único CTA con el mismo layout que sus enlaces normales. Agrega directamente productos de variante única y entrega una URL explícita a Quick Add cuando el producto requiere elegir opciones.
- `assets/quick-add.js` resuelve la URL del producto desde la tarjeta, desde `data-product-url` en el propio componente o mediante `open(productUrl)` para Product Hotspots. Después obtiene la página, extrae `[data-product-grid-content]` y lo monta con `morph` en `#quick-add-modal-content`. Su API asíncrona devuelve `opened`, `unavailable`, `failed` o `aborted`; los consumidores deben esperar ese resultado antes de elegir un fallback.
- `QuickAddComponent.cancelOpen()` invalida y aborta únicamente la apertura pendiente de su instancia, sin cerrar un modal ya abierto. `open()` confirma `opened` después de `dialog:open`; el guard opcional de `DialogComponent.showDialog(shouldOpen)` se evalúa dentro del frame y antes del bloqueo de scroll para impedir aperturas canceladas. Los eventos declarativos de `showDialog` conservan su contrato anterior.
- `snippets/quick-add-modal.liquid` se renderiza una sola vez desde `layout/theme.liquid`. Proporciona los IDs globales `#quick-add-dialog` y `#quick-add-modal-content`, el cierre accesible y el bloqueo de scroll. No debe renderizarse por sección ni duplicarse.
- La preferencia global `settings.quick_add` conserva el control visual de los botones en tarjetas de producto, pero no condiciona la existencia del modal global: Product Hotspots puede usar Quick Add aunque esa preferencia esté desactivada.
- Shopify resuelve un product setting como vacío cuando el recurso no está disponible en Online Store o en el mercado actual, incluso si el handle permanece guardado en el template JSON. Esos hotspots no se renderizan en storefront y conservan únicamente un marcador seleccionable dentro del Theme Editor.
- Un hotspot con modo `click-quick-buy` usa el modal cuando hay un producto accesible y la carga termina correctamente. La card local queda limitada a productos reales agotados, ausencia inesperada del modal o fallos de carga; una solicitud cancelada por una interacción posterior no abre ningún fallback obsoleto.
- Los modos desktop de Product Hotspots son excluyentes: `hover-preview-click-quick-buy` abre la card por hover o foco y reserva el click para Quick Add; `click-preview` alterna la card únicamente por click; `click-quick-buy` abre Quick Add y usa la card solo como fallback. Abrir una card cierra cualquier otra de la misma sección, y Escape, click exterior o salida del foco cierran la card activa.
- El hover de la imagen alternativa es independiente del modo de interacción y solo se activa en desktop con puntero fino; los botones móviles usan el mismo motor. `ProductHotspots` conserva la imagen base y crea un segundo buffer decorativo al montar, a partir de la capa hover existente. Precarga/decodifica bajo demanda con caché por URL y mantiene visible la imagen actual hasta que la nueva esté lista. Los fundidos de 400 ms usan Web Animations: la entrante cubre a la saliente opaca, que se retira al finalizar, sin destellos de la principal entre productos. Las cargas son paralelas, los fundidos se serializan y solo la última selección pendiente puede mostrarse; tokens independientes invalidan solicitudes y animaciones obsoletas. El cierre de usuario y los errores/ausencias de imagen funden hacia la base sin retirar los controles de salida. `resetState()` mantiene la limpieza inmediata de editor, breakpoint, desmontaje y slideshow; la opción aditiva `{ animateImage: true }` permite el cierre animado. Movimiento reducido aplica el estado final sin animación y finaliza un fundido en curso.
- `snippets/product-hotspot.liquid`, `assets/product-hotspot.css` y `assets/product-hotspot.js` forman el componente compartido por `Product Hotspots` y `AM Presentación numerada`. El snippet recibe producto, ID, posición, overrides editoriales y configuración visual de forma explícita; el slideshow crea un contenedor independiente por diapositiva y reinicia su card e imagen alternativa al desactivarla.
- En `Product Hotspots`, el contenedor interactivo incluye un marco de imagen y una grilla móvil externa. La imagen base usa `<picture>` hasta 749 px y, en altura automática, adopta la proporción de la imagen móvil. Título/texto y CTA general pueden salir del marco mediante controles independientes; el CTA general externo queda después de la grilla. Ocultar los puntos en móvil no desactiva sus botones de imagen.
- Los settings de theme blocks se leen dentro del propio bloque, no desde `section.blocks` en el padre. Cada hotspot habilitado proporciona un `<template>` con su botón móvil al snippet compartido; `ProductHotspots` reúne esos botones en orden y observa reemplazos o reordenaciones de bloques. El modo anterior requiere producto accesible e imagen alternativa; la imagen móvil cae a la imagen hover y el texto al título del producto. Toque repetido, Escape, click exterior o cambio de breakpoint restauran la base y sincronizan `aria-pressed`. El hotspot seleccionado desde el editor permanece visible temporalmente aunque se oculten los puntos en móvil.
- El checkbox de sección `mobile_preview_quick_buy`, desactivado por defecto, unifica hasta 749 px la selección desde punto y grilla. La imagen alternativa prioriza Hover Mobile y conserva el hover de escritorio como respaldo. La vista previa oculta todos los puntos y vuelve `inert` su contenedor desde la selección; al restaurar respeta el setting permanente de ocultación. Un `<template>` por producto entrega el CTA `Ver más` y una X dentro del marco, con opacidad/desplazamiento de 200 ms, respeto por movimiento reducido y estado `inert` al ocultarse. Sin imagen o ante error de carga se conserva la base y los controles siguen disponibles; agotados o fallos de Quick Buy ofrecen el enlace real del producto junto a la misma X. `ProductHotspotComponent.openMobileQuickBuy()` abre el modal sin volver a seleccionar el hotspot. Cambiar/restaurar selección cancela aperturas pendientes, las pulsaciones durante carga se bloquean y la interacción con el modal conserva la selección; al cerrarse devuelve el foco al CTA.
- La X y Escape desde los controles restauran la principal y devuelven el foco al punto, su botón de grilla o el marco, según disponibilidad. El cierre exterior del modo nuevo usa el marco de imagen como límite y conserva el foco del elemento pulsado; los botones de la propia grilla y el modal son excepciones para mantener la selección. Los espacios de la grilla y el CTA general cuentan como exterior sin impedir sus acciones. Seleccionar un bloque desde el editor restaura la principal y libera su marcador para configurarlo. El modo mobile anterior conserva el contenedor interactivo como límite.
- `mobile_quick_buy_x` y `mobile_quick_buy_y` definen por bloque el centro de `Ver más` en porcentajes, con valores iniciales de 50% y 85%. Son independientes de las coordenadas del punto. El contenedor mide el grupo completo, incluida la X de al menos 44 px y su separación de 8 px, y limita sus coordenadas para reservar 12 px interiores; observa el marco y el contenido para recalcular al redimensionar, cambiar de producto o mostrar el fallback. La capa del CTA no intercepta pulsaciones fuera de sus controles.
- `animate_hotspots`, desactivado por defecto en `Product Hotspots`, habilita el halo respirante compartido de 2 segundos. La animación vive en `product-hotspot.css`, conserva el contrato de diapositiva activa del slideshow y no cambia el tamaño interactivo del punto. Se pausa/oculta durante selección, foco visible de teclado, hover real de puntero fino o card abierta; el foco restituido después de un toque conserva el pulso y el hover persistente táctil no lo pausa; se desactiva con movimiento reducido y no anima marcadores vacíos de la sección.
- Cada bloque puede activar coordenadas móviles X/Y independientes y configurar fondo/texto de su botón de grilla. Los colores vacíos heredan el esquema, los explícitos usan las variables nativas del botón incluso durante hover/selección y las posiciones nuevas también se aplican a los marcadores vacíos del editor. Los parámetros del snippet son opcionales para conservar los consumidores del slideshow.
- En `AM Presentación numerada`, cada bloque de slide reserva tres grupos fijos de settings porque los bloques de sección no admiten hotspots anidados. Cada grupo se activa por checkbox, requiere un producto accesible para aparecer en storefront y puede reemplazar solo el título y enlace de la card; Quick Buy conserva siempre la URL real del producto.

## Datos administrados por Shopify

Los siguientes archivos pueden cambiar desde el Theme Editor o sistemas relacionados y requieren especial cuidado:

- `config/settings_data.json`: valores guardados para `settings_schema.json`.
- `config/markets.json`: herencia y personalizaciones por mercado.
- `templates/*.json`: configuración de secciones y bloques de cada template.
- `sections/*-group.json`: configuración de header y footer.

Antes de cambiar estos archivos, identificar si la modificación es código o contenido. Para una modificación intencional, mantener IDs estables, el orden de secciones y bloques, ajustes no relacionados, contenido existente y `custom_css`. No añadir ni editar `custom_css` administrado por Shopify. Nunca hacer reformateos masivos que oculten cambios funcionales.

## Receta de decisión

1. **¿Cambia toda la tienda?** Usar `layout/`, un asset global o configuración global solo si afecta de verdad a múltiples templates.
2. **¿Es un módulo de página configurable?** Crear o extender una sección y conectar su schema a un template JSON.
3. **¿Es contenido reusable dentro de una sección?** Crear o extender un theme block, permitiendo anidación solo cuando aporte valor editorial.
4. **¿Es lógica o markup reutilizable sin presencia propia en el editor?** Crear un snippet con parámetros explícitos.
5. **¿Es solo una instancia editorial?** Configurar el Theme Editor o el JSON existente sin modificar Liquid, salvo que falte una capacidad real.

## Lista de verificación antes de cerrar

- Confirmar template/section group, sección, bloque, snippet, assets, schema y locale afectados.
- Validar JSON si se modificó, y ejecutar `shopify theme check` cuando esté disponible.
- Probar en Theme Editor selección, configuración, preview y reordenamiento si hay secciones o bloques.
- Probar el flujo storefront afectado en desktop y mobile; revisar teclado, foco, semántica, contraste y carga.
- Registrar en [CHANGELOG.md](../CHANGELOG.md) objetivo, archivos, impacto, validación y reversión.

## Referencias oficiales

- [Arquitectura de themes](https://shopify.dev/docs/storefronts/themes/architecture)
- [JSON templates](https://shopify.dev/docs/storefronts/themes/architecture/templates/json-templates)
- [Sections](https://shopify.dev/docs/storefronts/themes/architecture/sections)
- [Config](https://shopify.dev/docs/storefronts/themes/architecture/config)
- [Theme limits](https://shopify.dev/docs/storefronts/themes/architecture/limits)
