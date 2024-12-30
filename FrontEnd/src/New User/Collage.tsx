import { memo, useContext, useEffect, useMemo, useRef, useState } from 'react';
import './Collage.css'
import {ExampleChats} from './examples'
import { Bot,UserRound,Trash,Copy,CircleX,Power,Settings2,Camera,Video,Mic,ArrowLeftToLineIcon,SendHorizonal,Ban,Upload,SquareX,LogOut,ArrowLeftRight,CirclePlay, DeleteIcon, Cog, ExternalLink, PlusCircle } from 'lucide-react';
import Markdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { AuthContext, SocketContext } from '../protected/authenticate';
import { Project, useSocketComponent } from './Socket';

//https://colorffy.com/dark-theme-generator?colors=424242-121212
//https://colorffy.com/dark-theme-generator?colors=615c95-121212
//https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/light-dark

/**
 * 
 * Checkboxes don't save when you refresh so don't use them
 */

export function useDevices(){
    const [Devices,SetDevices] = useState<MediaDeviceInfo[]>([])
    const [Secure,SetSecure] = useState(false);
    const [DefaultAudioDevice,SetDefaultAudioDevice] = useState<string>('')
    const [DefaultVideoDevice,SetDefaultVideoDevice] = useState<string>('');

    useEffect(()=>{
        //ask server for chat configuration
        //load previous configuration from local storage
        //grab current available devices
        const secure = navigator.mediaDevices;

        if(!secure) console.log("insecure content");
        SetSecure(!!secure);

        if(secure){
            const devices = navigator.mediaDevices.enumerateDevices();
            devices.then((res)=>{
                SetDevices(res);
                
                //save and load last used device
                const lastaudio = localStorage.getItem('audio');
                const lastvideo = localStorage.getItem('video');

                const defaudio = res.filter((itm)=>itm.kind == 'audioinput')[0];
                const defvideo = res.filter((itm)=>itm.kind == 'videoinput')[0];
                
                if(defaudio) SetDefaultAudioDevice(lastaudio ? lastaudio : defaudio.deviceId);
                if(defvideo) SetDefaultVideoDevice(lastvideo ? lastvideo : defvideo.deviceId);
            }).catch((e)=>{
                console.log("You do not support MediaDevices")
            });
        }


        return ()=>{
        }

    },[]);

    useEffect(()=>{
        if(!DefaultAudioDevice || !DefaultVideoDevice) return;

        localStorage.setItem('audio',DefaultAudioDevice);
        localStorage.setItem('video',DefaultVideoDevice);
    },[DefaultAudioDevice,DefaultVideoDevice])

    async function GetVideoStream(audio = false){
        if(!Secure) return false;
        const videoid = DefaultVideoDevice ? {deviceId : {exact : DefaultVideoDevice}} : true;
        
        const media = await navigator.mediaDevices.getUserMedia({audio : audio,video : videoid});
        return media;
    }
    async function GetAudioStream(){
        if(!Secure) return false;
        
        const audioid = DefaultAudioDevice ? {deviceId : {exact : DefaultAudioDevice}} : true;
        
        const media = await navigator.mediaDevices.getUserMedia({audio : audioid,video : false});
        return media;
    }

    function NextAudioStream(){
        const audio = Devices.filter((itm)=>itm.kind == 'audioinput');
        
        SetDefaultAudioDevice(prev=>{
            const idx = audio.findIndex(itm=>itm.deviceId == prev);
            if(idx == -1) return prev;

            const nextidx = idx + 1 < audio.length ? idx + 1 : 0;
            return audio[nextidx].deviceId
        })
    }

    function NextVideoStream(){
        const video = Devices.filter((itm)=>itm.kind == 'videoinput');
        
        SetDefaultVideoDevice(prev=>{
            const idx = video.findIndex(itm=>itm.deviceId == prev);
            if(idx == -1) return prev;

            const nextidx = idx + 1 < video.length ? idx + 1 : 0;
            return video[nextidx].deviceId
        })
    }

    return {
        Devices,
        Secure,
        DefaultAudioDevice,
        SetDefaultAudioDevice,
        DefaultVideoDevice,
        SetDefaultVideoDevice,
        GetVideoStream,
        GetAudioStream,
        NextAudioStream,
        NextVideoStream
    }
}

