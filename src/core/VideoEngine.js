/**
 * VideoEngine.js
 * Sony Vegas style Multi-Clip Sequential Engine.
 * Features:
 * 1. Thumbnail caching per clip segment for instant fluid rendering.
 * 2. Strict sequential clip placement along timeline axis (no overlapping).
 * 3. Instant frame-accurate 'S' key splitting.
 * 4. Master time mapping across clips.
 */

export class VideoEngine {
  constructor() {
    this.clips = [];
    this.activeClipIndex = 0;
    this.masterTime = 0;
    this.listeners = new Map();
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

  /**
   * Browser workaround for WebM videos that report duration = Infinity or NaN
   */
  static async resolveDuration(video) {
    if (Number.isFinite(video.duration) && !isNaN(video.duration) && video.duration > 0) {
      return video.duration;
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        video.currentTime = 0;
        resolve(video.duration && Number.isFinite(video.duration) ? video.duration : 10);
      }, 1200);

      const onTimeUpdate = () => {
        clearTimeout(timeout);
        video.removeEventListener('timeupdate', onTimeUpdate);
        const realDuration = video.duration;
        video.currentTime = 0;
        resolve(Number.isFinite(realDuration) && !isNaN(realDuration) ? realDuration : 10);
      };

      video.addEventListener('timeupdate', onTimeUpdate);
      video.currentTime = 1e101;
    });
  }

  async addClip(file) {
    const clipId = 'clip_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
    const url = URL.createObjectURL(file);

    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.src = url;
      video.crossOrigin = 'anonymous';
      video.preload = 'auto';

      video.onloadedmetadata = async () => {
        const duration = await VideoEngine.resolveDuration(video);

        // Pre-generate thumbnail cached array
        const thumbnails = await this.generateThumbnailsForVideo(video, duration, 10);

        const clip = {
          id: clipId,
          name: file.name,
          file: file,
          url: url,
          duration: duration,
          sourceStart: 0,
          sourceEnd: duration,
          videoStartTime: 0,
          videoEndTime: duration,
          audioStartTime: 0,
          audioEndTime: duration,
          isVideoEnabled: true,
          isAudioEnabled: true,
          videoEl: video,
          thumbnails: thumbnails,
          timelineStart: 0,
          timelineEnd: duration
        };

        this.clips.push(clip);
        this.recalculateTimelinePositions();
        this.activeClipIndex = this.clips.length - 1;

        this.emit('clipAdded', { clip, clips: this.clips });
        this.emit('stateChanged', this.getState());
        resolve(clip);
      };

      video.onerror = () => {
        reject(new Error('Failed to load video file: ' + file.name));
      };
    });
  }

  /**
   * Recalculates sequential positions for Sony Vegas style left-to-right clip alignment
   */
  recalculateTimelinePositions() {
    let currentMasterTime = 0;
    this.clips.forEach(clip => {
      const clipLength = Math.max(0.05, clip.sourceEnd - clip.sourceStart);
      clip.timelineStart = currentMasterTime;
      clip.timelineEnd = currentMasterTime + clipLength;
      currentMasterTime += clipLength;
    });
  }

  /**
   * Fluid 'S' Key Split
   */
  splitClipAtTime(masterTime) {
    if (this.clips.length === 0) return null;

    // Find clip containing masterTime
    const clipIndex = this.clips.findIndex(c => masterTime >= c.timelineStart - 0.001 && masterTime <= c.timelineEnd + 0.001);
    if (clipIndex === -1) return null;

    const clip = this.clips[clipIndex];
    const offset = masterTime - clip.timelineStart;
    
    // Require minimum 0.05s length for split
    if (offset <= 0.05 || offset >= (clip.sourceEnd - clip.sourceStart) - 0.05) {
      return null;
    }

    const splitSourcePoint = clip.sourceStart + offset;
    const originalSourceEnd = clip.sourceEnd;

    // Segment A (Update existing)
    clip.sourceEnd = splitSourcePoint;
    clip.videoEndTime = splitSourcePoint;
    clip.audioEndTime = splitSourcePoint;

    // Segment B (Create new segment)
    const newSegment = {
      ...clip,
      id: 'clip_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      name: clip.name,
      sourceStart: splitSourcePoint,
      sourceEnd: originalSourceEnd,
      videoStartTime: splitSourcePoint,
      videoEndTime: originalSourceEnd,
      audioStartTime: splitSourcePoint,
      audioEndTime: originalSourceEnd,
      thumbnails: [...clip.thumbnails]
    };

    // Insert Segment B right after Segment A
    this.clips.splice(clipIndex + 1, 0, newSegment);
    this.recalculateTimelinePositions();
    this.activeClipIndex = clipIndex + 1;

    this.emit('clipSplit', { index: clipIndex, newClip: newSegment, clips: this.clips });
    this.emit('stateChanged', this.getState());
    return newSegment;
  }

  /**
   * Removes selected clip segment ('Delete' / 'Backspace')
   */
  removeClip(index) {
    if (index >= 0 && index < this.clips.length) {
      const removed = this.clips.splice(index, 1)[0];
      
      const stillUsed = this.clips.some(c => c.url === removed.url);
      if (!stillUsed && removed && removed.url) {
        URL.revokeObjectURL(removed.url);
      }

      this.recalculateTimelinePositions();
      this.activeClipIndex = Math.max(0, Math.min(this.activeClipIndex, this.clips.length - 1));

      this.emit('clipRemoved', { index, clips: this.clips });
      this.emit('stateChanged', this.getState());
    }
  }

  getActiveClip() {
    return this.clips[this.activeClipIndex] || null;
  }

  getTotalMasterDuration() {
    if (this.clips.length === 0) return 0;
    return this.clips[this.clips.length - 1].timelineEnd;
  }

  getState() {
    return {
      clips: this.clips,
      activeClipIndex: this.activeClipIndex,
      activeClip: this.getActiveClip(),
      totalDuration: this.getTotalMasterDuration()
    };
  }

  async generateThumbnailsForVideo(video, duration, count = 10) {
    const thumbnails = [];
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 100;
    canvas.height = 56;

    const step = duration / count;
    for (let i = 0; i < count; i++) {
      const targetTime = Math.min(duration - 0.05, i * step);
      video.currentTime = targetTime;
      await new Promise(res => {
        const onSeek = () => {
          video.removeEventListener('seeked', onSeek);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          thumbnails.push(canvas.toDataURL('image/jpeg', 0.5));
          res();
        };
        video.addEventListener('seeked', onSeek);
        setTimeout(onSeek, 150);
      });
    }
    return thumbnails;
  }
}
