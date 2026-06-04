---
title: "sflores.one"
tags: ["Astro", "Tailwind", "Cloudflare"]
summary: "Mi rincón personal en la web. Este mismo portfolio, construido con Astro y Tailwind, desplegado en Cloudflare con scroll-snap y View Transitions."
year: 2026
color: "#2563eb"
blogSlug: "test-post"
author: "Sergio Flores"
description: "Cómo construí este portfolio con Astro, Tailwind y Cloudflare."
---

## Motivación

Necesitaba un espacio donde mis ideas pudieran vivir sin pedir permiso. Un sitio que se sintiera mío — rápido, limpio, sin distracciones. Algo que reflejara cómo pienso el código: estructura clara, sin adornos innecesarios, que funcione bien en cualquier dispositivo.

## Tech stack

### Astro

Elegí Astro porque quería un sitio estático con contenido dinámico, sin cargar JavaScript que no necesito. Las **Content Collections** me permiten escribir en Markdown y tener tipado completo con Zod, lo que hace que añadir un nuevo post sea trivial.

```astro
---
import { getCollection } from "astro:content";
const posts = await getCollection("blog");
---
```

### Tailwind CSS v4

La nueva versión de Tailwind con el plugin de Vite es brutal. Sin PostCSS, sin config, solo `@import "tailwindcss"` y a volar. Los tokens de diseño (`@theme`) me dan consistencia sin pensar.

### Cloudflare

Desplegado en Cloudflare Pages desde GitHub. Builds automáticos, CDN global, cero mantenimiento.

## Diseño

El diseño es deliberadamente simple: blanco y negro, tipografía limpia (Libre Baskerville para cuerpo, Manrope para títulos), scroll-snap sections. Cada elemento está ahí por una razón.

> El buen diseño es tan poco diseño como sea posible. — Dieter Rams

### View Transitions

Una de las decisiones clave fue usar View Transitions de Astro para que el header persista entre páginas. La navegación se siente fluida sin perder la naturaleza MPA del sitio.

## Lo que aprendí

- Astro v6 con Content Collections es increíblemente productivo
- Tailwind v4 + Vite plugin elimina toda la fricción del setup
- Phosphor icons tiene un GitHub icon que encaja perfectamente
- Las View Transitions API nativas del browser funcionan de lujo

---

Este proyecto sigue vivo. Siempre hay algo que mejorar, y creo que esa es la gracia.
