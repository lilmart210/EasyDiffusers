import { useContext, useEffect, useMemo, useRef, useState } from "react"
import { AuthContext, prefix, socket_location } from "../protected/authenticate";
import { UploadDisplay } from "./Collage";

export type Chat = {
    date :  string, // number date.now()
    directory : string, //number
    id : number, //integer
    owner : string, //gmail
    name : string
}
export type MyFile = {
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
export type Project = {
    id : number,
    name : string,
    owner : string,
    directory : string
}


export function PromiseUnwrapped(){
    let res;
    let rej;

    let prm = new Promise((resolve,reject)=>{
        res = resolve;
        rej = reject;
    })
    
    return [prm,res,rej];
}

export function useSocketComponent(){
    const [IsConnected,SetIsConnected] = useState(false);
    const [Configs,SetConfigs] = useState<Config[]>([]);
    const [SelectedConfig,SetSelectedConfig] = useState<Config>();
    const [Projects,SetProjects] = useState<Project[]>([]);
    const [SelectedProject,SetSelectedProject] = useState<Project | undefined>();
    const [UploadedProjectFiles,SetUploadedProjectFiles] = useState<File[]>([]);
    const [ProjectFiles,SetProjectFiles] = useState<MyFile[]>([]);
    const [Chats,SetChats] = useState<Chat[]>([]);
    const [SelectedChat,SetSelectedChat] = useState<Chat | undefined>();
    const [ChatMessages,SetChatMessages] = useState<ChatMessage[]>([]);
    const [ScrollAtBottom,SetScrollAtBottom] = useState(true);
    const [UploadedFiles,SetUploadedFiles] = useState<File[]>([])
    const [SelectedProjectFile,SetSelectedProjectFile] = useState<MyFile>();
    const [WaitingResponse,SetWaitingResponse] = useState(false);
    const [UpdateMessage,SetUpdateMessage] = useState('');

    const context = useContext(AuthContext);

    const SocketRef = useRef<WebSocket>();
    const HeartbeatRef = useRef<any>();
    const ErrorTimeRef = useRef<any>();
    const SelectedChatRef = useRef(SelectedChat)
    const ScrollContainerRef = useRef<HTMLDivElement>(null);
    const ScrollHeightRef = useRef(0)
    const FileInputRef = useRef<HTMLInputElement>(null);
    const ProjectUploadRef = useRef<HTMLInputElement>(null);
    const LockTokenRef = useRef<string>('');
    const TextInputRef = useRef<HTMLDivElement>(null);

    useEffect(()=>{
        if(!context.Token) return;

        const sock = Init();

        //get the config;
        GetConfig();
        GetProjects();
        GetChats();

        return ()=>{
            if(sock) sock.close();
            SocketRef.current = undefined;
            Disconnect();
        }

    },[context.Token]);

    useEffect(()=>{
        //try to load config defaults
        if(!SelectedConfig) return;
        const configs = Configs.map((itm)=>{
            if(itm.name == SelectedConfig?.name) return SelectedConfig;
            return itm;
        })

        localStorage.setItem("configuration",JSON.stringify(configs)); // sets the changed configuation values
        SetConfigs(configs);
        localStorage.setItem("config",SelectedConfig.name); // sets the selected config name
        //save changes to selected config and then 

    },[SelectedConfig])

    useEffect(()=>{
        if(!SelectedChat) {
            SetChatMessages([]);
            SetScrollAtBottom(true);
            return;
        }
        SelectedChatRef.current = SelectedChat;

        GetMessages(0);
    },[SelectedChat])

    useEffect(()=>{
        if(!SelectedProject) {
            SetSelectedProjectFile(undefined);
            return SetProjectFiles([]);
        }
        SetSelectedProjectFile(undefined);
        GetProjectFiles();
    },[SelectedProject])

    useEffect(()=>{
        const cont = ScrollContainerRef.current;
        if(!cont) return;

        const height = ScrollHeightRef.current;

        cont.scrollTop = height;
        
        ScrollToBottom();
    },[ChatMessages])

    useEffect(()=>{
        SetUpdateMessage("")
    },[WaitingResponse])


    const MemoUploadFiles = useMemo(()=>UploadedFiles.map((itm,i)=>(
        <UploadDisplay key={i} src={itm} onClose={()=>SetUploadedFiles(prev=>prev.filter((j,k)=>k!=i))}/>
    )),[UploadedFiles])
    
    const MemoProjectUploadFiles = useMemo(()=>UploadedProjectFiles.map((itm,i)=>(
        <UploadDisplay key={i} src={itm} onClose={()=>SetUploadedProjectFiles(prev=>prev.filter((j,k)=>k!=i))}/>
    )),[UploadedProjectFiles])


    function Init(){
        if(SocketRef.current) return console.log("socket already exists");


        
        try{
            const socket = new WebSocket(socket_location);
            SocketRef.current = socket;
            
            socket.onopen = ()=>{
                socket && socket.send(context.Token);
                SocketRef.current = socket;
                SetIsConnected(true);
            }
            socket.onclose = ()=>{
                SocketRef.current = undefined;
                SetIsConnected(false);
                ErrorTimeRef.current = setTimeout(() => {
                    Init();
                }, 2000);
            }
            socket.onerror = (e)=>{
                SocketRef.current = undefined;
                SetIsConnected(false);
            }
            socket.onmessage = Callback;

            return socket;
        }catch(e){
            console.log("error when trying to connect",e);

        }
    }

    function Callback(raw : MessageEvent){

        if(!SocketRef.current || SocketRef.current.readyState != SocketRef.current.OPEN) return;

        try{
            const json = JSON.parse(raw.data);
            if(json.msg == 'heartbeat'){
                SocketRef.current.send(JSON.stringify({
                    msg : "heartbeat"
                }))
                SetIsConnected(true);
                if(HeartbeatRef.current != undefined) clearTimeout(HeartbeatRef.current)
                
                const id = setTimeout(() => {
                    FailedHeartbeat();
                }, 2500);

                HeartbeatRef.current = id;
            }

            if(json.msg == 'start'){
                LockTokenRef.current = json.token;
            }else if(json.msg == 'end'){
                //this message has ended
                SetWaitingResponse(false);
            }else if(json.msg == "Get From"){
                GetMessages(json.date)
            }else if(json.msg == "Update"){
                SetUpdateMessage(json.data);
            }

        }catch(e){
            console.log('callback error',e);
        }
    }

    function FailedHeartbeat(){
        SetIsConnected(false);
    }

    function MyFetch(dest : string,opts? : RequestInit){
        return fetch(prefix + dest,{
            ...opts,
            headers : {
                ...opts?.headers,
                'Authorization' : `Bearer ${context.Token}`
            },
            

        })
    }

    async function StopGeneration(){
        if(!SocketRef.current || !LockTokenRef.current) return;
        console.log("ending");
        const sockmsg = {
            msg : "end",
            token : LockTokenRef.current
        }

        SocketRef.current.send(JSON.stringify(sockmsg));
    }
    function ScrollToBottom(){
        if(!ScrollContainerRef.current || !ScrollAtBottom) return;
        const scrollallowed = localStorage.getItem('autoscroll');
        if(!scrollallowed) return;

        //only scroll to bottom if the scroll was already at the bottom
        //ScrollContainerRef.current.scrollTop = ScrollContainerRef.current.scrollHeight;
        ScrollContainerRef.current.lastElementChild?.scrollIntoView({behavior : 'smooth',block : 'end'})
    }
    /**Function for the website */
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
    async function GetConfig(){
        const res = await MyFetch('/config');
        if(res.status != 200) return;

        const config : Config[] = await res.json();
               
        //SetSelectedConfig(prev=>!prev ? config[0]:prev)
        const newconf = [...config];
        let oldconfigstring = localStorage.getItem('configuration');
        const oldconfig : Config[] = oldconfigstring ? JSON.parse(oldconfigstring) : [];
        
        for(let i = 0;i < newconf.length;i++){
            const aname = newconf[i].name;
            const obj = oldconfig.find((elem)=>elem.name == aname);
            if(!obj) continue;
            //iterate over the options, and add it if its there
            const opts = newconf[i].options
            for(let j = 0;j< opts.length;j++){
                const o = opts[j];
                const ex = obj.options.find((itm)=>itm.name == o.name);
                if(!ex) continue;
                o.value = ex.value;
                o.default = ex.default
            }
        }
        localStorage.setItem('configuration',JSON.stringify(newconf));
        SetConfigs(newconf);

        const configname = localStorage.getItem('config');
        const selectedconf = newconf.find((itm)=>itm.name == configname)

        if(configname && selectedconf){
            SetSelectedConfig(selectedconf)
        }else{
            config.length && SetSelectedConfig(config[0])
        }
        
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
            console.log(conf);
    
            return conf;
        })
    }

    function Disconnect(){
        if(ErrorTimeRef.current != undefined) clearTimeout(ErrorTimeRef.current);
        ErrorTimeRef.current = undefined;

    }
    //a blocking message ?
    async function Send(){

    }

    function AddListener(cat : string, func : Function){
        
    }
    function RemoveListener(cat : string,func : Function){

    }

    function ChangeSelectedConfig(e : React.ChangeEvent<HTMLSelectElement>){
        const val = e.currentTarget.value;
        const itm = Configs.find((j)=>j.name == val);
        if(!itm) return;
        SetSelectedConfig(itm);
        localStorage.setItem('config',itm.name)
    }
    function SetInputValue(e : React.ChangeEvent<HTMLInputElement>){
        const atype = e.currentTarget.type;
        const aname = e.currentTarget.name;
        console.log(aname,atype,aname == atype,e.currentTarget.checked,e.currentTarget.value);
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

    async function GetProjects(){
        const raw = await MyFetch('/project',{
            method : "GET"
        })
        if(raw.status != 200) return console.log(raw.status,raw.statusText);
        const json = await raw.json();

        SetProjects(json);
    }
    async function SafeDeleteProjectFile(afile : MyFile){
        if(!SelectedProject) return;

        const res = confirm(`Are You Sure You Want To Delete : ${afile.name}?`)
        
        if(!res) return;

        DeleteProjectFile(afile,SelectedProject);
    }
    async function DeleteProjectFile(afile : MyFile,proj : Project){
        const raw = await MyFetch('/project/file/delete',{
            method : 'POST',
            body : JSON.stringify({id : proj.id,name : afile.name}),
            headers : {
                'Content-Type' : 'application/json'
            }

        })
        if(raw.status != 200) return;
        GetProjectFiles();
    }
    async function GetProjectFiles(){
        
        if(!SelectedProject) return;

        const files = await MyFetch(`/project/files/${SelectedProject.id}`,{
            method : 'GET'
        })

        if(files.status != 200) return console.log('usnces',files);
        
        const json = await files.json();

        SetProjectFiles(json);
    }

    async function GetChats(){
        const raw = await MyFetch('/chats',{
            method : "GET"
        })
        if(raw.status != 200) return console.log(raw.status,raw.statusText);
        const json : Chat[] = await raw.json();
        let sorted = json.sort((a,b)=>Number(b.date) - Number(a.date));
        SetChats(sorted);
    }

    function ShowChat(chat : Chat){
        SetChatMessages([]);
        SetSelectedChat(prev=>{
            if(!prev) return chat;

            if(prev.id == chat.id) return undefined;

            return chat;
        })
    }
    function ShowProject(project : Project){
        SetSelectedProjectFile(undefined);
        SetProjectFiles([]);
        SetSelectedProject(prev=>!prev || prev.id != project.id ? project : undefined);
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

        GetChats();
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
    }
    async function SubmitProjectFiles(){
        if(!SelectedProject) return;
        
        const fd = new FormData();
        
        //fd.append('project',SelectedProject.id.toString())
        
        UploadedProjectFiles.forEach((itm,i)=>{
            fd.append(`file-${i}`,UploadedProjectFiles[i]);
        })

        const res = MyFetch(`/project/upload/${SelectedProject.id}`,{
            body : fd,

            method : 'POST'
        })
        await res;

        SetUploadedProjectFiles([])
        GetProjectFiles();
    }
    function ProjectFileChanged(e : React.ChangeEvent<HTMLInputElement>){
        if(!e.target.files) return;
        const vals = Array.from(e.target.files);
        e.target.value = '';

        SetUploadedProjectFiles(prev=>[...prev,...vals]);
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
        const yes = confirm(`Are you sure you want to delete this message?`);
        if(!yes) return;

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
        //Deleted messages seem to cause a problem with the backend
        //GetMessages();
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

    function AddFiles(e: React.ChangeEvent<HTMLInputElement>){
        console.log("changin");
        if(!e.target.files) return console.log("no files");
        const vals = Array.from(e.target.files);
        console.log("update");
        SetUploadedFiles(prev=>[...prev,...vals]);
        e.target.value = '';
    }

    //sends silently
    async function PushMessage(){
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

        if(res.status != 200) return console.log("no message sent");

        const json = await res.json();
        //update the message with files
        if(counter > 0){
            const imgs = await MyFetch(`/message/${json.id}`,{
                body : fd,
                method : 'POST'
            })
            if(imgs.status != 200) return console.log("failed at post");
        }
        
        await GetMessages(date);
    }

    async function AlertWebsocket(){
        //Lock chat and await message
        if(!SocketRef.current || !SelectedChat) return console.log("no socket");
        //need to include the config options
        
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
    async function SendMessage(){
        await PushMessage();
        await AlertWebsocket();
    }
    function DropedImage(e : React.DragEvent<HTMLDivElement>){
        e.preventDefault();
        const files  = e.dataTransfer.files;
        SetUploadedFiles(prev=>[...prev,...files]);
    }
    function createFileFromText(text : string, filename = 'file', mimeType = 'text/plain') {
        const blob = new Blob([text], { type: mimeType });
        const file = new File([blob], filename, { type: mimeType, lastModified: new Date().getTime() });
        return file;
    }
    function OnPaste(e : React.ClipboardEvent<HTMLDivElement>){
        e.preventDefault();
        const items = e.clipboardData.items;
        const arr : File[] = [];

        for (let i = 0; i < items.length; i++) {
            if(items[i].kind == 'string'){
                items[i].getAsString(data=>{
                    if(!TextInputRef.current) return;
                    TextInputRef.current.textContent += data;
                });
            }else{
                const afile = items[i].getAsFile();
                afile && arr.push(afile);
            }
        }
        SetUploadedFiles(prev=>[...prev,...arr]);
    }
    
    async function GetProjectFileData(id : number,name : string){
        //id is the project id

        const res = await MyFetch('/project/file',{
            method : 'POST',
            headers : {
                'Content-Type' : 'application/json'
            },
            body : JSON.stringify({
                id : id,
                name : name

            })
        })
        return res;
        
    }
    async function ReplayChat(msg : ChatMessage){
        if(!TextInputRef.current) return;

        TextInputRef.current.textContent = msg.msg.text;
        const arr : File[] = [];
        
        for(let i = 0;i< msg.files.length;i++){
            const itm = msg.files[i];
            const res = await MyFetch(`/file/${msg.msg.chat}/${itm.id}`)
            const blob = await res.blob();
            const file = new File([blob], `file-${i}`, { type: blob.type });
            arr.push(file);
        }

        SetUploadedFiles(prev=>[...prev,...arr]);
    }

    async function UpdateChatMessage(msg : ChatMessage,role? : string,text? : string){
        //chat id, role, text
        const res = await MyFetch('/message/update',{
            method : 'POST',
            headers : {
                'Content-Type' : 'application/json'
            },
            body : JSON.stringify({
                id : msg.msg.id,
                role : role,
                text : text

            })
        })
        if(res.status == 200){
            //pull new messages
            GetMessages(msg.msg.date);
        }
    }

    return {
        Send,
        AddListener,
        RemoveListener,
        SelectedConfig,
        SetSelectedConfig,
        Configs,
        IsConnected,
        ChangeSelectedConfig,
        UpdateOption,
        SetSelectValue,
        SetInputValue,
        Projects,
        Chats,
        SelectedChat,
        ShowChat,
        ScrollContainerRef,
        ChatMessages,
        MyFetch,
        ShowProject,
        SelectedProject,
        ProjectFiles,
        SubmitNewChat,
        SubmitNewProject,
        SubmitProjectFiles,
        ProjectFileChanged,
        UploadedProjectFiles,
        SetUploadedProjectFiles,
        MemoUploadFiles,
        MemoProjectUploadFiles,
        FileInputRef,
        ProjectUploadRef,
        DeleteProject,
        RemoveMessage,
        DeleteChat,
        HandleScroll,
        AddFiles,
        UploadedFiles,
        SetUploadedFiles,
        SelectedProjectFile,
        SetSelectedProjectFile,
        StopGeneration,
        TextInputRef,
        DropedImage,
        OnPaste,
        createFileFromText,
        GetProjectFileData,
        PushMessage,
        SendMessage,
        AlertWebsocket,
        ReplayChat,
        UpdateChatMessage,
        WaitingResponse,
        UpdateMessage,
        SafeDeleteProjectFile
    }
}