/**
 * main.js
 * Universal file handler for MP4, MOV, WebM, MKV, AVI, etc.
 * Supports Sony Vegas style multi-clip video editing.
 */

import './style.css';
import { VideoEngine } from './core/VideoEngine.js';
import { AudioMixer } from './core/AudioMixer.js';
import { Timeline } from './core/Timeline.js';
import { FFmpegEngine } from './core/FFmpegEngine.js';

// Core Instances
const videoEngine = new VideoEngine();
const audioMixer = new AudioMixer();
const ffmpegEngine = new FFmpegEngine();

// DOM Elements
const dropzoneEl = document.getElementById('dropzone');
const videoFileInput = document.getElementById('videoFileInput');
const playerCardEl = document.getElementById('playerCard');
const mainVideoPlayer = document.getElementById('mainVideoPlayer');
const playPauseBtn = document.getElementById('playPauseBtn');
const playIcon = document.getElementById('playIcon');
const pauseIcon = document.getElementById('pauseIcon');
const overlayTimecode = document.getElementById('overlayTimecode');
const fullscreenBtn = document.getElementById('fullscreenBtn');

const timelineCardEl = document.getElementById('timelineCard');
const clipsListContainer = document.getElementById('clipsListContainer');
const addMoreClipsBtn = document.getElementById('addMoreClipsBtn');

const audioFileInput = document.getElementById('audioFileInput');
const loadAudioBtn = document.getElementById('loadAudioBtn');
const replacementAudioInfo = document.getElementById('replacementAudioInfo');
const replacementAudioName = document.getElementById('replacementAudioName');
const removeAudioBtn = document.getElementById('removeAudioBtn');

const headerExportBtn = document.getElementById('headerExportBtn');
const exportFormatSelect = document.getElementById('exportFormatSelect');
const exportResolutionSelect = document.getElementById('exportResolutionSelect');

const exportModal = document.getElementById('exportModal');
const modalTitle = document.getElementById('modalTitle');
const progressCircle = document.getElementById('progressCircle');
const progressPctText = document.getElementById('progressPctText');
const modalStatusText = document.getElementById('modalStatusText');
const cancelExportBtn = document.getElementById('cancelExportBtn');
const downloadVideoBtn = document.getElementById('downloadVideoBtn');
const themeToggleBtn = document.getElementById('themeToggleBtn');

// Initialize Timeline
const timeline = new Timeline(timelineCardEl);

// 1. Universal File Upload & Drag & Drop Handler (Allows all MP4, MOV, MKV, WEBM, etc.)
dropzoneEl.addEventListener('click', () => videoFileInput.click());

['dragenter', 'dragover'].forEach(name => {
  dropzoneEl.addEventListener(name, (e) => {
    e.preventDefault();
    dropzoneEl.classList.add('drag-active');
  });
});

['dragleave', 'drop'].forEach(name => {
  dropzoneEl.addEventListener(name, (e) => {
    e.preventDefault();
    dropzoneEl.classList.remove('drag-active');
  });
});

dropzoneEl.addEventListener('drop', (e) => {
  e.preventDefault();
  const files = Array.from(e.dataTransfer.files);
  if (files.length > 0) handleVideoFiles(files);
});

videoFileInput.addEventListener('change', (e) => {
  const files = Array.from(e.target.files);
  if (files.length > 0) handleVideoFiles(files);
});

addMoreClipsBtn.addEventListener('click', () => videoFileInput.click());

async function handleVideoFiles(files) {
  for (const file of files) {
    try {
      await videoEngine.addClip(file);
    } catch (err) {
      alert(`Could not load video "${file.name}": ` + err.message);
    }
  }
}

// 2. Video Engine Updates
videoEngine.on('clipAdded', () => refreshTimelineAndPlayer());
videoEngine.on('clipSplit', () => refreshTimelineAndPlayer());
videoEngine.on('clipRemoved', () => refreshTimelineAndPlayer());

