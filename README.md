# Pueblo de Cofres

Mapa 3D compartido donde cada persona que comenta en los vídeos de TikTok consigue una casa y cofres.
Todo gratis: GitHub Pages + GitHub Actions + datos en `data/state.json`.

## Cómo funciona
1. La persona entra en la web, escribe su @usuario y recibe un código (`CASA-XXX`).
2. Comenta ese código en cualquier vídeo listado en `config/videos.json`.
3. El bot (Actions, cada 30 min) lee los comentarios, crea la casa y abre un cofre de bienvenida.
4. Cada comentario nuevo = un cofre común (máx. 10 al día por jugador).

## Tareas habituales
- **Añadir un vídeo:** pon su URL completa en `config/videos.json` (`{"videos": ["https://www.tiktok.com/@tu_usuario/video/123"]}`).
- **Código de evento (cofre raro):** añade en `data/state.json` dentro de `events` una entrada `"REGALO-1": "Vídeo especial"` y pide en el vídeo que comenten ese código.
- **Probar en local:** `node scripts/fake-state.mjs 1500 > web/demo-state.json`, luego `python -m http.server 8765` y abre `http://localhost:8765/web/?state=demo-state.json`.
- **Tests:** `npm test`.
- **Si Actions es bloqueado por el proveedor de comentarios:** ejecuta `node bot/cli.mjs` en tu PC y haz push de `data/state.json`.

## Límites conocidos
- Los comentarios se leen con el servicio gratuito no oficial tikwm (solo comentarios principales, sin respuestas). Puede limitarse o cambiar.
- Diseño y plan: `docs/`.
