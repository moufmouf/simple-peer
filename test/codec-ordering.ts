import { orderCodecPreferences } from '../index.js'
import { test, expect } from 'vitest'

const capabilities: RTCRtpCodecCapability[] = [
  { mimeType: 'video/VP8', clockRate: 90000 },
  { mimeType: 'video/rtx', clockRate: 90000 },
  { mimeType: 'video/VP9', clockRate: 90000, sdpFmtpLine: 'profile-id=0' },
  { mimeType: 'video/H264', clockRate: 90000, sdpFmtpLine: 'profile-level-id=42e01f;packetization-mode=1' },
  { mimeType: 'video/H264', clockRate: 90000, sdpFmtpLine: 'profile-level-id=42e01f;packetization-mode=0' },
  { mimeType: 'video/red', clockRate: 90000 },
  { mimeType: 'video/ulpfec', clockRate: 90000 }
]

const mimes = (codecs: RTCRtpCodecCapability[]): string[] => codecs.map(codec => codec.mimeType)

test('preferred codecs come first, in order, then the rest', () => {
  expect(mimes(orderCodecPreferences(capabilities, ['video/VP9', 'h264']))).toEqual([
    'video/VP9', 'video/H264', 'video/H264', 'video/VP8', 'video/rtx', 'video/red', 'video/ulpfec'
  ])
})

test('exclusive keeps only the preferred codecs and the auxiliary entries', () => {
  expect(mimes(orderCodecPreferences(capabilities, { prefer: ['H264'], exclusive: true }))).toEqual([
    'video/H264', 'video/H264', 'video/rtx', 'video/red', 'video/ulpfec'
  ])
})

test('a preference matching nothing keeps every codec, exclusive or not', () => {
  expect(mimes(orderCodecPreferences(capabilities, { prefer: ['video/AV1'], exclusive: true }))).toEqual(mimes(capabilities))
  expect(mimes(orderCodecPreferences(capabilities, ['video/AV1']))).toEqual(mimes(capabilities))
})

test('auxiliary codecs are never matched by a preference', () => {
  expect(mimes(orderCodecPreferences(capabilities, ['rtx', 'VP8']))).toEqual([
    'video/VP8', 'video/rtx', 'video/VP9', 'video/H264', 'video/H264', 'video/red', 'video/ulpfec'
  ])
})
