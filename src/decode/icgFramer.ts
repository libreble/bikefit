/**
 * ICG Nordic-UART frame reassembler. Pure + stateful: feed it the raw bytes of each BLE
 * notification (which may split/merge messages), it emits complete frames. Mirrors the
 * official app's decoder (PROTOCOL.md §2).
 *
 * Wire format:  [SOF 0xFF] [LEN] [MSG_ID] [DATA…N] [XOR-CHK] [EOF 0x55]
 *   LEN      = N + 2         (counts MSG_ID + N data bytes + CHECKSUM)
 *   CHECKSUM = LEN ^ MSG_ID ^ DATA[0] ^ … ^ DATA[N-1]   (plain XOR, big-endian payloads)
 */

const SOF = 0xff
const EOF = 0x55
const MAX_MSG = 256

export interface IcgFrame {
  msgId: number
  /** The N payload bytes (a copy, safe to keep). */
  data: Uint8Array
}

type State = 'sync' | 'len' | 'id' | 'data' | 'checksum' | 'eof'

export class IcgFramer {
  private state: State = 'sync'
  private remaining = 0
  private idx = 0
  private checksum = 0
  private msgId = 0
  private readonly buf = new Uint8Array(MAX_MSG)
  private readonly onFrame: (frame: IcgFrame) => void
  private readonly onError: ((reason: string) => void) | undefined

  constructor(onFrame: (frame: IcgFrame) => void, onError?: (reason: string) => void) {
    this.onFrame = onFrame
    this.onError = onError
  }

  /** Feed one notification's bytes. Safe to call with partial or multiple frames. */
  push(chunk: Uint8Array): void {
    for (const b of chunk) this.step(b)
  }

  private resetFrame(): void {
    this.state = 'sync'
    this.remaining = 0
    this.idx = 0
    this.checksum = 0
    this.msgId = 0
  }

  private fail(reason: string): void {
    this.onError?.(reason)
    this.resetFrame()
  }

  private step(b: number): void {
    switch (this.state) {
      case 'sync':
        // 0xFF starts a frame; the next byte is LEN.
        if (b === SOF) {
          this.checksum = 0
          this.idx = 0
          this.state = 'len'
        }
        break
      case 'len':
        // LEN byte. Need N = LEN-2 >= 0, and LEN within bounds.
        if (b >= 2 && b <= MAX_MSG) {
          this.remaining = b - 2
          this.checksum = b
          this.state = 'id'
        } else {
          this.fail(`bad length ${b}`)
        }
        break
      case 'id':
        this.msgId = b
        this.checksum ^= b
        this.idx = 0
        this.state = this.remaining === 0 ? 'checksum' : 'data'
        break
      case 'data':
        this.buf[this.idx++] = b
        this.checksum ^= b
        if (--this.remaining === 0) this.state = 'checksum'
        break
      case 'checksum':
        if (b === (this.checksum & 0xff)) {
          this.state = 'eof'
        } else {
          this.fail('bad checksum')
        }
        break
      case 'eof':
        if (b === EOF) {
          this.onFrame({ msgId: this.msgId, data: this.buf.slice(0, this.idx) })
        } else {
          this.onError?.('bad eof')
        }
        this.resetFrame()
        break
    }
  }
}
