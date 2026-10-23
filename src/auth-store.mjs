import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { atomicJson } from './state.mjs';

const digest = value => createHash('sha256').update(value).digest('hex');
const equal = (left, right) => timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
const DEVICE_TTL = 30 * 24 * 60 * 60 * 1000;

export class DeviceStore {
  #file; #devices = new Map(); #ticket; #accessLink; #pending = Promise.resolve(); #now;
  constructor(directory, now = Date.now) { this.#file = path.join(directory, 'devices.json'); this.#now = now; }
  async load() {
    try {
      const document = JSON.parse(await readFile(this.#file, 'utf8'));
      if (![1,2].includes(document.schemaVersion) || !Array.isArray(document.devices)) throw new Error('Invalid device state');
      if (document.accessLink !== undefined) {
        const link = document.accessLink;
        if (!link || !/^[A-Za-z0-9_-]{43}$/.test(link.secret) || typeof link.generation !== 'string' || !Number.isSafeInteger(link.createdAt)) throw new Error('Invalid access link');
        this.#accessLink = link;
      }
      for (const device of document.devices) {
        if (typeof device.id !== 'string' || !/^[a-f0-9]{64}$/.test(device.tokenHash) || typeof device.label !== 'string' || !Number.isSafeInteger(device.expiresAt) || !Number.isSafeInteger(device.createdAt) || this.#devices.has(device.id)) throw new Error('Invalid device state');
        if (device.expiresAt > this.#now()) this.#devices.set(device.id, device);
      }
    } catch (error) { if (error.code !== 'ENOENT') throw new Error('Device state cannot be loaded; access remains closed'); }
  }
  issue() {
    const secret = randomBytes(32).toString('base64url');
    const code = String(randomInt(0, 100000000)).padStart(8, '0');
    const expiresAt = this.#now() + 5 * 60 * 1000;
    this.#ticket = { secretHash: digest(secret), codeHash: digest(code), expiresAt };
    return { secret, code, expiresAt };
  }
  invalidateTicket() { this.#ticket = undefined; }
  pairingAvailable() { return !!this.#ticket && this.#ticket.expiresAt > this.#now(); }
  existingAccessLink() { return this.#accessLink ? { ...this.#accessLink, expiresAt: null } : null; }
  async accessLink() {
    if (!this.#accessLink) await this.#transaction(() => {
      this.#accessLink ??= { secret: randomBytes(32).toString('base64url'), generation: randomUUID(), createdAt: this.#now() };
    });
    return this.existingAccessLink();
  }
  async resetAccessLink() {
    await this.#transaction(() => {
      this.#accessLink = { secret: randomBytes(32).toString('base64url'), generation: randomUUID(), createdAt: this.#now() };
      this.#devices.clear(); this.#ticket = undefined;
    });
    return this.existingAccessLink();
  }
  async #transaction(change) {
    const operation = this.#pending.catch(() => {}).then(async () => {
      const before = new Map(this.#devices);
      const beforeLink = this.#accessLink, beforeTicket = this.#ticket;
      try {
        const result = change();
        await atomicJson(this.#file, { schemaVersion: 2, devices: [...this.#devices.values()], ...(this.#accessLink ? {accessLink:this.#accessLink} : {}) });
        return result;
      } catch (error) { this.#devices = before; this.#accessLink = beforeLink; this.#ticket = beforeTicket; throw error; }
    });
    this.#pending = operation;
    return operation;
  }
  async claim(credential, label = 'Browser', existingToken) {
    if (typeof credential !== 'string' || !/^(?:[A-Za-z0-9_-]{43}|[0-9]{8})$/.test(credential)) return undefined;
    // Validate within the same queue as reset/revoke. A claim queued behind a
    // reset must never authorize a device using the previous link.
    return await this.#transaction(() => {
      const ticket = this.#ticket, candidate = digest(credential);
      const permanent = !!this.#accessLink && equal(candidate, digest(this.#accessLink.secret));
      if (!permanent && (!ticket || ticket.expiresAt <= this.#now() || (!equal(candidate, ticket.secretHash) && !equal(candidate, ticket.codeHash)))) return undefined;
      if (!permanent) this.#ticket = undefined;
      const existing = this.authenticate(existingToken);
      if (existing) return { token:existingToken, device:existing };
      const token = randomBytes(32).toString('base64url');
      const device = { id: randomUUID(), label: String(label).slice(0, 80), tokenHash: digest(token), createdAt: this.#now(), expiresAt: this.#now() + DEVICE_TTL };
      this.#devices.set(device.id, device);
      return { token, device: this.#public(device) };
    });
  }
  authenticate(token) {
    if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) return undefined;
    const hash = digest(token);
    const found = [...this.#devices.values()].find(device => device.tokenHash === hash && device.expiresAt > this.#now());
    return found && this.#public(found);
  }
  #public({ tokenHash: _secret, ...device }) { return device; }
  list() { return [...this.#devices.values()].filter(device => device.expiresAt > this.#now()).map(device => this.#public(device)); }
  async revoke(id) { return await this.#transaction(() => this.#devices.delete(id)); }
}

export class AttemptLimiter {
  #attempts = []; #now;
  constructor(now = Date.now) { this.#now = now; }
  allow() {
    const now = this.#now();
    this.#attempts = this.#attempts.filter(value => value > now - 60000);
    if (this.#attempts.length >= 8) return false;
    this.#attempts.push(now);
    return true;
  }
}
