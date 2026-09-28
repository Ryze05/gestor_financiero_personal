# Finanzas Personales

## 1. Objetivo

Aplicacion web para registrar y consultar ingresos y gastos personales. El sistema debe ayudar a conocer el balance mensual, detectar en que categorias se gasta mas y controlar limites de presupuesto.

La primera version esta pensada para una persona y se ejecutara en un entorno local de desarrollo.

## 1.1. Objetivo del MVP para el miercoles

El objetivo es entregar una aplicacion web funcional y demostrar un flujo de automatizacion de principio a fin. El frontend no sera una pantalla de demostracion: permitira consultar y gestionar los gastos principales sin depender de OpenClaw.

El flujo de automatizacion sera una capacidad adicional y prioritaria:

1. Una persona proporciona a OpenClaw los datos o una imagen de un ticket.
2. OpenClaw interpreta el ticket con un modelo de IA.
3. OpenClaw presenta los datos extraidos para que la persona los confirme.
4. OpenClaw llama a la API REST para registrar el gasto.
5. OpenClaw puede consultar la API para listar gastos y obtener un resumen.
6. La interfaz web refleja inmediatamente los datos guardados.

El backend y sus endpoints son la fuente de verdad. OpenClaw no escribira directamente en PostgreSQL.

## 1.2. Niveles de reconocimiento de tickets

El reconocimiento de tickets se divide en tres niveles de detalle. El MVP cubre el Nivel 1 y apunta al Nivel 2; el Nivel 3 queda para despues.

### Nivel 1. Un ticket = un movimiento

- El ticket completo se registra como un unico movimiento con una categoria.
- No se guardan productos ni lineas.
- No requiere cambios en el modelo de datos.

### Nivel 2. Un ticket = varios movimientos por categoria

- OpenClaw agrupa las lineas del ticket por categoria.
- Cada grupo de categoria genera un movimiento.
- Los movimientos de un mismo ticket se agrupan mediante una entidad `Receipt` y un `receiptId`.
- No se guardan productos individuales.

### Nivel 3. Un ticket = lineas de producto

- Se guardan los productos con su importe y categoria.
- Requiere entidad `Receipt` y entidad `LineItem`.
- Responde preguntas como "cuanto he gastado en pan este mes".
- Queda fuera del MVP.

## 1.3. Plan de entrega por rebanadas

El trabajo se organiza en rebanadas verticales: cada una entrega algo que funciona de punta a punta a traves del backend, el frontend y OpenClaw cuando corresponde.

1. **Rebanada 1. Nucleo backend.** Modulos `accounts`, `categories` y `transactions`, DTOs con `class-validator`, TDD y endpoints bajo `/api/v1`.
2. **Rebanada 2. Frontend funcional (Nivel 1).** Dashboard, listado, alta manual, edicion y filtros.
3. **Rebanada 3. OpenClaw (Nivel 1).** Skill que lee un ticket, propone datos, pide confirmacion y crea el movimiento.
4. **Rebanada 4. Extras financieros (fase final).** Conversion EUR/USD, completar la edicion de transferencias, filtros avanzados por `source` y `accountAmount` (el de cuenta ya esta implementado), incluir los nombres de cuenta y categoria en la respuesta de movimientos, y estados de carga (skeletons) en los listados para evitar parpadeos al restaurar la preferencia de cuenta. Las transferencias basicas ya estan implementadas en backend y frontend (listado, alta y borrado).
5. **Rebanada 5. Nivel 2 (si el tiempo lo permite).** Entidad `Receipt` para agrupar por categoria.
6. **Post-MVP. Nivel 3.** Lineas de producto.

Objetivo: tener el Nivel 2 como minimo antes del miercoles y el Nivel 3 si es posible.

## 2. Alcance del MVP

El MVP incluira:

- Gestion de movimientos economicos.
- Transferencias entre cuentas sin contabilizarlas como ingresos o gastos.
- Categorias predefinidas para gastos.
- Una cuenta inicial por defecto mediante seed y posibilidad de crear varias cuentas.
- Interfaz web funcional para crear, consultar, editar y eliminar gastos.
- Listado de gastos con filtros por fecha, categoria y texto.
- Resumen basico de gastos por periodo.
- Dashboard web con tarjetas resumen y grafico por categoria.
- Gestion web de categorias basica: crear, editar y archivar.
- Gestion web basica de cuentas: crear, editar y archivar.
- Endpoints preparados para ser utilizados por OpenClaw.
- Skill o instrucciones de OpenClaw con el contrato de la API.
- Flujo de reconocimiento de tickets supervisado por la persona (Nivel 1, con tendencia a Nivel 2).
- Agrupacion de movimientos de un mismo ticket mediante `Receipt` (Nivel 2, ampliacion).
- Validacion de datos tanto en cliente como en servidor.
- API REST documentada.
- Persistencia en PostgreSQL.
- Datos iniciales para poder probar la aplicacion.

## 3. Fuera del MVP

No se implementara inicialmente:

- Integracion automatica con bancos.
- Importacion de extractos bancarios.
- Pagos o transferencias reales.
- Multiusuario o registro publico.
- Aplicacion movil nativa.
- Notificaciones por correo o push.
- Reconocimiento de tickets sin confirmacion humana.
- Conversiones entre EUR y USD distintas de la conversion necesaria al registrar un movimiento.
- Presupuestos por categoria y mes.
- Gestion completa de cuentas y tarjetas.
- Almacenamiento de lineas de producto del ticket (Nivel 3).
- Almacenamiento de imagenes de tickets.

## 4. Conceptos principales

### 4.1 Movimiento

Un movimiento representa una entrada o salida de dinero.

Campos funcionales:

- Tipo: `INGRESO` o `GASTO`.
- Importe positivo.
- Concepto obligatorio.
- Fecha del movimiento.
- Categoria.
- Cuenta o medio de pago.
- Notas opcionales.

Un gasto reduce el balance y un ingreso lo aumenta.

### 4.2 Categoria

Una categoria agrupa movimientos relacionados. Ejemplos: vivienda, alimentacion, transporte, ocio, salud y salario.

Campos funcionales:

- Nombre obligatorio y unico.
- Tipo permitido: categorias para ingresos, gastos o ambas.
- Color opcional para representacion visual.
- Estado activo o archivado.

No se deben eliminar categorias que tengan movimientos asociados. Se archivaran para que dejen de aparecer como opcion en nuevos movimientos, conservando el historial.

### 4.3 Cuenta

Una cuenta representa el lugar o medio donde se registra el dinero. Ejemplos: efectivo, cuenta bancaria o tarjeta.

Campos funcionales:

- Nombre obligatorio y unico.
- Saldo inicial.
- Estado activo o archivado.

El saldo actual se calculara a partir del saldo inicial y de sus movimientos. No se permitira borrar una cuenta con movimientos asociados.

### 4.4 Presupuesto

Un presupuesto establece el limite de gasto de una categoria durante un mes.

Campos funcionales:

- Categoria.
- Mes.
- Importe limite.

Solo puede existir un presupuesto por categoria y mes. El sistema mostrara el importe gastado, el importe restante y si se ha superado el limite.

## 5. Casos de uso

### CU-01. Registrar un gasto

1. La persona abre el formulario de nuevo movimiento.
2. Selecciona el tipo `GASTO`.
3. Introduce importe, concepto, fecha, categoria y cuenta.
4. El sistema valida los datos.
5. El sistema guarda el movimiento.
6. El dashboard y los saldos se actualizan.

### CU-02. Registrar un ingreso

El flujo es equivalente al de un gasto, usando el tipo `INGRESO`. El movimiento incrementa el balance y el saldo de la cuenta seleccionada.

### CU-03. Consultar movimientos

La persona puede consultar una lista paginada y ordenada por fecha descendente. Puede filtrar por:

- Fecha inicial y final.
- Tipo.
- Categoria.
- Cuenta.

### CU-04. Editar un movimiento

La persona puede modificar los datos de un movimiento existente. El sistema debe recalcular los resumenes y saldos afectados.

### CU-05. Eliminar un movimiento

