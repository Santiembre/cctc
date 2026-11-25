# ANÁLISIS DE IMPACTO
**Plataforma centralizada de talleres, cursos y clubes con IA**

*Hub de Aprendizaje que reúne talleres, cursos y clubes en un solo sitio y usa IA para llenar cada ficha a partir de un PDF o un cartel.*

| Campo | Detalle |
| :--- | :--- |
| **Institución** | Facultad de Estudios Superiores Acatlán |
| **Materia** | Cómputo en la Nube |
| **Actividad** | Proyecto final, primera parte: documento de análisis de impacto |
| **Proyecto** | Hub de Aprendizaje, plataforma web centralizada de talleres, cursos y clubes, con carga asistida por IA |
| **Integrantes** | Diego Herrera Hernández<br>Samuel Herrera Franco |
| **Docente** | Diego Romero Mora |
| **Fecha de entrega** | [20/11/2026] |

---

## 1. Resumen del proyecto

Proponemos un sitio web único donde la comunidad estudiantil encuentre todos los talleres, cursos y clubes de aprendizaje, y donde los organizadores los publiquen subiendo un PDF o una foto del cartel: la IA extrae los datos y llena el registro automáticamente.

* **Problema:** Hoy la información está repartida entre PDFs, carteles físicos o digitales y tres páginas web distintas. Un estudiante tiene que revisar varias fuentes para saber qué hay, cuándo, dónde y cómo inscribirse. Muchas actividades se pierden o se llenan sin que la mayoría se entere.
* **Solución:** Un catálogo centralizado con búsqueda y filtros (tipo, área, fecha, modalidad, costo, cupo) y una ficha por actividad con enlace de inscripción.
* **¿Para qué se utilizará la IA?:** El organizador sube el PDF del curso o la imagen del cartel. Un modelo multimodal lee el documento, extrae título, fechas, horario, lugar, ponente, requisitos y contacto, y propone el registro en un formulario prellenado. El organizador revisa, corrige si hace falta y publica. Así la captura manual de varios minutos baja a menos de uno.

### Usuarios

| Rol | Qué hace en la plataforma |
| :--- | :--- |
| **Estudiante** | Busca, filtra, guarda favoritos y recibe recordatorios |
| **Organizador (docente, club, coordinación)** | Sube PDF o imagen, revisa lo que extrajo la IA y publica |
| **Administrador** | Aprueba organizadores, modera contenido y ve métricas |

---

## 2. Tipos de datos

El proyecto maneja tres familias de datos: estructurados (actividades, usuarios, inscripciones), semiestructurados (lo que devuelve la IA en JSON) y no estructurados (PDFs e imágenes de carteles).

| Categoría | Datos concretos | Formato | Volumen estimado (1 campus) | Dónde vive |
| :--- | :--- | :--- | :--- | :--- |
| **Estructurados** | Actividad: título, tipo (taller, curso o club), área, descripción, fechas, horario, sede o liga, modalidad, cupo, costo, requisitos, organizador, enlace de inscripción, estado | Registros con esquema | 300 a 1,500 por semestre | Base de datos |
| **Estructurados** | Usuarios y roles: nombre, correo institucional, carrera, rol (estudiante, organizador o admin) | Registros con esquema | 5,000 a 20,000 cuentas | Base de datos y servicio de identidad |
| **Estructurados** | Interacción: favoritos, inscripciones o clics de "me interesa", recordatorios | Registros con esquema | Decenas de miles por semestre | Base de datos |
| **Semiestructurados** | Resultado de la extracción por IA: campos detectados, nivel de confianza, campos faltantes, texto crudo | JSON | 1 por archivo subido | Base de datos (documento) |
| **Semiestructurados** | Etiquetas y categorías libres, horarios con varias sesiones | Listas o arreglos | Variable | Base de datos (documento) |
| **No estructurados** | PDFs de cursos y convocatorias | PDF | 0.2 a 5 MB c/u | Almacenamiento de objetos |
| **No estructurados** | Carteles y flyers (fotos o diseños) | JPG, PNG, WEBP | 0.5 a 8 MB c/u; miniaturas de unos 100 KB | Almacenamiento de objetos |
| **Analíticos** | Eventos de uso: búsquedas, filtros usados, vistas de ficha | Logs o eventos | Cientos de miles por semestre | Logs y almacén analítico (fase 2) |

