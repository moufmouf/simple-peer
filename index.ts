/*! simple-peer. MIT License. Feross Aboukhadijeh <https://feross.org/opensource> */
import Lite, { PeerLiteOptions } from './lite.js'
import errCode from 'err-code'
import { MediaStream, MediaStreamTrack, RTCRtpReceiver, RTCRtpTransceiver } from 'webrtc-polyfill'

/**
 * Codecs a peer prefers to receive for one kind of media, best first ('video/VP9', or just 'VP9').
 */
interface CodecPreference {
  prefer: string[]
  /**
   * Negotiate only the preferred codecs (plus rtx/red/ulpfec). For a browser that cannot choose its own send codec:
   * the remote then has nothing else to send us, and we have nothing else to send it.
   */
  exclusive?: boolean
}

interface PreferredCodecs {
  video?: string[] | CodecPreference
  audio?: string[] | CodecPreference
}

interface PeerOptions extends PeerLiteOptions {
  /**
   * Codecs this peer prefers to RECEIVE, per kind, applied with RTCRtpTransceiver.setCodecPreferences(). They
   * drive what the remote peer sends us. What we send is chosen by the remote's preference, or by
   * RTCRtpEncodingParameters.codec on browsers that support it.
   */
  receiveCodecs?: PreferredCodecs
  /** @deprecated Alias of receiveCodecs. The name suggested the opposite of what it does. */
  preferredCodecs?: PreferredCodecs
}

const AUXILIARY_CODEC_SUFFIXES = ['/rtx', '/red', '/ulpfec']

function isAuxiliaryCodec (codec: RTCRtpCodecCapability): boolean {
  const mime = codec.mimeType?.toLowerCase() ?? ''
  return AUXILIARY_CODEC_SUFFIXES.some(suffix => mime.endsWith(suffix))
}

/**
 * Orders the codecs a receiver is capable of after a preference: the preferred codecs first, in that order, then
 * either every other codec (default) or only the auxiliary rtx/red/ulpfec entries (exclusive). A preference matching
 * nothing keeps every codec, so the call still negotiates.
 */
export function orderCodecPreferences (capabilities: RTCRtpCodecCapability[], preference: string[] | CodecPreference): RTCRtpCodecCapability[] {
  const preferred = Array.isArray(preference) ? preference : preference.prefer
  const exclusive = !Array.isArray(preference) && preference.exclusive === true
  const normalized = preferred.map(codec => codec.toLowerCase())
  const ordered: RTCRtpCodecCapability[] = []
  const used = new Set<number>()

  normalized.forEach(pref => {
    const prefIsFull = pref.includes('/')
    capabilities.forEach((codec, index) => {
      if (used.has(index)) return
      const mime = codec.mimeType?.toLowerCase()
      if (!mime || isAuxiliaryCodec(codec)) return
      if (prefIsFull ? mime === pref : mime.endsWith('/' + pref)) {
        used.add(index)
        ordered.push(codec)
      }
    })
  })

  const keepOthers = !exclusive || ordered.length === 0
  capabilities.forEach((codec, index) => {
    if (used.has(index)) return
    if (keepOthers || isAuxiliaryCodec(codec)) ordered.push(codec)
  })

  return ordered
}

/**
 * WebRTC peer connection. Same API as node core `net.Socket`, plus a few extra methods.
 * Duplex stream.
 */
class Peer extends Lite {
  streams: MediaStream[]
  _senderMap: WeakMap<MediaStreamTrack, WeakMap<MediaStream, RTCRtpSender>>
  receiveCodecs?: PreferredCodecs
  /** @deprecated Alias of receiveCodecs. */
  preferredCodecs?: PreferredCodecs

  constructor (opts: PeerOptions = {}) {
    super(opts)
    if (!this._pc) return

    this.streams = opts.streams || (opts.stream ? [opts.stream] : []) // support old "stream" option
    this._senderMap = new WeakMap()
    this.receiveCodecs = opts.receiveCodecs ?? opts.preferredCodecs
    this.preferredCodecs = this.receiveCodecs

    if (this.streams) {
      this.streams.forEach(stream => {
        this.addStream(stream)
      })
    }
    this._pc.ontrack = (event: RTCTrackEvent) => {
      this._onTrack(event)
    }
  }