export function Collage(){
    const context = useContext(AuthContext);
    //const socketContext = useContext(SocketContext);
    //const Socket = socketContext.Socket as ReturnType<typeof useSocketComponent>;
    const Socket = useSocketComponent();


    //visible display settings
    const [ShowSettings,SetShowSettings] = useState(false);
    const [Hide,SetSettingsHide] = useState<boolean>();
    const [HidePreview,SetHidePreview] = useState<string>('');
    const [ScreenPanelView,SetScreenPanelView] = useState<string>('');
    const [LargeMedia,SetLargeMedia] = useState<File>();
    const [AllowVibrate,SetAllowVibrate] = useState(!!localStorage.getItem('vibrate'));
    const [AllowSamples,SetAllowSamples] = useState(!!localStorage.getItem('sampled'));
    const [AllowAutoScroll,SetAllowAutoScroll] = useState(!!localStorage.getItem('autoscroll'));
    const [ProjectSearch,SetProjectSearch] = useState('');
    const [ChatSearch,SetChatSearch] = useState('');
    const [HoverDetail,SetHoverDetail] = useState('');
    const [MousePosition,SetMousePosition] = useState({x : 0,y : 0});

    //devices root materials
    const Devices = useDevices();


    useEffect(()=>{
        //over rde every button
        const buttons = document.querySelectorAll('button');
        buttons.forEach((but)=>{
            but.addEventListener('click',Vibrate)
        })

        return ()=>{
            buttons.forEach((but)=>{
                but.removeEventListener('click',Vibrate);
            })
        }
    },[])

    useEffect(()=>{
        if(AllowVibrate == undefined){
            SetAllowVibrate(true);
        }

        localStorage.setItem('vibrate',AllowVibrate ? 'allow' : '');
    },[AllowVibrate])
    useEffect(()=>{
        if(AllowAutoScroll == undefined){
            SetAllowAutoScroll(true);
        }
        localStorage.setItem('autoscroll',AllowAutoScroll ? 'allow' : '');
    },[AllowAutoScroll])

    useEffect(()=>{
        if(AllowSamples == undefined){
            SetAllowSamples(true);
        }

        localStorage.setItem('samples',AllowSamples ? 'allow' : '');
    },[AllowSamples])


    function ShowInPreview(str : string){
        SetHidePreview(prev=> prev == str ? '' : str);
    }
    

    function SetMedia(file : File | undefined){
        Vibrate();
        SetLargeMedia(file);
        SetScreenPanelView('media');
    }

    async function RecordVoice(){
        SetScreenPanelView('audio');
    }
    
    function RecordVideo(){
        SetScreenPanelView('video');
    }

    function TakePicture(){
        SetScreenPanelView('picture');
    }
    function DroppedImage(){

    }
    async function InputDown(e : React.KeyboardEvent<HTMLDivElement>){
        if(!Socket.TextInputRef.current) return;

        const issubmit = e.key == "Enter" && !e.shiftKey;
        const mobile = isMobile();

        //check keys
        if(e.key == 'v' && e.ctrlKey){
            //paste
            const text = await GetClipBoardText();

            if(text.length > 200){
                const afile = Socket.createFileFromText(text);
                
                Socket.SetUploadedFiles(prev=>[...prev,afile]);
            }
            Socket.TextInputRef.current.textContent += text;
        }


        //check submission
        if(!issubmit || e.key == 'Enter' && mobile) {
            return;
        };

        e.preventDefault();
        Socket.SendMessage();
        
    }

    async function MouseEnterSettings(){
        SetShowSettings(true);
        SetSettingsHide(false);
    }

    function Logout(){
        context.SetToken('');
        localStorage.setItem('token','');
    }

    const MemoSettingsName = useMemo(()=>{
        const SettingsName = ["Settings"];
        if(ShowSettings) SettingsName.push('Visible');
        if(Hide) SettingsName.push('Hide');
        return SettingsName.join(' ');
    },[ShowSettings])



    const PreviewName = ["Preview"];
    if(!HidePreview) PreviewName.push('Hide');

    const ProjectFileViewName = ["ProjectFileView"]
    
    const ConnectedName = []
    if(!Socket.IsConnected) ConnectedName.push('Disconnected');


    const FileUploadName = ['FileUploads']
    if(Socket.MemoUploadFiles.length){
        FileUploadName.push('Visible');
    }

    const InputField = ['InputField'];
    if(Socket.SelectedChat == undefined || Socket.WaitingResponse){
        InputField.push("NotEditable")
    }


    /**
     * Start of memoized files
    */

    const MemoProjectFiles = useMemo(()=>{
        const files = Socket.Projects.toSorted((a,b)=>Number(a) - Number(b)).filter((v)=>v.name.includes(ProjectSearch))
        const arr = files.map((itm,i)=>{
            const click =()=>{
                ShowInPreview('project');
                Socket.ShowProject(itm);
            }
            const cn = []
            if(Socket.SelectedProject && Socket.SelectedProject.id == itm.id) cn.push('Selected');
            
            const remitem = ()=>{
                Socket.DeleteProject(i);
            }
    
            return(
                <li key={i} className={cn.join(' ')} onDoubleClick={(e)=>{e.preventDefault();e.stopPropagation();Socket.SetSelectedProjectFile(itm);click()}} onClick={()=>Socket.ShowProject(itm)}>
                    <button onClick={click}><ExternalLink size={16}/></button>
                    {itm.name}
                    <button onClick={remitem}><Trash size={16}/></button>
                </li>
            )
        })
        return arr;
    },[Socket.Projects,ProjectSearch,Socket.SelectedProjectFile,Socket.SelectedProject])
    
    const MemoChatFiles = useMemo(()=>{
        const chats = Socket.Chats.toSorted((a,b)=>Number(a) - Number(b)).filter((v)=>v.name.includes(ChatSearch)).map((itm,i)=>{
            const cn = []
            if(Socket.SelectedChat && Socket.SelectedChat.id == itm.id) cn.push('Selected');
            const remitem = ()=>{
                const msg = `Are you sure you want to delete Chat : ${itm.name}`
                Socket.DeleteChat(i);
            }
            return (
                <li key={i} className={cn.join(' ')} onClick={()=>{Socket.ShowChat(itm)}}>
                    {itm.name}
                    <button onClick={remitem}><Trash size={16}/></button>
                </li>
            )
        })
        return chats
    },[Socket.Chats,Socket.SelectedChat,ChatSearch])

    const MemoMessages = useMemo(()=>{
        const msgs = Socket.ChatMessages.map((itm,i,h)=>{
            let isbot = itm.msg.role == 'ai' ? <Bot/> : <UserRound />
            
            isbot = itm.msg.role == 'system' ? <Cog/> : isbot;
            let otherstatus = itm.msg.role;
            if(otherstatus == 'ai') otherstatus = 'user';
            if(otherstatus == 'user') otherstatus = 'ai';
            
            const msgname = ['Message'];
            

            if(i % 2 == 0) msgname.push('Bot');
            if(i % 2 != 0) msgname.push('User');

            const RemoveMessage = ()=>{
                if(!Socket.SelectedChat) return;
                Socket.SelectedChat && Socket.RemoveMessage(Socket.SelectedChat,itm)
            }

            //<p>{itm}</p>
            return (
                <div className={msgname.join(' ')} key={i}>
                    {isbot}
                    <div className='MessageBlock'>
                        {
                            itm.files.map((ktm,k,h)=>{
                                const me = ktm.file.split('.');
                                const ext = me[1];
                                const getsource = ()=>{
                                    if(!Socket.SelectedChat) return;
                                    const selchat = Socket.SelectedChat.id
                                    //if(k == h.length - 1) ScrollToBottom();
                                    return Socket.MyFetch(`/file/${selchat}/${ktm.id}`)
                                }
                                return <ChatDisplay controls key={k}  src={getsource} onClick={SetMedia}/>
                            })
                        }
                        <Markdown rehypePlugins={[rehypeRaw]}
                            components={{code : CodeBlock,p : PreserveBlock}}
                            
                        >
                            {itm.msg.text}
                        </Markdown>
                    </div>
                    <div className='Operations'>
                        <button onClick={()=>Socket.ReplayChat(itm)}><CirclePlay/></button>
                        {i == h.length - 1 && <button onClick={()=>Socket.UpdateChatMessage(itm,otherstatus)}><ArrowLeftRight/></button>}
                        <button onClick={()=>WriteClipBoardText(itm.msg.text)}><Copy /></button>
                        <button onClick={RemoveMessage}><Trash/></button>
                    </div>
                </div>
            )
        })
        return msgs
    },[Socket.ChatMessages,Socket.SelectedChat])

    const MemoSelectedProjectFile = useMemo(()=>{
        return Socket.SelectedProjectFile && <ChatDisplay  src={()=>{ return Socket.SelectedProject && Socket.SelectedProjectFile ? Socket.GetProjectFileData(Socket.SelectedProject.id,Socket.SelectedProjectFile.name) : undefined}}/>

    },[Socket.SelectedProject,Socket.SelectedProjectFile]);

    return (
        <div className="Collage" onMouseMove={(e)=>SetMousePosition({x : e.clientX,y : e.clientY - 10})}>
            <div className="Top">
            </div>

            <div className="Body">

                <div className={MemoSettingsName} onClick={()=>Vibrate()} onMouseEnter={MouseEnterSettings} onMouseLeave={()=>{SetSettingsHide(true);SetShowSettings(false)}}>
                    <label className='Title' onMouseEnter={()=>SetHoverDetail('Powered By Currupt Nation!')} onMouseLeave={()=>SetHoverDetail('')}>Systic A.I</label>

                    <div className='List'>
                        <label>Projects</label>
                        <input type='search' value={ProjectSearch} onChange={(e)=>SetProjectSearch(e.currentTarget.value)}/>
                        <ul>
                            {
                               MemoProjectFiles
                            }
                            <li onClick={()=>SetScreenPanelView('new project')}>+</li>
                        </ul>
                    </div>

                    <div className='List'>
                        <label>Chat List</label>
                        <input type='search' value={ChatSearch} onChange={(e)=>SetChatSearch(e.currentTarget.value)}/>
                        <ul>
                            {
                                MemoChatFiles
                            }
                            <li onClick={()=>SetScreenPanelView('new chat')}>+</li>
                        </ul>
                    </div>

                    <div className='Control'>
                        <button onClick={Logout} className={ConnectedName.join(' ')}><LogOut /></button>
                    </div>
                </div>

                <div className="Chat" ref={Socket.ScrollContainerRef} onWheel={Socket.HandleScroll}>
                    {
                        !Socket.SelectedChat  && (
                            <h1 className='Empty'>Select A Chat</h1>
                        )
                    }
                    {
                        MemoMessages
                    }
                    {
                        Socket.WaitingResponse && (
                            <div className="spinning-gradient-circle"></div>
                        )
                    }
                    {
                        Socket.WaitingResponse && Socket.UpdateMessage && (
                            <p>{Socket.UpdateMessage}</p>
                        )
                    }
                </div>
                <div className='UserField'>
                        <div className={FileUploadName.join(' ')}>
                            {
                                Socket.MemoUploadFiles
                            }    
                        </div>
                        <div className={InputField.join(' ')} ref={Socket.TextInputRef} onKeyDown={InputDown} onMouseEnter={()=>{!Socket.SelectedProject&&SetHoverDetail('Hover Left side to select chat')}}onMouseLeave={()=>{SetHoverDetail('')}} contentEditable={(Socket.SelectedChat != undefined) && !Socket.WaitingResponse} onDragOver={(e)=>e.preventDefault()}onPaste={Socket.OnPaste} onDrop={Socket.DropedImage}>
                        </div>
                        <div className='Helper'>
                            <select value={Socket.SelectedConfig?.name} onChange={Socket.ChangeSelectedConfig}>
                                {
                                    Socket.Configs.map((itm,i)=>{
                                        
                                        return (
                                            <option key={i} value={itm.name}>{itm.name}</option>
                                        )
                                    })
                                }
                            </select>
                            <button onClick={()=>ShowInPreview('settings')} onMouseEnter={(e)=>SetHoverDetail("Open Settings")} onMouseLeave={()=>(SetHoverDetail(''))}><Settings2/></button>
                            <input onChange={Socket.AddFiles} className='NoDisplay' ref={Socket.FileInputRef} type='file' multiple/>
                            <button onClick={()=>Socket.FileInputRef.current?.click()} onMouseOver={(e)=>SetHoverDetail("Upload a File")} onMouseLeave={()=>(SetHoverDetail(''))}><Upload/></button>
                            <button onClick={()=>RecordVoice()} onMouseOver={(e)=>SetHoverDetail("Record Voice")} onMouseLeave={()=>(SetHoverDetail(''))}><Mic/></button>
                            <button onClick={()=>TakePicture()}onMouseOver={(e)=>SetHoverDetail("Take a Picture")} onMouseLeave={()=>(SetHoverDetail(''))}><Camera/></button>
                            <button onClick={()=>RecordVideo()} onMouseOver={(e)=>SetHoverDetail("Record Video")} onMouseLeave={()=>(SetHoverDetail(''))}><Video/></button>
                            <button onClick={Socket.StopGeneration} onMouseOver={(e)=>SetHoverDetail("Cancel Message")} onMouseLeave={()=>(SetHoverDetail(''))}><SquareX/></button>
                            <button onClick={Socket.PushMessage} onMouseOver={(e)=>SetHoverDetail("Send Quiet Message")} onMouseLeave={()=>(SetHoverDetail(''))}><Ban/></button>
                            <button onClick={Socket.SendMessage} onMouseEnter={(e)=>SetHoverDetail("Send Message")} onMouseLeave={()=>(SetHoverDetail(''))}><SendHorizonal/></button>

                        </div>
                </div>

                <div className={PreviewName.join(' ')}>
                    <button onClick={()=>ShowInPreview('')}><ArrowLeftToLineIcon/></button>
                    {Socket.SelectedProject && HidePreview == 'project' &&
                        <div className='ProjectFileView'>
                            <div className='ProjectView'>
                                <div>
                                    {
                                        Socket.ProjectFiles.map((itm,i)=>{
                                            const cn = [];
                                            if(Socket.SelectedProjectFile && Socket.SelectedProjectFile.name == itm.name) cn.push("Selected");
                                            return (
                                                <button key={i} className={cn.join(' ')} onClick={()=>Socket.SetSelectedProjectFile(prev=> prev && prev.name == itm.name ? undefined : itm)}>{itm.name} <Trash size={16} onClick={(e)=>{e.preventDefault();e.stopPropagation();Socket.SafeDeleteProjectFile(itm)}}/></button>
                                            )
                                        })
                                    }
                                    <button onClick={()=>SetScreenPanelView('add project files')} disabled={!Socket.SelectedProject}><PlusCircle/></button>
                                </div>
                                <div>
                                    {
                                        MemoSelectedProjectFile
                                    }
                                </div>
                            </div>
                        </div>
                    }
                    {
                        !Socket.SelectedProject && HidePreview == 'project' && 
                        <h1 className='Empty'>Select A Project</h1>
                    }
                    {
                        HidePreview == 'settings' && (
                            <div className={'SelectedConfigView'}>
                                <div>    
                                    <label>Video Device : </label>
                                    <select value={Devices.DefaultVideoDevice} onChange={(e)=>Devices.SetDefaultVideoDevice(e.currentTarget.value)}>
                                        {
                                            Devices.Devices.filter((itm)=>itm.kind =='videoinput').map((itm,i)=>{
                                                
                                                return (
                                                    <option key={i} value={itm.deviceId}>{itm.label}</option>
                                                )
                                            })
                                        }
                                    </select>
                                </div>
                                <div>
                                    <label>Audio Device : </label>
                                    <select value={Devices.DefaultAudioDevice} onChange={(e)=>Devices.SetDefaultAudioDevice(e.currentTarget.value)}>
                                        {
                                            Devices.Devices.filter((itm)=>itm.kind =='audioinput').map((itm,i)=>{
        
                                                return (
                                                    <option key={i} value={itm.deviceId}>{itm.label}</option>
                                                )
                                            })
                                        }
                                    </select>
                                </div>
                                <div>
                                    <label>Enable Samples</label>
                                    <input type='checkbox' name='samples' checked={AllowSamples} onChange={(e)=>SetAllowSamples(prev=>!prev)} />
                                </div>
                                <div>
                                    <label>Enable Vibrate</label>
                                    <input type='checkbox' name='samples' checked={AllowVibrate} onChange={(e)=>SetAllowVibrate(prev=>!prev)} />
                                </div>
                                <div>
                                    <label>Enable AutoScroll</label>
                                    <input type='checkbox' name='samples' checked={AllowAutoScroll} onChange={(e)=>SetAllowAutoScroll(prev=>!prev)} />
                                </div>
                                
                                <hr/>
                                {
                                    Socket.SelectedConfig && Socket.SelectedConfig.options.map((itm,i)=>{
        
                                        return (
                                            <div key={i}>
                                                <label>{itm.name}</label>
                                                {itm.type == 'boolean' && <input type='checkbox' name={itm.name} checked={itm.value} onChange={Socket.SetInputValue}/>}
                                                {itm.type == 'number' && <input type='number' min={itm.min} max={itm.max} name={itm.name} value={itm.value ? itm.value : itm.default} onChange={Socket.SetInputValue}/>}
                                                {itm.type == 'select' && (
                                                    <select name={itm.name} value={itm.value ? itm.value : itm.default} onChange={Socket.SetSelectValue}>
                                                        {
                                                            itm.selection.map((jtm,j)=>(
                                                                <option value={jtm} key={j}>{jtm}</option>
                                                            ))
                                                        }
                                                    </select>
                                                )}
                                                {itm.type == 'string' && <input type='text' name={itm.name} value={itm.value ? itm.value : itm.default} onChange={Socket.SetInputValue}/>}
                                                <button onClick={()=>itm.default && Socket.UpdateOption(itm.name,itm.default)}>{`\u{21BA}`}</button>
                                            </div>
                                        )
                                    })
                                }
                            </div>
                        )
                    }
                    
                </div>
            </div>


            {ScreenPanelView == 'picture' && 
                <TakePhotoScreenPanel onData={(data)=>{SetScreenPanelView('');Socket.SetUploadedFiles(prev=>[...prev,data])}} switchMediaStream={Devices.NextVideoStream} onClose={()=>SetScreenPanelView('')} stream={()=>Devices.GetVideoStream(false)}/>
            }
            {
                ScreenPanelView == 'video' && 
                <TakeVideoScreenPanel onData={(data)=>{SetScreenPanelView('');Socket.SetUploadedFiles(prev=>[...prev,data])}} switchMediaStream={Devices.NextVideoStream} onClose={()=>SetScreenPanelView('')} stream={Devices.GetVideoStream}/>
            }
            {
                ScreenPanelView == 'audio' && 
                <TakeVideoScreenPanel audio onData={(data)=>{SetScreenPanelView('');Socket.SetUploadedFiles(prev=>[...prev,data])}} switchMediaStream={Devices.NextAudioStream} onClose={()=>SetScreenPanelView('')} stream={Devices.GetAudioStream}/>
            }
            {
                ScreenPanelView == 'media' &&
                <ShowLargeMedia src={LargeMedia} onClose={()=>{SetScreenPanelView('')}}/>
            }
            {
                ScreenPanelView == 'new chat' &&
                <ScreenPanel onClose={()=>SetScreenPanelView('')}>
                    <form onSubmit={(e)=>{SetScreenPanelView('');Socket.SubmitNewChat(e)}} onClick={(e)=>{e.stopPropagation()}}>
                        <label>New Chat</label>
                        <div>
                            <label>Name</label>
                            <input name="name" type='text'/>
                        </div>

                        <div>
                            <input type='submit'/>
                            <button onClick={(e)=>SetScreenPanelView('')}>close</button>
                        </div>
                    </form>
                </ScreenPanel>
            }
            
            {
                ScreenPanelView == 'new project' &&
                <ScreenPanel onClose={()=>{SetScreenPanelView('')}}>
                    <form onClick={(e)=>{e.stopPropagation()}} onSubmit={(e)=>{SetScreenPanelView('');Socket.SubmitNewProject(e)}}>
                            <label>New Project</label>
                            <div>
                                <label>Name</label>
                                <input name="name" type='text'/>
                            </div>

                            <div>
                                <input type='submit'/>
                                <button onClick={()=>SetScreenPanelView('')}>close</button>
                            </div>
                        </form>
                </ScreenPanel>
            }
            
            {
                ScreenPanelView == 'add project files' &&
                <ScreenPanel onClose={()=>SetScreenPanelView('')}>
                    <div className='UploadProjectFiles' onClick={(e)=>{e.stopPropagation()}}>
                            <label>Upload Project Files</label>
                            {Socket.UploadedProjectFiles.length != 0 && (
                                <div className='ProjectMedia'>
                                    {
                                        Socket.MemoProjectUploadFiles
                                    }
                                </div>
                                )
                            }
                            <button onClick={()=>Socket.ProjectUploadRef.current?.click()}><PlusCircle/></button>
                            <input onChange={Socket.ProjectFileChanged} className='HiddenUpload'type='file' multiple ref={Socket.ProjectUploadRef}/>
                            <div>
                                <button onClick={(e)=>{SetScreenPanelView('');Socket.SubmitProjectFiles()}}>Upload</button>
                                <button onClick={()=>{SetScreenPanelView('');Socket.SetUploadedProjectFiles([])}}>close</button>
                            </div>
                    </div>
                </ScreenPanel>
            }
            {
                HoverDetail && <div className='HoverDetail' style={{left : MousePosition.x,top : MousePosition.y - 10}}>{HoverDetail}</div>
            }
        </div>
    )
}



