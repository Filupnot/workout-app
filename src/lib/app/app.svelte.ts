import { ADMITTED_KEY, createSession, type Session } from '$lib/auth/session';
import { apiUrl, authConfig, localPreviewAllowed } from '$lib/config';
import { entries, finishedWorkouts, lastPerformed, sets, workouts } from '$lib/domain/history';
import { aggregateKey, defaultProfile, newWorkout, recordKey, seedExercises, type Exercise, type Profile, type Rowing, type Strength, type Workout, type WorkoutRecord } from '$lib/domain/model';
import { addEntry, confirmSet, emptyDraft, entryRemoval, finishWorkout, prefill, rowingEntry, workoutDeletion, type Batch, type Draft } from '$lib/domain/session';
import { adjust, remaining, startRest, tick, visibility, type RestTimer } from '$lib/domain/timer';
import { LocalStore, openWorkoutDB, type StoredRecord } from '$lib/storage/database';
import { createApi, fetchAggregate, HttpError, idleStatus, pullLibrary, pullWorkouts, SyncEngine, type Api, type SyncStatus } from '$lib/storage/sync';
import { describe } from './describe';

export type View = 'today' | 'history' | 'exercises';
export type Phase = 'loading' | 'welcome' | 'denied' | 'ready';
export const THEME_KEY = 'workout-theme';
const PREVIEW_OWNER = 'local-preview';
const PREVIEW_KEY = 'workout-preview';

type Conflict = { aggregate: string; kind: 'conflict' | 'invalid'; remote: Omit<StoredRecord, 'owner'>[]; local: string[]; server: string[] };

export class WorkoutApp {
  phase = $state<Phase>('loading');
  view = $state<View>('today');
  busy = $state(false);
  error = $state('');
  notice = $state('');
  preview = $state(false);
  records = $state<WorkoutRecord[]>([]);
  draft = $state<Draft>(emptyDraft());
  timer = $state<RestTimer | null>(null);
  now = $state(Date.now());
  status = $state<SyncStatus>('synced');
  pendingCount = $state(0);
  olderCursor = $state<string | undefined>(undefined);
  conflict = $state<Conflict | null>(null);
  picker = $state(false);
  readonly configured = !!authConfig() && !!apiUrl;
  readonly previewAllowed = localPreviewAllowed;

  private store?: LocalStore;
  private engine?: SyncEngine;
  private session?: Session;
  private api?: Api;
  private audio?: AudioContext;

  profile = $derived<Profile>(this.records.find((r): r is Profile => r.kind === 'profile') ?? { ...defaultProfile });
  current = $derived(workouts(this.records).find(w => w.status === 'active'));
  library = $derived(this.records.filter((r): r is Exercise => r.kind === 'exercise')
    .sort((a, b) => (b.lastUsedAt ?? '').localeCompare(a.lastUsedAt ?? '') || a.name.localeCompare(b.name)));
  currentEntries = $derived(this.current ? entries(this.records, this.current.id) : []);
  activeEntry = $derived(this.currentEntries.find((e): e is Strength => e.kind === 'strength' && e.id === this.draft.selected));
  activeSets = $derived(this.activeEntry ? sets(this.records, this.activeEntry.id) : []);
  prior = $derived(this.activeEntry ? lastPerformed(this.records, this.activeEntry.exerciseId, this.current?.id) : undefined);
  finished = $derived(finishedWorkouts(this.records));
  rest = $derived(this.timer ? remaining(this.timer, this.now) : this.profile.restSeconds);

  private queue: Promise<void> = Promise.resolve();
  private running = 0;
  /**
   * Runs actions one at a time, in the order they were requested, with a visible error
   * instead of a silent failure. Nothing the user taps is dropped.
   */
  act(fn: () => Promise<void> | void) {
    this.running++; this.busy = true;
    const run = async () => {
      this.error = '';
      try { await fn(); }
      catch (e) { this.error = e instanceof Error ? e.message : 'Something went wrong. Please try again.'; }
      finally { if (--this.running === 0) this.busy = false; }
    };
    return (this.queue = this.queue.then(run));
  }

  // ----- Startup and session -----

