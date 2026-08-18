# Guía de trabajo para agentes

Este repositorio contiene el theme Shopify de Aromas Milenarios, basado en Pitch 3.5.1. Estas reglas se aplican a cualquier agente, editor o persona que cambie el theme.

## Lectura obligatoria

Antes de investigar, planificar o editar, leer en este orden:

1. Este archivo.
2. [CHANGELOG.md](CHANGELOG.md), para conocer cambios recientes, decisiones y riesgos abiertos.
3. [docs/theme-architecture.md](docs/theme-architecture.md), para entender la arquitectura y los límites del theme.

Si una tarea modifica un área documentada, actualizar el changelog al finalizarla. Si revela una convención arquitectónica nueva o cambia una existente, actualizar también la guía técnica.

## Protocolo de trabajo

1. Definir el comportamiento esperado y la superficie afectada antes de editar.
2. Rastrear el flujo completo: template o section group, sección, bloques, snippets, assets, schema, locales y configuración relacionados.
3. Preferir los componentes y patrones existentes. Crear una sección para módulos de página configurables, un bloque para contenido reusable y anidable, y un snippet para presentación o lógica reutilizable sin entidad propia en el editor.
4. Mantener la personalización en el Theme Editor mediante schemas pequeños, coherentes y con presets cuando el componente deba ser agregable. No duplicar lógica ni añadir CSS global si puede pertenecer al componente.
5. Revisar accesibilidad, comportamiento responsive, rendimiento, textos traducibles y compatibilidad con el editor antes de cerrar el cambio.
6. Validar Liquid y JSON, ejecutar `shopify theme check` cuando esté disponible, y probar el flujo storefront afectado en desktop y mobile. Para cambios de editor, probar además la selección, reordenación y configuración de secciones o bloques.
7. Registrar el cambio finalizado en `CHANGELOG.md` con fecha, objetivo, archivos, impacto y validación.
8. Antes de entregar una tarea cuando el repositorio tenga cambios pendientes, revisar el worktree completo y añadir a la respuesta final un commit message sugerido conforme a la sección "Entrega y commit sugerido".

## Entrega y commit sugerido

- Toda respuesta final de una tarea que modifique archivos debe incluir una sección `Commit sugerido`.
- Usar Conventional Commits con el formato `type(scope): descripción breve en español`. Ejemplo: `fix(hotspots): corregir visualización de la etiqueta de quick buy`.
- Elegir el tipo que represente el cambio real entre `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `style`, `build`, `ci` y `revert`. Usar un scope breve cuando ayude a identificar el componente; omitirlo si el cambio abarca varias áreas sin un scope claro.
- Antes de redactar el mensaje, inspeccionar `git status --short`, `git diff` y `git diff --cached`. Leer también el contenido relevante de archivos untracked, porque Git no los incluye en esos diffs hasta que se agregan al índice.
- Basar el mensaje en todos los cambios pendientes del repositorio: staged, unstaged y untracked, aunque provengan de tareas anteriores. Proponer un único mensaje que sintetice el propósito general del worktree sin enumerar archivos.
- Elegir el tipo y el scope según el cambio dominante. Si los cambios abarcan varias áreas sin un scope común, omitir el scope y redactar una descripción general.
- Sugerir el mensaje no autoriza a ejecutar `git commit`. Solo crear el commit cuando el usuario lo solicite explícitamente.
- Las tareas informativas o que no modifican archivos no requieren commit message sugerido.

## Reglas técnicas

- Mantener el contrato entre código Liquid y schema: cada `settings.<id>` o `block.settings.<id>` debe existir en su schema y los valores de templates JSON deben ser válidos para ese schema.
- Conservar `block.shopify_attributes` en el elemento raíz de bloques que el editor deba identificar, seleccionar o reordenar.
- Usar `{% render %}` con parámetros explícitos; su scope es aislado. Documentar snippets nuevos con LiquidDoc.
- Mantener estilos y JavaScript próximos al componente con `{% stylesheet %}` y `{% javascript %}` cuando aplique. Reutilizar los módulos e import maps definidos por `snippets/scripts.liquid`.
- Todo texto nuevo visible al cliente debe usar traducciones de `locales/`; no introducir cadenas fijas salvo que el componente reciba contenido administrable desde el editor.
- Preservar los límites de Shopify: templates y section groups JSON de hasta 25 secciones; hasta 50 bloques por sección; y hasta 8 niveles de anidación de theme blocks.

## Archivos administrados y seguridad

- `config/settings_data.json`, `config/markets.json`, `templates/*.json` y `sections/*-group.json` pueden ser actualizados por Shopify desde el Theme Editor. No editarlos por rutina ni reformatearlos masivamente.
- Si una tarea exige modificar esos JSON, conservar IDs, `order`, `block_order`, valores administrados y cualquier `custom_css` existente; validar el JSON y explicar el impacto en el changelog.
- No añadir, cambiar ni borrar secretos, tokens, datos de clientes, costos, URLs privadas ni contenido comercial sensible en código o documentación.
- No sobrescribir cambios no relacionados. Revisar `git status` antes y después de cada trabajo.

## Formato de changelog

Cada entrada nueva va bajo `Unreleased` mientras está en curso o bajo una fecha al finalizar. Debe indicar: objetivo, archivos afectados, comportamiento o impacto para el editor/storefront, validación y una nota de reversión cuando sea necesaria.
