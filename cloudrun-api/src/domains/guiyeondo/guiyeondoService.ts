import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import {
  analyzeGuiyeondoSnapshots,
  createGuiyeondoNatalSnapshot,
  GuiyeondoProfileValidationError,
  parseGuiyeondoBirthProfile,
  type GuiyeondoNatalSnapshot,
  type GuiyeondoServerAnalysis
} from '../../../../src/lib/guiyeondo/serverAnalysis.ts';

const PUBLIC_ID_PATTERN = /^[a-f0-9]{32}$/;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{16,128}$/;
const MAX_RESPONSES = 100;

/**
 * 동의 버전이 보관 기간을 정한다.
 *
 * `v1` 은 "초대 만료일(최대 14일)까지 보관" 을 받은 동의다. 그 동의로 들어온 응답의
 * 보관 기간은 **늘리지 않는다** — 나중에 정책을 바꿨다고 해서 이미 받은 동의의 범위가
 * 넓어지지는 않기 때문이다. 그래서 두 버전을 함께 들고 간다.
 *
 * `v2` 는 "두 사람 중 누구든 지울 때까지 보관" 을 받은 동의다. 이 동의로 들어온 응답만
 * 인연 문서(`StoredGuiyeondoConnection`)로 넘어가 초대 만료 뒤에도 남는다.
 */
const GUEST_CONSENT_VERSION = 'guiyeondo-share-v1';
const GUEST_KEEP_CONSENT_VERSION = 'guiyeondo-share-v2';
const GUEST_CONSENT_VERSIONS = [GUEST_CONSENT_VERSION, GUEST_KEEP_CONSENT_VERSION] as const;

/** 한 계정이 들고 갈 수 있는 인연 수. 지도의 100명 상한과 같은 값이다. */
const MAX_CONNECTIONS = 100;

export interface StoredGuiyeondoInvite {
  publicId: string;
  hostName: string;
  natalSnapshot: GuiyeondoNatalSnapshot;
  sigilSeed: string;
  /** One-way server-side binding to the authenticated Kakao user id. */
  ownerUserIdHash: string;
  /** Legacy capability hash. Kept so existing Firestore documents remain parseable. */
  ownerKeyHash: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string;
  responseCount: number;
  updateTime: string;
}

export interface StoredGuiyeondoResponse {
  responseId: string;
  publicId: string;
  expiresAt: string;
  requestFingerprint: string;
  consentVersion: (typeof GUEST_CONSENT_VERSIONS)[number];
  consentedAt: string;
  person: GuiyeondoPersonResponse;
}

/**
 * 인연 한 건 — 초대보다 오래 사는 문서.
 *
 * 초대 링크는 14일에 닫히는 것이 맞다. 링크가 영원히 살아 있으면 한 번 보낸 주소가
 * 영원히 열려 있는 셈이다. 그런데 **이미 맺어진 인연까지 같이 닫힐 이유는 없다.**
 * 그래서 링크와 결과를 분리한다 — 링크는 만료되고, 결과는 이 문서로 남는다.
 *
 * 여기에는 원시 생년월일시도, 명식 스냅숏도 넣지 않는다. 계산된 관계 결과와 두 사람이
 * 적은 이름뿐이다. 초대 문서가 주인의 명식을 들고 있는 것은 응답이 들어올 때마다 다시
 * 계산해야 하기 때문인데, 인연 문서는 계산이 끝난 뒤의 것이라 그럴 이유가 없다.
 */
export interface StoredGuiyeondoConnection {
  connectionId: string;
  /**
   * 계정이 붙은 구성원의 단방향 해시.
   *
   * 초대를 만든 쪽은 응답이 들어오는 순간 들어간다. 응답한 쪽은 자리가 비어 있다가,
   * 로그인해서 자기 몫을 가져갈 때 붙는다 — 결과를 보기 전에 로그인을 물으면 그 자리에서
   * 흐름이 끊기기 때문에, 묻는 자리는 "남길 것이 생긴 뒤" 다.
   */
  memberHashes: string[];
  ownerHash: string;
  ownerName: string;
  otherName: string;
  /**
   * 응답한 사람이 나중에 자기 몫을 가져갈 때 내미는 증표. 응답 식별자와 같은 값이라
   * 따로 만들어 들고 다닐 것이 없다 — 링크와 멱등키를 아는 사람만 계산할 수 있다.
   */
  claimTicket: string;
  /** `invite` 는 링크로 맺어진 인연, `direct` 는 주인이 직접 넣은 사람. */
  kind: 'invite' | 'direct';
  personId: string;
  analysis: GuiyeondoServerAnalysis;
  consentVersion: string;
  createdAt: string;
  /** 지도에서 치운 구성원. 둘 다 치우면 문서를 지운다. */
  removedBy: string[];
  updateTime: string;
}

