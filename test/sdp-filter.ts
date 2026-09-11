import { filterSdpCodecs } from '../index.js'
import { test, expect } from 'vitest'

const offer = [
  'v=0', 'o=- 1 2 IN IP4 127.0.0.1', 's=-', 't=0 0',
  'm=audio 9 UDP/TLS/RTP/SAVPF 111 63', 'a=rtpmap:111 opus/48000/2', 'a=rtpmap:63 red/48000/2', 'a=fmtp:63 111/111',
  'm=video 9 UDP/TLS/RTP/SAVPF 96 97 98 99 100 101 102 103 104 105',
  'a=rtpmap:96 VP8/90000', 'a=rtcp-fb:96 nack', 'a=rtpmap:97 rtx/90000', 'a=fmtp:97 apt=96',
  'a=rtpmap:98 VP9/90000', 'a=fmtp:98 profile-id=0', 'a=rtpmap:99 rtx/90000', 'a=fmtp:99 apt=98',
  'a=rtpmap:100 H264/90000', 'a=fmtp:100 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f', 'a=rtcp-fb:100 nack pli',
  'a=rtpmap:101 rtx/90000', 'a=fmtp:101 apt=100',
  'a=rtpmap:102 red/90000', 'a=rtpmap:103 rtx/90000', 'a=fmtp:103 apt=102', 'a=rtpmap:104 ulpfec/90000',
  'a=rtpmap:105 AV1/90000', 'a=ssrc:1 cname:x'
].join('\r\n') + '\r\n'

test('keeps the preferred codecs, their rtx and the auxiliary entries, drops the rest', () => {
  const filtered = filterSdpCodecs(offer, 'video', ['video/H264'])
  expect(filtered).toContain('m=video 9 UDP/TLS/RTP/SAVPF 100 101 102 103 104\r\n')
  for (const gone of ['a=rtpmap:96 ', 'a=rtcp-fb:96 ', 'a=fmtp:97 ', 'a=rtpmap:98 ', 'a=fmtp:99 ', 'a=rtpmap:105 ']) {
    expect(filtered).not.toContain(gone)
  }
  for (const kept of ['a=rtpmap:100 H264', 'a=rtcp-fb:100 nack pli', 'a=fmtp:101 apt=100', 'a=rtpmap:102 red', 'a=fmtp:103 apt=102', 'a=rtpmap:104 ulpfec', 'a=ssrc:1 cname:x']) {
    expect(filtered).toContain(kept)
  }
  // the audio section is untouched
  expect(filtered).toContain('m=audio 9 UDP/TLS/RTP/SAVPF 111 63\r\n')
})

test('accepts short names and several codecs', () => {
  expect(filterSdpCodecs(offer, 'video', ['vp9', 'H264'])).toContain('m=video 9 UDP/TLS/RTP/SAVPF 98 99 100 101 102 103 104\r\n')
})

test('leaves the SDP alone when no preferred codec is present', () => {
  expect(filterSdpCodecs(offer, 'video', ['video/HEVC'])).toBe(offer)
  expect(filterSdpCodecs(offer, 'audio', ['video/H264'])).toBe(offer)
})
