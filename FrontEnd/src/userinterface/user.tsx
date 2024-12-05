import React, { ChangeEvent, DragEventHandler, useContext, useEffect, useMemo, useRef, useState } from 'react'
import './user.css'
import { AuthContext, prefix } from '../protected/authenticate';
import ReactMarkdown from 'react-markdown'

export type Chat = {
    date :  string, // number date.now()
    directory : string, //number
    id : number, //integer
    owner : string, //gmail
    name : string
}
export type ChatMessage = {
    files : Array<{
        chat : number,
        file : string,
        id : number
    }>,
    msg : {
        chat : number,
        date : number,//from date.now()
        id : number,
        owner : string,
        role : 'user' | 'ai' | 'system',
        text : string
    }
}
export type Project = {
    id : number,
    name : string,
    owner : string,
    directory : string
}
export type MyFile = {
    name : string
}
export type NumberConfig = {
    type : "number",
    min? : number,
    max? : number,
    default? : number,
    name : string,
}
export type SelectConfig = {
    type : "select",
    default? : number | string,
    selection : Array<number> | Array<string>,
    name : string,
}
export type BooleanConfig = {
    type : "boolean",
    default? : boolean,
    name : string
}
export type StringConfig = {
    type : "string",
    default? : string,
    name : string
}
export type OptionConfiguration = NumberConfig | SelectConfig | BooleanConfig | StringConfig

export type Config = {
    name : string,
    source : string,
    options : Array<OptionConfiguration & {value : any}>,
    env : string,
}
export type ZippedConfig = {
    name : string,
    source : string,
    options : {[name : string] : any}
}
function zipoptions(config : Config) : ZippedConfig{
    const zip : {[name : string] : any} = {}

    const opts = config.options;
    
    for(const obj of opts){
        const akey = obj.name;
        const aval = obj.value != undefined ? obj.value : obj.default;
        
        zip[akey] = aval;

    }

    return {
        name : config.name,
        source : config.source,
        options : zip
    }
    
}

