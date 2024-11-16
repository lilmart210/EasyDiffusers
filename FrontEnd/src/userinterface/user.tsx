import { ChangeEvent, useContext, useEffect, useMemo, useRef, useState } from 'react'
import './user.css'
import { AuthContext } from '../protected/authenticate';


export function UserInterface(){
    const [ShowChats,SetShowChats] = useState(true);
    const [ShowSettings,SetShowSettings] = useState(true);
    const [ShowChat,SetShowChat] = useState(true);
    const context = useContext(AuthContext);
    const FileInputRef = useRef<HTMLInputElement>(null);
    const [UploadedFiles,SetUploadedFiles] = useState<File[]>([])

    //Rendering Markdown
    //The weird input that chat apps have
    //auto scroll to bottom;
    //save a specific chat option in local storage?

    function AddFiles(e: React.ChangeEvent<HTMLInputElement>){
    
        if(!e.target.files) return;
        const vals = Array.from(e.target.files);
    
        SetUploadedFiles(prev=>[...prev,...vals]);
    
    }

    const MemoUploadFiles = useMemo(()=>UploadedFiles.map((itm,i)=>(
        <UploadDisplay key={i} src={itm} onClose={()=>SetUploadedFiles(prev=>prev.filter((j,k)=>k!=i))}/>
    )),[UploadedFiles])


    let ChatPanelName = `ChatPanel`
    if(!ShowChats) ChatPanelName += ' Hidden'

    let SettingName = `Option`;
    if(!ShowSettings) SettingName += ` Hidden`

    return (
        <div className='UserInterface'>
            {
                !ShowChats && (
                    <button className='HoverButton' onClick={()=>SetShowChats(true)}>{`\u{2192}`}</button>
                )
            }
            <div className={ChatPanelName}>
                <div className='Container'>
                    <label>Currupt</label>
                    <button onClick={()=>SetShowChats(false)}>{`\u{2190}`}</button>
                </div>
                
                <button>New Chat</button>
                <label>Projects</label>
                <div className='List'>

                </div>
                <label>History</label>
                <div className='List'>

                </div>
                <button onClick={()=>context.SetToken('')}>Logout</button>
            </div>

            <div className='Chat'>
                <div className='Chat-Header'>
                    <button className='TerminalButton' onClick={()=>SetShowChat(prev=>!prev)}>{ShowChat ? 'Terminal' : 'Chat'}</button>
                    <select>
                        <option >qween</option>
                        <option>stablediff</option>
                    </select>
                </div>
                <div className='ChatList'>
                    <label>hi</label>
                    <label>hi</label>
                    <label>hi</label>
                    
                </div>
                {UploadedFiles.length != 0 && (
                    <div className='MediaContent'>
                        {
                            MemoUploadFiles
                        }
                    </div>
                    )
                }
                
                <div className='Input'>
                    <div className='InputField' contentEditable></div>

                    <div className='ButtonContainer'>
                        <input onChange={AddFiles} type='file' multiple ref={FileInputRef} className='Hide'/>
                        <button onClick={()=>FileInputRef.current?.click()}>{`\u{2912}`}</button>
                        <button>{`\u{229d}`}</button>
                        <button>{`\u{2b95}`}</button>
                    </div>
                </div>
            </div>
            {
                !ShowSettings && (
                    <button className='HoverButton' onClick={()=>SetShowSettings(true)}>{`\u{2253}`}</button>
                )
            }
            <div className={SettingName}>
                <div className='Container'>
                    <label>Chat Parameters</label>
                    <button onClick={()=>SetShowSettings(false)}>{`\u{2253}`}</button>
                </div>
                
                <div className='List'>

                </div>

                <label>Project Files</label>
                
                <div className='List'>

                </div>
            </div>

        </div>
    )
}


type UploadDisplayProps = {
    src : File
    onClose? : Function
  }
  

function UploadDisplay(props : UploadDisplayProps){
    const [VideoHover,SetVideoHovering] = useState(false);
    const prefix = props.src.type.split('/')[0];
    const vidref = useRef<HTMLVideoElement>(null);
    const audioref = useRef<HTMLAudioElement>(null);

    useEffect(()=>{
        //audioref.current?.muted = false;

    },[audioref,vidref])
    
    return (
      <div className='UploadVideoContainer'>
        {prefix == 'image' && <img className='UploadVideo' src={URL.createObjectURL(props.src)}></img>} 
        {prefix == 'video' &&
          <video controls ref={vidref} className='UploadVideo' muted autoPlay={VideoHover} onMouseEnter={()=>vidref.current?.play()} onMouseLeave={()=>vidref.current?.pause()}>
            <source src={URL.createObjectURL(props.src)} type={props.src.type}></source>
          </video>
        }
        {
            prefix == 'audio' && <audio controls={true} ref={audioref} className='UploadVideo' muted={VideoHover} autoPlay={VideoHover} onMouseEnter={()=>{audioref.current?.play();}} onMouseLeave={()=>audioref.current?.pause()}> 
                <source src={URL.createObjectURL(props.src)} type={props.src.type}></source>
            </audio>
        }
        {(prefix  != 'image' && prefix != 'video' && prefix != 'audio') && <object className='UploadVideo' data={URL.createObjectURL(props.src)} type={props.src.type}/>}
        <button onClick={()=>props.onClose && props.onClose()}>x</button>
      </div>
    )
  }