# Cofrelandia

Mapa 3D compartido donde cada persona que comenta en los vídeos de TikTok consigue una casa y cofres.
Todo gratis: GitHub Pages + GitHub Actions + datos en `data/state.json`.

## Cómo funciona
1. La persona entra en la web, escribe su @usuario y recibe un código (`CASA-XXX`).
2. Comenta ese código en cualquier vídeo listado en `config/videos.json`.
3. El bot (Actions, cada 30 min) lee los comentarios, crea la casa y abre un cofre de bienvenida.
4. Cada comentario nuevo = un cofre común (máx. 10 al día por jugador).
5. Los objetos (~120) tienen estadísticas: se equipan automáticamente la mejor arma, armadura y 2 accesorios; decoración y consumibles suman encanto y curas. Ver `src/core/equip.mjs`.

## Cuenta de prueba
Abre `web/?demo=1` (en la web: https://fbatlos.github.io/cofrelandia/web/?demo=1). Entras como `prueba` con 60 vecinos falsos; los botones simulan comentarios, el código de evento `DEMO`, el paso de un día y el reinicio. Todo ocurre en tu navegador y no escribe nada.

## Tareas habituales
- **Añadir un vídeo:** pon su URL completa en `config/videos.json` (`{"videos": ["https://www.tiktok.com/@tu_usuario/video/123"]}`).
- **Código de evento (cofre raro):** añade en `data/state.json` dentro de `events` una entrada `"REGALO-1": "Vídeo especial"` y pide en el vídeo que comenten ese código.
- **Probar en local:** `node scripts/fake-state.mjs 1500 > web/demo-state.json`, luego `python -m http.server 8765` y abre `http://localhost:8765/web/?state=demo-state.json`.
- **Tests:** `npm test`.
- **Si Actions es bloqueado por el proveedor de comentarios:** ejecuta `node bot/cli.mjs` en tu PC y haz push de `data/state.json`.

## Límites conocidos
- Los comentarios se leen con el servicio gratuito no oficial tikwm (solo comentarios principales, sin respuestas). Puede limitarse o cambiar.
- Diseño y plan: `docs/`.

## Batallas semanales y ranking
- Cada domingo a las 20:00 UTC (workflow `battle.yml`) todos los vecinos luchan 3 combates simulados con las estadísticas de su equipo. Victoria 3 pts, empate 1, descanso (número impar) 2.
- Premios: 🥇 3 cofres de premio, 🥈🥉 2, top 10: 1; las 3 casas con más encanto reciben 1. Los cofres de premio dan objetos épicos o legendarios.
- Resultados en `data/season.json` (ranking top 500, 3 combates destacados con repetición, historial de campeones). La web los muestra en 🏆 Ranking.
- Lanzar a mano: pestaña Actions → battle → Run workflow (solo cuenta una vez por semana ISO). En local: `node bot/season-cli.mjs`.
- En el modo de prueba, el botón ⚔️ Batalla simula una semana al instante.
