<script setup lang="ts">
import { computed, ref } from 'vue'

const props = defineProps<{
	value: unknown
	indent?: number
	fieldKey?: string
	mimeType?: string
}>()

const currentIndent = props.indent ?? 0
const pad = '  '.repeat(currentIndent)
const padClose = '  '.repeat(Math.max(0, currentIndent - 1))

const copied = ref(false)
const showPreview = ref(false)

async function copy(text: string) {
	await navigator.clipboard.writeText(text)
	copied.value = true
	setTimeout(() => (copied.value = false), 1500)
}

function isObject(v: unknown): v is Record<string, unknown> {
	return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isArray(v: unknown): v is unknown[] {
	return Array.isArray(v)
}

function truncate(s: string): string {
	return s.length > 24 ? s.slice(0, 24) + '…"' : `${s}"`
}

function mimeTypeOf(obj: Record<string, unknown>): string {
	return typeof obj.type === 'string' ? obj.type : ''
}

type PreviewKind = 'image' | 'video' | 'audio' | 'pdf' | 'text' | 'none'

function previewKind(mime: string): PreviewKind {
	if (mime.startsWith('image/')) return 'image'
	if (mime.startsWith('video/')) return 'video'
	if (mime.startsWith('audio/')) return 'audio'
	if (mime === 'application/pdf') return 'pdf'
	if (
		mime.startsWith('text/') ||
		mime === 'application/json' ||
		mime === 'application/xml'
	)
		return 'text'
	return 'none'
}

const dataUrl = computed(() => {
	if (
		props.fieldKey !== 'base64' ||
		typeof props.value !== 'string' ||
		!props.mimeType
	)
		return ''
	return `data:${props.mimeType};base64,${props.value}`
})

const textContent = computed(() => {
	if (props.fieldKey !== 'base64' || typeof props.value !== 'string') return ''
	try {
		return atob(props.value)
	} catch {
		return ''
	}
})

const kind = computed(() => previewKind(props.mimeType ?? ''))
</script>

<template>
  <template v-if="isObject(value)">
    <span class="jv-brace">{</span>
    <div v-for="(v, k, i) in (value as Record<string, unknown>)" :key="k" class="jv-row">
      <span class="jv-pad">{{ pad }}</span>
      <span class="jv-key">"{{ k }}"</span>
      <span class="jv-colon">: </span>
      <JsonView
        :value="v"
        :indent="currentIndent + 1"
        :field-key="String(k)"
        :mime-type="String(k) === 'base64' && isObject(value) ? mimeTypeOf(value as Record<string, unknown>) : undefined"
      />
      <span v-if="i < Object.keys(value as object).length - 1" class="jv-comma">,</span>
    </div>
    <span class="jv-pad">{{ padClose }}</span>
    <span class="jv-brace">}</span>
  </template>

  <template v-else-if="isArray(value)">
    <span class="jv-brace">[</span>
    <div v-for="(v, i) in value" :key="i" class="jv-row">
      <span class="jv-pad">{{ pad }}</span>
      <JsonView :value="v" :indent="currentIndent + 1" />
      <span v-if="i < value.length - 1" class="jv-comma">,</span>
    </div>
    <span class="jv-pad">{{ padClose }}</span>
    <span class="jv-brace">]</span>
  </template>

  <template v-else-if="fieldKey === 'base64' && typeof value === 'string'">
    <span class="jv-string">"{{ truncate(value) }}</span>
    <button class="jv-btn" type="button" @click="copy(value)">{{ copied ? '✓' : 'copy' }}</button>
    <button class="jv-btn" type="button" @click="showPreview = true">preview</button>

    <Teleport to="body">
      <div v-if="showPreview" class="jv-overlay" @click.self="showPreview = false">
        <div class="jv-popup">
          <button class="jv-close" type="button" @click="showPreview = false">✕</button>

          <img v-if="kind === 'image'" :src="dataUrl" class="jv-preview-media" />

          <video v-else-if="kind === 'video'" :src="dataUrl" controls class="jv-preview-media" />

          <audio v-else-if="kind === 'audio'" :src="dataUrl" controls class="jv-preview-audio" />

          <iframe
            v-else-if="kind === 'pdf'"
            :src="dataUrl"
            class="jv-preview-media"
          />

          <pre v-else-if="kind === 'text'" class="jv-preview-text">{{ textContent }}</pre>

          <p v-else class="jv-preview-none">Preview not available for this file type.</p>
        </div>
      </div>
    </Teleport>
  </template>

  <template v-else-if="typeof value === 'string'">
    <span class="jv-string">"{{ value }}"</span>
  </template>

  <template v-else-if="value === null">
    <span class="jv-null">null</span>
  </template>

  <template v-else>
    <span class="jv-primitive">{{ value }}</span>
  </template>
</template>

<style scoped>
.jv-row { display: block; }
.jv-pad { white-space: pre; }
.jv-key { color: #9cdcfe; }
.jv-colon { color: #ccc; }
.jv-comma { color: #ccc; }
.jv-brace { color: #ccc; }
.jv-string { color: #ce9178; }
.jv-null { color: #569cd6; }
.jv-primitive { color: #b5cea8; }

.jv-btn {
  margin-left: 6px;
  padding: 0 5px;
  font-size: 11px;
  line-height: 1.4;
  cursor: pointer;
  border: 1px solid #555;
  border-radius: 3px;
  background: #2d2d2d;
  color: #ccc;
  vertical-align: middle;
}
.jv-btn:hover { background: #3d3d3d; }

.jv-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.jv-popup {
  position: relative;
  background: #1e1e1e;
  border: 1px solid #444;
  border-radius: 6px;
  padding: 32px 16px 16px;
  max-width: 90vw;
  max-height: 90vh;
  overflow: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.jv-close {
  position: absolute;
  top: 8px;
  right: 10px;
  background: none;
  border: none;
  color: #ccc;
  font-size: 16px;
  cursor: pointer;
  line-height: 1;
}
.jv-close:hover { color: #fff; }

.jv-preview-media {
  max-width: 80vw;
  max-height: 80vh;
  border: none;
  display: block;
}

.jv-preview-audio {
  width: 400px;
  max-width: 80vw;
}

.jv-preview-text {
  max-width: 80vw;
  max-height: 75vh;
  overflow: auto;
  color: #d4d4d4;
  font-size: 13px;
  white-space: pre-wrap;
  margin: 0;
}

.jv-preview-none {
  color: #888;
  font-size: 13px;
}
</style>