* **Datos sensibles:** Nombre y correo de estudiantes son datos personales. Se guardan los mínimos, con acceso por rol y cifrado en reposo (activo por defecto en Google Cloud), y se publica un aviso de privacidad conforme a la ley mexicana de protección de datos personales aplicable a la institución.
* **Consecuencia para el diseño:** Cada actividad tiene campos que varían (un club no tiene fecha de fin; un curso puede tener 8 sesiones) y la IA devuelve JSON, así que conviene una base de datos que acepte documentos flexibles. Los archivos pesados no van en la base de datos sino en almacenamiento de objetos, y la base solo guarda su ruta.

---

## 3. Base de datos: opciones y comparativa

Elegimos **Firestore** (NoSQL de documentos, sin servidor) como base principal. Los datos de cada actividad tienen forma variable, la IA entrega JSON que se guarda casi tal cual, el volumen es pequeño y su capa gratuita cubre un campus: 50,000 lecturas y 20,000 escrituras al día y 1 GiB almacenado. **Cloud SQL (PostgreSQL)** queda como alternativa si el proyecto creciera hacia reportes con muchas uniones entre tablas.

| Opción | Modelo | Ventajas para este proyecto | Desventajas | Costo de arranque | Veredicto |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Firestore (Google Cloud)** | NoSQL de documentos | Esquema flexible; guarda el JSON de la IA directo; escala a cero; tiempo real para la vista del organizador; reglas de seguridad por rol; se integra con Firebase Auth y Hosting | Consultas con varios filtros de rango requieren índices compuestos; sin JOINs ni búsqueda de texto completo nativa | $0 dentro de la capa gratuita | **Elegida** |
| **Cloud SQL para PostgreSQL** | Relacional (SQL) | Integridad referencial; JOINs y reportes; columnas JSONB para datos variables; búsqueda de texto completo con tsvector | Instancia siempre encendida; hay que dimensionar, parchar ventanas y pagar aunque no haya tráfico | Pago por hora de instancia, sin capa gratuita permanente | **Alternativa / fase 2** |
| **AlloyDB** | Relacional compatible con PostgreSQL | Alto rendimiento y analítica integrada | Diseñada para cargas empresariales; sobredimensionada y cara para un campus | Alto | Descartada |
| **Cloud Spanner** | Relacional distribuido global | Escala horizontal con consistencia fuerte | Pensada para millones de usuarios y varias regiones; costo mínimo elevado | Alto | Descartada |
| **Bigtable** | NoSQL de columnas anchas | Excelente para series de tiempo y millones de escrituras por segundo | No sirve para consultas por varios campos como "talleres de programación en diciembre" | Alto | Descartada |
| **MongoDB Atlas (otro proveedor)** | NoSQL de documentos | Muy parecida a Firestore y con búsqueda de texto | Servicio externo: otra cuenta, otra factura y fuera de lo visto en los labs | Capa gratuita pequeña | Descartada |

### Cómo se modela en Firestore
* **Colección `actividades`:** Un documento por taller, curso o club, con arreglos para sesiones y etiquetas, y la ruta del archivo original en Cloud Storage.
* **Colección `usuarios`:** Perfil y rol; la identidad la gestiona el servicio de autenticación.
* **Colección `extracciones`:** El JSON crudo que devolvió la IA, su nivel de confianza y si el organizador lo corrigió (sirve para medir la precisión del modelo).
* **Subcolección `usuarios/{id}/favoritos`:** Para guardados y recordatorios.