function refreshTimelineAndPlayer() {
  const state = videoEngine.getState();
  const clips = state.clips;

  if (clips.length === 0) {
    dropzoneEl.style.display = 'flex';
    playerCardEl.style.display = 'none';
    headerExportBtn.disabled = true;
    mainVideoPlayer.src = '';
    return;
  }

  dropzoneEl.style.display = 'none';
  playerCardEl.style.display = 'flex';
  headerExportBtn.disabled = false;

  updateClipsUI(clips);
  timeline.setClipsState(clips, videoEngine.activeClipIndex);

  const activeClip = videoEngine.getActiveClip();
  if (activeClip && mainVideoPlayer.src !== activeClip.url) {
    mainVideoPlayer.src = activeClip.url;
    mainVideoPlayer.currentTime = activeClip.sourceStart;
  }
}

function updateClipsUI(clips) {
  clipsListContainer.innerHTML = '';
  clips.forEach((c, idx) => {
    const item = document.createElement('div');
    item.className = `clip-item ${idx === videoEngine.activeClipIndex ? 'active' : ''}`;
    const duration = (c.sourceEnd - c.sourceStart).toFixed(1) + 's';
    item.innerHTML = `
      <span class="clip-name" title="${c.name}">${idx + 1}. ${c.name}</span>
      <span style="font-size:0.75rem; color:var(--text-muted);">${duration}</span>
      <button class="btn-glass btn-danger btn-icon" style="width:24px; height:24px;" data-index="${idx}">✕</button>
    `;

    item.addEventListener('click', (e) => {
      if (e.target.tagName === 'BUTTON') {
        const indexToRemove = parseInt(e.target.getAttribute('data-index'), 10);
        videoEngine.removeClip(indexToRemove);
        return;
      }
      videoEngine.activeClipIndex = idx;
      refreshTimelineAndPlayer();
    });

    clipsListContainer.appendChild(item);
  });
}

// 3. Player Controls
playPauseBtn.addEventListener('click', () => {
  if (mainVideoPlayer.paused) {
    mainVideoPlayer.play();
  } else {
    mainVideoPlayer.pause();
  }
});

mainVideoPlayer.addEventListener('play', () => {
  playIcon.style.display = 'none';
  pauseIcon.style.display = 'block';
});

mainVideoPlayer.addEventListener('pause', () => {
  playIcon.style.display = 'block';
  pauseIcon.style.display = 'none';
});

mainVideoPlayer.addEventListener('timeupdate', () => {
  const activeClip = videoEngine.getActiveClip();
  if (activeClip) {
    if (mainVideoPlayer.currentTime >= activeClip.sourceEnd) {
      if (videoEngine.activeClipIndex < videoEngine.clips.length - 1) {
        videoEngine.activeClipIndex++;
        refreshTimelineAndPlayer();
        mainVideoPlayer.play();
      } else {
        mainVideoPlayer.currentTime = activeClip.sourceStart;
      }
    }
    const currentMasterTime = activeClip.timelineStart + (mainVideoPlayer.currentTime - activeClip.sourceStart);
    timeline.setCurrentTime(currentMasterTime);
    updateOverlayTimecode(currentMasterTime, videoEngine.getTotalMasterDuration());
  }
});

fullscreenBtn.addEventListener('click', () => {
  if (!document.fullscreenElement) {
    playerCardEl.requestFullscreen().catch(err => alert(err.message));
  } else {
    document.exitFullscreen();
  }
});

function updateOverlayTimecode(current, max) {
  const fmt = (s) => {
    if (!Number.isFinite(s) || isNaN(s)) return '00:00.000';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    const ms = Math.floor((s % 1) * 1000);
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
  };
  overlayTimecode.textContent = `${fmt(current)} / ${fmt(max)}`;
}

// 4. Timeline Actions & Keyboard Shortcuts
timeline.on('selectClip', (index) => {
  videoEngine.activeClipIndex = index;
  refreshTimelineAndPlayer();
});

timeline.on('requestSplit', () => {
  videoEngine.splitClipAtTime(timeline.currentTime);
});

