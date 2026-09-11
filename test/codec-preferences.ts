import common from './common.js'
import Peer from '../index.js'
import { test, expect } from 'vitest'

function getVideoTransceiver (peer: Peer): RTCRtpTransceiver | null {
  const transceivers = peer._pc!.getTransceivers?.()
  if (!transceivers) return null
  return transceivers.find(transceiver => transceiver.receiver?.track?.kind === 'video') || null
}

function getCodecMimeTypeFromReport (report: RTCStatsReport, rtpType: 'outbound-rtp' | 'inbound-rtp'): string | null {
  let rtpReport: RTCStats & { codecId?: string } | undefined
  report.forEach(stat => {
    if (rtpReport) return
    if (stat.type !== rtpType) return
    const mediaType = (stat as any).mediaType || (stat as any).kind
    if (mediaType === 'video') rtpReport = stat as (RTCStats & { codecId?: string })
  })

  if (!rtpReport?.codecId) return null
  const codecReport = report.get(rtpReport.codecId) as (RTCStats & { mimeType?: string }) | undefined
  return codecReport?.mimeType?.toLowerCase() ?? null
}

function listCodecMimeTypes (report: RTCStatsReport): string[] {
  const codecs: string[] = []
  report.forEach(stat => {
    if (stat.type !== 'codec') return
    const mime = (stat as RTCStats & { mimeType?: string }).mimeType?.toLowerCase()
    if (mime && !codecs.includes(mime)) codecs.push(mime)
  })
  return codecs
}

