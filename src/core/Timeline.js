/**
 * Timeline.js
 * Sony Vegas style Multi-Clip Timeline Controller.
 * Restores Video Thumbnail Strips & Audio Waveform Canvases inside sequential track blocks.
 */

export class Timeline {
  constructor(containerEl) {
    this.container = containerEl;
    this.clips = [];
    this.totalDuration = 0;
    this.currentTime = 0;
    this.activeClipIndex = 0;

    this.isVideoEnabled = true;
    this.isAudioEnabled = true;

    this.isDraggingPlayhead = false;
    this.listeners = new Map();
    this.initDOM();
  }

  on(event, fn) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(fn);
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(fn => fn(data));
    }
  }

  initDOM() {
    this.container.innerHTML = `
      <div class="timeline-header">
        <div class="timeline-meta">
          <span class="range-readout" id="tlRangeReadout">Total Duration: 00:00.000</span>
          <div class="precision-actions">
            <button class="btn-micro btn-action-split" id="btnSplit" title="Split Clip at Playhead (Hotkey: S)">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/>
                <line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/>
                <line x1="8.12" y1="8.12" x2="12" y2="12"/>
              </svg>
              Split (S)
            </button>

            <button class="btn-micro btn-action-delete" id="btnDelete" title="Delete Selected Clip Segment (Hotkey: Delete / Backspace)">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
              Delete
            </button>

            <button class="btn-micro" id="btnPrevFrame" title="-1 Frame (Hotkey: Left Arrow)">&lt;</button>
            <button class="btn-micro" id="btnNextFrame" title="+1 Frame (Hotkey: Right Arrow)">&gt;</button>
          </div>
        </div>

        <div class="timecode-display" id="tlCurrentTime">00:00.000</div>
      </div>

      <div class="timeline-tracks-wrapper" id="tlTracksWrapper">
        <!-- Track 1: Video Track -->
        <div class="track-row video-track-row" id="videoTrackRow">
          <div class="track-label-pill">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4285f4" stroke-width="2">
              <polygon points="23 7 16 12 23 17 23 7"/>
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
            </svg>
            <span>Video</span>
          </div>

          <div class="track-timeline-area" id="videoTrackArea">
            <div class="clips-container" id="vClipsContainer"></div>
            <div class="playhead-line" id="vPlayhead"></div>
          </div>

          <div class="track-checkbox-col" title="Include/Exclude Video Track">
            <label class="track-chk-label">
              <input type="checkbox" id="chkVideoTrack" checked>
              <span class="chk-box"></span>
            </label>
          </div>
        </div>

        <!-- Track 2: Audio Track -->
        <div class="track-row audio-track-row" id="audioTrackRow">
          <div class="track-label-pill">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ea4335" stroke-width="2">
              <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
            </svg>
            <span>Audio</span>
          </div>

          <div class="track-timeline-area" id="audioTrackArea">
            <div class="clips-container" id="aClipsContainer"></div>
            <div class="playhead-line" id="aPlayhead"></div>
          </div>

          <div class="track-checkbox-col" title="Include/Exclude Audio Track">
            <label class="track-chk-label">
              <input type="checkbox" id="chkAudioTrack" checked>
              <span class="chk-box"></span>
            </label>
          </div>
        </div>
      </div>
    `;

    this.rangeReadout = this.container.querySelector('#tlRangeReadout');
    this.currentTimeLabel = this.container.querySelector('#tlCurrentTime');

    this.btnSplit = this.container.querySelector('#btnSplit');
    this.btnDelete = this.container.querySelector('#btnDelete');
    this.btnPrevFrame = this.container.querySelector('#btnPrevFrame');
    this.btnNextFrame = this.container.querySelector('#btnNextFrame');

    this.videoTrackRow = this.container.querySelector('#videoTrackRow');
    this.videoTrackArea = this.container.querySelector('#videoTrackArea');
    this.vClipsContainer = this.container.querySelector('#vClipsContainer');
    this.vPlayhead = this.container.querySelector('#vPlayhead');
    this.chkVideoTrack = this.container.querySelector('#chkVideoTrack');

    this.audioTrackRow = this.container.querySelector('#audioTrackRow');
    this.audioTrackArea = this.container.querySelector('#audioTrackArea');
    this.aClipsContainer = this.container.querySelector('#aClipsContainer');
    this.aPlayhead = this.container.querySelector('#aPlayhead');
    this.chkAudioTrack = this.container.querySelector('#chkAudioTrack');

    this.attachEvents();
  }

  attachEvents() {
    this.chkVideoTrack.addEventListener('change', (e) => {
      this.isVideoEnabled = e.target.checked;
      this.videoTrackRow.classList.toggle('track-disabled', !this.isVideoEnabled);
      this.emit('videoTrackToggle', this.isVideoEnabled);
    });

    this.chkAudioTrack.addEventListener('change', (e) => {
      this.isAudioEnabled = e.target.checked;
      this.audioTrackRow.classList.toggle('track-disabled', !this.isAudioEnabled);
      this.emit('audioTrackToggle', this.isAudioEnabled);
    });

    this.btnSplit.addEventListener('click', () => this.emit('requestSplit'));
    this.btnDelete.addEventListener('click', () => this.emit('requestDelete'));
    this.btnPrevFrame.addEventListener('click', () => this.stepFrame(-1));
    this.btnNextFrame.addEventListener('click', () => this.stepFrame(1));

    const onMouseMove = (e) => {
      if (!this.totalDuration || this.totalDuration <= 0 || !this.isDraggingPlayhead) return;
      const rect = this.videoTrackArea.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      this.currentTime = ratio * this.totalDuration;
      this.updateVisuals();
      this.emit('seek', this.currentTime);
    };

    const onMouseUp = () => {
      this.isDraggingPlayhead = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    [this.videoTrackArea, this.audioTrackArea].forEach(area => {
      area.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('clip-block-segment')) return;
        this.isDraggingPlayhead = true;
        onMouseMove(e);
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      });
    });
  }

  stepFrame(direction) {
    const frameDuration = 1 / 30;
    const nextTime = Math.max(0, Math.min(this.totalDuration, this.currentTime + direction * frameDuration));
    this.currentTime = nextTime;
    this.updateVisuals();
    this.emit('seek', this.currentTime);
  }

  setClipsState(clips, activeIndex = 0) {
    this.clips = clips;
    this.activeClipIndex = activeIndex;
    this.totalDuration = clips.reduce((acc, c) => acc + Math.max(0.05, c.sourceEnd - c.sourceStart), 0);

    this.renderClipBlocks();
    this.updateVisuals();
  }

  /**
   * Renders Video Thumbnails & Audio Waveform Canvases inside sequential track blocks
   */
  renderClipBlocks() {
    this.vClipsContainer.innerHTML = '';
    this.aClipsContainer.innerHTML = '';

    if (!this.totalDuration || this.totalDuration <= 0) return;

    this.clips.forEach((clip, idx) => {
      const clipLength = clip.sourceEnd - clip.sourceStart;
      const leftPct = (clip.timelineStart / this.totalDuration) * 100;
      const widthPct = (clipLength / this.totalDuration) * 100;
      const isActive = idx === this.activeClipIndex;

      // 1. VIDEO TRACK BLOCK with Thumbnails background
      const vBlock = document.createElement('div');
      vBlock.className = `clip-block-segment v-block ${isActive ? 'active-block' : ''}`;
      vBlock.style.left = `${leftPct}%`;
      vBlock.style.width = `${widthPct}%`;

      // Thumbnails background container
      const thumbsBg = document.createElement('div');
      thumbsBg.className = 'block-thumbs-bg';
      if (clip.thumbnails && clip.thumbnails.length > 0) {
        clip.thumbnails.forEach(src => {
          const img = document.createElement('img');
          img.className = 'thumb-frame';
          img.src = src;
          thumbsBg.appendChild(img);
        });
      }

      const vOverlay = document.createElement('div');
      vOverlay.className = 'block-glass-overlay v-glass';
      vOverlay.innerHTML = `<span class="clip-label-text">${idx + 1}. ${clip.name}</span>`;

      vBlock.appendChild(thumbsBg);
      vBlock.appendChild(vOverlay);
      
      vBlock.addEventListener('click', (e) => {
        e.stopPropagation();
        this.activeClipIndex = idx;
        this.emit('selectClip', idx);
        this.renderClipBlocks();
      });

      this.vClipsContainer.appendChild(vBlock);

      // 2. AUDIO TRACK BLOCK with Waveform Canvas background
      const aBlock = document.createElement('div');
      aBlock.className = `clip-block-segment a-block ${isActive ? 'active-block' : ''}`;
      aBlock.style.left = `${leftPct}%`;
      aBlock.style.width = `${widthPct}%`;

      const audioCanvas = document.createElement('canvas');
      audioCanvas.className = 'block-waveform-canvas';
      this.drawWaveformOnCanvas(audioCanvas);

      const aOverlay = document.createElement('div');
      aOverlay.className = 'block-glass-overlay a-glass';
      aOverlay.innerHTML = `<span class="clip-label-text">${clip.name}</span>`;

      aBlock.appendChild(audioCanvas);
      aBlock.appendChild(aOverlay);

      aBlock.addEventListener('click', (e) => {
        e.stopPropagation();
        this.activeClipIndex = idx;
        this.emit('selectClip', idx);
        this.renderClipBlocks();
      });

      this.aClipsContainer.appendChild(aBlock);
    });
  }

  drawWaveformOnCanvas(canvas) {
    canvas.width = 300;
    canvas.height = 40;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'rgba(234, 67, 53, 0.6)';
    const bars = Math.floor(canvas.width / 3);
    for (let i = 0; i < bars; i++) {
      const h = Math.sin(i * 0.2) * 14 + 16 + Math.random() * 8;
      ctx.fillRect(i * 3, (40 - h) / 2, 2, h);
    }
  }

  setCurrentTime(time) {
    this.currentTime = Math.max(0, Math.min(time, this.totalDuration));
    this.updateVisuals();
  }

  updateVisuals() {
    if (!this.totalDuration || this.totalDuration <= 0) return;

    const currentPct = (this.currentTime / this.totalDuration) * 100;
    this.vPlayhead.style.left = `${currentPct}%`;
    this.aPlayhead.style.left = `${currentPct}%`;

    this.rangeReadout.textContent = `Total Duration: ${this.formatTime(this.totalDuration)} (${this.clips.length} clip${this.clips.length > 1 ? 's' : ''})`;
    this.currentTimeLabel.textContent = this.formatTime(this.currentTime);
  }

  formatTime(seconds) {
    if (!Number.isFinite(seconds) || isNaN(seconds)) return '00:00.000';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
  }
}