timeline.on('requestDelete', () => {
  videoEngine.removeClip(videoEngine.activeClipIndex);
});

timeline.on('seek', (masterTime) => {
  const clips = videoEngine.clips;
  const clipIndex = clips.findIndex(c => masterTime >= c.timelineStart - 0.01 && masterTime <= c.timelineEnd + 0.01);
  if (clipIndex !== -1) {
    videoEngine.activeClipIndex = clipIndex;
    const clip = clips[clipIndex];
    const relativeTime = masterTime - clip.timelineStart;
    if (mainVideoPlayer.src !== clip.url) {
      mainVideoPlayer.src = clip.url;
    }
    mainVideoPlayer.currentTime = clip.sourceStart + relativeTime;
  }
});

// SONY VEGAS KEYBOARD SHORTCUTS
window.addEventListener('keydown', (e) => {
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

  if (e.code === 'Space') {
    e.preventDefault();
    if (mainVideoPlayer.paused) mainVideoPlayer.play();
    else mainVideoPlayer.pause();
  } else if (e.code === 'KeyS') {
    e.preventDefault();
    videoEngine.splitClipAtTime(timeline.currentTime);
  } else if (e.code === 'Delete' || e.code === 'Backspace') {
    e.preventDefault();
    videoEngine.removeClip(videoEngine.activeClipIndex);
  } else if (e.code === 'ArrowLeft') {
    e.preventDefault();
    const step = e.shiftKey ? 1.0 : 1 / 30;
    timeline.stepFrame(-step * 30);
  } else if (e.code === 'ArrowRight') {
    e.preventDefault();
    const step = e.shiftKey ? 1.0 : 1 / 30;
    timeline.stepFrame(step * 30);
  }
});

// 5. Replacement Audio
loadAudioBtn.addEventListener('click', () => audioFileInput.click());

audioFileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (file) {
    await audioMixer.loadReplacementAudio(file);
    replacementAudioInfo.style.display = 'flex';
    replacementAudioName.textContent = file.name;
  }
});

removeAudioBtn.addEventListener('click', () => {
  audioMixer.removeReplacementAudio();
  replacementAudioInfo.style.display = 'none';
});

// 6. Export Handling
headerExportBtn.addEventListener('click', async () => {
  const clips = videoEngine.clips;
  if (!clips || clips.length === 0) return;

  const audioConfig = audioMixer.getConfig();
  if (audioConfig.hasReplacementAudio) {
    audioConfig.replacementAudioEl = audioMixer.replacementAudioEl;
  }
  audioConfig.isMuted = !timeline.isAudioEnabled;

  const format = exportFormatSelect.value;
  const resolution = exportResolutionSelect.value;

  exportModal.classList.add('active');
  modalTitle.textContent = 'Rendering Video...';
  downloadVideoBtn.style.display = 'none';
  cancelExportBtn.style.display = 'inline-flex';
  updateModalProgress(0, 'Initializing client export...');

  try {
    const result = await ffmpegEngine.exportVideo({
      clips,
      audioConfig,
      format,
      resolution,
      fps: 30,
      onProgress: ({ percent, statusText }) => {
        updateModalProgress(percent, statusText);
      }
    });

    modalTitle.textContent = 'Export Completed!';
    downloadVideoBtn.href = result.url;
    downloadVideoBtn.download = result.filename;
    downloadVideoBtn.style.display = 'inline-flex';
    cancelExportBtn.style.display = 'none';
  } catch (err) {
    console.error(err);
    alert('Export error: ' + err.message);
    exportModal.classList.remove('active');
  }
});

function updateModalProgress(percent, text) {
  progressPctText.textContent = `${percent}%`;
  modalStatusText.textContent = text;
  const offset = 314.159 - (314.159 * percent) / 100;
  progressCircle.style.strokeDashoffset = offset;
}

cancelExportBtn.addEventListener('click', () => {
  ffmpegEngine.cancelExport();
  exportModal.classList.remove('active');
});

// 7. Theme Toggle
themeToggleBtn.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
});