function Vibrate(){
    if(!navigator.vibrate) return;
    const vib = localStorage.getItem('vibrate');
    if(vib) return;

    navigator.vibrate(20);
}

async function WriteClipBoardText(text : string){
    await navigator.clipboard.writeText(text);
}

async function GetClipBoardText(){
    const res = navigator.clipboard.readText();

    return res;
}

type PreserveBlock = {

} & React.ClassAttributes<HTMLParagraphElement> & React.HTMLAttributes<HTMLParagraphElement>

export function PreserveBlock(props : PreserveBlock){

    return <pre>{props.children}</pre>
}

type CodeBlock = {
} & React.ClassAttributes<HTMLElement> & React.HTMLAttributes<HTMLElement>

export function CodeBlock(props : CodeBlock){
    
    return <div>
        {props.children}
    </div>
}

//for typing in words
type TextBox = {
    onSubmit : (text : string) =>any,
    
}

export function TextBox(props : TextBox){

    return (
        <div>

        </div>
    )
}

//for listing data that you can search through
type SearchList = {
    onChange ? : ()=>any,
    text ? : string,

}

export function SearchList(props : SearchList){
    
}

function isMobile() {
    const userAgent = navigator.userAgent.toLowerCase();
    return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/.test(userAgent);
}


type ScrenPanelType = {
    onClose? : ()=>any,
} & React.PropsWithChildren