export function UserInterface(){
    const [ShowChats,SetShowChats] = useState(true);
    const [ShowSettings,SetShowSettings] = useState(true);
    const [ShowChat,SetShowChat] = useState(true);
    const context = useContext(AuthContext);
    const FileInputRef = useRef<HTMLInputElement>(null);
    const [UploadedFiles,SetUploadedFiles] = useState<File[]>([])
    const SocketRef = useRef<ReturnType<typeof MakeSocket>>();

    const [ShowNewChat,SetShowNewChat] = useState(false);
    const [ShowNewProject,SetShowNewProject] = useState(false);
    const [ShowProjectFileUpload,SetShowProjectFileUpload] = useState(false);
    const [UploadedProjectFiles,SetUploadedProjectFiles] = useState<File[]>([]);
    const ProjectUploadRef = useRef<HTMLInputElement>(null);
    const TextInputRef = useRef<HTMLDivElement>(null);

    const [SelectedChat,SetSelectedChat] = useState<Chat | undefined>();
    const [SelectedProject,SetSelectedProject] = useState<Project | undefined>();

    const [Chats,SetChats] = useState<Chat[]>([]);
    const [Projects,SetProjects] = useState<Project[]>([]);
    const [ProjectFiles,SetProjectFiles] = useState<MyFile[]>([]);
    const [WaitingResponse,SetWaitingResponse] = useState(false);
    
    const [Config,SetConfig] = useState<Config[]>([])
    const [SelectedConfig,SetSelectedConfig] = useState<Config>();
    const [ChatMessages,SetChatMessages] = useState<ChatMessage[]>([]);

    const ScrollContainerRef = useRef<HTMLDivElement>(null);
    const [ScrollAtBottom,SetScrollAtBottom] = useState(true);

    const [UpdateMessage,SetUpdateMessage] = useState('');
    const [LargeMedia,SetLargeMedia] = useState<File>();
    const SelectedChatRef = useRef(SelectedChat)
    const ScrollHeightRef = useRef(0)
    

    useEffect(()=>{
        
        const asocket = MakeSocket(SocketMessage);
        SocketRef.current = asocket;
        asocket

        asocket.init(context.Token);
        GetConfig();

        return ()=>{
            asocket.destroy();
        }

    },[context.Token])
    useEffect(()=>{
        SetUpdateMessage("")
    },[WaitingResponse])

    useEffect(()=>{
        //try to load config defaults

    },[SelectedConfig])
    useEffect(()=>{

    },[SelectedConfig])
    function TryLoadConfig(){
        if(!SelectedConfig) return;
        const loded = localStorage.getItem(SelectedConfig.name)
        
        return ()=>{
            //localStorage.setItem(SelectedConfig)
        }
    }
    useEffect(()=>{
        if(SelectedChat == undefined){
            SetChatMessages([]);
            SetScrollAtBottom(true);
            return;
        }
        SelectedChatRef.current = SelectedChat;

        GetMessages(0);
    },[SelectedChat])

    useEffect(()=>{
        if(!context.Token) return;
        GetChats();
        GetProjects();
    },[context.Token])
    
    useEffect(()=>{
        const cont = ScrollContainerRef.current;
        if(!cont) return;

        const height = ScrollHeightRef.current;

        cont.scrollTop = height;
        
        ScrollToBottom();
    },[ChatMessages])

    async function SocketMessage(e : MessageEvent){
        if(!SocketRef.current) return;
        try{
            const json = JSON.parse(e.data);
            //incase you want to stop it... you can do so with the token
            if(json.msg == 'start'){
                SocketRef.current.LockToken = json.token;
            }else if(json.msg == 'end'){
                //this message has ended
                SetWaitingResponse(false);
            }else if(json.msg == "Get From"){
                GetMessages(json.date)
            }else if(json.msg == "Update"){
                SetUpdateMessage(json.data);
            }
        }catch(e){
            console.log("error parsing json",e);
        }
    }
    async function GetProjectFiles(){
        if(!SelectedProject) return;

        const files = await MyFetch(`/project/files/${SelectedProject.id}`,{
            method : 'GET'
        })

        if(files.status != 200) return;

        const json = await files.json();
        SetProjectFiles(json);
    }

    useEffect(()=>{
        if(!SelectedProject) return SetProjectFiles([]);
        GetProjectFiles();
    },[SelectedProject])

    function ScrollToBottom(){
        if(!ScrollContainerRef.current || !ScrollAtBottom) return;

        //only scroll to bottom if the scroll was already at the bottom
        //ScrollContainerRef.current.scrollTop = ScrollContainerRef.current.scrollHeight;
        ScrollContainerRef.current.lastElementChild?.scrollIntoView({behavior : 'smooth',block : 'end'})
    }

    async function GetConfig(){
        const res = await MyFetch('/config')
        if(res.status != 200) return;

        const config : Config[] = await res.json();
        
        const conf = localStorage.getItem('config');

        if(!conf){
            const zipped = config.map((itm)=>zipoptions(itm));

            localStorage.setItem('config',JSON.stringify(zipped));
        }else{
            config.forEach((itm)=>{
                itm.options.forEach((j)=>{
                    //oppossing = conf.
                })
                const f = itm.options.find((j)=>j.name == itm.name);
                if(!f) return;
                const aval = f.value != undefined ? f.value : f.default;
                
            })
        }
        
        SetSelectedConfig(prev=>!prev ? config[0]:prev)
        SetConfig(config);

    }

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
    
    const MemoProjectUploadFiles = useMemo(()=>UploadedProjectFiles.map((itm,i)=>(
        <UploadDisplay key={i} src={itm} onClose={()=>SetUploadedProjectFiles(prev=>prev.filter((j,k)=>k!=i))}/>
    )),[UploadedProjectFiles])

    function MyFetch(dest : string,opts? : RequestInit){
        return fetch(prefix + dest,{
            ...opts,
            headers : {
                ...opts?.headers,
                'Authorization' : `Bearer ${context.Token}`
            },
            

        })
    }
    async function GetChats(){
        const raw = await MyFetch('/chats',{
            method : "GET"
        })
        if(raw.status != 200) return console.log(raw.status,raw.statusText);
        const json = await raw.json();

        SetChats(json);
    }

    async function SubmitNewChat(e : React.FormEvent<HTMLFormElement>){
        e.preventDefault();
        const fm = new FormData(e.currentTarget);
        const adate = Date.now();

        await MyFetch('/chats/create',{
            method : 'POST',
            body : JSON.stringify({date : adate,name : fm.get('name')}),
            headers : {
                'Content-Type' : 'application/json'
            }

        })

        SetShowNewChat(false);

        GetChats();
    }
    async function GetProjects(){
        const raw = await MyFetch('/project',{
            method : "GET"
        })
        if(raw.status != 200) return console.log(raw.status,raw.statusText);
        const json = await raw.json();

        SetProjects(json);
    }

    async function SubmitNewProject(e : React.FormEvent<HTMLFormElement>){
        e.preventDefault();
        const fm = new FormData(e.currentTarget);
        const body : {[name : string] : any} = {

        }

        fm.forEach((v,k)=>{
            body[k] = v;
        })
        
        await MyFetch('/project/create',{
            method : 'POST',
            body : JSON.stringify(body),
            headers : {
                'Content-Type' : 'application/json'
            }
        })
        GetProjects();
        GetProjectFiles(); 
        SetShowNewProject(false);
    }
    function SubmitProjectFiles(){
        if(!SelectedProject) return;
        
        const fd = new FormData();
        
        //fd.append('project',SelectedProject.id.toString())
        
        UploadedProjectFiles.forEach((itm,i)=>{
            fd.append(`file-${i}`,UploadedProjectFiles[i]);
        })

        MyFetch(`/project/upload/${SelectedProject.id}`,{
            body : fd,

            method : 'POST'
        })

        SetUploadedProjectFiles([])
        GetProjectFiles();
        SetShowProjectFileUpload(false);
    }
    function ProjectFileChanged(e : React.ChangeEvent<HTMLInputElement>){
        if(!e.target.files) return;
        const vals = Array.from(e.target.files);
    
        SetUploadedProjectFiles(prev=>[...prev,...vals]);
    }
    async function StopGeneration(){
        if(!SocketRef.current) return;
        console.log("ending");
        const sockmsg = {
            msg : "end",
            token : SocketRef.current.LockToken
        }

        SocketRef.current.send(JSON.stringify(sockmsg));
    }
    async function SendMessage(){
        if(!TextInputRef.current || SelectedChat == undefined) return;

        const msg = TextInputRef.current.textContent;
        TextInputRef.current.textContent = "";
        //send message to the backend
        const fd = new FormData();
        const counter = UploadedFiles.length;
        
        UploadedFiles.forEach((itm,i)=>{
            fd.append(`file-${i}`,itm);
        })
        
        SetUploadedFiles([]);

        const date = Date.now();
        const chatid = SelectedChat.id;

        //send message get message id back
        const res = await MyFetch('/message',{
            method : 'POST',
            body : JSON.stringify({
                chat : chatid,
                date : date,
                role : 'user',
                text : msg

            }),
            headers : {
                'Content-Type' : 'application/json'
            }
        })

        if(res.status != 200) return;

        const json = await res.json();
        //update the message with files
        if(counter > 0){
            const imgs = await MyFetch(`/message/${json.id}`,{
                body : fd,
                method : 'POST'
            })
            if(imgs.status != 200) return;
        }
        //successfully upload, get latest message for this chat
        //after gotten latest messages, send websocket a token to 
        //begin getting a message response
        //lock this chat while we wait for a message response
        if(!SocketRef.current) return console.log("no socket");
        //need to include the config options
 
        
        await GetMessages(date);
        
        SetWaitingResponse(true);
        //send the backend to make a decision
        const sockmsg = {
            msg : "start",
            config : SelectedConfig,
            chatid : SelectedChat.id,
            project : SelectedProject ? SelectedProject : undefined
        }

        SocketRef.current.send(JSON.stringify(sockmsg));
    }

    async function InputDown(e : React.KeyboardEvent<HTMLDivElement>){
        const issubmit = e.key == "Enter" && !e.shiftKey;
        if(!issubmit) {
            return;
        };
        e.preventDefault();
        SendMessage();
    }


    //get the chat messages after time period date.
    async function GetMessages(date? : number){
        //console.log(SelectedChat)
        const selchat = SelectedChatRef.current;
        const elem = ScrollContainerRef.current;

        if(!selchat || !elem) return;

        ScrollHeightRef.current = elem.scrollTop;

        const res = await MyFetch(`/message/get`,{
            method : 'POST',
            body : JSON.stringify({id : selchat.id,date : date}),
            headers : {
                'Content-Type' : 'application/json'
            },
        })

        if(res.status != 200) return console.log("bad message");
        const json = await res.json();

        if(date != undefined){
            //remove messages if any post date
            SetChatMessages(prev=>{
                const arr = prev.filter((itm)=>itm.msg.date < date);
                
                return [...arr,...json]
            });
        }else{
            SetChatMessages(json);
        }
        
    }
    function AutoScroll(){
        console.log("hi")
    }
    function HandleScroll(e : React.WheelEvent<HTMLDivElement>){
        if(!ScrollContainerRef.current) return;
        const elem = ScrollContainerRef.current;
        //const diff = ScrollContainerRef.current.scrollTop + ScrollContainerRef.current.innerh >= ScrollContainerRef.current.scrollHeight;
        const diff = Math.abs(elem.scrollHeight - elem.scrollTop - elem.clientHeight) < 1

        if(e.deltaY < 0){
            SetScrollAtBottom(false);
        }else if(e.deltaY > 0){
            SetScrollAtBottom(true);
        }
    }


    function Logout(){
        context.SetToken('');
        localStorage.setItem('token','');
    }

    async function DeleteProjectFiles(idx : number){
        if(!SelectedProject) return;
        const pf = ProjectFiles[idx]

        await MyFetch('/project/file/delete',{
            method : 'POST',
            headers : {
                'Content-Type' : 'application/json'
            },
            body : JSON.stringify({id : SelectedProject.id,name : pf.name})
        })
        
        GetProjectFiles();
    }
    async function DeleteChat(idx : number){
        const yes = confirm(`Are you sure you you want to chat ${Chats[idx].name}`)
        if(!yes) return;

        const achat = Chats[idx];
        //delete the chat
        const res = await MyFetch('/chats/delete',{
            method : 'POST',
            body : JSON.stringify({id : achat.id}),
            headers : {
                'Content-Type' : 'application/json'
            },
        })
        if(res.status == 200 && SelectedChat?.id == achat.id){
            SetSelectedChat(undefined);
        }
        GetChats();
    }

    async function RemoveMessage(achat : Chat,msg : ChatMessage){
        const res = await MyFetch('/message/delete',{
            method : 'POST',
            headers : {
                'Content-Type' : 'application/json'
            },
            body : JSON.stringify({
                id : msg.msg.id,

            })
        })
        if(res.status != 200) return;
        
        GetMessages(msg.msg.date);
    }
    
    async function DeleteProject(idx : number){
        const yes = confirm(`Are you sure you you want to delete ${Projects[idx].name}`)
        if(!yes) return;
        //delete the project
        const project = Projects[idx]
        const res = await MyFetch('/project/delete',{
            method : 'POST',
            body : JSON.stringify({id : project.id}),
            headers : {
                'Content-Type' : 'application/json'
            },
        })
        if(res.status == 200 && project.id == SelectedProject?.id){
            SetSelectedProject(undefined);
        }
        GetProjects();

    }

    function ChangeSelectedConfig(e : ChangeEvent<HTMLSelectElement>){
        const val = e.currentTarget.value;
        const itm = Config.find((j)=>j.name == val);
        if(!itm) return;
        SetSelectedConfig(itm);
    }

    function UpdateOption(aname : string,aval : any){
        SetSelectedConfig(prev=>{
          if(prev == undefined) return prev;
          const conf : Config = JSON.parse(JSON.stringify(prev));
          const newopts = conf.options.map((itm)=>{
            if(itm.name != aname) return itm;
            return {
                ...itm,
                value : aval
            }
          })
    
          conf.options = newopts;
    
          return conf;
        })
      }

    function SetInputValue(e : React.ChangeEvent<HTMLInputElement>){
        const atype = e.currentTarget.type;
        const aname = e.currentTarget.name;
        
        if(atype == 'checkbox'){
          UpdateOption(aname,e.currentTarget.checked)
        }else if(atype == 'number'){
          UpdateOption(aname,e.currentTarget.valueAsNumber)
        } else if(atype == 'text'){
          UpdateOption(aname,e.currentTarget.value)
        }
      }
    
    function SetSelectValue(e : React.ChangeEvent<HTMLSelectElement>){
        const newval = e.currentTarget.value;
        const aname = e.currentTarget.name;

        UpdateOption(aname,newval);
    }
    function DropedImage(e : React.DragEvent<HTMLDivElement>){
        e.preventDefault();
        const files  = e.dataTransfer.files;
        SetUploadedFiles(prev=>[...prev,...files]);
    }


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
                
                <button onClick={()=>SetShowNewChat(true)}>New Chat</button>
                <label>Projects</label>
                <div className='List'>
                    {
                        Projects.map((itm,i)=>(
                            <button key={i} className={`${SelectedProject?.id == itm.id && 'Selected'}`} onClick={()=>SetSelectedProject(prev=>!prev || prev.id != itm.id ? itm : undefined)}>{itm.name}<span onClick={(e)=>{e.preventDefault();e.stopPropagation();DeleteProject(i)}}>{`\u{1F5D1}`}</span></button>
                        ))
                    }
                    <button onClick={()=>SetShowNewProject(true)}>+</button>
                </div>
                <label>History</label>
                <div className='List NoAdd'>
                    {
                        Chats.map((itm,i)=>(
                            <button className={`${SelectedChat&&SelectedChat.id == itm.id && 'Selected'}`} key={i} onClick={()=>SetSelectedChat(prev=>!prev||prev.id !=itm.id ? itm : undefined)}>{itm.name}<span onClick={(e)=>{e.preventDefault();e.stopPropagation();DeleteChat(i)}}>{`\u{1F5D1}`}</span></button>
                        ))
                    }
                </div>
                <button onClick={Logout}>Logout</button>
            </div>

            <div className='Chat'>
                <div className='Chat-Header'>
                    <button className='TerminalButton' onClick={()=>SetShowChat(prev=>!prev)}>{ShowChat ? 'Terminal' : 'Chat'}</button>
                    <select onChange={ChangeSelectedConfig}>
                        {
                            Config.map((itm,i)=>(
                                <option key={i} value={itm.name}>{itm.name}</option>
                            ))
                        }
                    </select>
                </div>
                <div className='ChatList' onResize={AutoScroll} ref={ScrollContainerRef} onWheel={HandleScroll}>
                        {
                            ChatMessages.map((itm,i)=>{
                                //delete message on hover
                                //change message role? todo
                                const dt = new Date(itm.msg.date);
                                return (
                                    <div key={i} className={`ChatMessage ${itm.msg.role}`}>
                                        <ReactMarkdown className={itm.msg.role}>{itm.msg.text}</ReactMarkdown>
                                        
                                        <div className='ChatMedia'>
                                            {
                                                itm.files.map((ktm,k,h)=>{
                                                    const me = ktm.file.split('.');
                                                    const ext = me[1];
                                                    const getsource = ()=>{
                                                        if(!SelectedChat) return;
                                                        const selchat = SelectedChat.id
                                                        //if(k == h.length - 1) ScrollToBottom();
                                                        return MyFetch(`/file/${selchat}/${ktm.id}`)
                                                    }
                                                    return <ChatDisplay key={k} src={getsource} onClick={SetLargeMedia}/>
                                                })
                                            }
                                        </div>
                                        <div className='ChatButtons'>
                                            <label>{dt.toLocaleString()}</label>
                                            <span className={`Span-${itm.msg.role}`}>{`(${itm.msg.role})`}</span>
                                            <button onClick={()=>SelectedChat && RemoveMessage(SelectedChat,itm)}>{`\u{1F5D1}`}</button>

                                        </div>
                                    </div>
                                )
                            })
                        }
                        {
                            WaitingResponse && !UpdateMessage && (
                                <p>Waiting...</p>
                            )
                        }
                        {
                            WaitingResponse && UpdateMessage && (
                                <p>{UpdateMessage}</p>
                            )
                        }
                        <div></div>
                </div>
                {UploadedFiles.length != 0 && (
                    <div className='MediaContent'>
                        {
                            MemoUploadFiles
                        }
                    </div>
                    )
                }
                
                <div className={`Input ${((SelectedChat == undefined) || WaitingResponse) && 'NotEditable'}`}>
                    <div className={`InputField`} onDragOver={(e)=>e.preventDefault()}onDrop={DropedImage} contentEditable={(SelectedChat != undefined) && !WaitingResponse} onKeyDown={InputDown} ref={TextInputRef}></div>

                    <div className='ButtonContainer'>
                        <input onChange={AddFiles} type='file' multiple ref={FileInputRef} className='Hide'/>
                        <button onClick={()=>FileInputRef.current?.click()}>{`\u{2912}`}</button>
                        <button onClick={()=>StopGeneration()}>{`\u{229d}`}</button>
                        <button onClick={()=>SendMessage()}>{`\u{2b95}`}</button>
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
                    {
                        SelectedConfig && SelectedConfig.options.map((itm,i)=>{

                            return (
                                <div key={i}>
                                    <label>{itm.name}</label>
                                    {itm.type == 'boolean' && <input type='checkbox' name={itm.name} value={itm.value ? itm.value : itm.default} onChange={SetInputValue}/>}
                                    {itm.type == 'number' && <input type='number' min={itm.min} max={itm.max} name={itm.name} value={itm.value ? itm.value : itm.default} onChange={SetInputValue}/>}
                                    {itm.type == 'select' && (
                                        <select name={itm.name} value={itm.value ? itm.value : itm.default} onChange={SetSelectValue}>
                                            {
                                                itm.selection.map((jtm,j)=>(
                                                    <option value={jtm} key={j}>{jtm}</option>
                                                ))
                                            }
                                        </select>
                                    )}
                                    {itm.type == 'string' && <input type='text' name={itm.name} value={itm.value ? itm.value : itm.default} onChange={SetInputValue}/>}
                                </div>
                            )
                        })
                    }
                </div>

                <label>Project Files</label>
                
                <div className='List'>
                    {
                        ProjectFiles.map((itm,i)=>{

                            return <button key={i}>{itm.name}<span onClick={()=>DeleteProjectFiles(i)}>{`\u{1F5D1}`}</span></button>
                        })
                    }
                    <button onClick={()=>SetShowProjectFileUpload(true)} disabled={!SelectedProject}>+</button>
                </div>
            </div>

            {
                ShowNewChat && (
                    <div className='NewChat'>
                        <form onSubmit={SubmitNewChat}>
                            <label>New Chat</label>
                            <div>
                                <label>Name</label>
                                <input name="name" type='text'/>
                            </div>

                            <div>
                                <input type='submit'/>
                                <button onClick={()=>SetShowNewChat(false)}>close</button>
                            </div>
                        </form>
                    </div>
                )
            }
            {
                ShowNewProject && (
                    <div className='NewChat'>
                        <form onSubmit={SubmitNewProject}>
                            <label>New Project</label>
                            <div>
                                <label>Name</label>
                                <input name="name" type='text'/>
                            </div>

                            <div>
                                <input type='submit'/>
                                <button onClick={()=>SetShowNewProject(false)}>close</button>
                            </div>
                        </form>
                    </div>
                )
            }
            {
                ShowProjectFileUpload &&(
                    <div className='UploadProjectFiles'>
                            <label>Upload Project Files</label>
                            {UploadedProjectFiles.length != 0 && (
                                <div className='ProjectMedia'>
                                    {
                                        MemoProjectUploadFiles
                                    }
                                </div>
                                )
                            }
                            <button onClick={()=>ProjectUploadRef.current?.click()}>+</button>
                            <input onChange={ProjectFileChanged} className='HiddenUpload'type='file' multiple ref={ProjectUploadRef}/>
                            <div>
                                <button onClick={SubmitProjectFiles}>Upload</button>
                                <button onClick={()=>{SetShowProjectFileUpload(false);SetUploadedProjectFiles([])}}>close</button>
                            </div>
                    </div>
                ) 
            }
            {
                LargeMedia && (
                    <div className='Dark' onClick={(e)=>{e.preventDefault();e.stopPropagation();SetLargeMedia(undefined)}}>
                        <ChatDisplay file={LargeMedia}/>
                    </div>

                )
            }

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

//websocket for backend connection
function MakeSocket(callback : (data : MessageEvent)=>any){
    let Socket : null | WebSocket = null;
    let Token = '';
    let ready = false;
    let LockToken = '';

    function init(token : string){
        Token = token;
        Socket = new WebSocket(import.meta.env.VITE_SOCKET || `ws://${window.location.host}`)
        Socket.onopen = ()=>{
            Socket && Socket.send(Token);
            ready = true;
        }
        Socket.onclose = ()=>{
            ready = false;
            Socket = null;
        }
        Socket.onmessage = callback;
    }

    function send(msg : string){
        if(!Socket || !ready) return;
        Socket.send(msg);
    }
    
    function destroy(){
        if(!Socket) return;
        Socket.close();
    }

    return {
        init,
        destroy,
        send,
        LockToken
    }
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
    onClick? : Function
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

    function Click(){
        if(props.onClick && source) props.onClick(source);
    }

    return (
        <div className='Selectable' onMouseDown={MakeBig} onClick={Click}>
            {prefix == 'image' && <img className='' src={source && URL.createObjectURL(source)}></img>} 
            {prefix == 'video' &&
                <video ref={vidref} className=''>
                <source src={source && URL.createObjectURL(source)} type={source && source.type}></source>
                </video>
            }
            {(prefix != 'image' && prefix != 'video') && <object className='' data={source && URL.createObjectURL(source)} type={source && source.type}/>}
        </div>
    )
}