# VidCraft Studio

VidCraft Studio is a minimalist web video editor built with HTML5, CSS, and JavaScript. Inspired by Apple Liquid Glass UI and Google Material color accents, it operates 100% client-side inside your browser with zero server uploads.

[Repository](https://github.com/romero-ivan/google-video-studio) | [Live Demo](https://google-video-studio.vercel.app)

---

## Technical Features

- **100% Client-Side Processing**: No video files or audio tracks are uploaded to external servers.
- **Sony Vegas Style NLE Timeline**: Multi-clip sequential timeline supporting continuous left-to-right clip placement.
- **Dual-Track Video & Audio Engine**: Independent video and audio tracks with per-track mute and export selection checkboxes.
- **WebM Duration Auto-Repair**: Fixes WebM video files recorded with missing or non-finite duration headers.
- **Universal Format Input**: Load MP4, WebM, MOV, MKV, AVI, M4V, and FLV files on Mac and Windows.
- **Deterministic Frame Exporter**: Frame-by-frame seeking engine ensuring full-bitrate MP4 and WebM file exports.

---

## Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Space` | Toggle Play / Pause |
| `S` | Split active video clip at playhead position |
| `Delete` / `Backspace` | Delete selected clip segment |
| `Left Arrow` / `Right Arrow` | Step backward / forward by 1 frame (30 FPS) |
| `Shift` + `Left` / `Right` | Jump backward / forward by 1 second |

---

## Local Development

```bash
git clone https://github.com/romero-ivan/google-video-studio.git
cd google-video-studio
npm install
npm run dev
```

Build for production:

```bash
npm run build
```

---

## Manual en Español

VidCraft Studio es un editor de vídeo web minimalista con procesado 100% local en el navegador sin subir archivos a ningún servidor.

### Características Principales

- **Edición Estilo Sony Vegas**: Línea de tiempo secuencial para colocar y empalmar múltiples clips sin superposiciones.
- **Corte Rápido con Tecla S**: Divide cualquier clip instantáneamente en el punto del cursor de reproducción.
- **Eliminación con Tecla Delete**: Borra el segmento de vídeo o audio seleccionado y ajusta la secuencia automáticamente.
- **Pistas Independientes de Vídeo y Audio**: Control de silencio y casillas de selección para exportar solo vídeo, solo audio o ambos.
- **Corrección de Vídeos WebM**: Resuelve automáticamente la duración en vídeos WebM grabados desde navegador o streaming.
- **Soporte de Formatos**: Compatible con MP4, WebM, MOV, MKV, AVI y M4V.

### Teclas Rápidas

- **Espacio**: Reproducir o Pausar.
- **S**: Cortar clip en la posición actual.
- **Supr / Delete / Backspace**: Eliminar clip seleccionado.
- **Flechas Izquierda / Derecha**: Avanzar o retroceder 1 fotograma.
- **Shift + Flechas**: Avanzar o retroceder 1 segundo.

---

License: MIT  
Author: [romero-ivan](https://github.com/romero-ivan)
