import { ReportRequestError } from '../contracts/errors.ts';
import type {
  GuiyeondoRepository,
  StoredGuiyeondoConnection,
  StoredGuiyeondoInvite,
  StoredGuiyeondoResponse
} from '../domains/guiyeondo/guiyeondoService.ts';
import { FirestoreRepository } from './firestoreRepository.ts';

type FirestoreValue = {
  stringValue?: string;
  integerValue?: string;
  timestampValue?: string;
  arrayValue?: { values?: FirestoreValue[] };
};

type FirestoreDocument = {
  name?: string;
  fields?: Record<string, FirestoreValue>;
  updateTime?: string;
};

type FirestoreRunQueryRow = { document?: FirestoreDocument };

function readString(document: FirestoreDocument, fieldName: string) {
  return document.fields?.[fieldName]?.stringValue || '';
}

function readInteger(document: FirestoreDocument, fieldName: string) {
  const value = document.fields?.[fieldName]?.integerValue;
  return typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : 0;
}

function readTimestamp(document: FirestoreDocument, fieldName: string) {
  return document.fields?.[fieldName]?.timestampValue || '';
}

function readStringArray(document: FirestoreDocument, fieldName: string) {
  const values = document.fields?.[fieldName]?.arrayValue?.values;
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => value.stringValue || '')
    .filter((value): value is string => Boolean(value));
}

function stringArrayValue(values: readonly string[]): FirestoreValue {
  return { arrayValue: { values: values.map((value) => ({ stringValue: value })) } };
}

function isNotFound(error: unknown) {
  return error instanceof ReportRequestError && error.status === 404;
}

function isConflict(error: unknown) {
  return error instanceof ReportRequestError && (error.status === 409 || error.status === 412);
}

function parseInvite(document: FirestoreDocument): StoredGuiyeondoInvite {
  return {
    publicId: readString(document, 'publicId'),
    hostName: readString(document, 'hostName'),
    natalSnapshot: JSON.parse(readString(document, 'natalSnapshotJson')),
    sigilSeed: readString(document, 'sigilSeed'),
    ownerKeyHash: readString(document, 'ownerKeyHash'),
    ownerUserIdHash: readString(document, 'ownerUserIdHash'),
    createdAt: readTimestamp(document, 'createdAt'),
    expiresAt: readTimestamp(document, 'expiresAt'),
    revokedAt: readTimestamp(document, 'revokedAt'),
    responseCount: readInteger(document, 'responseCount'),
    updateTime: document.updateTime || ''
  };
}

function parseResponse(document: FirestoreDocument): StoredGuiyeondoResponse {
  return {
    responseId: readString(document, 'responseId'),
    publicId: readString(document, 'publicId'),
    requestFingerprint: readString(document, 'requestFingerprint'),
    expiresAt: readTimestamp(document, 'expiresAt'),
    consentVersion: readString(document, 'consentVersion') as StoredGuiyeondoResponse['consentVersion'],
    consentedAt: readTimestamp(document, 'consentedAt'),
    person: JSON.parse(readString(document, 'personJson'))
  };
}

function parseConnection(document: FirestoreDocument): StoredGuiyeondoConnection {
  return {
    connectionId: readString(document, 'connectionId'),
    memberHashes: readStringArray(document, 'memberHashes'),
    ownerHash: readString(document, 'ownerHash'),
    ownerName: readString(document, 'ownerName'),
    otherName: readString(document, 'otherName'),
    claimTicket: readString(document, 'claimTicket'),
    kind: readString(document, 'kind') === 'direct' ? 'direct' : 'invite',
    personId: readString(document, 'personId'),
    analysis: JSON.parse(readString(document, 'analysisJson')),
    consentVersion: readString(document, 'consentVersion'),
    createdAt: readTimestamp(document, 'createdAt'),
    removedBy: readStringArray(document, 'removedBy'),
    updateTime: document.updateTime || ''
  };
}

export class GuiyeondoFirestoreRepository implements GuiyeondoRepository {
  constructor(
    private readonly firestore: FirestoreRepository,
    private readonly inviteCollection: string,
    private readonly responseCollection: string,
    private readonly rateLimitCollection: string,
    private readonly connectionCollection: string
  ) {}

  private invitePath(publicId: string) {
    return `/${encodeURIComponent(this.inviteCollection)}/${encodeURIComponent(publicId)}`;
  }

  private responsePath(responseId: string) {
    return `/${encodeURIComponent(this.responseCollection)}/${encodeURIComponent(responseId)}`;
  }

