export interface EqualizerSettings {
  enabled: boolean;
  preset: string;
  bands: number[]; // Gain values in dB (-12 to +12)
  bassBoost: number; // 0 to 100%
  virtualizer: boolean; // 3D spatial effect
  preamp: number; // -6 to +6 dB
}

export interface EqBandConfig {
  frequency: number;
  label: string;
  type: BiquadFilterType;
}

export const EQ_BANDS: EqBandConfig[] = [
  { frequency: 60, label: '60 Hz', type: 'lowshelf' },
  { frequency: 230, label: '230 Hz', type: 'peaking' },
  { frequency: 910, label: '910 Hz', type: 'peaking' },
  { frequency: 3600, label: '3.6 kHz', type: 'peaking' },
  { frequency: 14000, label: '14 kHz', type: 'highshelf' },
];

export const EQ_PRESETS: Record<string, { name: string; bands: number[]; bassBoost?: number }> = {
  flat: { name: 'Flat / Studio', bands: [0, 0, 0, 0, 0], bassBoost: 0 },
  bass_boost: { name: 'Bass Boost', bands: [8, 5, 1, 0, 1], bassBoost: 40 },
  vocal: { name: 'Vocal Clarity', bands: [-2, 1, 6, 4, 1], bassBoost: 0 },
  treble_boost: { name: 'Treble Boost', bands: [-2, -1, 1, 5, 8], bassBoost: 0 },
  electronic: { name: 'Electronic / EDM', bands: [6, 4, -1, 3, 5], bassBoost: 30 },
  rock: { name: 'Rock / Metal', bands: [5, 3, -1, 3, 5], bassBoost: 20 },
  hiphop: { name: 'Hip-Hop / R&B', bands: [7, 5, 0, 2, 4], bassBoost: 35 },
  pop: { name: 'Pop Hits', bands: [2, 4, 5, 3, -1], bassBoost: 15 },
  jazz: { name: 'Jazz & Blues', bands: [3, 2, 1, 3, 4], bassBoost: 10 },
  classical: { name: 'Classical Hall', bands: [4, 2, -1, 3, 3], bassBoost: 0 },
  acoustic: { name: 'Acoustic / Live', bands: [3, 2, 3, 4, 2], bassBoost: 10 },
  dynamic_club: { name: 'Dynamic Club', bands: [9, 6, 0, 4, 7], bassBoost: 50 },
};

const STORAGE_KEY = 'zenisai_eq_settings_v1';

class EqualizerService {
  private audioCtx: AudioContext | null = null;
  private filterNodes: BiquadFilterNode[] = [];
  private bassBoostNode: BiquadFilterNode | null = null;
  private preampGainNode: GainNode | null = null;
  private delayNode: DelayNode | null = null;
  private delayGainNode: GainNode | null = null;
  private isInitialized = false;

  private settings: EqualizerSettings = {
    enabled: true,
    preset: 'flat',
    bands: [0, 0, 0, 0, 0],
    bassBoost: 0,
    virtualizer: false,
    preamp: 0,
  };

  private listeners: Array<(s: EqualizerSettings) => void> = [];

  constructor() {
    this.loadSettings();
  }

