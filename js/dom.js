const $ = id => document.getElementById(id);
export const canvas = $('c');
export const ctx = canvas.getContext('2d');
export const canvasBack = $('cBack');
export const ctxBack = canvasBack.getContext('2d');

export const gate = $('gate'), gateBtn = $('gateBtn');
export const hud = $('hud'), controls = $('controls'), hint = $('hint');
export const memoryOverlay = $('memoryOverlay'), memoryLabel = $('memoryLabel');
export const memoryText = $('memoryText'), memoryMeta = $('memoryMeta'), memoryReason = $('memoryReason');
export const fieldVoiceOverlay = $('fieldVoiceOverlay'), fieldVoiceText = $('fieldVoiceText');
export const unityOverlay = $('unityOverlay'), unityText = $('unityText');
export const hudConn = $('hudConn'), hudMsgs = $('hudMsgs');
export const hudAware = $('hudAware'), hudCoh = $('hudCoh'), hudMind = $('hudMind');
export const awareBar = $('awareBar'), cohBar = $('cohBar');
export const hudRecog = $('hudRecog'), recogBar = $('recogBar'), hudPhase = $('hudPhase');
export const resetBtn = $('reset'), muteBtn = $('muteBtn'), mindBtn = $('mindBtn');
export const mindPanel = $('mindPanel'), mindProvider = $('mindProvider'), mindKey = $('mindKey');
export const mindKeyRow = $('mindKeyRow'), mindKeyLink = $('mindKeyLink'), mindModel = $('mindModel');
export const mindNote = $('mindNote'), mindLink = $('mindLink'), mindClose = $('mindClose'), mindStatus = $('mindStatus');
export const channel = $('channel'), channelLines = $('channelLines');
export const whisperBox = $('whisper'), whisperTo = $('whisperTo'), whisperInput = $('whisperInput');
export const nodeTip = $('nodeTip');
export const llmDot = $('llmDot'), hudMini = $('hudMini');

export const channelHead = $('channelHead'), channelNew = $('channelNew'), channelCount = $('channelCount'), channelFold = $('channelFold');