La persona puede eliminar un movimiento despues de una confirmacion explicita. Los resumenes y saldos se recalculan.

### CU-06. Consultar el dashboard

El dashboard mostrara para el periodo seleccionado:

- Ingresos totales.
- Gastos totales.
- Balance.
- Numero de movimientos.
- Gasto agrupado por categoria.
- Evolucion de ingresos y gastos por dia o mes, segun el periodo.
- Estado de los presupuestos.

El periodo por defecto sera el mes actual.

### CU-07. Gestionar categorias y cuentas

La persona puede crear, consultar, editar y archivar categorias y cuentas. Los elementos archivados se mantienen disponibles para consultar el historial.

### CU-08. Gestionar presupuestos

La persona puede crear, editar y eliminar el presupuesto de una categoria para un mes concreto. El sistema impedira duplicar la misma categoria y mes.

## 5.1. Flujo principal con OpenClaw

OpenClaw sera un cliente de la API, no una capa de persistencia adicional.

### Registrar un gasto desde un ticket

1. La persona entrega a OpenClaw una imagen del ticket o el texto de la compra.
2. OpenClaw extrae tienda, fecha, importe total, moneda y una categoria propuesta.
3. OpenClaw consulta las categorias disponibles mediante la API si necesita clasificar el gasto.
4. OpenClaw muestra un resumen normalizado y solicita confirmacion explicita.
5. Tras la confirmacion, OpenClaw envia `POST /api/v1/transactions`.
6. OpenClaw comprueba la respuesta de la API y comunica el identificador del movimiento.
7. Si la respuesta se pierde, OpenClaw consulta los movimientos antes de volver a crear el gasto.

El MVP no guardara necesariamente la imagen del ticket. Podra guardar el texto extraido y una referencia opcional, pero no se subiran imagenes al backend hasta definir un sistema de almacenamiento.

### Consultar gastos desde OpenClaw

OpenClaw podra responder preguntas utilizando consultas a la API, por ejemplo:

- "Lista mis gastos de esta semana."
- "Cuanto he gastado este mes?"
- "Cuanto he gastado en alimentacion?"
- "Cuales son mis ultimos cinco gastos?"

Para estas respuestas, OpenClaw debera consultar los endpoints y no inventar datos ni calcular sobre informacion que no haya recibido de la API.

### Seguridad del flujo

- Registrar un gasto siempre requiere confirmacion explicita de la persona.
- Las operaciones de lectura pueden ejecutarse sin confirmacion.
- OpenClaw debe recibir errores claros y no afirmar que un gasto se guardo si la API no lo confirma.
- El backend debe validar todos los datos aunque procedan de OpenClaw.

## 6. Reglas de negocio

- Todos los importes deben ser mayores que cero.
- Los importes se almacenaran con precision de dos decimales.
- Las fechas deben ser validas y representaran el dia del movimiento.
- Un gasto solo puede usar una categoria compatible con gastos.
- Un ingreso solo puede usar una categoria compatible con ingresos.
- Solo se podran seleccionar categorias y cuentas activas al crear o editar movimientos.
- La categoria y la cuenta de un movimiento son obligatorias.
- El balance sera `ingresos - gastos`.
- El saldo de una cuenta sera `saldo inicial + ingresos - gastos` de esa cuenta.
- Un presupuesto se considera superado cuando el gasto acumulado es mayor que su limite.
- El borrado de movimientos requiere confirmacion en la interfaz.
- Las operaciones invalidas no deben modificar la base de datos.
- Las fechas y horas se trataran de forma consistente para evitar cambios de dia por zona horaria.

## 7. Validaciones minimas

### Movimiento

- Tipo valido.
- Importe numerico mayor que cero.
- Concepto entre 1 y 150 caracteres.
- Fecha obligatoria y valida.
- Categoria existente, compatible y activa.
- Cuenta existente y activa.
- Notas de un maximo de 500 caracteres.

### Categoria

- Nombre entre 1 y 80 caracteres.
- Nombre unico sin distinguir mayusculas y minusculas.
- Tipo valido.
- Color con formato hexadecimal si se proporciona.

