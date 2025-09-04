import * as React from 'react'
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog'
import { Button } from './ui/button'
import QRCode from 'qrcode'

export function QRCodeModal({ open, onClose, url }: { open: boolean; onClose: () => void; url: string }) {
  const [dataUrl, setDataUrl] = React.useState<string>('')
  React.useEffect(() => {
    let mounted = true
    if (open && url) {
      QRCode.toDataURL(url, { width: 256, margin: 1 }).then((d: string) => {
        if (mounted) setDataUrl(d)
      }).catch(() => setDataUrl(''))
    } else {
      setDataUrl('')
    }
    return () => { mounted = false }
  }, [open, url])

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader>
        <DialogTitle>Scan to open</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col items-center gap-3">
        {dataUrl ? <img src={dataUrl} alt="QR Code" className="h-56 w-56" /> : <div className="h-56 w-56 rounded bg-gray-100" />}
        <div className="break-all text-center text-xs text-gray-600">{url}</div>
      </div>
      <DialogFooter>
        <Button onClick={onClose} variant="secondary">Close</Button>
      </DialogFooter>
    </Dialog>
  )
}