  _setPreferredCodecs (kind: 'audio' | 'video', transceiver: RTCRtpTransceiver | null): void {
    const preference = this.receiveCodecs?.[kind]
    if (!preference) return
    if ((Array.isArray(preference) ? preference : preference.prefer).length === 0) return
    if (!transceiver?.setCodecPreferences) return
    // setCodecPreferences() takes receiver capabilities: a browser may decode codecs it cannot encode
    if (typeof RTCRtpReceiver === 'undefined' || typeof RTCRtpReceiver.getCapabilities !== 'function') return

    const capabilities = RTCRtpReceiver.getCapabilities(kind)
    if (!capabilities?.codecs?.length) return

    transceiver.setCodecPreferences(orderCodecPreferences(capabilities.codecs, preference))
  }

  /**
   * Transceivers created by the remote offer never go through addTrack(): a peer that only receives would otherwise
   * never express its preference. setCodecPreferences() must run before createAnswer() to shape the answer.
   */
  _createAnswer (): void {
    this._pc!.getTransceivers?.().forEach(transceiver => {
      const kind = transceiver.receiver?.track?.kind
      if (kind === 'audio' || kind === 'video') this._setPreferredCodecs(kind, transceiver)
    })
    super._createAnswer()
  }

  _getTransceiverForSender (sender: RTCRtpSender): RTCRtpTransceiver | null {
    const transceivers = this._pc!.getTransceivers?.()
    if (!transceivers) return null
    return transceivers.find(transceiver => transceiver.sender === sender) || null
  }

  /**
   * Add a Transceiver to the connection.
   */
  addTransceiver (kind: string, init?: Record<string, unknown>): void {
    if (this._destroying) return
    if (this.destroyed) throw errCode(new Error('cannot addTransceiver after peer is destroyed'), 'ERR_DESTROYED')
    this._debug('addTransceiver()')

    if (this.initiator) {
      try {
        const transceiver = this._pc!.addTransceiver(kind, init as RTCRtpTransceiverInit)
        if (kind === 'audio' || kind === 'video') {
          this._setPreferredCodecs(kind, transceiver)
        }
        this._needsNegotiation()
      } catch (err) {
        this.__destroy(errCode(err as Error, 'ERR_ADD_TRANSCEIVER'))
      }
    } else {
      this.emit('signal', { // request initiator to renegotiate
        type: 'transceiverRequest',
        transceiverRequest: { kind, init }
      })
    }
  }

  /**
   * Add a MediaStream to the connection.
   */
  addStream (stream: MediaStream): void {
    if (this._destroying) return
    if (this.destroyed) throw errCode(new Error('cannot addStream after peer is destroyed'), 'ERR_DESTROYED')
    this._debug('addStream()')

    stream.getTracks().forEach(track => {
      this.addTrack(track, stream)
    })
  }

  /**
   * Add a MediaStreamTrack to the connection.
   */
  addTrack (track: MediaStreamTrack, stream: MediaStream): void {
    if (this._destroying) return
    if (this.destroyed) throw errCode(new Error('cannot addTrack after peer is destroyed'), 'ERR_DESTROYED')
    this._debug('addTrack()')

    const submap = this._senderMap.get(track) || new WeakMap() // nested Maps map [track, stream] to sender
    let sender = submap.get(stream)
    if (!sender) {
      sender = this._pc!.addTrack(track, stream)
      submap.set(stream, sender)
      this._senderMap.set(track, submap)
      if (track.kind === 'audio' || track.kind === 'video') {
        this._setPreferredCodecs(track.kind, this._getTransceiverForSender(sender))
      }
      this._needsNegotiation()
    } else {
      throw errCode(new Error('Track has already been added to that stream.'), 'ERR_SENDER_ALREADY_ADDED')
    }
  }

