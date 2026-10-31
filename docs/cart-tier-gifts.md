# Regalos automáticos por nivel

Los ajustes están en **Personalizar tema → Ajustes del tema → Beneficios del carrito**. Cada nivel conserva su activación, umbral, etiqueta y mensajes, y añade **Producto de regalo (opcional)**. Sin producto, el nivel sigue comunicando un beneficio y no crea promociones de envío ni descuentos.

## Preparar un producto

1. Crear en Shopify un producto dedicado al regalo, distinto de los productos de envoltorio y nota personalizada.
2. Conservar una sola variante, con precio de venta cero. Las reglas de cantidad deben permitir una unidad. No asignar un plan de suscripción.
3. Configurar el inventario y la política de venta según la disponibilidad real. Si el producto se agota, el cliente puede continuar comprando sin ese regalo.
4. Publicarlo únicamente en el canal **Online Store** y establecer su estado como **Unlisted**. El theme no cambia precios, inventario, estados ni publicaciones de productos.
5. Elegirlo en el picker del nivel correspondiente, activar la barra y el nivel, y guardar. Los umbrales activos deben ser positivos y crecientes y tener una etiqueta.
6. Comprobar el regalo en drawer y página antes de habilitar la configuración en producción. Repetir las comprobaciones de checkout al pasar de Development a Basic.

Shopify permite seleccionar Unlisted en los product pickers del theme y previsualizar estos productos en templates de producto. Véase la [confirmación de Shopify](https://community.shopify.dev/t/unlisted-products-arent-selectable-in-product-type-settings/26911/10).

## Personalizar etiquetas y precios

En **Beneficios del carrito**, cada nivel ofrece **Etiqueta del regalo en el carrito**. Es independiente de la etiqueta del hito de la barra. Un mismo producto asignado a varios niveles puede mostrar textos distintos porque cada línea conserva su marca de nivel. Dejar el texto vacío usa «Regalo» traducido.

**Texto de gratuidad de los regalos** es compartido por todos los niveles. Vacío usa «GRATIS» traducido. Los textos se muestran como texto plano, incluidos caracteres como `<`, `>` y `&`.

Por defecto, debajo del nombre se muestra el precio unitario actual tachado, seguido del texto de gratuidad; la columna de total conserva su importe. El precio tachado es el actual del regalo, cero, aunque el producto tenga precio de comparación.

Activar **Reemplazar los precios de regalos por el texto de gratuidad** oculta por completo la fila del precio unitario y muestra el texto únicamente en el total de la derecha. El checkbox empieza desactivado. Ambas presentaciones se aplican al drawer y a la página de carrito y conservan los importes reales y el cálculo de los niveles.

## Qué recibe el cliente

- Una unidad por cada nivel alcanzado, de forma acumulativa. Repetir un producto en dos niveles crea dos líneas independientes, cada una con cantidad uno.
- El importe es el total con descuentos del carrito, incluidos envoltorio y nota pagos y sin envío. La barra y los regalos solo funcionan en la moneda de la tienda.
- El regalo se retira si se pierde su umbral, se desactiva la barra o el nivel, cambia su producto o deja de cumplir la configuración. Retirar el último producto normal elimina también regalos y servicios.
- Las líneas de regalo muestran su identificación, precio y cantidad, sin enlaces, papelera ni selector. Los formularios de compra del producto reservado se omiten en todos los templates, Quick Buy y otras superficies compartidas.
- Un producto permanece reservado mientras esté seleccionado en cualquier picker, incluso con el nivel desactivado. Para volver a venderlo normalmente, retirarlo de todos los pickers y revisar su precio y publicación en Shopify.
- Un producto agotado, con varias variantes, pago o incompatible no se sustituye automáticamente por otro producto. El editor muestra ayuda para configuraciones incompatibles; una alta rechazada o una comprobación de producto fallida informa al cliente sin bloquear la compra normal. Un estado de carrito sin verificar mantiene el bloqueo de checkout hasta poder reconciliarlo.

## Marcas y alcance de la protección

La propiedad privada `_am_tier_gift` guarda `1`, `2` o `3` y distingue cada línea. El theme también reconoce los productos por los IDs seleccionados, corrige cantidades y limpia copias sin marca o duplicadas. La propiedad no es una credencial ni demuestra autorización; Shopify oculta las propiedades privadas en checkout y las conserva en el pedido del administrador. [Referencia del carrito Ajax](https://shopify.dev/docs/api/ajax/reference/cart#private-line-item-properties).

El bloqueo en Liquid depende del producto, no del nombre de template: `?view=...` no recupera sus acciones de compra. La URL directa puede mostrar una ficha informativa. Unlisted oculta el producto de las superficies de descubrimiento, pero no es un control de acceso. [Productos Unlisted](https://shopify.dev/docs/apps/build/product-merchandising/unlisted-products).

Antes del botón Pagar del carrito, el theme consulta y reconcilia el estado. La compra acelerada que salta el carrito, una solicitud directa a la API, otra pestaña o JavaScript desactivado pueden eludir esta gestión. No existe una garantía contra pedidos manipulados usando solo un theme. Para imponer cantidades y umbrales dentro de checkout se requiere [Cart and Checkout Validation](https://shopify.dev/docs/apps/build/checkout/cart-checkout-validation). En Basic, las Functions deben llegar mediante una app pública compatible; las apps personalizadas con Functions requieren Plus. [Disponibilidad de Functions](https://shopify.dev/docs/apps/build/functions).

El checkout estándar de Basic no incluye el bloque de edición de líneas que permite añadir selectores de cantidad. Ese bloque requiere Plus; el theme no modifica el checkout. [Edición de líneas](https://help.shopify.com/en/manual/checkout-settings/checkout-blocks/blocks/create-block/line-item-edit).

## Verificación y reversión

Las pruebas locales son `node tests/am-tier-gifts.test.mjs` y `node tests/am-commerce.test.mjs`. Para ejecutar solo los escenarios nuevos del navegador, definir `AM_QA_TIERS_ONLY=1` antes del segundo comando. Usan productos y respuestas de tienda de prueba, sin crear pedidos ni editar productos reales.

En la tienda, comprobar pickers Unlisted, inventario, importes justo antes y después de cada umbral, acumulación, descuentos, servicios, cambio de cantidad de productos normales y eliminación del último producto. Revisar ambos carritos en móvil y escritorio y la llegada a checkout. Probar el acceso directo y los templates alternativos del regalo: deben conservar información sin acciones de compra.

Desactivar la barra o los niveles detiene la entrega y retira las líneas administradas cuando el cliente vuelve al theme. Vaciar los tres pickers libera la reserva de los productos. Si se retira el código, las líneas que ya existen en carritos de Shopify conservan sus propiedades y dejan de reconciliarse; desactivar y limpiar antes de desplegar esa reversión.