export function ScreenPanel(props : ScrenPanelType){


    return (
        <div className='ScreenPanel' onClick={()=>props.onClose && props.onClose()}>
            <div className='ScreenControl'>
                <CircleX onClick={()=>props.onClose && props.onClose()}/>
            </div>
            {
                props.children
            }
        </div>
    )
}

type ShowLargeMediaProps = {
    src? : File,
    onClose? : ()=>any,
}

export function ShowLargeMedia(props : ShowLargeMediaProps){
    function click(f : File,e : React.MouseEvent<HTMLDivElement>){
        if(!isMobile()) return;
        e.preventDefault();
        e.stopPropagation()
        
    }
    function close(){
        Vibrate()
        props.onClose && props.onClose();
    }

    return (
        <ScreenPanel onClose={close}>
            <ChatDisplay file={props.src} onClick={click}/>
        </ScreenPanel>
    )
}

function dataURLtoFile(dataurl : string,name : string) {
    let arr = dataurl.split(',')
    const mimeString = dataurl.split(',')[0].split(':')[1].split(';')[0];

    const bstr = atob(arr[1])
    let n = bstr.length
    const u8arr = new Uint8Array(n);
  
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
  
    return new File([u8arr], name, { type: mimeString });
}

type TakePhotoProps = {
    stream? : ()=>Promise<MediaStream | false>,
    onClose? : ()=>any,
    onExit? : ()=>any,
    switchMediaStream? : ()=>any,
    onData? : (file : File) => any
}

