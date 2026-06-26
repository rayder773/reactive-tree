import type { FileData } from '../../../../src'

export async function fileToData(file: File): Promise<FileData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () =>
      resolve({
        name: file.name,
        type: file.type,
        size: file.size,
        lastModified: file.lastModified,
        base64: (reader.result as string).split(',')[1],
      })
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function dataToFile(data: FileData): File {
  const bytes = atob(data.base64)
  const buffer = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) {
    buffer[i] = bytes.charCodeAt(i)
  }
  return new File([buffer], data.name, {
    type: data.type,
    lastModified: data.lastModified,
  })
}
