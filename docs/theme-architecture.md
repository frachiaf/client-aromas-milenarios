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

### Quick Add compartido

- `snippets/quick-add.liquid` renderiza el origen del flujo: un `quick-add-component`, el formulario de producto y sus datos de producto, variante y sección. Se puede usar en tarjetas y en bloques de Product Hotspots.
- `assets/quick-add.js` resuelve la URL del producto desde la tarjeta o acepta una URL explícita mediante `open(productUrl)` para Product Hotspots. Después obtiene la página, extrae `[data-product-grid-content]` y lo monta con `morph` en `#quick-add-modal-content`. Su API asíncrona devuelve `opened`, `unavailable`, `failed` o `aborted`; los consumidores deben esperar ese resultado antes de elegir un fallback.
- `snippets/quick-add-modal.liquid` se renderiza una sola vez desde `layout/theme.liquid`. Proporciona los IDs globales `#quick-add-dialog` y `#quick-add-modal-content`, el cierre accesible y el bloqueo de scroll. No debe renderizarse por sección ni duplicarse.
- La preferencia global `settings.quick_add` conserva el control visual de los botones en tarjetas de producto, pero no condiciona la existencia del modal global: Product Hotspots puede usar Quick Add aunque esa preferencia esté desactivada.
- Shopify resuelve un product setting como vacío cuando el recurso no está disponible en Online Store o en el mercado actual, incluso si el handle permanece guardado en el template JSON. Esos hotspots no se renderizan en storefront y conservan únicamente un marcador seleccionable dentro del Theme Editor.
- Un hotspot con modo `click-quick-buy` usa el modal cuando hay un producto accesible y la carga termina correctamente. La card local queda limitada a productos reales agotados, ausencia inesperada del modal o fallos de carga; una solicitud cancelada por una interacción posterior no abre ningún fallback obsoleto.

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