  private connectionPath(connectionId: string) {
    return `/${encodeURIComponent(this.connectionCollection)}/${encodeURIComponent(connectionId)}`;
  }

  async createInvite(invite: Omit<StoredGuiyeondoInvite, 'updateTime'>) {
    try {
      await this.firestore.request(
        `/${encodeURIComponent(this.inviteCollection)}?documentId=${encodeURIComponent(invite.publicId)}`,
        {
          method: 'POST',
          body: JSON.stringify({
            fields: {
              publicId: { stringValue: invite.publicId },
              hostName: { stringValue: invite.hostName },
              natalSnapshotJson: { stringValue: JSON.stringify(invite.natalSnapshot) },
              sigilSeed: { stringValue: invite.sigilSeed },
              ownerKeyHash: { stringValue: invite.ownerKeyHash },
              ownerUserIdHash: { stringValue: invite.ownerUserIdHash },
              createdAt: { timestampValue: invite.createdAt },
              expiresAt: { timestampValue: invite.expiresAt },
              responseCount: { integerValue: String(invite.responseCount) }
            }
          })
        }
      );
      return true;
    } catch (error) {
      if (isConflict(error)) return false;
      throw error;
    }
  }

  async getInvite(publicId: string) {
    try {
      return parseInvite(await this.firestore.request<FirestoreDocument>(this.invitePath(publicId)));
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async listInvitesByOwner(ownerUserIdHash: string, limit: number) {
    const rows = await this.firestore.request<FirestoreRunQueryRow[]>(':runQuery', {
      method: 'POST',
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: this.inviteCollection }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'ownerUserIdHash' },
              op: 'EQUAL',
              value: { stringValue: ownerUserIdHash }
            }
          },
          limit: Math.min(20, Math.max(1, limit))
        }
      })
    });
    return (Array.isArray(rows) ? rows : [])
      .map((row) => row.document)
      .filter((document): document is FirestoreDocument => Boolean(document))
      .map(parseInvite)
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
  }

  async getResponse(responseId: string) {
    try {
      return parseResponse(await this.firestore.request<FirestoreDocument>(this.responsePath(responseId)));
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async createResponseWithSlot(invite: StoredGuiyeondoInvite, response: StoredGuiyeondoResponse) {
    try {
      await this.firestore.request(':commit', {
        method: 'POST',
        body: JSON.stringify({
          writes: [
            {
              update: {
                name: this.firestore.documentName(this.responseCollection, response.responseId),
                fields: {
                  responseId: { stringValue: response.responseId },
                  publicId: { stringValue: response.publicId },
                  expiresAt: { timestampValue: response.expiresAt },
                  requestFingerprint: { stringValue: response.requestFingerprint },
                  consentVersion: { stringValue: response.consentVersion },
                  consentedAt: { timestampValue: response.consentedAt },
                  createdAt: { timestampValue: response.person.createdAt },
                  personJson: { stringValue: JSON.stringify(response.person) }
                }
              },
              currentDocument: { exists: false }
            },
            {
              update: {
                name: this.firestore.documentName(this.inviteCollection, invite.publicId),
                fields: { responseCount: { integerValue: String(invite.responseCount + 1) } }
              },
              updateMask: { fieldPaths: ['responseCount'] },
              currentDocument: { updateTime: invite.updateTime }
            }
          ]
        })
      });
      return true;
    } catch (error) {
      if (isConflict(error)) return false;
      throw error;
    }
  }

  async listResponses(publicId: string, limit: number) {
    const rows = await this.firestore.request<FirestoreRunQueryRow[]>(':runQuery', {
      method: 'POST',
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: this.responseCollection }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'publicId' },
              op: 'EQUAL',
              value: { stringValue: publicId }
            }
          },
          limit: Math.min(100, Math.max(1, limit))
        }
      })
    });
    return (Array.isArray(rows) ? rows : [])
      .map((row) => row.document)
      .filter((document): document is FirestoreDocument => Boolean(document))
      .map(parseResponse)
      .sort((left, right) => Date.parse(left.person.createdAt) - Date.parse(right.person.createdAt));
  }

  async revokeInvite(invite: StoredGuiyeondoInvite, revokedAt: string) {
    const params = new URLSearchParams();
    params.append('updateMask.fieldPaths', 'revokedAt');
    params.set('currentDocument.updateTime', invite.updateTime);
    try {
      await this.firestore.request(`${this.invitePath(invite.publicId)}?${params}`, {
        method: 'PATCH',
        body: JSON.stringify({ fields: { revokedAt: { timestampValue: revokedAt } } })
      });
      return true;
    } catch (error) {
      if (isConflict(error)) return false;
      throw error;
    }
  }

  async createConnection(connection: Omit<StoredGuiyeondoConnection, 'updateTime'>) {
    const collection = encodeURIComponent(this.connectionCollection);
    try {
      await this.firestore.request(
        `/${collection}?documentId=${encodeURIComponent(connection.connectionId)}`,
        {
          method: 'POST',
          body: JSON.stringify({
            fields: {
              connectionId: { stringValue: connection.connectionId },
              memberHashes: stringArrayValue(connection.memberHashes),
              ownerHash: { stringValue: connection.ownerHash },
              ownerName: { stringValue: connection.ownerName },
              otherName: { stringValue: connection.otherName },
              claimTicket: { stringValue: connection.claimTicket },
              kind: { stringValue: connection.kind },
              personId: { stringValue: connection.personId },
              analysisJson: { stringValue: JSON.stringify(connection.analysis) },
              consentVersion: { stringValue: connection.consentVersion },
              createdAt: { timestampValue: connection.createdAt },
              removedBy: stringArrayValue(connection.removedBy)
            }
          })
        }
      );
      return true;
    } catch (error) {
      if (isConflict(error)) return false;
      throw error;
    }
  }

  async getConnection(connectionId: string) {
    try {
      return parseConnection(await this.firestore.request<FirestoreDocument>(this.connectionPath(connectionId)));
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async listConnectionsByMember(memberHash: string, limit: number) {
    const rows = await this.firestore.request<FirestoreRunQueryRow[]>(':runQuery', {
      method: 'POST',
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: this.connectionCollection }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'memberHashes' },
              op: 'ARRAY_CONTAINS',
              value: { stringValue: memberHash }
            }
          },
          limit: Math.min(100, Math.max(1, limit))
        }
      })
    });
    return (Array.isArray(rows) ? rows : [])
      .map((row) => row.document)
      .filter((document): document is FirestoreDocument => Boolean(document))
      .map(parseConnection)
      .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));
  }

  async updateConnectionMembership(
    connection: StoredGuiyeondoConnection,
    next: { memberHashes: string[]; removedBy: string[] }
  ) {
    const params = new URLSearchParams();
    params.append('updateMask.fieldPaths', 'memberHashes');
    params.append('updateMask.fieldPaths', 'removedBy');
    params.set('currentDocument.updateTime', connection.updateTime);
    try {
      await this.firestore.request(`${this.connectionPath(connection.connectionId)}?${params}`, {
        method: 'PATCH',
        body: JSON.stringify({
          fields: {
            memberHashes: stringArrayValue(next.memberHashes),
            removedBy: stringArrayValue(next.removedBy)
          }
        })
      });
      return true;
    } catch (error) {
      if (isConflict(error)) return false;
      throw error;
    }
  }

  async deleteConnection(connection: StoredGuiyeondoConnection) {
    const params = new URLSearchParams();
    params.set('currentDocument.updateTime', connection.updateTime);
    try {
      await this.firestore.request(`${this.connectionPath(connection.connectionId)}?${params}`, {
        method: 'DELETE'
      });
      return true;
    } catch (error) {
      /* 이미 사라진 문서는 지우려던 결과와 같다. */
      if (isNotFound(error)) return true;
      if (isConflict(error)) return false;
      throw error;
    }
  }

  async consumeRateLimit(input: {
    key: string;
    windowStartedAt: string;
    expiresAt: string;
    limit: number;
  }) {
    const collection = encodeURIComponent(this.rateLimitCollection);
    const path = `/${collection}/${encodeURIComponent(input.key)}`;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        await this.firestore.request(`/${collection}?documentId=${encodeURIComponent(input.key)}`, {
          method: 'POST',
          body: JSON.stringify({
            fields: {
              count: { integerValue: '1' },
              windowStartedAt: { timestampValue: input.windowStartedAt },
              expiresAt: { timestampValue: input.expiresAt }
            }
          })
        });
        return true;
      } catch (error) {
        if (!isConflict(error)) throw error;
      }

      const document = await this.firestore.request<FirestoreDocument>(path);
      const count = readInteger(document, 'count');
      if (count >= input.limit) return false;
      const params = new URLSearchParams();
      params.append('updateMask.fieldPaths', 'count');
      params.set('currentDocument.updateTime', document.updateTime || '');
      try {
        await this.firestore.request(`${path}?${params}`, {
          method: 'PATCH',
          body: JSON.stringify({ fields: { count: { integerValue: String(count + 1) } } })
        });
        return true;
      } catch (error) {
        if (!isConflict(error)) throw error;
      }
    }
    return false;
  }
}