  /**
   * Replace a MediaStreamTrack by another in the connection.
   */
  replaceTrack (oldTrack: MediaStreamTrack, newTrack: MediaStreamTrack, stream: MediaStream): void {
    if (this._destroying) return
    if (this.destroyed) throw errCode(new Error('cannot replaceTrack after peer is destroyed'), 'ERR_DESTROYED')
    this._debug('replaceTrack()')

    const submap = this._senderMap.get(oldTrack)
    const sender = submap ? submap.get(stream) : null
    if (!sender) {
      throw errCode(new Error('Cannot replace track that was never added.'), 'ERR_TRACK_NOT_ADDED')
    }
    if (newTrack) this._senderMap.set(newTrack, submap!)

    if (sender.replaceTrack != null) {
      sender.replaceTrack(newTrack)
    } else {
      this.__destroy(errCode(new Error('replaceTrack is not supported in this browser'), 'ERR_UNSUPPORTED_REPLACETRACK'))
    }
  }

  /**
   * Remove a MediaStreamTrack from the connection.
   */
  removeTrack (track: MediaStreamTrack, stream: MediaStream): void {
    if (this._destroying) return
    if (this.destroyed) throw errCode(new Error('cannot removeTrack after peer is destroyed'), 'ERR_DESTROYED')
    this._debug('removeSender()')

    const submap = this._senderMap.get(track)
    const sender = submap ? submap.get(stream) : null
    if (!sender) {
      throw errCode(new Error('Cannot remove track that was never added.'), 'ERR_TRACK_NOT_ADDED')
    }
    try {
      submap?.delete(stream);
      this._pc!.removeTrack(sender)
    } catch (err) {
      if ((err as Error).name === 'NS_ERROR_UNEXPECTED') {
        this._sendersAwaitingStable.push(sender) // HACK: Firefox must wait until (signalingState === stable) https://bugzilla.mozilla.org/show_bug.cgi?id=1133874
      } else {
        this.__destroy(errCode(err as Error, 'ERR_REMOVE_TRACK'))
      }
    }
    this._needsNegotiation()
  }

  /**
   * Remove a MediaStream from the connection.
   */
  removeStream (stream: MediaStream): void {
    if (this._destroying) return
    if (this.destroyed) throw errCode(new Error('cannot removeStream after peer is destroyed'), 'ERR_DESTROYED')
    this._debug('removeSenders()')

    stream.getTracks().forEach(track => {
      this.removeTrack(track, stream)
    })
  }

  _requestMissingTransceivers (): void {
    if (this._pc!.getTransceivers()) {
      this._pc!.getTransceivers().forEach((transceiver: RTCRtpTransceiver) => {
        if (!transceiver.mid && transceiver.sender.track && !(transceiver as RTCRtpTransceiver & { requested?: boolean }).requested) {
          (transceiver as RTCRtpTransceiver & { requested?: boolean }).requested = true // HACK: Safari returns negotiated transceivers with a null mid
          this.addTransceiver(transceiver.sender.track.kind)
        }
      })
    }
  }

  _onTrack (event: RTCTrackEvent): void {
    if (this.destroyed) return

    event.streams.forEach(eventStream => {
      this._debug('on track')
      this.emit('track', event.track, eventStream)

      this._remoteTracks!.push({
        track: event.track,
        stream: eventStream
      })

      if (this._remoteStreams!.some(remoteStream => {
        return remoteStream.id === eventStream.id
      })) return // Only fire one 'stream' event, even though there may be multiple tracks per stream

      this._remoteStreams!.push(eventStream)
      queueMicrotask(() => {
        this._debug('on stream')
        this.emit('stream', eventStream) // ensure all tracks have been added
      })
    })
  }
}

export default Peer
export { Peer }
export type { PeerLiteOptions, SignalData, AddressInfo, StatsReport } from './lite.js'
export type { PeerOptions, PreferredCodecs, CodecPreference }