### Límite conocido y cómo se resuelve
Firestore no hace búsqueda de texto libre. Para la primera versión bastan filtros por tipo, área, fecha y modalidad, más un arreglo de palabras clave que la propia IA genera al extraer. Si se necesitara búsqueda semántica ("algo de robótica para principiantes"), se añadiría búsqueda vectorial sobre los mismos documentos en una fase 2.

---

## 4. Análisis de mercado

Ya existen plataformas de vida estudiantil y de eventos, pero ninguna resuelve el paso que más frena a nuestros organizadores: convertir un PDF o un cartel en un registro publicado sin capturarlo a mano. Esa es nuestra oportunidad, junto con un costo casi nulo para una sola institución.

| Solución | Qué es | Fortalezas | En qué se diferencia de la nuestra |
| :--- | :--- | :--- | :--- |
| **Anthology Engage** | Plataforma comercial de vida estudiantil para universidades | Gestión de organizaciones, eventos, elecciones y métricas de participación en un solo portal | Licencia institucional cara y en inglés; la captura de eventos es manual; enfocada en clubes, no en cursos y talleres académicos |
| **CampusGroups (Ready Education)** | Competidor directo de Engage | App móvil propia, calendario central, asistencia con QR, analítica | Mismo modelo de licencia y captura manual; requiere un proyecto de implantación institucional |
| **Modern Campus Involve (Presence)** | Plataforma de participación estudiantil | Seguimiento de participación y evaluación | Orientada a universidades de EE. UU.; sin carga automática desde documentos |
| **Eventbrite** | Venta de boletos y descubrimiento de eventos públicos | Gran audiencia y herramientas de marketing | Pensada para eventos abiertos y de pago; no organiza la oferta de una institución ni distingue talleres, cursos y clubes |
| **Luma** | Páginas de evento e invitaciones para comunidades | Crear un evento en minutos; calendarios que se pueden seguir | Cada organizador tiene su calendario aislado; no hay un catálogo único del campus |
| **Meetup** | Grupos por intereses | Descubrimiento por tema | Cobra suscripción al organizador; no está ligado a la institución |
| **Situación actual del campus** | PDFs, carteles y 3 páginas web; redes sociales de cada club | Gratis y ya conocido | Información dispersa, desactualizada y difícil de buscar: es el problema que atacamos |

### Oportunidad y propuesta de valor
* **Carga con IA desde el material que ya existe:** El organizador no cambia su forma de trabajar: sube el PDF o la foto del cartel que ya hizo, y la ficha se llena sola. Ninguna de las plataformas revisadas lo ofrece como función central.
* **Un solo catálogo para tres tipos de oferta:** Talleres, cursos y clubes en el mismo buscador, con filtros pensados para estudiantes (horario, modalidad, costo, cupo).
* **Hecho a la medida y en español:** Sin licencias por estudiante; el costo es el consumo en la nube, que para un campus cabe casi completo en las capas gratuitas (sección 6).
* **Datos para la institución:** Qué se busca y no se encuentra indica qué talleres nuevos abrir.

### Riesgo de mercado
La adopción depende de que los organizadores suban su contenido. Por eso la carga con IA es la función más importante: si publicar cuesta menos de un minuto, la plataforma se llena sola.

---

## 5. Infraestructura en la nube propuesta

Proponemos una arquitectura 100% sin servidores (*serverless*) en Google Cloud: no hay máquinas que administrar, todo escala a cero cuando nadie usa la página y el costo sigue al uso real. Es el mismo ecosistema de los labs de Google Skills.

> **[Diagrama de Arquitectura — Figura 1: Al subir un PDF o cartel, Gemini llena la ficha de la actividad]**
> * **Flujo Estudiante:** Usuarios (navegador o celular) → Firebase Hosting (sitio web y CDN) → Cloud Run (API web / contenedor) → Firestore (datos de actividades).
> * **Autenticación:** Usuarios (navegador o celular) → *(inicia sesión)* → Firebase Auth (login institucional).
> * **Flujo Organizador / IA:** Cloud Run → *(sube archivo)* → Cloud Storage (PDFs y carteles) → Extractor IA (Cloud Run functions) → *(envía archivo, recibe JSON)* → Gemini Flash (Vertex AI) → *(guarda borrador)* → Firestore.