export interface GuiyeondoPersonResponse {
  id: string;
  name: string;
  source: 'invite';
  createdAt: string;
  expiresAt: string;
  analysis: GuiyeondoServerAnalysis;
}

export interface GuiyeondoRepository {
  createInvite(invite: Omit<StoredGuiyeondoInvite, 'updateTime'>): Promise<boolean>;
  getInvite(publicId: string): Promise<StoredGuiyeondoInvite | null>;
  getResponse(responseId: string): Promise<StoredGuiyeondoResponse | null>;
  listInvitesByOwner(ownerUserIdHash: string, limit: number): Promise<StoredGuiyeondoInvite[]>;
  createResponseWithSlot(invite: StoredGuiyeondoInvite, response: StoredGuiyeondoResponse): Promise<boolean>;
  listResponses(publicId: string, limit: number): Promise<StoredGuiyeondoResponse[]>;
  revokeInvite(invite: StoredGuiyeondoInvite, revokedAt: string): Promise<boolean>;
  createConnection(connection: Omit<StoredGuiyeondoConnection, 'updateTime'>): Promise<boolean>;
  getConnection(connectionId: string): Promise<StoredGuiyeondoConnection | null>;
  listConnectionsByMember(memberHash: string, limit: number): Promise<StoredGuiyeondoConnection[]>;
  updateConnectionMembership(
    connection: StoredGuiyeondoConnection,
    next: { memberHashes: string[]; removedBy: string[] }
  ): Promise<boolean>;
  deleteConnection(connection: StoredGuiyeondoConnection): Promise<boolean>;
  consumeRateLimit(input: {
    key: string;
    windowStartedAt: string;
    expiresAt: string;
    limit: number;
  }): Promise<boolean>;
}

export class GuiyeondoRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code: string
  ) {
    super(message);
    this.name = 'GuiyeondoRequestError';
  }
}

export type GuiyeondoServiceConfig = {
  enabled: boolean;
  inviteTtlMs: number;
  rateLimitWindowMs: number;
  createRateLimitMax: number;
  readRateLimitMax: number;
  responseRateLimitMax: number;
  ownerRateLimitMax: number;
};

export interface GuiyeondoApi {
  createInvite(body: unknown, ownerUserId: string, clientIp: string): Promise<unknown>;
  listInvites(ownerUserId: string, clientIp: string): Promise<unknown>;
  getInvite(publicId: string, clientIp: string): Promise<unknown>;
  submitResponse(publicId: string, body: unknown, clientIp: string): Promise<unknown>;
  listResponses(publicId: string, ownerUserId: string, clientIp: string): Promise<unknown>;
  revokeInvite(publicId: string, ownerUserId: string, clientIp: string): Promise<unknown>;
  listConnections(userId: string, clientIp: string): Promise<unknown>;
  claimConnection(body: unknown, userId: string, clientIp: string): Promise<unknown>;
  createDirectConnection(body: unknown, userId: string, clientIp: string): Promise<unknown>;
  removeConnection(connectionId: string, userId: string, clientIp: string): Promise<unknown>;
}

type GuiyeondoServiceOptions = {
  repository: GuiyeondoRepository;
  config: GuiyeondoServiceConfig;
  now?: () => Date;
  randomHex?: (byteLength: number) => string;
};