  async start() {
    const config = authConfig();
    try {
      if (this.previewAllowed && localStorage.getItem(PREVIEW_KEY)) { await this.openPreview(); return; }
      if (!config || !apiUrl) { this.phase = 'welcome'; return; }
      this.session = createSession(config);
      this.api = createApi(apiUrl, () => this.session!.token());
      const user = await this.session.current();
      if (!user) { this.phase = 'welcome'; return; }
      const subject = user.profile.sub;
      if (localStorage.getItem(ADMITTED_KEY) === subject) {
        // Previously admitted on this device: open local data immediately, then sync.
        await this.open(subject);
        void this.refresh(true);
        return;
      }
      try { await this.api('/profile'); }
      catch (e) {
        if (e instanceof HttpError && e.status === 403) { this.phase = 'denied'; return; }
        if (e instanceof HttpError && e.status === 401) { this.phase = 'welcome'; this.error = 'Your sign-in expired. Please sign in again.'; return; }
        this.phase = 'welcome'; this.error = 'Connect to the internet to finish signing in.'; return;
      }
      localStorage.setItem(ADMITTED_KEY, subject);
      await this.open(subject);
      await this.refresh(true);
    } catch {
      this.phase = 'welcome';
      this.error = 'Workout could not open its storage on this device. Check that private browsing is off.';
    }
  }
  signIn() { return this.act(async () => { if (!this.session) throw new Error('Sign-in is not configured.'); await this.session.signIn(); }); }
  openPreview() {
    return this.act(async () => {
      this.preview = true; this.api = undefined;
      localStorage.setItem(PREVIEW_KEY, '1');
      await this.open(PREVIEW_OWNER); await this.seed();
    });
  }
  private async open(owner: string) {
    this.store = new LocalStore(await openWorkoutDB(), owner);
    await this.reload();
    this.timer = (await this.store.local<RestTimer | null>('rest')) ?? null;
    if (this.timer) await this.setTimer(visibility(this.timer, !document.hidden));
    this.draft = { ...emptyDraft(this.profile.unit), ...((await this.store.local<Draft>('draft')) ?? {}) };
    if (this.api) this.engine = new SyncEngine(this.store, m => this.api!('/mutations', m), s => { this.status = s; void this.countPending(); });
    this.status = idleStatus(await this.store.pending());
    await this.countPending();
    this.phase = 'ready';
  }
  // Preview data never syncs, so its outbox is not meaningful.
  private async countPending() { this.pendingCount = this.preview ? 0 : (await this.store?.pending())?.length ?? 0; }
  private async reload() {
    if (!this.store) return;
    this.records = (await this.store.records()).map(r => r.value);
    this.applyTheme();
  }
  /** Sends queued changes, then pulls the library and newest workouts. Never blocks local logging. */
  async refresh(first = false) {
    if (!this.store || !this.api || !this.engine) return;
    try {
      await this.engine.flush();
      if (!navigator.onLine) return;
      await pullLibrary(this.api, this.store);
      const cursor = await pullWorkouts(this.api, this.store);
      if (first) this.olderCursor = cursor;
      await this.reload();
    } catch (e) {
      if (e instanceof HttpError && (e.status === 401 || e.status === 403)) this.status = 'signin';
    } finally {
      if (first) await this.seed();
    }
  }
  private async seed() {
    if (!this.store) return;
    if (!this.records.some(r => r.kind === 'profile')) await this.save([{ ...defaultProfile }]);
    if (!this.records.some(r => r.kind === 'exercise')) for (const e of seedExercises()) await this.save([e]);
  }
  loadOlder() {
    return this.act(async () => {
      if (!this.api || !this.store || !this.olderCursor) return;
      this.olderCursor = await pullWorkouts(this.api, this.store, this.olderCursor);
      await this.reload();
    });
  }
  syncNow() {
    return this.act(async () => {
      if (this.status === 'signin') { await this.session?.signIn(); return; }
      if (this.status === 'conflict' || this.status === 'failed') { await this.openConflict(); return; }
      await this.refresh();
    });
  }

  /** Saves locally in one transaction with its outbox entry, then syncs in the background. */
  private async save(values: WorkoutRecord[], removed: string[] = []) {
    if (!this.store) throw new Error('Storage is unavailable.');
    try { await this.store.save(values, removed); }
    catch { throw new Error('This change could not be saved on your device. Nothing was recorded; please try again.'); }
    await this.reload();
    if (this.engine) { this.status = 'local'; await this.countPending(); void this.engine.flush(); }
  }
  async persistDraft() {
    try { await this.store?.setLocal('draft', $state.snapshot(this.draft)); }
    catch { this.error = 'Your unsaved entry could not be stored on this device.'; }
  }
  setDraft(patch: Partial<Draft>) { Object.assign(this.draft, patch); void this.persistDraft(); }

  // ----- Settings -----