El estudiante solo toca la fila superior (sitio, API, base de datos). Cuando un organizador sube un archivo, este se guarda en Cloud Storage; ese evento dispara el extractor, que manda el archivo a Gemini, recibe un JSON con los campos y lo guarda como borrador en Firestore para que el organizador lo revise y publique.

### Flujo de alta con IA, paso a paso
1. El organizador inicia sesión y elige "Nueva actividad desde archivo".
2. La API (Cloud Run) le da una URL firmada y el navegador sube el PDF o la imagen directo a Cloud Storage.
3. Eventarc detecta el archivo nuevo y activa la función extractora.
4. La función llama a Gemini Flash con el archivo y un esquema JSON (título, tipo, fechas, sesiones, lugar, cupo, costo, requisitos, contacto) usando salida estructurada.
5. El resultado se guarda en Firestore con estado borrador y nivel de confianza por campo.
6. El organizador ve el formulario prellenado en tiempo real, corrige lo marcado como dudoso y publica.

### Servicios elegidos y por qué esos y no otros

| Capa | Servicio elegido | Función en el proyecto | Por qué este | Alternativas descartadas |
| :--- | :--- | :--- | :--- | :--- |
| **Front-end** | Firebase Hosting | Sirve el sitio web (HTML, JS, imágenes) con CDN global y HTTPS automático | Despliegue con un comando y certificado SSL gratis | Compute Engine con Nginx (hay que administrar la VM); Cloud Storage como sitio estático (sin HTTPS propio sin balanceador) |
| **Cómputo (API)** | Cloud Run | API REST en un contenedor: búsquedas, alta de actividades, URLs firmadas, favoritos | Escala a cero y a muchas instancias en picos de inicio de semestre; 2 millones de solicitudes gratis al mes; acepta cualquier lenguaje | Compute Engine (VM encendida 24/7); GKE (Kubernetes es excesivo para un equipo de 4); App Engine (menos flexible que Cloud Run) |
| **Cómputo (eventos)** | Cloud Run functions + Eventarc | Función que se ejecuta sola al subir un archivo | Solo corre cuando hay archivos nuevos; código pequeño y aislado | Procesar dentro de la API (bloquea la respuesta al usuario); Pub/Sub manual (más piezas) |
| **IA** | Gemini Flash en Vertex AI | Lee PDF e imagen y devuelve JSON con los campos | Multimodal: entiende carteles con diseño libre, no solo texto; salida estructurada; precio bajo por documento | Document AI (requiere procesadores entrenados por formato, y cada cartel es distinto); Cloud Vision OCR (solo extrae texto, no lo organiza en campos) |
| **Almacenamiento** | Cloud Storage (clase Standard) | Guarda los PDFs e imágenes originales y sus miniaturas | Barato por GB, durable, integra eventos y URLs firmadas; reglas de ciclo de vida pasan archivos de semestres viejos a Nearline | Guardar archivos dentro de Firestore (límite de 1 MiB por documento y caro); Filestore (disco compartido para VMs, no aplica) |
| **Base de datos** | Firestore | Actividades, usuarios, favoritos y resultados de la IA | Ver sección 3 | Cloud SQL, AlloyDB, Spanner, Bigtable (sección 3) |
| **Identidad** | Firebase Authentication | Inicio de sesión con la cuenta de Google institucional; roles por custom claims | Gratis para inicio de sesión con Google; se conecta con las reglas de Firestore | Sistema de usuarios propio (contraseñas que proteger) |
| **Notificaciones** | Cloud Scheduler + Firebase Cloud Messaging | Recordatorio un día antes de la actividad guardada | Tarea programada diaria sin servidor; notificaciones push gratis | Cron en una VM |
| **Seguridad y operación** | Secret Manager, IAM, Cloud Logging y Monitoring | Llaves fuera del código, permisos mínimos por servicio, registros y alertas | Integrados y sin servidores extra | Variables en el código (inseguro) |