  private loadSettings() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        this.settings = { ...this.settings, ...parsed };
      }
    } catch (e) {
      console.warn('Could not load EQ settings', e);
    }
  }

  private saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
      this.notifyListeners();
    } catch {}
  }

  public subscribe(cb: (s: EqualizerSettings) => void): () => void {
    this.listeners.push(cb);
    cb(this.getSettings());
    return () => {
      this.listeners = this.listeners.filter(l => l !== cb);
    };
  }

  private notifyListeners() {
    const copy = this.getSettings();
    this.listeners.forEach(cb => {
      try { cb(copy); } catch {}
    });
  }

  public getSettings(): EqualizerSettings {
    return { ...this.settings, bands: [...this.settings.bands] };
  }

  /**
   * Chains Web Audio API nodes:
   * source -> preampGain -> filter0 -> filter1 -> ... -> bassBoost -> delayNode (virtualizer) -> analyser -> destination
   */
  public connectNodes(
    sourceNode: MediaElementAudioSourceNode,
    ctx: AudioContext,
    analyserNode: AnalyserNode
  ) {
    try {
      this.audioCtx = ctx;
      this.filterNodes = [];

      // Preamp
      this.preampGainNode = ctx.createGain();
      this.updatePreampGain();

      // Create 5-band EQ biquad filters
      EQ_BANDS.forEach((bandConfig, index) => {
        const filter = ctx.createBiquadFilter();
        filter.type = bandConfig.type;
        filter.frequency.setValueAtTime(bandConfig.frequency, ctx.currentTime);
        filter.Q.setValueAtTime(1.4, ctx.currentTime);
        filter.gain.setValueAtTime(
          this.settings.enabled ? (this.settings.bands[index] || 0) : 0,
          ctx.currentTime
        );
        this.filterNodes.push(filter);
      });

      // Bass Boost filter (low-shelf at 80Hz)
      this.bassBoostNode = ctx.createBiquadFilter();
      this.bassBoostNode.type = 'lowshelf';
      this.bassBoostNode.frequency.setValueAtTime(80, ctx.currentTime);
      this.updateBassBoostGain();

      // 3D Virtualizer / Spatializer (comb filter with subtle stereo delay)
      this.delayNode = ctx.createDelay(0.05);
      this.delayNode.delayTime.setValueAtTime(0.016, ctx.currentTime); // ~16ms binaural acoustic delay
      this.delayGainNode = ctx.createGain();
      this.delayGainNode.gain.setValueAtTime(this.settings.virtualizer ? 0.35 : 0, ctx.currentTime);

      // Connect the chain:
      // source -> preampGain
      sourceNode.connect(this.preampGainNode);

      // preampGain -> filter0 -> filter1 -> ...
      let prevNode: AudioNode = this.preampGainNode;
      this.filterNodes.forEach(filter => {
        prevNode.connect(filter);
        prevNode = filter;
      });

      // last filter -> bassBoost
      prevNode.connect(this.bassBoostNode);

      // bassBoost -> delayNode -> delayGainNode -> analyser
      this.bassBoostNode.connect(analyserNode);
      this.bassBoostNode.connect(this.delayNode);
      this.delayNode.connect(this.delayGainNode);
      this.delayGainNode.connect(analyserNode);

      // analyser -> destination
      analyserNode.connect(ctx.destination);

      this.isInitialized = true;
      this.applyAll();
    } catch (e) {
      console.warn('Equalizer audio chain connection warning:', e);
    }
  }

  public setEnabled(enabled: boolean) {
    this.settings.enabled = enabled;
    this.applyAll();
    this.saveSettings();
  }

  public setBand(index: number, gainDb: number) {
    const clamped = Math.max(-12, Math.min(12, Math.round(gainDb * 10) / 10));
    const nextBands = [...this.settings.bands];
    nextBands[index] = clamped;
    this.settings.bands = nextBands;
    this.settings.preset = 'custom';

    if (this.filterNodes[index] && this.audioCtx) {
      const targetGain = this.settings.enabled ? clamped : 0;
      this.filterNodes[index].gain.setTargetAtTime(targetGain, this.audioCtx.currentTime, 0.04);
    }

    this.saveSettings();
  }

  public setBassBoost(percent: number) {
    this.settings.bassBoost = Math.max(0, Math.min(100, Math.round(percent)));
    this.updateBassBoostGain();
    this.saveSettings();
  }

  public setVirtualizer(enabled: boolean) {
    this.settings.virtualizer = enabled;
    if (this.delayGainNode && this.audioCtx) {
      this.delayGainNode.gain.setTargetAtTime(enabled ? 0.35 : 0, this.audioCtx.currentTime, 0.05);
    }
    this.saveSettings();
  }

  public setPreamp(gainDb: number) {
    this.settings.preamp = Math.max(-6, Math.min(6, Math.round(gainDb * 10) / 10));
    this.updatePreampGain();
    this.saveSettings();
  }

  public setPreset(presetKey: string) {
    const preset = EQ_PRESETS[presetKey];
    if (!preset) return;
    this.settings.preset = presetKey;
    this.settings.bands = [...preset.bands];
    if (preset.bassBoost !== undefined) {
      this.settings.bassBoost = preset.bassBoost;
    }
    this.applyAll();
    this.saveSettings();
  }

  public resetFlat() {
    this.setPreset('flat');
  }

  private updatePreampGain() {
    if (!this.preampGainNode || !this.audioCtx) return;
    const gainValue = this.settings.enabled ? Math.pow(10, this.settings.preamp / 20) : 1;
    this.preampGainNode.gain.setTargetAtTime(gainValue, this.audioCtx.currentTime, 0.05);
  }

  private updateBassBoostGain() {
    if (!this.bassBoostNode || !this.audioCtx) return;
    const gainDb = this.settings.enabled ? (this.settings.bassBoost / 100) * 12 : 0; // Up to +12dB
    this.bassBoostNode.gain.setTargetAtTime(gainDb, this.audioCtx.currentTime, 0.05);
  }

  private applyAll() {
    if (!this.audioCtx) return;
    const isEqOn = this.settings.enabled;

    this.filterNodes.forEach((node, idx) => {
      const val = isEqOn ? (this.settings.bands[idx] || 0) : 0;
      node.gain.setTargetAtTime(val, this.audioCtx!.currentTime, 0.04);
    });

    this.updateBassBoostGain();
    this.updatePreampGain();

    if (this.delayGainNode) {
      const val = isEqOn && this.settings.virtualizer ? 0.35 : 0;
      this.delayGainNode.gain.setTargetAtTime(val, this.audioCtx.currentTime, 0.05);
    }
  }
}

export const equalizerService = new EqualizerService();