export function TakePhotoScreenPanel(props : TakePhotoProps){
    const videoref = useRef<HTMLVideoElement>(null);
    const imgref = useRef<HTMLImageElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const [Photo,SetPhoto] = useState(false);

    useEffect(()=>{
        if(!props.stream) return;

        const media = props.stream();
        media.then((res)=>{
            if(!res || !videoref.current) return;

            videoref.current.srcObject = res;
            console.log(res);
        }).catch((e)=>{
            console.log(e);
        })
    },[props.stream])


    function TakePhoto(){
        if(!videoref.current || !imgref.current || !canvasRef.current) return;

        const context = canvasRef.current.getContext('2d');
        if(!context) return;


        const width = videoref.current.videoWidth
        const height = videoref.current.videoHeight;
        canvasRef.current.width = width;
        canvasRef.current.height = height;

        context.drawImage(videoref.current,0,0);

        const data = canvasRef.current.toDataURL();
        imgref.current.src = data;
        SetPhoto(true);
    }
    function MyUpload(){
        if(!imgref.current) return;
        
        const data = imgref.current.src;
        
        if(props.onData) props.onData(dataURLtoFile(data,'image'));

    }

    let name = ['TakePhoto'];

    if(Photo){
        name.push("Photo");
    }

    function StopMouse(e : React.MouseEvent){
        e.stopPropagation();
        e.preventDefault();
    }
    return (
        <ScreenPanel onClose={props.onClose}>
            <div className={name.join(' ')} onClick={StopMouse}>
                <canvas ref={canvasRef}/>
                <video ref={videoref} autoPlay>

                </video>
                <img ref={imgref}>
                </img>

                <div >
                    {
                        Photo && (
                            <>

                                <button onClick={()=>SetPhoto(false)}>Retake</button>
                                <button onClick={MyUpload}>Upload</button>
                            </>
                        )
                    }
                    {
                        !Photo && (
                            <>
                                <button onClick={TakePhoto}>Take Photo</button>
                            </>
                        )
                    }
                    <button onClick={props.switchMediaStream}>Switch Camera</button>
                </div>
            </div>
        </ScreenPanel>
    )
}