* **Región:** `us-central1` (Iowa): precios de nivel 1, todos los servicios disponibles y buena latencia hacia México. Si la institución exige datos en el país, se evaluaría la región de Querétaro (`northamerica-south1`), revisando antes qué servicios están disponibles allí.
* **Escalabilidad:** El pico esperado son las primeras dos semanas de semestre. Cloud Run sube instancias automáticamente y Firestore no necesita dimensionarse, así que el mismo diseño sirve para un campus o para toda una red de campus.

---

## 6. Costos estimados, riesgos y conclusión

Para un campus de unos 10,000 estudiantes y 1,500 archivos subidos por semestre, estimamos menos de 10 USD al mes; casi todo cae en capas gratuitas y el gasto real es la IA. Son cifras aproximadas con precios de noviembre de 2026, a validar con la calculadora de Google Cloud.

| Servicio | Supuesto de uso mensual | Referencia de precio | Costo aprox. (USD/mes) |
| :--- | :--- | :--- | :--- |
| **Gemini Flash (IA)** | 250 archivos × ~1,500 tokens de entrada y ~500 de salida | Gemini 3.x Flash: 0.75 / 3.75 USD por millón de tokens (precio introductorio hasta el 31/12/2026; luego 1.50 / 7.50) | ~1 (≈ 0.003 por archivo; ~2 con el precio de 2027) |
| **Cloud Run (API + extractor)** | < 1 millón de solicitudes | 2 millones de solicitudes y 180,000 vCPU-segundos gratis al mes | 0 |
| **Firestore** | ~40,000 lecturas y < 2,000 escrituras al día | 50,000 lecturas y 20,000 escrituras gratis al día; 0.03 USD por 100,000 lecturas extra | 0 a 1 |
| **Cloud Storage** | ~5 GB acumulados por semestre | Clase Standard, centavos por GB al mes | < 1 |
| **Firebase Hosting, Auth, Scheduler, Logging** | Uso bajo | Capas gratuitas | 0 a 1 |
| **Total** | | | **< 10** |

Se configurará una alerta de presupuesto en Cloud Billing (por ejemplo, a 10 y 20 USD) para evitar sorpresas.

### Riesgos y mitigación

| Riesgo | Impacto | Mitigación |
| :--- | :--- | :--- |
| **La IA extrae un dato mal (fecha, lugar)** | Alto: un estudiante llega a la hora equivocada | Nada se publica sin revisión humana; campos con baja confianza se marcan en amarillo |
| **Carteles con poca resolución o escritos a mano** | Medio | Pedir foto nítida; si falla, el formulario queda vacío para captura manual |
| **Los organizadores no adoptan la plataforma** | Alto | Carga en menos de un minuto; acuerdo con coordinaciones para que sea el canal oficial |
| **Datos personales de estudiantes** | Medio | Datos mínimos, acceso por rol, aviso de privacidad, reglas de seguridad en Firestore |
| **Dependencia de un solo proveedor (Google Cloud)** | Bajo | API en contenedor (Cloud Run) portable a otra nube; datos exportables en JSON |
| **Aumento del precio de la IA** | Bajo | Costo por archivo de fracciones de centavo; se puede cambiar a un modelo Flash-Lite más barato |

### Conclusión
El proyecto ataca un problema real y medible (información repartida en PDFs, carteles y tres páginas) con una arquitectura sin servidores que cuesta menos de 10 USD al mes, escala sola en inicio de semestre y usa IA donde más ahorra trabajo: convertir un archivo en un registro. La segunda parte del proyecto podría implementar un prototipo con Firebase Hosting, Cloud Run, Firestore, Cloud Storage y Gemini.