### Cuenta

- Nombre entre 1 y 80 caracteres.
- Nombre unico.
- Saldo inicial numerico.

### Presupuesto

- Mes con formato `YYYY-MM`.
- Importe limite mayor que cero.
- Categoria existente y compatible con gastos.
- Combinacion categoria-mes unica.

## 8. API funcional esperada

La API sera REST, con prefijo global `/api/v1`.

Salud:

- `GET /api/v1/health`

Movimientos:

- `GET /api/v1/transactions` (filtros: `from`, `to`, `categoryId`, `type`, `search`, `page`, `limit`)
- `POST /api/v1/transactions`
- `GET /api/v1/transactions/:id`
- `PATCH /api/v1/transactions/:id`
- `DELETE /api/v1/transactions/:id` (borrado real)

Categorias:

- `GET /api/v1/categories` (paginado)
- `POST /api/v1/categories`
- `GET /api/v1/categories/:id`
- `PATCH /api/v1/categories/:id`
- `DELETE /api/v1/categories/:id` (archivado logico)
- `PATCH /api/v1/categories/:id/restore`

Cuentas:

- `GET /api/v1/accounts` (paginado)
- `POST /api/v1/accounts`
- `GET /api/v1/accounts/:id`
- `PATCH /api/v1/accounts/:id`
- `DELETE /api/v1/accounts/:id` (archivado logico)
- `PATCH /api/v1/accounts/:id/restore`

Dashboard:

- `GET /api/v1/dashboard?from=&to=&currency=`

Transferencias (Rebanada 4):

- `POST /api/v1/transfers`

Los nombres de campos, codigos de error y parametros se concretan en `docs/architecture.md`.

## 9. Criterios de aceptacion del MVP

- Se puede arrancar PostgreSQL con Docker Compose.
- Las categorias iniciales se cargan mediante seed.
- La web permite consultar el dashboard y los gastos existentes.
- La web permite crear, editar y eliminar gastos.
- La web permite filtrar gastos por periodo, categoria y texto.
- La web permite gestionar categorias basicas sin romper los movimientos historicos.
- La web permite crear y consultar transferencias entre cuentas.
- Se puede registrar un gasto mediante `POST /api/v1/transactions`.
- Se puede registrar un gasto a partir del flujo supervisado de OpenClaw.
- La API permite listar gastos filtrando por periodo y categoria.
- El dashboard muestra totales coherentes con los movimientos guardados.
- Las transferencias no aparecen como ingresos ni gastos en el dashboard.
- Las transferencias entre monedas aplican una tasa y actualizan correctamente los saldos de ambas cuentas.
- Los gastos se agrupan correctamente por categoria.
- OpenClaw puede consultar los ultimos gastos y el resumen de un periodo.
- La web muestra los gastos creados por OpenClaw sin pasos manuales adicionales aparte de actualizar los datos.
- La API rechaza datos invalidos con errores claros.
- Las operaciones invalidas no dejan cambios parciales en la base de datos.
- El backend dispone de tests para reglas de negocio y endpoints principales.
- La interfaz funciona en escritorio y movil.

## 10. Evolucion posterior

Una vez completado el MVP se podran valorar:

- Autenticacion, multiusuario y roles (por ejemplo, solo un administrador podria crear o editar categorias).
- Unicidad insensible a mayusculas para los nombres de categorias y cuentas, mediante una columna normalizada con restriccion unica (conservando el nombre visible tal cual).
- Responder `200` (en lugar de `201`) cuando un reintento idempotente de OpenClaw devuelve un movimiento que ya existia.
- Importacion de extractos bancarios mediante CSV o formatos bancarios.
- Integracion automatica con bancos.
- Movimientos recurrentes.
- Etiquetas personalizadas para complementar las categorias.
- Presupuestos mensuales y alertas de limite.
- Exportacion de informes y datos.
- Almacenamiento de imagenes de tickets.
- Reconocimiento de tickets con multiples lineas de productos.
- Mas monedas y conversion historica avanzada.
- Aplicacion movil nativa.
- Notificaciones por correo o push.