async function urlToFile(url : string, filename : string) {
    try {
        const res = await fetch(url);
        // If no mimeType is specified, try to get it from the response
        const mimeType = res.headers.get('content-type');
        
        if(!mimeType) return null;

        const blob = await res.blob();
        const file = new File([blob], filename, { type: mimeType });
        return file;
    } catch (error) {
        console.error("Error fetching or converting file:", error);
        return null;
    }
  }


type TakeVideoProps = {
    stream? : ()=>Promise<MediaStream | false>,
    onClose? : ()=>any,
    onExit? : ()=>any,
    switchMediaStream? : ()=>any,
    onData? : (file : File) => any,
    audio? : boolean,
}

export function TakeVideoScreenPanel(props : TakeVideoProps){
    const videoref = useRef<HTMLVideoElement>(null);
    const videoref2 = useRef<HTMLVideoElement>(null);;
    const dataref = useRef<Blob[]>([]);
    const recorderRef = useRef<MediaRecorder>();
    const [Recording,SetRecording] = useState(false);

    const [Photo,SetPhoto] = useState(false);

    useEffect(()=>{
        if(!props.stream) return;

        const media = props.stream();
        media.then((res)=>{
            if(!res || !videoref.current) return;

            videoref.current.srcObject = res;
            videoref.current.play();
        }).catch((e)=>{
            console.log(e);
        })
    },[props.stream])


    async function Record(){
        if(!videoref.current || !videoref2.current) return;
        
        //const stream = videoref.current.srcObject as MediaStream;
        const stream = props.stream && await props.stream();
        if(!stream) return;

        let recorder = new MediaRecorder(stream);
        recorderRef.current = recorder;
        const data : Blob[] = []
        dataref.current = data;
        console.log(stream);
        recorder.ondataavailable = (event)=>{console.log("run");data.push(event.data);};
        
        recorder.start(100);

        SetRecording(true);

    }

    function Stop(){
        console.log(dataref.current);
        if(!videoref.current || !videoref2.current) return console.log("fff");
        if(!dataref.current) return SetRecording(false);
        if(!recorderRef.current) return console.log('asdf');
    
        recorderRef.current.stop();
        const type = props.audio ? 'audio/webm' : 'video/webm';

        let chunks = new Blob(dataref.current,{type : type});

        videoref2.current.src = URL.createObjectURL(chunks);

        SetRecording(false);
        SetPhoto(true);
    }
    function closeexit(){
        if(recorderRef.current){
            recorderRef.current.stop();
        }
        props.onClose && props.onClose();
    }

    async function MyUpload(){
        if(!videoref2.current) return;
        
        const data = videoref2.current.src;
        const name = props.audio ? 'audio' : 'video'
        const vid =await urlToFile(data,name);
        
        if(!vid) return console.log("couldn't convert video");

        if(props.onData) props.onData(vid);

    }

    let name = ['TakeVideo'];

    if(Photo){
        name.push("Photo");
    }

    function StopMouse(e : React.MouseEvent){
        e.stopPropagation();
        e.preventDefault();
    }
    return (
        <ScreenPanel onClose={closeexit}>
            <div className={name.join(' ')} onClick={StopMouse}>
                {
                    props.audio ? <audio ref={videoref} autoPlay/> : <video ref={videoref} autoPlay/>
                }
                {
                    props.audio ? <audio className='Video2' ref={videoref2} controls/> : <video className='Video2' ref={videoref2} controls/>
                }
                
                <div >
                    {
                        Photo && (
                            <>

                                <button onClick={()=>SetPhoto(false)}>Retake</button>
                                <button onClick={MyUpload}>Upload</button>
                            </>
                        )
                    }
                    {
                        !Photo && (
                            <>
                                <label>{`Recording : ${Recording}`}</label>
                                {
                                    Recording ? <button onClick={Stop}>Stop</button> : <button onClick={Record}>Record</button>
                                }
                            </>
                        )
                    }
                    <button onClick={props.switchMediaStream}>Switch {props.audio ? 'Microphone' : "Camera"}</button>
                </div>
            </div>
        </ScreenPanel>
    )
}





