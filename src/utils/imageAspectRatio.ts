/** Read only image headers; no pixels, network or persistent changes. Unsupported formats remain unknown. */
export function imageAspectRatio(dataUrl?: string): number | undefined {
  if (!dataUrl?.startsWith('data:image/')) return undefined
  const comma=dataUrl.indexOf(',')
  if(comma<0||!dataUrl.slice(0,comma).includes(';base64'))return undefined
  try {
    // The bounded prefix suffices for ordinary PNG/JPEG headers, without decoding the photograph.
    const encoded=dataUrl.slice(comma+1,comma+1+262144),raw=atob(encoded.length%4?encoded.slice(0,encoded.length-encoded.length%4):encoded)
    const bytes=Uint8Array.from(raw,c=>c.charCodeAt(0)),view=new DataView(bytes.buffer)
    let width=0,height=0,orientation=1
    if(bytes.length>=24&&view.getUint32(0)===0x89504e47&&view.getUint32(4)===0x0d0a1a0a) {
      width=view.getUint32(16);height=view.getUint32(20)
    } else if(bytes[0]===0xff&&bytes[1]===0xd8) {
      let cursor=2
      while(cursor+4<=bytes.length) {
        if(bytes[cursor]!==0xff)break
        const marker=bytes[cursor+1],length=view.getUint16(cursor+2)
        if(marker===0xda||marker===0xd9)break
        if(length<2||cursor+2+length>bytes.length)break
        if(marker===0xe1&&length>=16&&String.fromCharCode(...bytes.slice(cursor+4,cursor+10))==='Exif\0\0') {
          const tiff=cursor+10,little=view.getUint16(tiff)===0x4949
          const directory=tiff+view.getUint32(tiff+4,little)
          if(directory+2<=cursor+2+length) {
            const count=view.getUint16(directory,little)
            for(let i=0;i<count;i++) {
              const entry=directory+2+12*i;if(entry+12>cursor+2+length)break
              if(view.getUint16(entry,little)===0x112)orientation=view.getUint16(entry+8,little)
            }
          }
        }
        if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)&&length>=7) {height=view.getUint16(cursor+5);width=view.getUint16(cursor+7)}
        cursor+=length+2
      }
    }
    if(!width||!height)return undefined
    return orientation>=5&&orientation<=8?height/width:width/height
  }catch{return undefined}
}