  updateProfile(patch: Partial<Profile>) {
    return this.act(async () => {
      if (patch.restSeconds !== undefined && (!Number.isInteger(patch.restSeconds) || patch.restSeconds < 5 || patch.restSeconds > 1800))
        throw new Error('Rest must be between 5 and 1800 seconds.');
      if (patch.sound) this.ensureAudio();
      await this.save([{ ...this.profile, ...patch }]);
    });
  }
  applyTheme() {
    const theme = this.profile.theme;
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* theme falls back to system */ }
  }

  // ----- Rest timer -----

  private async setTimer(next: RestTimer | null) {
    this.timer = next; this.now = Date.now();
    try { await this.store?.setLocal('rest', next ? { ...next } : null); }
    catch { this.error = 'The rest timer could not be saved on this device.'; }
  }
  /** "I just finished a set": rest starts immediately, before any typing or saving. */
  startRest() {
    if (this.profile.sound) this.ensureAudio();
    void this.setTimer(startRest(this.profile.restSeconds));
    return this.act(async () => {
      if (!this.current) await this.save([newWorkout()]);
      if (!this.activeEntry) this.picker = true;
    });
  }
  skipRest() { void this.setTimer(null); }
  adjustRest(seconds: number) { if (this.timer) void this.setTimer(adjust(this.timer, seconds)); }
  tick() {
    this.now = Date.now();
    if (!this.timer) return;
    const result = tick(this.timer, this.now, !document.hidden, this.profile.sound);
    if (result.timer.consumed !== this.timer.consumed) void this.setTimer(result.timer);
    if (result.cue) this.tone();
  }
  visibilityChanged() {
    if (this.timer) void this.setTimer(visibility(this.timer, !document.hidden));
    if (!document.hidden) void this.refresh();
  }
  private ensureAudio() {
    try { this.audio ??= new AudioContext(); void this.audio.resume(); } catch { /* audio unsupported */ }
  }
  tone() {
    const audio = this.audio;
    if (!audio || audio.state !== 'running') return;
    const oscillator = audio.createOscillator(), gain = audio.createGain();
    oscillator.connect(gain); gain.connect(audio.destination);
    oscillator.type = 'sine'; oscillator.frequency.value = 660;
    gain.gain.setValueAtTime(0.0001, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, audio.currentTime + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.7);
    oscillator.start(); oscillator.stop(audio.currentTime + 0.75);
  }
  testSound() { this.ensureAudio(); setTimeout(() => this.tone(), 50); }
  close() { this.engine?.stop(); this.store?.db.close(); void this.audio?.close(); }

  // ----- Workout logging -----

  startWorkout() { return this.act(async () => { if (!this.current) await this.save([newWorkout()]); }); }
  chooseExercise(exercise: Exercise) {
    return this.act(async () => {
      const workout = this.current ?? newWorkout();
      if (!this.current) await this.save([workout]);
      const entry = addEntry(this.records, workout, exercise);
      await this.save([entry]);
      await this.save([{ ...exercise, lastUsedAt: new Date().toISOString() }]);
      const previous = lastPerformed(this.records, exercise.id, workout.id);
      const lastSets = previous?.entries.find(e => e.entry.details.angle === entry.details.angle)?.sets ?? previous?.entries[0].sets;
      this.picker = false;
      this.setDraft({ selected: entry.id, ...prefill([], lastSets, this.profile.unit), angle: entry.details.angle?.toString() ?? '', entryNote: '', editSetId: '' });
    });
  }
  selectEntry(entry: Strength) {
    this.setDraft({ selected: entry.id, ...prefill(sets(this.records, entry.id), undefined, this.profile.unit),
      angle: entry.details.angle?.toString() ?? '', entryNote: entry.notes, editSetId: '' });
    this.picker = false;
  }
  logSet() {
    return this.act(async () => {
      if (!this.current || !this.activeEntry) throw new Error('Choose an exercise first.');
      const result = confirmSet(this.records, this.current, this.activeEntry, this.draft);
      await this.save(result.records);
      this.setDraft({ selected: result.entry.id, editSetId: '' });
    });
  }
  editSet(id: string) {
    const set = this.activeSets.find(s => s.id === id);
    if (set) this.setDraft({ editSetId: id, weight: String(set.weight), reps: String(set.reps), unit: set.unit });
  }
  cancelEdit() { this.setDraft({ editSetId: '', ...prefill(this.activeSets, undefined, this.profile.unit) }); }
  removeSet(id: string) {
    return this.act(async () => {
      const set = this.activeSets.find(s => s.id === id);
      if (!set || !this.activeEntry) return;
      await this.save([this.activeEntry], [recordKey(set)]);
      if (this.draft.editSetId === id) this.cancelEdit();
    });
  }
  saveEntryNote() {
    return this.act(async () => {
      if (this.activeEntry && this.activeEntry.notes !== this.draft.entryNote) await this.save([{ ...this.activeEntry, notes: this.draft.entryNote.slice(0, 2000) }]);
    });
  }
  addRow() {
    return this.act(async () => {
      if (!this.current) throw new Error('Start a workout first.');
      await this.save([rowingEntry(this.records, this.current, this.draft)]);
      this.setDraft({ rowTime: '', rowDistance: '', rowSplit: '' });
    });
  }
  setStretched(stretched: boolean) { return this.act(async () => { if (this.current) await this.save([{ ...this.current, stretched }]); }); }
  saveSessionNote() {
    return this.act(async () => { if (this.current && this.current.notes !== this.draft.sessionNote) await this.save([{ ...this.current, notes: this.draft.sessionNote.slice(0, 2000) }]); });
  }
  finish() {
    return this.act(async () => {
      if (!this.current) return;
      await this.save([finishWorkout(this.current, this.draft.sessionNote)]);
      await this.setTimer(null);
      this.setDraft({ ...emptyDraft(this.profile.unit) });
      this.notice = 'Workout saved';
      setTimeout(() => { if (this.notice === 'Workout saved') this.notice = ''; }, 5000);
    });
  }

  // ----- Correcting mistakes -----

  private async saveBatches(batches: Batch[]) { for (const b of batches) await this.save(b.values, b.removed); }
  removeEntry(entry: Strength | Rowing) {
    return this.act(async () => {
      if (!this.current || entry.workoutId !== this.current.id) return;
      await this.saveBatches(entryRemoval(this.records, this.current, entry));
      if (this.draft.selected === entry.id) this.setDraft({ selected: '', weight: '', reps: '', angle: '', entryNote: '', editSetId: '' });
    });
  }
  deleteWorkout(workout: Workout) {
    return this.act(async () => {
      const active = workout.id === this.current?.id;
      await this.saveBatches(workoutDeletion(this.records, workout));
      if (active) { await this.setTimer(null); this.setDraft({ ...emptyDraft(this.profile.unit) }); }
    });
  }

  // ----- Exercise library -----

  saveExercise(input: { id?: string; name: string; category: Exercise['category']; angle: string }) {
    return this.act(async () => {
      const name = input.name.trim();
      if (!name) throw new Error('Give the exercise a name.');
      const existing = this.library.find(e => e.id === input.id);
      const angle = input.angle.trim() ? Number(input.angle) : undefined;
      if (angle !== undefined && (!Number.isFinite(angle) || angle < -90 || angle > 90)) throw new Error('Angle must be between -90 and 90 degrees.');
      const exercise: Exercise = { schemaVersion: 1, kind: 'exercise', id: existing?.id ?? crypto.randomUUID(), name, category: input.category,
        details: angle === undefined ? {} : { angle }, archived: existing?.archived ?? false, ...(existing?.lastUsedAt ? { lastUsedAt: existing.lastUsedAt } : {}) };
      await this.save([exercise]);
    });
  }
  setArchived(exercise: Exercise, archived: boolean) { return this.act(() => this.save([{ ...exercise, archived }])); }

  // ----- Conflicts and sign-out -----

  async openConflict() {
    if (!this.store) return;
    const item = (await this.store.pending()).find(p => p.error);
    if (!item) { this.status = idleStatus([]); return; }
    if (!this.api) throw new Error('Connect to review online changes.');
    const remote = await fetchAggregate(this.api, item.aggregate);
    const local = this.records.filter(r => aggregateKey(r) === item.aggregate);
    this.conflict = { aggregate: item.aggregate, kind: item.error === 'conflict' ? 'conflict' : 'invalid', remote,
      local: describe(local), server: describe(remote.map(r => r.value)) };
  }
  resolveConflict(choice: 'local' | 'server') {
    return this.act(async () => {
      if (!this.store || !this.conflict) return;
      await this.store.resolve(this.conflict.aggregate, this.conflict.remote, choice);
      this.conflict = null;
      await this.reload();
      await this.refresh();
    });
  }
  signOut(discard: boolean) {
    return this.act(async () => {
      if (!this.store) { await this.session?.signOut(); return; }
      if (!discard && !this.preview) {
        await this.engine?.flush();
        if ((await this.store.pending()).length) throw new Error('Some changes have not synced yet. Connect and try again, or discard them.');
      }
      this.engine?.stop();
      await this.store.clear(discard || this.preview);
      this.store.db.close();
      this.store = undefined; this.engine = undefined;
      this.records = []; this.timer = null; this.draft = emptyDraft(); this.olderCursor = undefined;
      if (this.preview) { this.preview = false; localStorage.removeItem(PREVIEW_KEY); this.phase = 'welcome'; return; }
      await this.session?.signOut();
    });
  }
  denySignOut() { return this.act(async () => { await this.session?.signOut(); }); }
}