const mime_types :{[name : string] : any} = {
    '.txt': 'text/plain',
    '.html': 'text/html',
    '.htm': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.xml': 'application/xml',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.zip': 'application/zip',
    '.rar': 'application/x-rar-compressed',
    '.tar.gz': 'application/gzip',
    '.7z': 'application/x-7z-compressed',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.avi': 'video/x-msvideo',
    '.mov': 'video/quicktime'
}
type ChatDisplay = {
    src? : ()=>Promise<Response> | undefined
    onClose? : Function,
    file? : File,
    onClick? : (file : File,e : React.MouseEvent<HTMLDivElement>)=>any,
    controls? : boolean
}
  
function ChatDisplay(props : ChatDisplay){
    const [VideoHover,SetVideoHovering] = useState(false);
    const [prefix,setprefix] = useState('');
    const vidref = useRef<HTMLVideoElement>(null);
    const [source,setsource] = useState<File>();

    useEffect(()=>{
        if(!props.file) return;
        const file = props.file
        const sp = file.type.split('/')

        setprefix(sp[0])
        setsource(file);
    },[props.file])

    useEffect(()=>{
        if(!props.src) return;

        const src = props.src()
        if(!src) return;

        src.then(async (res)=>{
            if(res.status != 200) return;
            const blob = await res.blob();
            const file = new File([blob], "file", { type: blob.type });
            const sp = file.type.split('/')

            setprefix(sp[0])
            setsource(file);
        })
    },[props.src])
    

    function MakeBig(){

    }

    function Click(e : React.MouseEvent<HTMLDivElement>){
        if(props.onClick && source) props.onClick(source,e);
    }

    return (
        <div className='Selectable' onMouseDown={MakeBig} onClick={Click}>
            {prefix == 'image' && <img className='' src={source && URL.createObjectURL(source)}></img>} 
            {prefix == 'video' &&
                <video ref={vidref} className='' controls={true}>
                    <source src={source && URL.createObjectURL(source)} type={source && source.type}></source>
                </video>
            }
            {(prefix != 'image' && prefix != 'video') && <object className='' data={source && URL.createObjectURL(source)} type={source && source.type}/>}
        </div>
    )
}


type UploadDisplayProps = {
    src : File
    onClose? : Function
  }
  

export function UploadDisplay(props : UploadDisplayProps){
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