async function waitForReceiverVideoCodec (peer: Peer, timeoutMs = 8000): Promise<string> {
  const start = Date.now()
  let lastCodecs: string[] = []
  while (Date.now() - start < timeoutMs) {
    const transceiver = getVideoTransceiver(peer)
    if (!transceiver?.receiver?.getStats) break
    const report = await transceiver.receiver.getStats()
    const codec = getCodecMimeTypeFromReport(report, 'inbound-rtp')
    if (codec) return codec
    lastCodecs = listCodecMimeTypes(report)
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error(`Timed out waiting for inbound video codec. Seen codecs: ${lastCodecs.join(', ') || 'none'}`)
}

async function waitForSenderVideoCodec (peer: Peer, timeoutMs = 8000): Promise<string> {
  const start = Date.now()
  let lastCodecs: string[] = []
  while (Date.now() - start < timeoutMs) {
    const transceiver = getVideoTransceiver(peer)
    if (!transceiver?.sender?.getStats) break
    const report = await transceiver.sender.getStats()
    const codec = getCodecMimeTypeFromReport(report, 'outbound-rtp')
    if (codec) return codec
    lastCodecs = listCodecMimeTypes(report)
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error(`Timed out waiting for outbound video codec. Seen codecs: ${lastCodecs.join(', ') || 'none'}`)
}

async function waitForVideoCodec (peer: Peer): Promise<string> {
  try {
    return await waitForReceiverVideoCodec(peer, 4000)
  } catch {
    return await waitForSenderVideoCodec(peer, 4000)
  }
}

async function attachStreamToVideo (stream: MediaStream): Promise<void> {
  const video = document.createElement('video')
  video.muted = true
  video.autoplay = true
  video.playsInline = true
  video.srcObject = stream
  document.body.appendChild(video)
  try {
    await video.play()
  } catch {
    // Ignore autoplay errors; stats should still populate.
  }
}

// A moving canvas: a video source every browser under test has, unlike a webcam
async function getCameraStream (): Promise<MediaStream> {
  const canvas = document.createElement('canvas')
  canvas.width = 320
  canvas.height = 180
  const context = canvas.getContext('2d')!
  const paint = (): void => {
    context.fillStyle = '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')
    context.fillRect(0, 0, canvas.width, canvas.height)
  }
  paint()
  setInterval(paint, 50)
  return canvas.captureStream(15)
}

test('preferredCodecs influences negotiated video codec (getStats)', async function () {
  if (!browserCanRunCodecTests() || !browserHonoursCodecOrder()) return
  const preferred = ['video/vp9']
  const receiverCaps = RTCRtpReceiver.getCapabilities('video')
  if (!receiverCaps?.codecs?.some(codec => codec.mimeType?.toLowerCase() === 'video/vp9')) return

  const [stream1, stream2] = await Promise.all([getCameraStream(), getCameraStream()])

  const peer1 = new Peer({
    initiator: true,
    streams: [stream1],
    preferredCodecs: { video: preferred }
  })
  const peer2 = new Peer({
    streams: [stream2],
    preferredCodecs: { video: preferred }
  })

  peer1.on('signal', data => peer2.signal(data))
  peer2.on('signal', data => peer1.signal(data))

  await new Promise<void>((resolve) => {
    let streams = 0
    const onStream = (stream: MediaStream) => {
      void attachStreamToVideo(stream)
      streams++
      if (streams >= 2) resolve()
    }
    peer1.on('stream', onStream)
    peer2.on('stream', onStream)
  })

  await new Promise(resolve => setTimeout(resolve, 500))

  const [codec1, codec2] = await Promise.all([
    waitForVideoCodec(peer1),
    waitForVideoCodec(peer2)
  ])

  expect(codec1).toBe('video/vp9')
  expect(codec2).toBe('video/vp9')

  peer1.destroy()
  peer2.destroy()
  stream1.getTracks().forEach(track => track.stop())
  stream2.getTracks().forEach(track => track.stop())
})

// Linux WebKit's GStreamer WebRTC backend keeps the codec order it likes whatever setCodecPreferences() says;
// iOS Safari runs libwebrtc and does honour it. Tests that depend on the order skip there.
function browserHonoursCodecOrder (): boolean {
  return !common.isBrowser('safari') && !common.isBrowser('ios')
}

function browserCanRunCodecTests (): boolean {
  if (!process.browser) return false
  if (typeof RTCRtpTransceiver === 'undefined') return false
  if (typeof RTCRtpTransceiver.prototype.setCodecPreferences !== 'function') return false
  if (typeof RTCRtpReceiver === 'undefined' || typeof RTCRtpReceiver.getCapabilities !== 'function') return false
  return true
}

function connect (peer1: Peer, peer2: Peer): void {
  peer1.on('signal', data => peer2.signal(data))
  peer2.on('signal', data => peer1.signal(data))
}

function waitForStream (peer: Peer): Promise<void> {
  return new Promise<void>(resolve => {
    peer.once('stream', (stream: MediaStream) => {
      void attachStreamToVideo(stream)
      resolve()
    })
  })
}

test('exclusive receive preference restricts both directions', async function () {
  if (!browserCanRunCodecTests() || !browserHonoursCodecOrder()) return

  const [stream1, stream2] = await Promise.all([getCameraStream(), getCameraStream()])

  // peer1 can only take VP8; peer2 would rather have VP9, but has nothing else to send
  const peer1 = new Peer({
    initiator: true,
    streams: [stream1],
    receiveCodecs: { video: { prefer: ['video/vp8'], exclusive: true } }
  })
  const peer2 = new Peer({
    streams: [stream2],
    receiveCodecs: { video: ['video/vp9'] }
  })
  connect(peer1, peer2)
  await Promise.all([waitForStream(peer1), waitForStream(peer2)])
  await new Promise(resolve => setTimeout(resolve, 500))

  // Both what each peer receives and, the part setCodecPreferences() alone cannot enforce, what each peer sends
  const [received1, received2, sent1, sent2] = await Promise.all([
    waitForReceiverVideoCodec(peer1), waitForReceiverVideoCodec(peer2),
    waitForSenderVideoCodec(peer1), waitForSenderVideoCodec(peer2)
  ])
  expect([received1, received2, sent1, sent2]).toEqual(['video/vp8', 'video/vp8', 'video/vp8', 'video/vp8'])

  peer1.destroy()
  peer2.destroy()
  stream1.getTracks().forEach(track => track.stop())
  stream2.getTracks().forEach(track => track.stop())
})

test('an exclusive answerer sends only its preferred codec', async function () {
  if (!browserCanRunCodecTests()) return

  const [stream1, stream2] = await Promise.all([getCameraStream(), getCameraStream()])

  // The offerer asks for VP9; the answerer can only afford VP8 and must not encode what the offer lists first
  const peer1 = new Peer({
    initiator: true,
    streams: [stream1],
    receiveCodecs: { video: ['video/vp9'] }
  })
  const peer2 = new Peer({
    streams: [stream2],
    receiveCodecs: { video: { prefer: ['video/vp8'], exclusive: true } }
  })
  connect(peer1, peer2)
  await Promise.all([waitForStream(peer1), waitForStream(peer2)])
  await new Promise(resolve => setTimeout(resolve, 500))

  const [sent1, sent2] = await Promise.all([waitForSenderVideoCodec(peer1), waitForSenderVideoCodec(peer2)])
  expect([sent1, sent2]).toEqual(['video/vp8', 'video/vp8'])

  peer1.destroy()
  peer2.destroy()
  stream1.getTracks().forEach(track => track.stop())
  stream2.getTracks().forEach(track => track.stop())
})

test('a peer that only receives still gets its preferred codec', async function () {
  if (!browserCanRunCodecTests() || !browserHonoursCodecOrder()) return

  const stream1 = await getCameraStream()

  // peer2 adds no track: its transceiver comes from the offer, and its preference must shape the answer
  const peer1 = new Peer({
    initiator: true,
    streams: [stream1],
    receiveCodecs: { video: ['video/vp9'] }
  })
  const peer2 = new Peer({
    receiveCodecs: { video: ['video/vp8'] }
  })
  connect(peer1, peer2)
  await waitForStream(peer2)
  await new Promise(resolve => setTimeout(resolve, 500))

  expect(await waitForReceiverVideoCodec(peer2)).toBe('video/vp8')

  peer1.destroy()
  peer2.destroy()
  stream1.getTracks().forEach(track => track.stop())
})

async function waitForSenderVideoCodecToBe (peer: Peer, expected: string, timeoutMs = 8000): Promise<string> {
  const start = Date.now()
  let last = ''
  while (Date.now() - start < timeoutMs) {
    last = await waitForSenderVideoCodec(peer, timeoutMs)
    if (last === expected) return last
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  return last
}

// A changed preference takes effect on renegotiation, whether the initiator or the other peer changes it
for (const changer of ['initiator', 'non-initiator'] as const) {
  test(`a changed receiveCodecs applies to both directions when the ${changer} renegotiates`, async function () {
    if (!browserCanRunCodecTests() || !browserHonoursCodecOrder()) return

    const [stream1, stream2] = await Promise.all([getCameraStream(), getCameraStream()])
    const both = { video: { prefer: ['video/vp9', 'video/vp8'], exclusive: true } }
    const peer1 = new Peer({ initiator: true, streams: [stream1], receiveCodecs: both })
    const peer2 = new Peer({ streams: [stream2], receiveCodecs: both })
    connect(peer1, peer2)
    await Promise.all([waitForStream(peer1), waitForStream(peer2)])
    await new Promise(resolve => setTimeout(resolve, 500))
    expect(await waitForSenderVideoCodecToBe(peer1, 'video/vp9')).toBe('video/vp9')
    expect(await waitForSenderVideoCodecToBe(peer2, 'video/vp9')).toBe('video/vp9')

    // One peer can no longer afford VP9: both must fall back to VP8
    const peer = changer === 'initiator' ? peer1 : peer2
    peer.receiveCodecs = { video: { prefer: ['video/vp8'], exclusive: true } }
    peer.negotiate()

    expect(await waitForSenderVideoCodecToBe(peer1, 'video/vp8')).toBe('video/vp8')
    expect(await waitForSenderVideoCodecToBe(peer2, 'video/vp8')).toBe('video/vp8')

    peer1.destroy()
    peer2.destroy()
    stream1.getTracks().forEach(track => track.stop())
    stream2.getTracks().forEach(track => track.stop())
  })
}