function hash(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function ownerIdentityHash(ownerUserId: string) {
  const normalized = ownerUserId.trim();
  if (!normalized || normalized.length > 256) {
    throw new GuiyeondoRequestError(401, '카카오 로그인이 필요합니다.', 'OWNER_LOGIN_REQUIRED');
  }
  return hash(`guiyeondo-owner:v1:${normalized}`);
}

function normalizePublicId(value: string) {
  const publicId = value.trim().toLowerCase();
  if (!PUBLIC_ID_PATTERN.test(publicId)) {
    throw new GuiyeondoRequestError(404, '초대장을 찾을 수 없습니다.', 'INVITE_NOT_FOUND');
  }
  return publicId;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function publicInvite(invite: StoredGuiyeondoInvite) {
  return {
    publicId: invite.publicId,
    hostName: invite.hostName,
    createdAt: invite.createdAt,
    expiresAt: invite.expiresAt,
    sigilSeed: invite.sigilSeed
  };
}

const CONNECTION_ID_PATTERN = /^[a-f0-9]{64}$/;

/** 응답 하나에 인연 하나. 같은 응답을 두 번 처리해도 같은 문서를 가리킨다. */
function inviteConnectionId(responseId: string) {
  return hash(`guiyeondo-connection:v1:${responseId}`);
}

/** 직접 넣은 사람은 주인과 멱등키로 정한다. 새로고침하다 둘로 늘어나지 않게. */
function directConnectionId(ownerHash: string, idempotencyKey: string) {
  return hash(`guiyeondo-connection:direct:v1:${ownerHash}:${idempotencyKey}`);
}

/**
 * 인연 문서를 **보는 사람 기준**으로 접어서 돌려준다.
 *
 * 구성원 해시는 내보내지 않는다. 그것이 있으면 한쪽이 다른 쪽의 계정 식별자를 들고
 * 가게 되는데, 관계를 보여 주는 데 필요한 값이 아니다. 이름도 상대 것만 준다 —
 * 자기 이름은 이미 자기 화면이 알고 있다.
 */
function connectionForMember(connection: StoredGuiyeondoConnection, memberHash: string) {
  const viewerIsOwner = connection.ownerHash === memberHash;

  return {
    connectionId: connection.connectionId,
    personId: connection.personId,
    kind: connection.kind,
    /* 초대를 만든 쪽에서 보면 상대는 응답한 사람, 응답한 쪽에서 보면 상대는 초대한 사람. */
    name: viewerIsOwner ? connection.otherName : connection.ownerName,
    role: viewerIsOwner ? ('host' as const) : ('guest' as const),
    createdAt: connection.createdAt,
    analysis: connection.analysis
  };
}

export class GuiyeondoService implements GuiyeondoApi {
  private readonly now: () => Date;
  private readonly randomHex: (byteLength: number) => string;

  constructor(private readonly options: GuiyeondoServiceOptions) {
    this.now = options.now || (() => new Date());
    this.randomHex = options.randomHex || ((byteLength) => randomBytes(byteLength).toString('hex'));
  }

  private async enforceRateLimit(scope: string, clientIp: string, limit: number) {
    if (!this.options.config.enabled) {
      throw new GuiyeondoRequestError(503, '귀연도 공유 저장소가 준비되지 않았습니다.', 'SERVICE_UNAVAILABLE');
    }
    const now = this.now();
    const windowMs = this.options.config.rateLimitWindowMs;
    const windowStart = Math.floor(now.getTime() / windowMs) * windowMs;
    const allowed = await this.options.repository.consumeRateLimit({
      key: hash(`guiyeondo:${scope}:${clientIp || 'unknown'}:${windowStart}`),
      windowStartedAt: new Date(windowStart).toISOString(),
      expiresAt: new Date(windowStart + windowMs * 2).toISOString(),
      limit
    });
    if (!allowed) {
      throw new GuiyeondoRequestError(429, '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.', 'RATE_LIMITED');
    }
  }

  private assertActive(invite: StoredGuiyeondoInvite) {
    if (invite.revokedAt) {
      throw new GuiyeondoRequestError(410, '철회된 초대장입니다. 새 링크를 요청해 주세요.', 'INVITE_REVOKED');
    }
    const expiresAt = Date.parse(invite.expiresAt);
    if (!Number.isFinite(expiresAt)) {
      throw new GuiyeondoRequestError(503, '초대장 상태를 확인하지 못했습니다.', 'INVITE_STATE_INVALID');
    }
    if (expiresAt <= this.now().getTime()) {
      throw new GuiyeondoRequestError(410, '만료된 초대장입니다. 새 링크를 요청해 주세요.', 'INVITE_EXPIRED');
    }
  }

  private async requireInvite(publicIdValue: string) {
    const publicId = normalizePublicId(publicIdValue);
    const invite = await this.options.repository.getInvite(publicId);
    if (!invite) {
      throw new GuiyeondoRequestError(404, '초대장을 찾을 수 없습니다.', 'INVITE_NOT_FOUND');
    }
    this.assertActive(invite);
    return invite;
  }

  private assertOwner(invite: StoredGuiyeondoInvite, ownerUserId: string) {
    if (!/^[a-f0-9]{64}$/.test(invite.ownerUserIdHash)) {
      throw new GuiyeondoRequestError(403, '이 초대장은 현재 로그인 계정에 연결되어 있지 않습니다.', 'OWNER_BINDING_REQUIRED');
    }
    const actual = Buffer.from(ownerIdentityHash(ownerUserId), 'hex');
    const expected = Buffer.from(invite.ownerUserIdHash, 'hex');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      throw new GuiyeondoRequestError(403, '이 초대장을 관리할 권한이 없습니다.', 'OWNER_ACCOUNT_MISMATCH');
    }
  }

  private parseSnapshot(value: unknown) {
    try {
      const parsed = parseGuiyeondoBirthProfile(value);
      const solarDate = parsed.calculation.primary?.bazi.solar
        || parsed.calculation.scenarios[0]?.bazi.solar;
      if (!solarDate || solarDate.length !== 3) {
        throw new GuiyeondoRequestError(422, '출생일을 확인할 수 없습니다.', 'INVALID_BIRTH_PROFILE');
      }
      const birthDate = new Date(Date.UTC(solarDate[0], solarDate[1] - 1, solarDate[2]));
      const minimumAgeDate = new Date(this.now().getTime());
      minimumAgeDate.setUTCFullYear(minimumAgeDate.getUTCFullYear() - 14);
      if (birthDate > minimumAgeDate) {
        throw new GuiyeondoRequestError(422, '만 14세 이상만 귀연도를 이용할 수 있습니다.', 'AGE_RESTRICTED');
      }
      return {
        profile: parsed.profile,
        snapshot: createGuiyeondoNatalSnapshot(parsed.calculation)
      };
    } catch (error) {
      if (error instanceof GuiyeondoProfileValidationError) {
        throw new GuiyeondoRequestError(422, error.message, 'INVALID_BIRTH_PROFILE');
      }
      throw error;
    }
  }

  async createInvite(body: unknown, ownerUserId: string, clientIp: string) {
    await this.enforceRateLimit('create', clientIp, this.options.config.createRateLimitMax);
    if (!isRecord(body)) {
      throw new GuiyeondoRequestError(400, '요청 형식이 올바르지 않습니다.', 'INVALID_REQUEST');
    }

    const parsed = this.parseSnapshot(body.ownerProfile);
    const createdAt = this.now().toISOString();
    const expiresAt = new Date(this.now().getTime() + this.options.config.inviteTtlMs).toISOString();
    const ownerUserIdHash = ownerIdentityHash(ownerUserId);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const publicId = this.randomHex(16).toLowerCase();
      if (!PUBLIC_ID_PATTERN.test(publicId)) continue;
      const invite: Omit<StoredGuiyeondoInvite, 'updateTime'> = {
        publicId,
        hostName: parsed.profile.name,
        natalSnapshot: parsed.snapshot,
        sigilSeed: `gy-${hash(`sigil:${publicId}`).slice(0, 16)}`,
        ownerUserIdHash,
        ownerKeyHash: '',
        createdAt,
        expiresAt,
        revokedAt: '',
        responseCount: 0
      };
      if (await this.options.repository.createInvite(invite)) {
        return { invite: publicInvite({ ...invite, updateTime: '' }) };
      }
    }
    throw new GuiyeondoRequestError(503, '초대 링크를 만들지 못했습니다. 다시 시도해 주세요.', 'INVITE_CREATE_FAILED');
  }

  async getInvite(publicId: string, clientIp: string) {
    await this.enforceRateLimit('read', clientIp, this.options.config.readRateLimitMax);
    return { invite: publicInvite(await this.requireInvite(publicId)) };
  }

  async listInvites(ownerUserId: string, clientIp: string) {
    await this.enforceRateLimit('owner', clientIp, this.options.config.ownerRateLimitMax);
    const invites = await this.options.repository.listInvitesByOwner(ownerIdentityHash(ownerUserId), 20);
    const now = this.now().getTime();
    return {
      invites: invites
        .filter((invite) => !invite.revokedAt && Date.parse(invite.expiresAt) > now)
        .map(publicInvite)
    };
  }

  async submitResponse(publicIdValue: string, body: unknown, clientIp: string) {
    const publicId = normalizePublicId(publicIdValue);
    await this.enforceRateLimit('response', clientIp, this.options.config.responseRateLimitMax);
    if (!isRecord(body) || typeof body.idempotencyKey !== 'string' || !IDEMPOTENCY_KEY_PATTERN.test(body.idempotencyKey)) {
      throw new GuiyeondoRequestError(400, '응답 요청 식별값이 올바르지 않습니다.', 'INVALID_IDEMPOTENCY_KEY');
    }
    const invite = await this.requireInvite(publicId);
    const consentVersion = GUEST_CONSENT_VERSIONS.find((version) => version === body.consentVersion);
    if (!consentVersion) {
      throw new GuiyeondoRequestError(422, '인연 결과 공유에 동의해 주세요.', 'CONSENT_REQUIRED');
    }
    const parsed = this.parseSnapshot(body.guestProfile);

    const requestFingerprint = hash(JSON.stringify({
      name: parsed.profile.name,
      snapshot: parsed.snapshot
    }));
    const responseId = hash(`${publicId}:${body.idempotencyKey}`);
    const existing = await this.options.repository.getResponse(responseId);
    if (existing) {
      if (existing.requestFingerprint !== requestFingerprint || existing.publicId !== publicId) {
        throw new GuiyeondoRequestError(409, '같은 요청 식별값으로 다른 응답을 저장할 수 없습니다.', 'IDEMPOTENCY_CONFLICT');
      }
      /* 다시 보낸 요청도 처음과 같은 모양을 돌려줘야 한다. `keepable` 이 빠지면 화면이
         "내 지도에 남기기" 를 처음에만 띄우고 새로고침 뒤에는 감춘다. */
      return { person: existing.person, keepable: existing.consentVersion === GUEST_KEEP_CONSENT_VERSION };
    }

    const createdAt = this.now().toISOString();
    const analysis = analyzeGuiyeondoSnapshots(invite.natalSnapshot, parsed.snapshot);
    const person: GuiyeondoPersonResponse = {
      id: responseId,
      name: parsed.profile.name,
      source: 'invite',
      createdAt,
      expiresAt: invite.expiresAt,
      analysis
    };
    const response: StoredGuiyeondoResponse = {
      responseId,
      publicId,
      expiresAt: invite.expiresAt,
      requestFingerprint,
      consentVersion,
      consentedAt: createdAt,
      person
    };
    let latest = invite;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const concurrent = await this.options.repository.getResponse(responseId);
      if (concurrent) {
        if (concurrent.requestFingerprint !== requestFingerprint || concurrent.publicId !== publicId) {
          throw new GuiyeondoRequestError(409, '같은 요청 식별값으로 다른 응답을 저장할 수 없습니다.', 'IDEMPOTENCY_CONFLICT');
        }
        return { person: concurrent.person, keepable: concurrent.consentVersion === GUEST_KEEP_CONSENT_VERSION };
      }
      this.assertActive(latest);
      if (latest.responseCount >= MAX_RESPONSES) {
        throw new GuiyeondoRequestError(409, '이 초대에는 최대 100명까지 응답할 수 있습니다.', 'RESPONSE_LIMIT_REACHED');
      }
      if (await this.options.repository.createResponseWithSlot(latest, response)) {
        await this.openConnection(invite, response);
        return { person, keepable: consentVersion === GUEST_KEEP_CONSENT_VERSION };
      }
      const refreshed = await this.options.repository.getInvite(publicId);
      if (!refreshed) break;
      latest = refreshed;
    }
    throw new GuiyeondoRequestError(409, '응답이 동시에 처리되고 있습니다. 다시 시도해 주세요.', 'RESPONSE_CREATE_CONFLICT');
  }

  /**
   * 응답이 저장된 직후 인연 문서를 연다. 구성원은 일단 초대를 만든 쪽 하나다.
   *
   * 응답한 사람은 아직 계정이 없을 수 있으므로 자리를 비워 두고, 나중에 로그인해서
   * `claimConnection` 으로 들어온다. 그래서 **초대를 만든 쪽의 지도는 응답을 받는 순간
   * 영구적**이 되고, 응답한 쪽은 원하면 가져간다.
   *
   * 실패해도 응답 저장은 되돌리지 않는다. 인연 문서는 편의를 위한 사본이고, 없으면
   * 초대가 살아 있는 동안은 기존 경로가 그대로 사람을 보여 준다. 여기서 예외를 올리면
   * 이미 저장된 응답에 대해 게스트가 오류 화면을 보게 되는데, 그쪽이 더 나쁘다.
   */
  private async openConnection(invite: StoredGuiyeondoInvite, response: StoredGuiyeondoResponse) {
    if (response.consentVersion !== GUEST_KEEP_CONSENT_VERSION) return;
    try {
      await this.options.repository.createConnection({
        connectionId: inviteConnectionId(response.responseId),
        memberHashes: [invite.ownerUserIdHash],
        ownerHash: invite.ownerUserIdHash,
        ownerName: invite.hostName,
        otherName: response.person.name,
        claimTicket: response.responseId,
        kind: 'invite',
        personId: response.person.id,
        analysis: response.person.analysis,
        consentVersion: response.consentVersion,
        createdAt: response.person.createdAt,
        removedBy: []
      });
    } catch {
      /* 저장소가 잠깐 흔들린 것뿐이다. 응답은 이미 저장됐다. */
    }
  }

  async listResponses(publicIdValue: string, ownerUserId: string, clientIp: string) {
    const publicId = normalizePublicId(publicIdValue);
    await this.enforceRateLimit('owner', clientIp, this.options.config.ownerRateLimitMax);
    const invite = await this.requireInvite(publicId);
    this.assertOwner(invite, ownerUserId);
    const responses = await this.options.repository.listResponses(publicId, MAX_RESPONSES);
    return { people: responses.map((response) => response.person) };
  }

  async revokeInvite(publicIdValue: string, ownerUserId: string, clientIp: string) {
    const publicId = normalizePublicId(publicIdValue);
    await this.enforceRateLimit('owner', clientIp, this.options.config.ownerRateLimitMax);
    let invite = await this.options.repository.getInvite(publicId);
    if (!invite) {
      throw new GuiyeondoRequestError(404, '초대장을 찾을 수 없습니다.', 'INVITE_NOT_FOUND');
    }
    this.assertOwner(invite, ownerUserId);
    if (invite.revokedAt) return { ok: true, publicId, revokedAt: invite.revokedAt };
    const revokedAt = this.now().toISOString();
    for (let attempt = 0; attempt < 4; attempt += 1) {
      if (await this.options.repository.revokeInvite(invite, revokedAt)) {
        return { ok: true, publicId, revokedAt };
      }
      const refreshed = await this.options.repository.getInvite(publicId);
      if (!refreshed) break;
      if (refreshed.revokedAt) return { ok: true, publicId, revokedAt: refreshed.revokedAt };
      this.assertOwner(refreshed, ownerUserId);
      invite = refreshed;
    }
    throw new GuiyeondoRequestError(409, '초대 철회가 동시에 처리되고 있습니다. 다시 시도해 주세요.', 'REVOKE_CONFLICT');
  }

  /** 내 지도에 남아 있는 인연. 내가 치운 것은 빼고 돌려준다. */
  async listConnections(userId: string, clientIp: string) {
    await this.enforceRateLimit('owner', clientIp, this.options.config.ownerRateLimitMax);
    const memberHash = ownerIdentityHash(userId);
    const connections = await this.options.repository.listConnectionsByMember(memberHash, MAX_CONNECTIONS);

    return {
      connections: connections
        .filter((connection) => !connection.removedBy.includes(memberHash))
        .map((connection) => connectionForMember(connection, memberHash))
    };
  }

  /**
   * 응답한 사람이 자기 몫을 가져간다.
   *
   * 증표는 링크(`publicId`)와 응답할 때 쓴 멱등키다. 둘을 아는 사람은 그 응답을 만든
   * 사람뿐이므로 그것으로 충분하다 — 초대를 만든 쪽도 멱등키는 모른다.
   *
   * 초대를 만든 본인이 자기 초대에 응답한 경우는 막는다. 자기 자신과의 인연이 지도에
   * 한 줄 생기는 것은 결과가 아니라 버그로 보인다.
   */
  async claimConnection(body: unknown, userId: string, clientIp: string) {
    await this.enforceRateLimit('owner', clientIp, this.options.config.ownerRateLimitMax);
    if (!isRecord(body) || typeof body.idempotencyKey !== 'string'
      || !IDEMPOTENCY_KEY_PATTERN.test(body.idempotencyKey) || typeof body.publicId !== 'string') {
      throw new GuiyeondoRequestError(400, '요청 형식이 올바르지 않습니다.', 'INVALID_REQUEST');
    }
    const publicId = normalizePublicId(body.publicId);
    const memberHash = ownerIdentityHash(userId);
    const responseId = hash(`${publicId}:${body.idempotencyKey}`);
    const connectionId = inviteConnectionId(responseId);

    const connection = await this.options.repository.getConnection(connectionId);
    if (!connection) {
      throw new GuiyeondoRequestError(404, '가져올 인연을 찾을 수 없습니다. 결과를 다시 받아 주세요.', 'CONNECTION_NOT_FOUND');
    }
    if (connection.ownerHash === memberHash) {
      throw new GuiyeondoRequestError(409, '내가 만든 초대라 이미 내 지도에 있습니다.', 'CONNECTION_SELF_CLAIM');
    }
    if (connection.memberHashes.includes(memberHash)) {
      return { connection: connectionForMember(connection, memberHash) };
    }
    if (connection.memberHashes.length >= 2) {
      throw new GuiyeondoRequestError(409, '이 인연은 이미 다른 계정이 가져갔습니다.', 'CONNECTION_ALREADY_CLAIMED');
    }

    const mine = await this.options.repository.listConnectionsByMember(memberHash, MAX_CONNECTIONS);
    if (mine.filter((item) => !item.removedBy.includes(memberHash)).length >= MAX_CONNECTIONS) {
      throw new GuiyeondoRequestError(409, `귀연도에는 인연을 최대 ${MAX_CONNECTIONS}명까지 담을 수 있습니다.`, 'CONNECTION_LIMIT_REACHED');
    }

    const updated = await this.options.repository.updateConnectionMembership(connection, {
      memberHashes: [...connection.memberHashes, memberHash],
      /* 가져가는 순간 "치웠음" 표시는 지운다. 지웠다가 다시 가져오는 경로다. */
      removedBy: connection.removedBy.filter((item) => item !== memberHash)
    });
    if (!updated) {
      throw new GuiyeondoRequestError(409, '인연을 가져오는 중입니다. 다시 시도해 주세요.', 'CONNECTION_CLAIM_CONFLICT');
    }
    return { connection: connectionForMember(connection, memberHash) };
  }

  /**
   * 주인이 직접 넣은 사람을 계정에 남긴다.
   *
   * 두 사람의 출생정보를 받아 **계산만 하고 버린다** — 초대 응답과 같은 처리다.
   * 남는 것은 이름과 결과뿐이라, 기기를 바꿔도 돌아오면서 상대의 생년월일시는 서버에
   * 남지 않는다. 상대는 계정이 없으므로 구성원은 주인 하나다.
   */
  async createDirectConnection(body: unknown, userId: string, clientIp: string) {
    await this.enforceRateLimit('create', clientIp, this.options.config.createRateLimitMax);
    if (!isRecord(body) || typeof body.idempotencyKey !== 'string'
      || !IDEMPOTENCY_KEY_PATTERN.test(body.idempotencyKey)) {
      throw new GuiyeondoRequestError(400, '요청 식별값이 올바르지 않습니다.', 'INVALID_IDEMPOTENCY_KEY');
    }
    const ownerHash = ownerIdentityHash(userId);
    const connectionId = directConnectionId(ownerHash, body.idempotencyKey);

    const existing = await this.options.repository.getConnection(connectionId);
    if (existing) return { connection: connectionForMember(existing, ownerHash) };

    const owner = this.parseSnapshot(body.ownerProfile);
    const other = this.parseSnapshot(body.guestProfile);

    const mine = await this.options.repository.listConnectionsByMember(ownerHash, MAX_CONNECTIONS);
    if (mine.filter((item) => !item.removedBy.includes(ownerHash)).length >= MAX_CONNECTIONS) {
      throw new GuiyeondoRequestError(409, `귀연도에는 인연을 최대 ${MAX_CONNECTIONS}명까지 담을 수 있습니다.`, 'CONNECTION_LIMIT_REACHED');
    }

    const connection: Omit<StoredGuiyeondoConnection, 'updateTime'> = {
      connectionId,
      memberHashes: [ownerHash],
      ownerHash,
      ownerName: owner.profile.name,
      otherName: other.profile.name,
      /* 직접 넣은 사람에게는 가져갈 몫이 없다. 상대는 이 계산에 참여하지 않았다. */
      claimTicket: '',
      kind: 'direct',
      personId: connectionId,
      analysis: analyzeGuiyeondoSnapshots(owner.snapshot, other.snapshot),
      consentVersion: GUEST_KEEP_CONSENT_VERSION,
      createdAt: this.now().toISOString(),
      removedBy: []
    };

    if (!await this.options.repository.createConnection(connection)) {
      const concurrent = await this.options.repository.getConnection(connectionId);
      if (concurrent) return { connection: connectionForMember(concurrent, ownerHash) };
      throw new GuiyeondoRequestError(503, '인연을 저장하지 못했습니다. 다시 시도해 주세요.', 'CONNECTION_CREATE_FAILED');
    }
    return { connection: connectionForMember({ ...connection, updateTime: '' }, ownerHash) };
  }

  /**
   * 내 지도에서 인연을 치운다.
   *
   * 한쪽이 치웠다고 상대 지도에서까지 지우지는 않는다 — 그 관계는 상대의 것이기도 하다.
   * 대신 **둘 다 치우면 문서를 지운다.** 아무도 보지 않는 관계 계산을 서버가 계속 들고
   * 있을 이유가 없다.
   */
  async removeConnection(connectionIdValue: string, userId: string, clientIp: string) {
    await this.enforceRateLimit('owner', clientIp, this.options.config.ownerRateLimitMax);
    const connectionId = connectionIdValue.trim().toLowerCase();
    if (!CONNECTION_ID_PATTERN.test(connectionId)) {
      throw new GuiyeondoRequestError(404, '인연을 찾을 수 없습니다.', 'CONNECTION_NOT_FOUND');
    }
    const memberHash = ownerIdentityHash(userId);
    const connection = await this.options.repository.getConnection(connectionId);
    if (!connection) return { ok: true, connectionId };
    if (!connection.memberHashes.includes(memberHash)) {
      throw new GuiyeondoRequestError(403, '이 인연을 관리할 권한이 없습니다.', 'CONNECTION_FORBIDDEN');
    }
    if (connection.removedBy.includes(memberHash)) return { ok: true, connectionId };

    const removedBy = [...connection.removedBy, memberHash];
    const everyoneLeft = connection.memberHashes.every((item) => removedBy.includes(item));

    const done = everyoneLeft
      ? await this.options.repository.deleteConnection(connection)
      : await this.options.repository.updateConnectionMembership(connection, {
        memberHashes: connection.memberHashes,
        removedBy
      });
    if (!done) {
      throw new GuiyeondoRequestError(409, '인연을 정리하는 중입니다. 다시 시도해 주세요.', 'CONNECTION_REMOVE_CONFLICT');
    }
    return { ok: true, connectionId };
  }
}
