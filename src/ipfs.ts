interface FileUploadResponse {
  name: string
  type: string
  uri: string
  error?: string
}

interface IpfsSender {
  uploadFile: (file: File) => Promise<FileUploadResponse>
}

const ipfsSDK = {
  uploadFile: async (file) => {
    const body = new FormData()
    console.log('file', file)
    body.append(file.name, file, file.name)
    try {
      const resp = await fetch('https://market.holaplex.com/api/ipfs/upload', {
        method: 'POST',
        body,
      })
      const json = await resp.json()
      if (json) {
        return json.files[0] as FileUploadResponse
      }
    } catch (e: any) {
      console.error('Could not upload file', e)
      throw new Error(e)
    }
  },
} as IpfsSender

export default ipfsSDK
